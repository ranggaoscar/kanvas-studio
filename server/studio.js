// Server lokal Kanvas Studio: menyajikan UI + API file ruang kerja. Cukup buka http://localhost:4848.
//
// Model keamanan (sengaja sederhana):
// - Hanya mendengar 127.0.0.1 → tidak bisa diakses dari jaringan.
// - Ancaman nyata = situs web jahat di browser yang mencoba memanggil server ini. Dicegah dengan:
//   Host wajib localhost (cegah DNS rebinding), Origin asing ditolak, dan header X-Kanvas wajib
//   (header khusus memicu CORS preflight yang tidak kita jawab → browser tidak akan mengirimnya lintas situs).
// - Program lain yang berjalan sebagai user yang sama tidak dibatasi: mereka toh bisa membaca/menulis file user
//   langsung. Karena itu API hanya bisa menyentuh ruang kerja (~/KanvasStudio): tidak ada API untuk menulis ke
//   folder bebas, dan "buka folder" hanya membuka ruang kerja. Simpan ke folder lain dilakukan oleh browser lewat
//   dialog pilih-folder bawaan (user yang memilih), atau oleh agent lewat MCP.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { realpathSync, lstatSync, writeFileSync } from 'node:fs'
import { buildAdminReportDoc } from './presentation.js'
import { writeXlsx, readTabularFile, sheetsFromDoc } from './xlsx.js'
import { inspectPdf, extractHybridKanvas, embedHybridKanvas, quickEditPdf } from './pdf-bridge.js'
import { RUANG, jalur, tulisAtomik, statusAgen, siapkanRuang, bacaDesain } from './ruang.js'
import { envMinimal } from './render.js'
import { listBrands, getBrand } from './brand.js'
import { listAssets } from './assets.js'
import { listCommunity } from './community.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
const STATIS = { '/': 'app/index.html', '/render.html': 'app/render.html', '/dist/kanvas.js': 'app/dist/kanvas.js', '/dist/logo.svg': 'app/dist/logo.svg', '/dist/ikon.json': 'app/dist/ikon.json', '/dist/template.json': 'app/dist/template.json' }
// versi build yang dimuat saat server mulai; halaman membandingkannya supaya server lama ketahuan (minta restart)
const BUILD = (() => { try { return readFileSync(join(AKAR, 'app/dist/build.txt'), 'utf8').trim() } catch { return 'dev' } })()
export const PORT_DEFAULT = Number(process.env.KANVAS_PORT) || 4848
const MAX_DOCUMENT_BYTES = 64 * 1024 * 1024
// JSON/base64 transport is larger than the original file. Keep the decoded
// limit at 64 MiB while allowing one such request through the local API.
const MAX_DOCUMENT_BODY = 120 * 1024 * 1024 // base64 PDF plus editable JSON

function kirim(res, kode, isi, tipe = 'application/json') {
  res.writeHead(kode, { 'Content-Type': tipe, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' })
  res.end(typeof isi === 'string' || Buffer.isBuffer(isi) ? isi : JSON.stringify(isi))
}
const bacaBody = (req, batas = 20 * 1024 * 1024) => new Promise((ok, gagal) => {
  let n = 0; const bag = []
  req.on('data', c => { n += c.length; if (n > batas) { gagal(new Error('too large')); req.destroy() } else bag.push(c) })
  req.on('end', () => { try { ok(JSON.parse(Buffer.concat(bag).toString('utf8') || '{}')) } catch (e) { gagal(e) } })
})

// buka URL di browser default / folder di file manager
export function bukaDiOS(target) {
  const url = /^https?:/.test(target)
  const [cmd, args] = process.platform === 'win32'
    ? (url ? ['rundll32.exe', ['url.dll,FileProtocolHandler', target]] : ['explorer.exe', [target]])   // explorer.exe gagal diam-diam pada URL ber-? dan &
    : process.platform === 'darwin' ? ['open', [target]] : ['xdg-open', [target]]
  try { spawn(cmd, args, { env: envMinimal(), detached: true, stdio: 'ignore', windowsHide: false }).unref(); return true } catch { return false }
}

// salin desain + gambar yang dipakainya ke folder tujuan (dipakai agent lewat MCP, bukan lewat HTTP)
export function salinKeFolder(file, tujuan) {
  const doc = bacaDesain(file), dest = resolve(String(tujuan || ''))
  mkdirSync(dest, { recursive: true })
  const nama = file.split(/[\\/]/).pop(), keluar = join(dest, nama)
  tulisAtomik(keluar, JSON.stringify(doc, null, 1))
  let n = 0
  for (const src of gambarLokal(doc)) {
    try {
      const asal = jalur(src), ke = resolve(dest, src)
      if (!ke.startsWith(dest + sep) || !existsSync(asal)) continue
      mkdirSync(dirname(ke), { recursive: true }); copyFileSync(asal, ke); n++
    } catch {}
  }
  return { ok: true, path: keluar, gambar: n }
}
// gambar lokal yang dipakai desain: hanya file gambar, tanpa file/folder tersembunyi
export const gambarLokal = doc => [...new Set((doc.artboards || []).flatMap(ab => (ab.elemen || [])
  .filter(e => e.tipe === 'gambar' && e.src && !/^(data:|https?:)/.test(e.src)).map(e => String(e.src))))]
  .filter(s => /\.(png|jpe?g|webp|gif|svg)$/i.test(s) && !s.split(/[\\/]/).some(x => x.startsWith('.')))

// All document actions accept workspace-relative paths; refuse symlinks/junctions and overwrites.
function bridgePath(file, ext) {
  if(typeof file!=='string' || file.length>500 || !ext.test(file) || file.split(/[\\/]/).some(s=>s.startsWith('.') || s.includes(':'))) throw Error('Invalid document path or extension')
  const path=jalur(file), root=realpathSync(RUANG)
  for(let p=path;p!==RUANG;p=dirname(p)) {
    const st=lstatSync(p,{throwIfNoEntry:false}); if(st?.isSymbolicLink()) throw Error('Linked paths not permitted')
    if(st){const real=realpathSync(p);if(!real.startsWith(root+sep))throw Error('Outside workspace')}
  }
  return path
}
function uploadBytes(upload, ext) {
  const { name, base64 } = upload
  if (typeof name !== 'string' || !ext.test(name) || /[\\/]/.test(name)) throw Error('Format file tidak didukung.')
  if (typeof base64 !== 'string' || !base64.length || base64.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 ||
      base64.length % 4 || /[^A-Za-z0-9+/=]/.test(base64)) throw Error('File kosong, rusak, atau terlalu besar.')
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length > MAX_DOCUMENT_BYTES || bytes.toString('base64') !== base64) throw Error('Data file tidak valid.')
  return bytes
}

function extractSheets(hybrid, info) {
  if (hybrid) {
    try { return { sheets: sheetsFromDoc(hybrid), needsVisionFallback: false } } catch (e) {
      if (!e.message.startsWith('No editable table')) throw e
    }
  }
  const rows = [], missing = []
  for (const [i, p] of (hybrid?.artboards || info.pages).entries()) {
    const lines = hybrid
      ? (p.elemen || []).filter(e => e.tipe === 'teks' && !e.sembunyi).sort((a, b) => a.y - b.y || a.x - b.x).map(e => e.teks)
      : p.text.split(/\r?\n/)
    const nonempty = lines.map(s => String(s ?? '').trim()).filter(Boolean)
    if (!nonempty.length) missing.push(i + 1)
    for (const line of nonempty) rows.push([i + 1, line])
  }
  const sheets = rows.length ? [{ name: 'Teks PDF', headers: ['Halaman', 'Teks'], rows }] : []
  const message = [
    info?.textAvailable === false ? 'Pembaca teks PDF tidak tersedia pada host ini.' : '',
    rows.length ? 'Teks disusun per halaman. Periksa kembali susunan kolom sebelum memakai data.' : '',
    !hybrid && rows.length ? 'Ekstraksi membaca hingga 1.000 karakter per halaman.' : '',
    missing.length ? 'Halaman yang perlu diperiksa dengan bantuan agent: ' + missing.join(', ') + '.' : ''
  ].filter(Boolean).join(' ')
  return { sheets, needsVisionFallback: !!missing.length, message }
}

export async function documentAction(a) {
  const upload = a.upload
  const read = ext => {
    if (upload) return uploadBytes(upload, ext)
    const path = bridgePath(a.file, ext), st = statSync(path)
    if (!st.isFile() || st.size > MAX_DOCUMENT_BYTES) throw Error('Invalid input or size limit exceeded')
    return readFileSync(path)
  }
  const sourceName = upload?.name || a.file || 'table'
  const stem = String(sourceName).replace(/(?:\.kanvas)?\.[^.]+$/i, '')
  function save(file, ext, bytes) {
    const p = bridgePath(file, ext)
    mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, bytes, { flag: 'wx' })
    return file
  }
  function design(doc, tag) {
    const name = upload ? (stem.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 80) || 'Dokumen') + '-' + randomUUID().slice(0, 8) : stem
    const encoded = JSON.stringify(doc)
    if (upload && Buffer.byteLength(JSON.stringify({ text: JSON.stringify(doc, null, 1) })) > 20 * 1024 * 1024 - 1024) throw Error('Dokumen ini terlalu besar untuk disimpan kembali di editor. Pisahkan beberapa halaman terlebih dahulu.')
    return { file: save(a.output || name + '-' + tag + '.kanvas.json', /\.kanvas\.json$/i, encoded), artboards: doc.artboards.length }
  }
  function report(sheets) {
    const pages = sheets.filter(s => s.headers.length).map(s => ({
      type: 'data-table', heading: s.name, columns: s.headers.slice(0, 8), rows: s.rows.slice(0, 20).map(r => r.slice(0, 8)),
      footnote: upload ? 'Draft menampilkan ' + Math.min(20, s.rows.length) + ' dari ' + (s.rowCount ?? s.rows.length) + ' baris dan ' + Math.min(8, s.headers.length) + ' dari ' + s.headers.length + ' kolom.'
        : 'Draft preview: ' + s.rows.length + ' of ' + s.rowCount + ' rows; first 8 columns.'
    }))
    if (!pages.length) throw Error('Tidak ada data untuk membuat laporan.')
    const brand = upload && a.brand ? getBrand(a.brand) : null
    const draft = design(buildAdminReportDoc({ judul: upload ? stem : 'Imported report', pages, brand }).doc, 'report')
    if (upload && sheets.some(s => (s.rowCount ?? s.rows.length) > 20 || s.headers.length > 8)) {
      draft.message = 'Draft dan unduhan laporan memuat hingga 20 baris dan 8 kolom per lembar sumber.'
    }
    return draft
  }
  if (a.action === 'import_xlsx') {
    const { sheets } = readTabularFile(read(/\.(csv|xlsx)$/i), { format: extname(sourceName).slice(1).toLowerCase(), limit: 20 })
    const result = a.create_report ? report(sheets) : {}
    const short = v => typeof v === 'string' ? v.slice(0, 80) : v
    return { ok: true, ...result, sheetCount: sheets.length, sheets: sheets.slice(0, 8).map(s => ({
      name: s.name.slice(0, 60), headers: s.headers.slice(0, 12).map(short), columnCount: s.headers.length,
      rows: s.rows.slice(0, 4).map(r => r.slice(0, 12).map(short)), rowCount: s.rowCount
    })) }
  }
  if (a.action === 'export_pdf' && upload) {
    if (!Array.isArray(a.doc?.artboards)) throw Error('Dokumen tidak valid.')
    const bytes = embedHybridKanvas(read(/\.pdf$/i), a.doc)
    if (bytes.length > MAX_DOCUMENT_BYTES) throw Error('PDF melebihi 64 MiB. Kurangi resolusi ekspor.')
    return { ok: true, base64: bytes.toString('base64') }
  }
  if (a.action === 'export_xlsx') {
    const sheets = a.sheets ?? sheetsFromDoc(a.doc ?? JSON.parse(read(/\.kanvas\.json$/i)))
    const bytes = writeXlsx({ sheets })
    if (a.returnBytes) return { ok: true, base64: bytes.toString('base64') }
    return { ok: true, file: save(a.output || stem + '.xlsx', /\.xlsx$/i, bytes), sheetCount: sheets.length }
  }
  if (a.action === 'import_pdf') {
    if (a.mode && !['extract', 'quick_edit'].includes(a.mode)) throw Error('Invalid PDF mode')
    const bytes = read(/\.pdf$/i), hybrid = extractHybridKanvas(bytes)
    if (hybrid && (!upload || a.mode !== 'extract')) return { ok: true, isHybrid: true, needsVisionFallback: false, ...design(hybrid, 'editable') }
    const overlay = async () => {
      const doc = await quickEditPdf(bytes)
      if (upload) { doc.judul = stem; doc.meta = { pdfQuickEdit: true } }
      return design(doc, 'overlay')
    }
    if (a.mode === 'quick_edit') return { ok: true, isHybrid: false, ...await overlay() }
    const info = hybrid ? null : await inspectPdf(bytes)
    if (!upload) return { ok: true, ...info }
    const extracted = extractSheets(hybrid, info)
    if (!a.create_report) return { ok: true, isHybrid: !!hybrid, ...extracted }
    const draft = extracted.sheets.length ? report(extracted.sheets) : hybrid ? design(hybrid, 'editable') : await overlay()
    return { ok: true, ...draft, needsVisionFallback: extracted.needsVisionFallback, message: [draft.message, extracted.message].filter(Boolean).join(' ') }
  }
  throw Error('Unknown document action')
}
const API = {
  'POST document': documentAction,
  'GET info': () => ({ ok: true, ruangKerja: RUANG, build: BUILD, versi: JSON.parse(readFileSync(join(AKAR, 'package.json'), 'utf8')).version }),
  'GET agen': () => statusAgen(),
  'GET brands': () => ({ ok: true, ...listBrands() }),
  'GET assets': q => ({ ok: true, ...listAssets({ category: q.get('category') || undefined, tag: q.get('tag') || undefined, search: q.get('search') || undefined }) }),
  'GET community': () => ({ ok: true, ...listCommunity() }),
  'GET list': q => {
    const dir = q.get('dir') || '', abs = dir ? jalur(dir) : RUANG
    if (!existsSync(abs)) return { ok: true, entries: [] }
    const entries = readdirSync(abs, { withFileTypes: true }).filter(d => !d.name.startsWith('.'))
      .map(d => ({ name: d.name, path: relative(RUANG, join(abs, d.name)).split(sep).join('/'), isDirectory: d.isDirectory() }))
    return { ok: true, entries }
  },
  'GET read': q => { const p = jalur(q.get('path')); if (!existsSync(p)) return { ok: false, error: 'not-found', message: 'Not found: ' + q.get('path') }; return { ok: true, text: readFileSync(p, 'utf8'), mtimeMs: statSync(p).mtimeMs } },
  'GET stat': q => { const p = jalur(q.get('path')); if (!existsSync(p)) return { ok: true, exists: false }; const s = statSync(p); return { ok: true, exists: true, isDirectory: s.isDirectory(), size: s.size, mtimeMs: s.mtimeMs } },
  'GET dataurl': q => {
    const p = jalur(q.get('path')), m = MIME[extname(p).toLowerCase()]
    if (!m || !m.startsWith('image/') || !existsSync(p)) return { ok: false, error: 'not-found', message: 'Image not found' }
    return { ok: true, url: `data:${m};base64,` + readFileSync(p).toString('base64') }
  },
  'POST write': b => { if (typeof b.text !== 'string') return { ok: false, error: 'invalid', message: 'text is required' }; tulisAtomik(jalur(b.path), b.text); return { ok: true } },
  'POST reveal': () => ({ ok: bukaDiOS(RUANG) })   // hanya ruang kerja
}

export function mulaiStudio({ port = PORT_DEFAULT, diam = false } = {}) {
  siapkanRuang()
  const server = createServer(async (req, res) => {
    try {
      const host = String(req.headers.host || '')
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return kirim(res, 403, { ok: false, error: 'host' })
      const url = new URL(req.url, 'http://' + host)
      if (url.pathname.startsWith('/api/')) {
        const asal = req.headers.origin
        if (asal && asal !== 'http://' + host) return kirim(res, 403, { ok: false, error: 'origin' })
        if (req.headers['x-kanvas'] !== '1') return kirim(res, 403, { ok: false, error: 'header' })
        const f = API[req.method + ' ' + url.pathname.slice(5)]
        if (!f) return kirim(res, 404, { ok: false, error: 'not-found' })
        return kirim(res, 200, await f(req.method === 'POST' ? await bacaBody(req, url.pathname === '/api/document' ? MAX_DOCUMENT_BODY : undefined) : url.searchParams))
      }
      const file = STATIS[url.pathname]
      if (req.method !== 'GET' || !file) return kirim(res, 404, 'Not found', 'text/plain')
      return kirim(res, 200, readFileSync(join(AKAR, file)), MIME[extname(file)])
    } catch (e) {
      kirim(res, 200, { ok: false, error: e.kode || 'io-error', message: e.message })
    }
  })
  return new Promise((ok, gagal) => {
    server.once('error', gagal)
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}`
      if (!diam) console.error(`Kanvas Studio is running → ${url}   (workspace: ${RUANG})`)
      ok({ server, url })
    })
  })
}

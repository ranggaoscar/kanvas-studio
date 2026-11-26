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
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { realpathSync, lstatSync, writeFileSync } from 'node:fs'
import { buildAdminReportDoc } from './presentation.js'
import { writeXlsx, readTabularFile, sheetsFromDoc } from './xlsx.js'
import { inspectPdf, extractHybridKanvas, quickEditPdf } from './pdf-bridge.js'
import { RUANG, jalur, tulisAtomik, statusAgen, siapkanRuang, bacaDesain } from './ruang.js'
import { envMinimal } from './render.js'
import { listBrands } from './brand.js'
import { listAssets } from './assets.js'
import { listCommunity } from './community.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
const STATIS = { '/': 'app/index.html', '/render.html': 'app/render.html', '/dist/kanvas.js': 'app/dist/kanvas.js', '/dist/logo.svg': 'app/dist/logo.svg', '/dist/ikon.json': 'app/dist/ikon.json', '/dist/template.json': 'app/dist/template.json' }
// versi build yang dimuat saat server mulai; halaman membandingkannya supaya server lama ketahuan (minta restart)
const BUILD = (() => { try { return readFileSync(join(AKAR, 'app/dist/build.txt'), 'utf8').trim() } catch { return 'dev' } })()
export const PORT_DEFAULT = Number(process.env.KANVAS_PORT) || 4848

function kirim(res, kode, isi, tipe = 'application/json') {
  res.writeHead(kode, { 'Content-Type': tipe, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' })
  res.end(typeof isi === 'string' || Buffer.isBuffer(isi) ? isi : JSON.stringify(isi))
}
const bacaBody = req => new Promise((ok, gagal) => {
  let n = 0; const bag = []
  req.on('data', c => { n += c.length; if (n > 20 * 1024 * 1024) { gagal(new Error('too large')); req.destroy() } else bag.push(c) })
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
export async function documentAction(a) {
  const read=(ext)=>{const path=bridgePath(a.file,ext),st=statSync(path);if(!st.isFile()||st.size>64*1024*1024)throw Error('Invalid input or size limit exceeded');return readFileSync(path)}
  const stem=String(a.file||'table').replace(/(?:\.kanvas)?\.[^.]+$/,'')
  function save(file,ext,bytes){const p=bridgePath(file,ext);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,bytes,{flag:'wx'});return file}
  const design=(d,tag)=>({file:save(a.output||`${stem}-${tag}.kanvas.json`,/\.kanvas\.json$/i,JSON.stringify(d)),artboards:d.artboards.length})
  if(a.action==='import_xlsx'){
    const data=readTabularFile(read(/\.(csv|xlsx)$/i),{format:extname(a.file).slice(1).toLowerCase(),limit:20}); const {sheets}=data
    let report={};if(a.create_report){const pages=sheets.filter(s=>s.headers.length).map(s=>({type:'data-table',heading:s.name,columns:s.headers.slice(0,8),rows:s.rows.map(r=>r.slice(0,8)),footnote:`Draft preview: ${s.rows.length} of ${s.rowCount} rows; first 8 columns.`}));report=design(buildAdminReportDoc({judul:'Imported report',pages}).doc,'report')}
    const short=v=>typeof v==='string'?v.slice(0,80):v
    return {ok:true,...report,sheetCount:sheets.length,sheets:sheets.slice(0,8).map(s=>({name:s.name.slice(0,60),headers:s.headers.slice(0,12).map(short),columnCount:s.headers.length,rows:s.rows.slice(0,4).map(r=>r.slice(0,12).map(short)),rowCount:s.rowCount}))}
  }
  if(a.action==='export_xlsx'){const sheets=a.sheets??sheetsFromDoc(JSON.parse(read(/\.kanvas\.json$/i)));return {ok:true,file:save(a.output||stem+'.xlsx',/\.xlsx$/i,writeXlsx({sheets})),sheetCount:sheets.length}}
  if(a.action==='import_pdf'){if(a.mode&&!['extract','quick_edit'].includes(a.mode))throw Error('Invalid PDF mode');const b=read(/\.pdf$/i),hybrid=extractHybridKanvas(b);if(hybrid)return {ok:true,isHybrid:true,needsVisionFallback:false,...design(hybrid,'editable')};if(a.mode==='quick_edit')return {ok:true,isHybrid:false,...design(await quickEditPdf(b),'overlay')};return {ok:true,...await inspectPdf(b)}}
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
        return kirim(res, 200, await f(req.method === 'POST' ? await bacaBody(req) : url.searchParams))
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

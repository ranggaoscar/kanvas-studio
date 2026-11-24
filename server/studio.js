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
import { RUANG, jalur, tulisAtomik, statusAgen, siapkanRuang, bacaDesain } from './ruang.js'
import { envMinimal } from './render.js'

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

const API = {
  'GET info': () => ({ ok: true, ruangKerja: RUANG, build: BUILD, versi: JSON.parse(readFileSync(join(AKAR, 'package.json'), 'utf8')).version }),
  'GET agen': () => statusAgen(),
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

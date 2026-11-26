// Ruang kerja: folder tempat semua desain tinggal. Default ~/KanvasStudio, bisa diganti lewat KANVAS_HOME.
import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync, renameSync, copyFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')

// Ruang kerja: KANVAS_HOME → folder panel Kanvas di Hermes Desktop (kalau pluginnya terpasang atau lewat mcp.json
// Hermes, supaya agent & panel selalu melihat file yang sama tanpa perlu config) → ~/KanvasStudio.
export const FOLDER_HERMES = process.platform === 'win32' ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Hermes', 'plugin-files', 'data', 'kanvas-studio')
  : process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support', 'Hermes', 'plugin-files', 'data', 'kanvas-studio')
  : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Hermes', 'plugin-files', 'data', 'kanvas-studio')
export const RUANG = resolve(process.env.KANVAS_HOME || (process.env.KANVAS_HERMES === '1' || existsSync(FOLDER_HERMES) ? FOLDER_HERMES : join(homedir(), 'KanvasStudio')))
export const DIR_SISTEM = join(RUANG, '.kanvas')

export function siapkanRuang() {
  mkdirSync(DIR_SISTEM, { recursive: true })
  // di mode Hermes Desktop, salin data ikon & template ke folder data plugin agar pemilih ikon & galeri selalu siap lintas OS
  if (RUANG === resolve(FOLDER_HERMES)) {
    for (const f of ['ikon.json', 'template.json']) {
      try {
        const asal = join(AKAR, 'app/dist', f), tujuan = join(RUANG, f)
        if (existsSync(asal) && (!existsSync(tujuan) || statSync(tujuan).size !== statSync(asal).size || statSync(tujuan).mtimeMs < statSync(asal).mtimeMs)) {
          copyFileSync(asal, tujuan)
        }
      } catch {}
    }
  }
  const contoh = join(RUANG, 'welcome.kanvas.json')
  if (!existsSync(contoh) && !existsSync(join(DIR_SISTEM, 'sudah-contoh'))) {
    writeFileSync(contoh, JSON.stringify(DESAIN_CONTOH, null, 1))
    writeFileSync(join(DIR_SISTEM, 'sudah-contoh'), '1')
  }
  return RUANG
}

// path relatif di dalam ruang kerja → path absolut; menolak apa pun yang keluar dari ruang kerja
export function jalur(rel) {
  const r = String(rel ?? '')
  if (!r || isAbsolute(r) || /^[a-z]:/i.test(r) || r.split(/[\\/]/).includes('..') || r.includes('\0')) throw kesalahan('invalid-path', 'Path must be relative inside the workspace: ' + r)
  const abs = resolve(RUANG, r)
  if (abs !== RUANG && !abs.startsWith(RUANG + sep)) throw kesalahan('outside-folder', 'Outside the workspace: ' + r)
  return abs
}
export const kesalahan = (error, message) => Object.assign(new Error(message), { kode: error })

export const isSecretFile = rel => String(rel ?? '').split(/[\\/]/).some(seg => seg.toLowerCase() === '_llm.json')

export function bacaDesain(file) {
  if (isSecretFile(file)) throw kesalahan('forbidden', 'Access to _llm.json is restricted.')
  const p = jalur(file)
  if (!existsSync(p)) throw kesalahan('not-found', 'Design not found: ' + file)
  return JSON.parse(readFileSync(p, 'utf8'))
}
// tulis atomik: file sementara lalu rename → UI tidak pernah membaca setengah file
let _tmpSeq = 0
export function tulisAtomik(p, isi) {
  mkdirSync(dirname(p), { recursive: true })
  const tmp = `${p}.${process.pid}.${++_tmpSeq}.tmp`
  writeFileSync(tmp, isi); renameSync(tmp, p)
}
export function tulisDesain(file, doc) {
  if (isSecretFile(file)) throw kesalahan('forbidden', 'Access to _llm.json is restricted.')
  tulisAtomik(jalur(file), JSON.stringify(doc, null, 1))
}

// sinyal "agent sedang bekerja" untuk bar agent di UI
const AGEN = () => join(RUANG, '_agen.json')   // di akar ruang kerja (folder ber-titik bisa ditolak panel Hermes)
export function tandaiAgen(alat, file) { try { writeFileSync(AGEN(), JSON.stringify({ waktu: Date.now(), alat, file })) } catch {} }
export function statusAgen() {
  try { const a = JSON.parse(readFileSync(AGEN(), 'utf8')); return { sibuk: Date.now() - a.waktu < 9000, alat: a.alat, file: a.file, waktu: a.waktu } } catch { return { sibuk: false } }
}
export function aktif() { try { return JSON.parse(readFileSync(join(RUANG, '_aktif.json'), 'utf8')) } catch { return null } }
export const mtime = p => { try { return statSync(p).mtimeMs } catch { return 0 } }

const C = '#F3F0E9', N = '#101634', K = '#FF4D3D'
const DESAIN_CONTOH = {
  versi: 1, judul: 'Welcome to Kanvas Studio',
  artboards: [{
    id: 'a1', nama: 'Welcome', x: 0, y: 0, w: 1920, h: 1080, bg: { warna: ['#161C42', '#0B0E24'], sudut: 150 },
    elemen: [
      { id: 'bg1', tipe: 'elips', x: 1240, y: -420, w: 1100, h: 1100, fill: C, opacity: 0.04 },
      { id: 'm1', tipe: 'path', x: 140, y: 150, w: 150, h: 150, vb: [64, 64], d: 'M15 0H49A15 15 0 0 1 64 15V49A15 15 0 0 1 49 64H15A15 15 0 0 1 0 49V15A15 15 0 0 1 15 0Z', fill: C },
      { id: 'm2', tipe: 'path', x: 140, y: 150, w: 150, h: 150, vb: [64, 64], d: 'M20.25 19.25V44.75M30.5 32L45 17.5', garis: { tebal: 20, warna: N } },
      { id: 'm3', tipe: 'path', x: 140, y: 150, w: 150, h: 150, vb: [64, 64], d: 'M30.5 32L45 46.5', garis: { tebal: 20, warna: K } },
      { id: 't1', tipe: 'teks', x: 140, y: 370, w: 1300, teks: 'Design anything.\nYour agent draws it.', font: 'Plus Jakarta Sans', ukuran: 100, tebal: 800, warna: C, lh: 1.02, spasi: -3 },
      { id: 't2', tipe: 'teks', x: 140, y: 640, w: 1000, teks: 'Connect Claude Code, Codex or Hermes over MCP and ask for "an A4 poster for our spring sale". You watch every step here and can edit anything yourself.', font: 'Plus Jakarta Sans', ukuran: 32, tebal: 400, warna: C, lh: 1.5, opacity: 0.85 },
      { id: 'k1', tipe: 'kotak', x: 140, y: 880, w: 360, h: 72, radius: 36, fill: { warna: ['#FF4D3D', '#FFA23C'], sudut: 135 } },
      { id: 't3', tipe: 'teks', x: 140, y: 896, w: 360, teks: 'npx kanvas-studio mcp', font: 'Inter', ukuran: 26, tebal: 800, warna: N, rata: 'tengah', lh: 1.5 },
      { id: 'p1', tipe: 'path', x: 1260, y: 260, w: 520, h: 520, vb: [100, 100], d: 'M50 4L61 38H96L68 59L79 93L50 72L21 93L32 59L4 38H39Z', fill: { warna: ['#FF4D3D', '#FFD166'], sudut: 160 }, rotasi: 10, bayangan: true }
    ]
  }]
}

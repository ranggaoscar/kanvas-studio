// =============================================================
// Kanvas Studio — plugin desain untuk Hermes Desktop (pemakaian pribadi di PC ini)
// Presentasi, pitch deck, poster (A4/A2/bebas). Agent Hermes bisa ikut mendesain:
// desain = file .kanvas.json di folder desain; agent menulis file itu, kanvas ikut berubah.
// Format file & aturan untuk agent: skill "kanvas-studio" (SKILL.md).
// =============================================================
import { Button, PANES_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA, PALETTE_AREA, STATUSBAR_AREAS, KEYBINDS_AREA, host, useValue } from '@hermes/plugin-sdk'
import { createElement as h, Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'

const ROUTE = '/kanvas'
const PRESET = [
  { nama: 'Slide 16:9', w: 1920, h: 1080 }, { nama: 'Slide 4:3', w: 1600, h: 1200 },
  { nama: 'A4 Portrait', w: 794, h: 1123 }, { nama: 'A4 Landscape', w: 1123, h: 794 },
  { nama: 'A3 Portrait', w: 1123, h: 1587 }, { nama: 'A2 Portrait', w: 1587, h: 2245 }, { nama: 'A1 Portrait', w: 2245, h: 3179 },
  { nama: 'IG Feed 4:5', w: 1080, h: 1350 }, { nama: 'IG Square', w: 1080, h: 1080 }, { nama: 'IG Story 9:16', w: 1080, h: 1920 }
]
const FONTS = ['Plus Jakarta Sans', 'Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Bebas Neue', 'Segoe UI', 'Arial', 'Georgia', 'Impact']
const GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&family=Inter:wght@400;600;800&family=Poppins:wght@300;400;600;800&family=Montserrat:wght@400;700;900&family=Playfair+Display:wght@400;700;900&family=Bebas+Neue&display=swap'
const SWATCH = ['#FF4D3D', '#FF9A3C', '#FFD166', '#06D6A0', '#118AB2', '#7B61FF', '#EF476F', '#101634', '#FFFFFF', '#F2F4F9']
const GRADIEN = [
  { warna: ['#FF4D3D', '#FFA23C'], sudut: 135 }, { warna: ['#7B61FF', '#EF476F'], sudut: 135 },
  { warna: ['#06D6A0', '#118AB2'], sudut: 135 }, { warna: ['#FFD166', '#FF4D3D'], sudut: 160 },
  { warna: ['#101634', '#3A2F7A'], sudut: 160 }, { warna: ['#FDFBFB', '#EBEDEE'], sudut: 180 }
]
const AKSEN = 'linear-gradient(135deg,#ff4d3d,#ff9a3c)'

/* =============== 1. STORE (satu untuk semua tampilan) =============== */
const S = {}
function resetStore() {
  Object.assign(S, {
    ctx: null, folder: null, files: [], file: null, doc: null, ab: null, sel: [], edit: null,
    zoom: 0.4, pan: { x: 60, y: 60 }, tool: 'pilih', undo: [], redo: [], lastSnap: 0,
    dirty: false, saving: false, lastMtime: 0, status: '', fase: 'muat', pesan: '',
    img: {}, menu: null, modal: null, present: null, guides: [], ikuti: true, skala: 2, panelKiri: false, panelKanan: true,
    tema: 'terang', documentBusy: false, robot: true, bot: null, sorot: new Set(), propAb: false, film: true, fokus: false,
    chatConfig: null, chatConfigLoaded: false, chatBusy: false, chatDrawerOpen: false, chatDrawerMin: false,
    chatLog: [], chatHistory: [], chatAbort: null, chatDraft: '', chatAttachments: []
  })
}
resetStore()
let ver = 0
const subs = new Set()
const emit = () => { if (S.doc) { sinkronKomponen(S.doc); terapkanTata(S.doc) } ver++; subs.forEach(f => f()) }
const useStore = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => ver)

const uid = p => (p || 'e') + Math.random().toString(36).slice(2, 8)
const clone = o => JSON.parse(JSON.stringify(o))
const abById = id => S.doc?.artboards.find(a => a.id === id) || null
const abAktif = () => abById(S.ab) || S.doc?.artboards[0] || null
function cariEl(id) {
  for (const ab of S.doc?.artboards || []) { const i = ab.elemen.findIndex(e => e.id === id); if (i >= 0) return { ab, el: ab.elemen[i], i } }
  return null
}
const terpilih = () => S.sel.map(cariEl).filter(Boolean)
// A lock on a group also protects every descendant. Layer-panel selection and
// the lock toggle remain available so a user can unlock a protected subtree.
function terkunci(ab, el) {
  const seen = new Set()
  for (let x = el; x; ) {
    if (x.kunci === true) return true
    if (!x.id || seen.has(x.id)) break
    seen.add(x.id)
    x = x.induk ? ab.elemen.find(p => p.id === x.induk) : null
  }
  return false
}
function bolehUbah(items = terpilih()) {
  if (!items?.length || !items.some(({ ab, el }) => terkunci(ab, el))) return true
  host.notify?.({ kind: 'info', message: 'Unlock the selected layer before editing it.' })
  return false
}

// perubahan + undo. gabung=true → ketikan beruntun digabung jadi satu langkah undo
function snap() { if (S.doc) { S.undo.push(JSON.stringify(S.doc)); if (S.undo.length > 60) S.undo.shift(); S.redo = [] } }
function ubah(fn, gabung) {
  if (!S.doc) return
  const now = Date.now()
  if (!gabung || now - S.lastSnap > 900) snap()
  S.lastSnap = now
  fn(S.doc)
  if (S.undo.length && S.doc.artboards.some(ab => ab.elemen.some(e => e.salinan))) catatTimpaan(S.doc, JSON.parse(S.undo.at(-1)))
  tandaiUbah()
}
function tandaiUbah() { S.dirty = true; jadwalSimpan(); emit() }
function undo() { if (!S.undo.length) return; S.redo.push(JSON.stringify(S.doc)); S.doc = JSON.parse(S.undo.pop()); bersihSel(); tandaiUbah() }
function redo() { if (!S.redo.length) return; S.undo.push(JSON.stringify(S.doc)); S.doc = JSON.parse(S.redo.pop()); bersihSel(); tandaiUbah() }
function bersihSel() { S.sel = S.sel.filter(id => cariEl(id)); if (!abById(S.ab)) S.ab = S.doc?.artboards[0]?.id || null }

/* =============== 2. WARNA, TEKS, GAMBAR =============== */
const isGrad = f => !!f && typeof f === 'object' && Array.isArray(f.warna)
const fillCss = f => !f ? 'transparent' : isGrad(f) ? `linear-gradient(${f.sudut ?? 135}deg, ${f.warna.join(', ')})` : f
const warnaUtama = f => isGrad(f) ? f.warna[0] : (f || '#000000')

let _mctx = null
const mctx = () => _mctx || (_mctx = document.createElement('canvas').getContext('2d'))
// nama font aman (huruf, angka, spasi) — dipakai di CSS font & URL Google Fonts
const namaFont = f => String(f || 'Plus Jakarta Sans').replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Plus Jakarta Sans'
const fontStr = el => `${el.miring ? 'italic ' : ''}${el.tebal || 400} ${el.ukuran || 32}px "${namaFont(el.font)}", sans-serif`
// Font apa pun dari Google Fonts dimuat otomatis saat pertama dipakai. Font sistem tidak diunduh.
const FONT_SISTEM = new Set(['Segoe UI', 'Arial', 'Georgia', 'Impact', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Helvetica', 'system-ui', 'sans-serif', 'serif', 'monospace'])
const FONT_POPULER = ['Plus Jakarta Sans', 'Inter', 'Poppins', 'Montserrat', 'DM Sans', 'Manrope', 'Outfit', 'Sora', 'Space Grotesk', 'Urbanist', 'Lexend', 'Figtree', 'Nunito', 'Rubik', 'Work Sans', 'Raleway', 'Lato', 'Open Sans', 'Roboto', 'Barlow', 'Archivo', 'Syne', 'Unbounded', 'Bricolage Grotesque', 'Instrument Sans', 'Playfair Display', 'DM Serif Display', 'Fraunces', 'Instrument Serif', 'Cormorant Garamond', 'Libre Baskerville', 'Lora', 'Merriweather', 'Bebas Neue', 'Anton', 'Oswald', 'Archivo Black', 'Abril Fatface', 'Righteous', 'Pacifico', 'Caveat', 'Dancing Script', 'Permanent Marker', 'Space Mono', 'JetBrains Mono', 'IBM Plex Mono', 'Segoe UI', 'Arial', 'Georgia', 'Impact']
const FONT = {}   // "Nama|tebal|miring" → 'muat' | 'ok' | 'gagal'
function muatFont(font, tebal = 400, miring = false) {
  const nama = namaFont(font), kunci = `${nama}|${tebal}|${miring ? 1 : 0}`
  if (FONT_SISTEM.has(nama) || FONT[kunci] === 'ok' || FONT[kunci] === 'gagal') return Promise.resolve(FONT[kunci] || 'ok')
  if (FONT[kunci]?.then) return FONT[kunci]
  const fam = nama.replace(/ /g, '+'), w = Math.round(Math.min(900, Math.max(100, Number(tebal) || 400)) / 100) * 100
  // batas 8 detik: jaringan lambat / offline tidak boleh membuat render menunggu selamanya
  const coba = url => new Promise(ok => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; const t = setTimeout(() => ok(false), 8000); l.onload = () => { clearTimeout(t); ok(true) }; l.onerror = () => { clearTimeout(t); l.remove(); ok(false) }; document.head.append(l) })
  FONT[kunci] = (async () => {
    // ketebalan persis dulu; kalau keluarga itu tidak punya ketebalan tsb, ambil versi standarnya
    const ada = await coba(`https://fonts.googleapis.com/css2?family=${fam}:ital,wght@${miring ? 1 : 0},${w}&display=swap`) || await coba(`https://fonts.googleapis.com/css2?family=${fam}&display=swap`)
    if (ada) try { await Promise.race([document.fonts.load(`${miring ? 'italic ' : ''}${w} 32px "${nama}"`), new Promise(r => setTimeout(r, 8000))]) } catch {}
    FONT[kunci] = ada && document.fonts.check(`${miring ? 'italic ' : ''}${w} 32px "${nama}"`) ? 'ok' : 'gagal'
    emit(); return FONT[kunci]
  })()
  return FONT[kunci]
}
const fontGagal = el => FONT[`${namaFont(el.font)}|${Math.round(Math.min(900, Math.max(100, Number(el.tebal) || 400)) / 100) * 100}|${el.miring ? 1 : 0}`] === 'gagal'
async function muatFontDoc(doc) {
  const semua = doc.artboards.flatMap(ab => ab.elemen.filter(e => e.tipe === 'teks'))
  await Promise.all(semua.map(e => muatFont(e.font, e.tebal, e.miring)))
}
function layoutTeks(el) {
  if (el.font && !FONT_SISTEM.has(namaFont(el.font))) muatFont(el.font, el.tebal, el.miring)
  const c = mctx(); c.font = fontStr(el)
  const sp = el.spasi || 0, W = el.w || 400
  const lebar = s => c.measureText(s).width + sp * Math.max(0, s.length - 1)
  const isi = el.kapital ? String(el.teks ?? '').toUpperCase() : String(el.teks ?? '')
  const lines = []
  for (const par of isi.split('\n')) {
    let line = ''
    for (const w of par.split(/(\s+)/)) {
      const t = line + w
      if (lebar(t.trimEnd()) > W && line.trim()) { lines.push(line.trimEnd()); line = w.trimStart() } else line = t
    }
    lines.push(line.trimEnd())
  }
  const lh = (el.ukuran || 32) * (el.lh || 1.2)
  return { lines, lh, h: Math.max(lh, lines.length * lh) }
}
const tinggi = el => el.tipe === 'teks' ? layoutTeks(el).h : (el.h || 100)
// path: data SVG `d` di ruang koordinat `vb` [lebar, tinggi] (default = ukuran elemen), diregangkan ke w×h.
// Tebal garis dalam px elemen; ujung "bulat" | "datar" | "kotak".
function skalaPath(el) {
  const w = el.w || 100, hh = el.h || 100, vb = Array.isArray(el.vb) && el.vb[0] > 0 && el.vb[1] > 0 ? el.vb : [w, hh]
  return { w, h: hh, vw: vb[0], vh: vb[1], sx: w / vb[0], sy: hh / vb[1] }
}
const CAP = { bulat: 'round', datar: 'butt', kotak: 'square' }
const gradSvg = f => { const a = (f.sudut ?? 135) * Math.PI / 180, dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2; return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy } }

/* <pena> — disalin otomatis dari server/pena.js oleh scripts/build.js, jangan diedit di sini */
// Path dari titik (alat Pena). Sumber tunggal: scripts/build.js menyalinnya ke desktop/plugin.js.
// Titik: { x, y, ix?, iy?, ox?, oy? } — (ix,iy) pegangan masuk, (ox,oy) pegangan keluar, koordinat mutlak.
// Segmen dengan pegangan → kurva bezier kubik, tanpa pegangan → garis lurus.

const bulat = n => Math.round(n * 100) / 100

function dariTitik(titik, tutup) {
  if (!titik?.length) return ''
  const seg = (a, b) => (a.ox != null || b.ix != null)
    ? `C${bulat(a.ox ?? a.x)} ${bulat(a.oy ?? a.y)} ${bulat(b.ix ?? b.x)} ${bulat(b.iy ?? b.y)} ${bulat(b.x)} ${bulat(b.y)}`
    : `L${bulat(b.x)} ${bulat(b.y)}`
  let d = `M${bulat(titik[0].x)} ${bulat(titik[0].y)}`
  for (let i = 1; i < titik.length; i++) d += seg(titik[i - 1], titik[i])
  if (tutup && titik.length > 2) d += seg(titik.at(-1), titik[0]) + 'Z'
  return d
}

function kotakTitik(titik) {
  const xs = [], ys = []
  for (const t of titik) { xs.push(t.x); ys.push(t.y); if (t.ix != null) { xs.push(t.ix); ys.push(t.iy) } if (t.ox != null) { xs.push(t.ox); ys.push(t.oy) } }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

// titik (koordinat artboard) → bidang elemen path: x/y/w/h, vb, titik relatif terhadap kotak, d
function bidangDariTitik(titikAb, tutup) {
  const k = kotakTitik(titikAb), w = Math.max(1, k.x1 - k.x0), h = Math.max(1, k.y1 - k.y0)
  const geser = t => { const r = { x: bulat(t.x - k.x0), y: bulat(t.y - k.y0) }; if (t.ix != null) { r.ix = bulat(t.ix - k.x0); r.iy = bulat(t.iy - k.y0) } if (t.ox != null) { r.ox = bulat(t.ox - k.x0); r.oy = bulat(t.oy - k.y0) } return r }
  const titik = titikAb.map(geser)
  return { x: bulat(k.x0), y: bulat(k.y0), w: bulat(w), h: bulat(h), vb: [bulat(w), bulat(h)], titik, tutup: !!tutup, d: dariTitik(titik, tutup) }
}

// titik elemen (relatif, satuan vb) → koordinat artboard (memperhitungkan ukuran elemen yang sudah diubah)
function titikKeAb(el) {
  const vb = Array.isArray(el.vb) ? el.vb : [el.w || 1, el.h || 1], sx = (el.w || vb[0]) / vb[0], sy = (el.h || vb[1]) / vb[1]
  const ubah = (x, y) => [(el.x || 0) + x * sx, (el.y || 0) + y * sy]
  return (el.titik || []).map(t => {
    const [x, y] = ubah(t.x, t.y), r = { x, y }
    if (t.ix != null) [r.ix, r.iy] = ubah(t.ix, t.iy)
    if (t.ox != null) [r.ox, r.oy] = ubah(t.ox, t.oy)
    return r
  })
}
/* </pena> */

/* <komponen> — disalin otomatis dari server/komponen.js oleh scripts/build.js, jangan diedit di sini */
// Komponen & instance (sumber tunggal: file ini; scripts/build.js menyalinnya ke desktop/plugin.js).
// Tanpa import & tanpa DOM, supaya bisa dipakai server (operasi agent) dan kanvas (browser).
//
// Master  = elemen grup dengan `komponen: true` (+ `nama`). Isinya elemen biasa (induk = master).
// Instance = elemen grup dengan `salinan: "<id master>"`. Anak-anaknya DIBUAT dari master setiap sinkron:
//   id anak = "<id instance>.<id elemen master>", sehingga stabil.
//   `timpa`: { "<id elemen master>": { teks, warna, fill, … } } = bagian yang diubah khusus di instance ini.
//   `timpa["@"]` = timpaan untuk grup instance itu sendiri (mis. fill, w, lebar).
// Master berubah → semua instance ikut, kecuali bagian yang ditimpa.

const KUNCI_TIMPA = ['teks', 'warna', 'fill', 'garis', 'ikon', 'd', 'src', 'sembunyi', 'font', 'ukuran', 'tebal', 'opacity', 'radius', 'w', 'h', 'lebar', 'tinggi', 'rata', 'kapital', 'miring']
const KUNCI_AKAR = ['tata', 'fill', 'radius', 'garis', 'bayangan', 'opacity', 'lebar', 'tinggi', 'w', 'h', 'nama']
const salinObj = o => JSON.parse(JSON.stringify(o))
const PEMISAH = '.'

// id elemen master yang menjadi sumber anak instance: "<instance>.<master-el>" → "<master-el>"
function kunciAnak(instId, anakId) { return String(anakId).startsWith(instId + PEMISAH) ? String(anakId).slice(instId.length + 1) : null }

// keturunan "asli" sebuah grup: anak hasil instance lain di dalamnya dilewati (dibuat ulang oleh instance itu)
function keturunanAsli(els, id) {
  const out = [], jalan = x => { for (const c of els) if (c.induk === x) { out.push(c); if (!c.salinan) jalan(c.id) } }
  jalan(id); return out
}

function sinkronKomponen(doc) {
  for (let putaran = 0; putaran < 4; putaran++) {   // instance di dalam master → beberapa putaran
    let berubah = false
    const master = new Map()
    for (const ab of doc.artboards || []) for (const e of ab.elemen) if (e.komponen && e.tipe === 'grup') master.set(e.id, { ab, el: e })
    for (const ab of doc.artboards || []) {
      for (const inst of ab.elemen.filter(e => e.salinan)) {
        const m = master.get(inst.salinan)
        if (!m || m.el === inst) { delete inst.salinan; continue }   // master hilang → instance jadi grup biasa
        const timpa = inst.timpa || {}
        // grup instance: gaya dari master, posisi & induk milik sendiri, timpaan "@" menang
        const akar = { ...Object.fromEntries(KUNCI_AKAR.filter(k => m.el[k] !== undefined).map(k => [k, salinObj(m.el[k])])), ...(timpa['@'] || {}) }
        for (const k of KUNCI_AKAR) { if (akar[k] === undefined) delete inst[k]; else if (JSON.stringify(inst[k]) !== JSON.stringify(akar[k])) { inst[k] = akar[k]; berubah = true } }
        inst.tipe = 'grup'; delete inst.komponen
        const dx = (inst.x || 0) - (m.el.x || 0), dy = (inst.y || 0) - (m.el.y || 0)
        const baru = keturunanAsli(m.ab.elemen, m.el.id).map(s => {
          const c = salinObj(s)
          c.id = inst.id + PEMISAH + s.id
          c.induk = s.induk === m.el.id ? inst.id : inst.id + PEMISAH + s.induk
          c.x = (s.x || 0) + dx; c.y = (s.y || 0) + dy
          delete c.komponen
          Object.assign(c, timpa[s.id] || {})
          return c
        })
        // anak lama instance (hasil sinkron sebelumnya)
        const lama = new Map(), jalan = x => { for (const c of ab.elemen) if (c.induk === x && c.id.startsWith(inst.id + PEMISAH)) { lama.set(c.id, c); jalan(c.id) } }
        jalan(inst.id)
        const isi = list => JSON.stringify(list.map(({ x, y, w, h, ...r }) => r))
        if (lama.size === baru.length && isi([...lama.values()]) === isi(baru)) continue   // tidak ada yang berubah
        // posisi/ukuran hasil tata letak sebelumnya dipertahankan (hindari kedip), lalu tata letak menghitung ulang
        for (const c of baru) { const p = lama.get(c.id); if (p) { c.x = p.x; c.y = p.y; if (c.lebar === 'isi' || c.lebar === 'peluk') c.w = p.w; if (c.tinggi === 'isi' || c.tinggi === 'peluk') c.h = p.h } }
        const sisa = ab.elemen.filter(e => !lama.has(e.id))
        sisa.splice(sisa.indexOf(inst) + 1, 0, ...baru)
        ab.elemen = sisa
        berubah = true
      }
    }
    if (!berubah) break
  }
  return doc
}

// perubahan pada anak instance → disimpan sebagai timpaan di instance (bukan di elemen yang dibuat ulang)
function catatTimpaan(doc, sebelum) {
  const lama = new Map()
  for (const ab of sebelum.artboards || []) for (const e of ab.elemen) lama.set(e.id, e)
  const byId = new Map()
  for (const ab of doc.artboards || []) for (const e of ab.elemen) byId.set(e.id, e)
  for (const ab of doc.artboards || []) for (const e of ab.elemen) {
    if (!e.induk || !e.id.includes(PEMISAH)) continue
    // cari instance pemilik: id terpanjang yang merupakan awalan "<inst>."
    let inst = null
    for (let i = e.id.lastIndexOf(PEMISAH); i > 0; i = e.id.lastIndexOf(PEMISAH, i - 1)) { const c = byId.get(e.id.slice(0, i)); if (c?.salinan) { inst = c; break } }
    if (!inst) continue
    const k = kunciAnak(inst.id, e.id), sblm = lama.get(e.id)
    if (!k || !sblm) continue
    for (const kunci of KUNCI_TIMPA) {
      if (JSON.stringify(e[kunci]) === JSON.stringify(sblm[kunci])) continue
      if ((kunci === 'w' || kunci === 'h') && (e.lebar || e.tinggi)) continue   // ukuran hasil auto-layout, bukan timpaan
      inst.timpa ||= {}; inst.timpa[k] ||= {}
      if (e[kunci] === undefined) delete inst.timpa[k][kunci]; else inst.timpa[k][kunci] = salinObj(e[kunci])
    }
  }
  return doc
}

// lepas instance jadi grup biasa: anak-anaknya diberi id baru yang bebas
function lepasInstance(doc, instId, buatId) {
  for (const ab of doc.artboards || []) {
    const inst = ab.elemen.find(e => e.id === instId); if (!inst?.salinan) continue
    const peta = new Map()
    for (const e of ab.elemen) if (e.id.startsWith(instId + PEMISAH)) peta.set(e.id, buatId())
    for (const e of ab.elemen) {
      if (peta.has(e.id)) e.id = peta.get(e.id)
      if (peta.has(e.induk)) e.induk = peta.get(e.induk)
    }
    delete inst.salinan; delete inst.timpa
  }
  return doc
}
/* </komponen> */

/* ---------- GRUP & AUTO-LAYOUT ----------
   Grup = elemen `tipe: "grup"` (bingkai: bisa punya fill, radius, garis, bayangan). Anggotanya elemen biasa dengan
   `induk: "<id grup>"`; struktur tetap datar di `ab.elemen` (urutan: grup lalu seluruh keturunannya, berurutan).
   Grup dengan `tata` mengatur posisi anggotanya otomatis (seperti flexbox / auto-layout Figma):
     tata: { arah: "baris" | "kolom", jarak: 16, padding: 24 | [atas, kanan, bawah, kiri],
             rata: "awal" | "tengah" | "akhir" | "regang"   (sumbu silang),
             sebar: "awal" | "tengah" | "akhir" | "antara"  (sumbu utama) }
   Ukuran grup: `lebar` / `tinggi` = "tetap" (pakai w/h) atau "peluk" (menyesuaikan isi).
   Ukuran anggota di dalam grup ber-tata: `lebar` / `tinggi` = "isi" untuk memenuhi ruang grup.
   Hasil tata letak ditulis ke x/y/w/h anggota (di memori), jadi semua penggambar tinggal memakai x/y/w/h biasa. */
const isGrup = e => e?.tipe === 'grup'
function padding4(p) {
  if (Array.isArray(p)) { const [a = 0, b = a, c = a, d = b] = p.map(Number); return [a, b, c, d] }
  const n = Number(p) || 0; return [n, n, n, n]
}
// urutkan elemen artboard supaya setiap grup langsung diikuti keturunannya (urutan relatif tetap)
function urutPohon(els) {
  const ada = new Map(els.map(e => [e.id, e])), anak = new Map(), akar = []
  for (const e of els) {
    if (e.induk && isGrup(ada.get(e.induk)) && e.induk !== e.id) { if (!anak.has(e.induk)) anak.set(e.induk, []); anak.get(e.induk).push(e) }
    else { if (e.induk) delete e.induk; akar.push(e) }
  }
  const out = [], lewat = new Set()
  const tulis = e => { if (lewat.has(e.id)) return; lewat.add(e.id); out.push(e); for (const c of anak.get(e.id) || []) tulis(c) }
  akar.forEach(tulis)
  for (const e of els) if (!lewat.has(e.id)) { delete e.induk; out.push(e) }   // siklus induk → jadikan akar
  return out
}
function anakDari(ab) {
  const m = new Map()
  for (const e of ab.elemen) if (e.induk) { if (!m.has(e.induk)) m.set(e.induk, []); m.get(e.induk).push(e) }
  return m
}
function keturunan(ab, id, m = anakDari(ab)) {
  const out = [], jalan = x => { for (const c of m.get(x) || []) { out.push(c); jalan(c.id) } }
  jalan(id); return out
}
function lebarAlami(el) {
  const c = mctx(); c.font = fontStr(el); const sp = el.spasi || 0
  const isi = el.kapital ? String(el.teks ?? '').toUpperCase() : String(el.teks ?? '')
  return Math.ceil(Math.max(1, ...isi.split('\n').map(s => c.measureText(s).width + sp * Math.max(0, s.length - 1)))) + 1
}
function terapkanTata(doc) {
  for (const ab of doc?.artboards || []) {
    for (const e of ab.elemen) if (e.tipe === 'teks' && e.lebar === 'peluk') e.w = lebarAlami(e)
    if (!ab.elemen.some(isGrup)) continue
    const m = anakDari(ab), byId = new Map(ab.elemen.map(e => [e.id, e]))
    const geserTurunan = (g, dx, dy) => { if (!dx && !dy) return; for (const d of keturunan(ab, g.id, m)) { d.x = (d.x || 0) + dx; d.y = (d.y || 0) + dy } }
    const ukuranEl = e => ({ w: e.w || 100, h: tinggi(e) })
    const paksa = new Set()   // 'id:w' / 'id:h' — ukuran yang ditentukan induk (isi / regang), jangan dipeluk ulang
    // grup ber-tata tanpa ukuran eksplisit = memeluk isinya (seperti Figma)
    // grup ber-tata tanpa ukuran eksplisit = memeluk isinya; dicatat sebagai "peluk" karena w/h hasil hitungan ikut tersimpan
    for (const g of ab.elemen) if (isGrup(g) && g.tata) { if (g.lebar == null && g.w == null) g.lebar = 'peluk'; if (g.tinggi == null && g.h == null) g.tinggi = 'peluk' }
    const peluk = (g, k) => g[k === 'w' ? 'lebar' : 'tinggi'] === 'peluk'
    // 1) dari dalam ke luar: hitung ukuran "peluk"
    const ukur = g => {
      const kids = (m.get(g.id) || []).filter(c => !c.sembunyi)
      kids.filter(isGrup).forEach(ukur)
      if (!g.tata || !kids.length) return
      const [pt, pr, pb, pl] = padding4(g.tata.padding), baris = g.tata.arah === 'baris', jarak = Number(g.tata.jarak) || 0
      const uk = kids.map(ukuranEl)
      const utama = uk.reduce((a, u) => a + (baris ? u.w : u.h), 0) + jarak * (kids.length - 1)
      const silang = Math.max(0, ...uk.map(u => baris ? u.h : u.w))
      if (peluk(g, 'w') && !paksa.has(g.id + ':w')) g.w = Math.round((baris ? utama : silang) + pl + pr)
      if (peluk(g, 'h') && !paksa.has(g.id + ':h')) g.h = Math.round((baris ? silang : utama) + pt + pb)
    }
    // 2) dari luar ke dalam: posisi & ukuran "isi"
    const tempatkan = g => {
      const kids = (m.get(g.id) || []).filter(c => !c.sembunyi)
      if (g.tata && kids.length) {
        const [pt, pr, pb, pl] = padding4(g.tata.padding), baris = g.tata.arah === 'baris', jarak = Number(g.tata.jarak) || 0
        const x0 = (g.x || 0) + pl, y0 = (g.y || 0) + pt, iw = Math.max(0, (g.w || 0) - pl - pr), ih = Math.max(0, (g.h || 0) - pt - pb)
        const dalamUtama = baris ? iw : ih, dalamSilang = baris ? ih : iw, rata = g.tata.rata || 'awal'
        // ukuran silang dulu (lebar teks memengaruhi tinggi teks di tata kolom)
        for (const c of kids) {
          // "regang" meregangkan anggota, kecuali yang jelas minta ukuran sendiri (peluk / tetap)
          const silangSendiri = baris ? c.tinggi : c.lebar
          const isiSilang = silangSendiri === 'isi' || (rata === 'regang' && silangSendiri !== 'peluk' && silangSendiri !== 'tetap')
          if (!isiSilang) continue
          if (baris) { if (c.tipe !== 'teks') { c.h = Math.round(dalamSilang); paksa.add(c.id + ':h') } } else { c.w = Math.round(dalamSilang); paksa.add(c.id + ':w') }
        }
        kids.filter(isGrup).forEach(ukur)   // tinggi grup anak bisa berubah setelah lebarnya dipaksa
        const isiUtama = c => (baris ? c.lebar : c.tinggi) === 'isi'
        const tetap = kids.filter(c => !isiUtama(c)).reduce((a, c) => a + (baris ? (c.w || 100) : tinggi(c)), 0)
        const nIsi = kids.filter(isiUtama).length, sisa = dalamUtama - tetap - jarak * (kids.length - 1)
        for (const c of kids) if (isiUtama(c)) { const v = Math.max(1, Math.round(sisa / nIsi)); if (baris) { c.w = v; paksa.add(c.id + ':w') } else if (c.tipe !== 'teks') { c.h = v; paksa.add(c.id + ':h') } }
        kids.filter(isGrup).forEach(ukur)
        const ukurUtama = c => baris ? (c.w || 100) : tinggi(c), ukurSilang = c => baris ? tinggi(c) : (c.w || 100)
        const total = kids.reduce((a, c) => a + ukurUtama(c), 0) + jarak * (kids.length - 1)
        const sebar = g.tata.sebar || 'awal', longgar = Math.max(0, dalamUtama - total)
        let pos = sebar === 'tengah' ? longgar / 2 : sebar === 'akhir' ? longgar : 0
        const antara = sebar === 'antara' && kids.length > 1 ? jarak + longgar / (kids.length - 1) : jarak
        for (const c of kids) {
          const s = ukurSilang(c), off = rata === 'tengah' ? (dalamSilang - s) / 2 : rata === 'akhir' ? dalamSilang - s : 0
          const nx = Math.round(baris ? x0 + pos : x0 + off), ny = Math.round(baris ? y0 + off : y0 + pos)
          if (isGrup(c) && !c.tata) geserTurunan(c, nx - (c.x || 0), ny - (c.y || 0))
          c.x = nx; c.y = ny
          pos += ukurUtama(c) + antara
        }
      }
      kids.filter(isGrup).forEach(tempatkan)
    }
    // beberapa putaran: lebar dari induk ("isi"/"regang") mengubah pembungkusan teks → tinggi "peluk" ikut berubah
    for (const g of ab.elemen) if (isGrup(g) && !byId.get(g.induk)) for (let i = 0; i < 3; i++) {
      const jejak = () => keturunan(ab, g.id, m).map(e => `${e.x},${e.y},${e.w},${e.h}`).join('|') + `|${g.w},${g.h}`
      const sebelum = jejak(); paksa.clear(); ukur(g); tempatkan(g)
      if (jejak() === sebelum) break
    }
  }
  return doc
}


// tolak URL gambar ke alamat lokal / jaringan privat / metadata cloud saat render headless (cegah SSRF)
function urlGambarAman(src) {
  try {
    const u = new URL(src)
    if (u.protocol !== 'https:' && (window.KANVAS_RENDER || u.protocol !== 'http:')) return false
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h)) return false
    if (h === '::1' || h === '::' || /^(fc|fd|fe80:|::ffff:(127|10|169\.254|192\.168|172\.(1[6-9]|2\d|3[01])))/i.test(h)) return false
    return true
  } catch { return false }
}
// gambar: path relatif di folder desain → data URL (lewat ctx.files), atau data:/https publik
function gambar(src) {
  if (!src) return null
  const c = S.img[src]
  if (c) return c.status === 'ok' ? c : null
  S.img[src] = { status: 'muat' }
  ;(async () => {
    let url = src
    if (/^https?:/i.test(src) && !urlGambarAman(src)) { S.img[src] = { status: 'gagal' }; return emit() }
    if (!/^(data:|https?:)/i.test(src)) {
      const r = S.folder ? await S.ctx.files.readDataUrl(S.folder.id, src) : { ok: false }
      if (!r.ok) { S.img[src] = { status: 'gagal' }; return emit() }
      url = r.url
    }
    const im = new Image(); im.crossOrigin = 'anonymous'; im.src = url
    try { await im.decode(); S.img[src] = { status: 'ok', url, im } } catch { S.img[src] = { status: 'gagal' } }
    emit()
  })()
  return null
}
async function tungguGambar(ab) {
  const srcs = ab.elemen.filter(e => e.tipe === 'gambar' && e.src).map(e => e.src)
  srcs.forEach(gambar)
  for (let i = 0; i < 100 && srcs.some(s => S.img[s]?.status === 'muat'); i++) await new Promise(r => setTimeout(r, 50))
}

/* =============== 3. FILE: folder, buka, simpan, pantau agent =============== */
// Ruang kerja default = folder data milik plugin: selalu ada, tanpa izin, tanpa pilih folder dulu.
// Folder lain (yang diizinkan user) bisa dipilih sebagai ruang kerja, atau jadi tujuan "Simpan ke folder".
const ruangDefault = () => ({ id: 'data', name: 'Kanvas workspace', path: S.ctx.files.dataPath || null, data: true })
const pathFolder = () => S.folder?.path || null
const pathLengkap = file => { const f = pathFolder(); if (!f || !file) return null; const sep = f.includes('/') && !f.includes('\\') ? '/' : '\\'; return f.replace(/[\\/]+$/, '') + sep + file.replace(/[\\/]/g, sep) }
async function siapFolder() {
  const ctx = S.ctx
  if (!ctx.files) { S.fase = 'error'; S.pesan = 'This Hermes version has no file access for plugins yet. Run "hermes update".'; return emit() }
  S.folders = [ruangDefault(), ...(await ctx.files.folders())]
  S.folder = S.folders.find(x => x.id === ctx.storage.get('folderId', 'data')) || S.folders[0]
  await muatDaftar()
  const terakhir = ctx.storage.get('file', null)
  if (terakhir && S.files.includes(terakhir)) await buka(terakhir)
  else { S.fase = 'pilih-file'; emit(); tulisAktif(true) }
}
async function pilihRuang(id) {
  let f = S.folders.find(x => x.id === id)
  if (id === '+') {
    const p = await S.ctx.files.requestFolder(); if (!p.ok || !p.folder) return emit()
    f = p.folder; S.folders = [ruangDefault(), ...(await S.ctx.files.folders())]
  }
  if (!f) return
  if (S.dirty) await simpanSekarang()
  Object.assign(S, { folder: f, file: null, doc: null, files: [] })
  S.ctx.storage.set('folderId', f.id); S.ctx.storage.remove('file')
  await muatDaftar(); S.fase = 'pilih-file'; emit(); tulisAktif(true)
}
// salin desain yang terbuka ke folder pilihan user (file .kanvas.json + gambar teks/svg yang bisa disalin)
async function simpanKeFolder() {
  S.menu = null
  if (!S.doc || !S.file) return
  if (S.dirty) await simpanSekarang()
  if (S.ctx.simpanKe) {   // app lokal: server yang menyalin (termasuk folder gambar/)
    const r = await S.ctx.simpanKe(S.folder.id, S.file)
    if (r?.ok) host.notify({ kind: 'info', message: 'Saved to ' + r.path })
    S.status = r?.ok ? 'Copied to ' + r.path : 'Cancelled or could not save'; return emit()
  }
  const p = await S.ctx.files.requestFolder(); if (!p.ok || !p.folder) return
  const nama = S.file.split(/[\\/]/).pop()
  const r = await S.ctx.files.writeText(p.folder.id, nama, JSON.stringify(S.doc, null, 1))
  const lewat = []
  for (const src of new Set(S.doc.artboards.flatMap(ab => ab.elemen.filter(e => e.tipe === 'gambar' && e.src && !/^(data:|https?:)/.test(e.src)).map(e => e.src)))) {
    const t = /\.svg$/i.test(src) ? await S.ctx.files.readText(S.folder.id, src) : null
    if (t?.ok) { const dir = src.split('/').slice(0, -1).join('/'); if (dir) await S.ctx.files.writeText(p.folder.id, dir + '/.kanvas', ''); await S.ctx.files.writeText(p.folder.id, src, t.text) } else lewat.push(src)
  }
  S.folders = [ruangDefault(), ...(await S.ctx.files.folders())]
  S.status = r.ok ? `Copied to ${p.folder.path} (${nama})` + (lewat.length ? `. Copy ${lewat.length} image(s) manually` : '') : 'Could not save: ' + (r.message || r.error)
  host.notify({ kind: 'info', message: S.status }); emit()
}
async function muatDaftar() {
  const r = await S.ctx.files.list(S.folder.id, '')
  S.files = r.ok ? r.entries.filter(e => !e.isDirectory && /\.kanvas\.json$/i.test(e.name)).map(e => e.path || e.name).sort() : []
}
function normalisasi(d) {
  d.versi = d.versi || 1; d.judul = d.judul || 'Design'; d.artboards = Array.isArray(d.artboards) ? d.artboards : []
  let x = 0
  for (const ab of d.artboards) {
    ab.id = ab.id || uid('a'); ab.nama = ab.nama || 'Artboard'; ab.w = +ab.w || 1920; ab.h = +ab.h || 1080
    if (typeof ab.x !== 'number') ab.x = x; if (typeof ab.y !== 'number') ab.y = 0
    x = Math.max(x, ab.x + ab.w + 160)
    ab.elemen = Array.isArray(ab.elemen) ? ab.elemen : []
    for (const e of ab.elemen) { e.id = e.id || uid(); e.tipe = e.tipe || 'kotak' }
    ab.elemen = urutPohon(ab.elemen)
  }
  sinkronKomponen(d)
  for (const ab of d.artboards) ab.elemen = urutPohon(ab.elemen)
  return d
}
async function buka(path) {
  const r = await S.ctx.files.readText(S.folder.id, path)
  const gagalBuka = pesan => { S.status = pesan; if (!S.doc) S.fase = 'pilih-file'; S.ctx.storage.remove('file'); host.notify({ kind: 'info', message: pesan }); emit() }
  if (!r.ok) return gagalBuka('Could not open ' + path + ': ' + (r.message || r.error))
  let d; try { d = normalisasi(JSON.parse(r.text)) } catch (e) { return gagalBuka('Design file is damaged (' + path + '): ' + e.message) }
  Object.assign(S, { doc: d, file: path, sel: [], patchArea: null, ab: d.artboards[0]?.id || null, undo: [], redo: [], dirty: false, edit: null, fase: 'siap' })
  S.lastMtime = r.mtimeMs || (await S.ctx.files.stat(S.folder.id, path)).mtimeMs || 0
  S.ctx.storage.set('file', path)
  emit(); setTimeout(() => fitSemua(), 30); tulisAktif()
}
let _simpanT = null
function jadwalSimpan() { clearTimeout(_simpanT); _simpanT = setTimeout(simpanSekarang, 600) }
async function simpanSekarang() {
  if (!S.doc || !S.file || !S.folder) return
  S.saving = true; S.status = 'Saving…'; emit()
  const r = await S.ctx.files.writeText(S.folder.id, S.file, JSON.stringify(S.doc, null, 1))
  const st = await S.ctx.files.stat(S.folder.id, S.file)
  S.lastMtime = st.mtimeMs || Date.now(); S.saving = false
  if (r.ok) { S.dirty = false; S.status = 'Saved ✓' } else S.status = 'Could not save: ' + (r.message || r.error)
  emit(); tulisAktif()
}
// catatan untuk agent: ruang kerja mana yang dibuka, file apa, elemen apa yang dipilih.
// Disimpan di folder data plugin (lokasinya tetap) → agent selalu tahu harus menulis ke mana.
let _aktifT = null
function tulisAktif(segera) {
  clearTimeout(_aktifT)
  _aktifT = setTimeout(() => {
    if (!S.folder) return
    const ab = S.file ? abAktif() : null
    const info = {
      ruangKerja: S.folder.data ? 'default' : 'folder-pilihan',
      folder: pathFolder(),   // null = folder yang sama dengan file _aktif.json ini
      file: S.file || null, pathLengkap: S.file ? pathLengkap(S.file) : null,
      artboardAktif: ab ? { id: ab.id, nama: ab.nama, w: ab.w, h: ab.h } : null,
      terpilih: S.file ? terpilih().map(({ el, ab }) => ({ id: el.id, tipe: el.tipe, artboard: ab.id, teks: el.teks ? String(el.teks).slice(0, 80) : undefined })) : [],
      waktu: new Date().toISOString()
    }
    const isi = JSON.stringify(info, null, 1)
    S.ctx.files.writeText('data', '_aktif.json', isi)
    if (!S.folder.data) S.ctx.files.writeText(S.folder.id, '_aktif.json', isi)
  }, segera ? 0 : 700)
}
let _tick = 0, _agenFile = null
// sinyal dari server MCP (_agen.json di ruang kerja): agent sedang bekerja & di desain mana.
// Dipakai di app lokal maupun panel Hermes (selama MCP menulis ke ruang kerja yang sama).
async function cekAgen() {
  const r = await S.ctx.files.readText(S.folder.id, '_agen.json').catch(() => null)
  if (!r?.ok) { if (S.agenSibuk) { S.agenSibuk = false; emit() } return }
  let a; try { a = JSON.parse(r.text) } catch { return }
  const sibuk = Date.now() - (a.waktu || 0) < 9000
  if (sibuk !== !!S.agenSibuk) { S.agenSibuk = sibuk; emit() }
  bukaOtomatisBilaPerlu()
  // agent mengerjakan desain lain → kanvas ikut pindah (sekali per desain, kalau "Ikuti agent" aktif & tak ada editan tertunda)
  if (sibuk && a.file && a.file !== S.file && a.file !== _agenFile && S.ikuti && !S.dirty && !S.saving) {
    _agenFile = a.file
    if (!S.files.includes(a.file)) await muatDaftar()
    if (S.files.includes(a.file)) { await buka(a.file); host.notify({ kind: 'info', message: 'Kanvas Studio: following your agent → ' + a.file }) }
  }
  if (!sibuk) _agenFile = null
}
async function pantau() {
  if (S.documentBusy) return
  if (S.folder) await cekAgen()
  if (S.folder && ++_tick % 3 === 0) {   // file baru dari agent → langsung dibuka (kalau "Ikuti agent" aktif)
    const lama = new Set(S.files); await muatDaftar()
    const baru = S.files.filter(f => !lama.has(f))
    if (baru.length && S.ikuti && !S.dirty && !S.saving) {
      await buka(baru.at(-1))
      host.notify({ kind: 'info', message: 'Kanvas Studio: your agent created ' + baru.at(-1) })
      return
    }
    if (baru.length || S.files.length !== lama.size) emit()
  }
  if (!S.folder || !S.file || S.saving || S.dirty || !S.ctx) return
  const st = await S.ctx.files.stat(S.folder.id, S.file)
  if (!st.ok || !st.exists || !(st.mtimeMs > S.lastMtime + 2)) return
  const r = await S.ctx.files.readText(S.folder.id, S.file)
  if (!r.ok) return
  let d; try { d = normalisasi(JSON.parse(r.text)) } catch { return }   // agent sedang menulis → coba lagi nanti
  if (S.dirty || S.saving) return
  const lamaAb = S.doc?.artboards.length || 0, lamaDoc = S.doc
  snap()                         // perubahan agent bisa di-undo
  S.doc = d; S.lastMtime = st.mtimeMs; bersihSel()
  if (lamaDoc) jalankanBot(bedaDoc(lamaDoc, d))
  for (const k of Object.keys(S.img)) if (S.img[k].status === 'gagal') delete S.img[k]
  S.status = 'Updated by agent · ' + new Date().toLocaleTimeString()
  if (S.ikuti && d.artboards.length > lamaAb) { S.ab = d.artboards.at(-1).id; setTimeout(() => fitAb(abAktif()), 30) }
  emit()
}
/* ---------- robot pekerja: menunjukkan bagian yang diubah agent ---------- */
function bedaDoc(lama, baru) {
  const peta = new Map(), out = []
  lama.artboards.forEach(ab => ab.elemen.forEach(e => peta.set(e.id, JSON.stringify(e))))
  for (const ab of baru.artboards) {
    const abLama = lama.artboards.find(a => a.id === ab.id)
    if (!abLama) out.push({ ab, el: null, jenis: 'artboard' })
    else if (abLama.w !== ab.w || abLama.h !== ab.h || JSON.stringify(abLama.bg) !== JSON.stringify(ab.bg)) out.push({ ab, el: null, jenis: 'latar' })
    for (const e of ab.elemen) {
      const sl = peta.get(e.id)
      if (sl === undefined) out.push({ ab, el: e, jenis: 'tambah' })
      else if (sl !== JSON.stringify(e)) out.push({ ab, el: e, jenis: 'ubah' })
    }
  }
  return out
}
function pesanBot({ ab, el, jenis }) {
  if (!el) return jenis === 'artboard' ? `Setting up ${ab.nama}` : `Styling the ${ab.nama} background`
  const baru = jenis === 'tambah', t = String(el.teks || '').replace(/\s+/g, ' ')
  if (el.tipe === 'teks') return `${baru ? 'Writing' : 'Editing'} “${t.slice(0, 30)}${t.length > 30 ? '…' : ''}”`
  if (el.tipe === 'gambar') return baru ? 'Placing image' : 'Adjusting image'
  return baru ? 'Drawing shape' : 'Adjusting shape'
}
let _botT = null
function jalankanBot(list) {
  if (!list.length) return
  clearTimeout(_botT)
  if (!S.robot) return
  const q = list.length > 16 ? list.filter((_, i) => i % Math.ceil(list.length / 16) === 0) : list
  S.sorot = new Set(list.filter(x => x.el).map(x => x.el.id))
  let i = 0
  const langkah = () => {
    if (i >= q.length) {
      S.bot = { ...S.bot, mode: 'selesai', pesan: `Done · ${list.length} change${list.length > 1 ? 's' : ''}` }; emit()
      _botT = setTimeout(() => { S.bot = null; S.sorot = new Set(); emit() }, 2600); return
    }
    const t = q[i++]
    S.bot = { mode: 'kerja', abId: t.ab.id, elId: t.el?.id || null, pesan: pesanBot(t), n: i, total: q.length }
    emit(); _botT = setTimeout(langkah, q.length > 8 ? 520 : 820)
  }
  langkah()
}
// logo Kanvas Studio: K dari tiga batang; kaki coral = "bar" agent yang sedang bekerja
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" rx="15" fill="#101634"/><rect x="16" y="15" width="8.5" height="34" rx="4.25" fill="#F3F0E9"/><path d="M30.5 32 L45 17.5" stroke="#F3F0E9" stroke-width="8.5" stroke-linecap="round"/><path class="kvl-kaki" d="M30.5 32 L45 46.5" stroke="#FF4D3D" stroke-width="8.5" stroke-linecap="round"/></svg>`
const Logo = ({ className }) => h('i', { className: 'kv-logo ' + (className || ''), dangerouslySetInnerHTML: { __html: LOGO_SVG } })
const KURSOR_SVG = `<svg viewBox="0 0 20 22" width="20" height="22" xmlns="http://www.w3.org/2000/svg"><path d="M2 2 L17 10.5 L10.2 12.2 L6.6 19 Z" fill="#FF4D3D" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`
// apakah chat yang terakhir dapat permintaan dari tombol "Minta agent" sedang bekerja.
// Chat lain (task email, dll.) tidak membuat robot muncul.
const useSibuk = host.state?.busyBySession && host.state?.focusedSessionId && typeof useValue === 'function'
  ? () => {
      const m = useValue(host.state.busyBySession), fokus = useValue(host.state.focusedSessionId)
      // permintaan dikirim ke chat baru yang belum punya id → ambil id-nya saat chat itu mulai bekerja
      if (S.sesiAgent === 'tunggu' && fokus && m?.[fokus]) { S.sesiAgent = fokus; S.ctx.storage.set('sesiAgent', fokus) }
      return !!(S.sesiAgent && m?.[S.sesiAgent]) || !!S.agenSibuk
    }
  : () => { useStore(); return !!S.agenSibuk }
/* ---------- bar agent: kursor + label yang bergerak ke bagian yang sedang dikerjakan ---------- */
const PESAN_MIKIR = ['Reading the canvas…', 'Scanning the layout…', 'Measuring spacing & text…', 'Planning changes…']
const AGEN = { tick: 0 }
// apa yang sedang "disentuh" agent: artboard + (opsional) elemen
function targetAgen(sibuk) {
  const b = S.bot
  if (b && (b.mode === 'kerja' || b.mode === 'selesai')) {
    const ab = abById(b.abId); if (!ab) return null
    const f = b.elId ? cariEl(b.elId) : null
    return { mode: b.mode, ab, el: f && f.ab === ab ? f.el : null }
  }
  if (!sibuk) return null
  const ab = abAktif(); if (!ab) return null
  const kandidat = ab.elemen.filter(e => !e.sembunyi && (e.w || 100) < ab.w * 0.95)
  return { mode: 'mikir', ab, el: kandidat.length ? kandidat[AGEN.tick % kandidat.length] : null }
}
function kotakTarget(t) {
  if (!t.el) return { x: t.ab.x, y: t.ab.y, w: t.ab.w, h: t.ab.h }
  return { x: t.ab.x + t.el.x, y: t.ab.y + t.el.y, w: t.el.w || 100, h: tinggi(t.el) }
}
// lapisan di dalam dunia kanvas (ikut zoom): pindaian artboard + bingkai kerja di elemen
function AgentKerja() {
  const sibuk = useSibuk()
  if (!S.robot || S.present != null) return null
  const t = targetAgen(sibuk); if (!t) return null
  const z = S.zoom, ab = t.ab, k = kotakTarget(t), pad = 6 / z
  const vars = { '--t': 1.5 / z + 'px', '--d': 7 / z + 'px', '--hs': 8 / z + 'px' }
  return h(Fragment, null,
    t.mode !== 'selesai' ? h('div', { className: 'kv-scan kv-scan-' + t.mode, style: { left: ab.x, top: ab.y, width: ab.w, height: ab.h, ...vars } },
      h('div', { className: 'kv-scan-band' }),
      ['nw', 'ne', 'sw', 'se'].map(c => h('i', { key: c, className: 'kv-scan-sudut kv-sd-' + c, style: { width: 28 / z, height: 28 / z, borderWidth: 3 / z } }))) : null,
    t.el ? h('div', { className: 'kv-kerja kv-kerja-' + t.mode, style: { left: k.x - pad, top: k.y - pad, width: k.w + pad * 2, height: k.h + pad * 2, transform: t.el.rotasi ? `rotate(${t.el.rotasi}deg)` : undefined, ...vars } },
      h('div', { className: 'kv-kerja-isi' }),
      ['nw', 'ne', 'sw', 'se'].map(c => h('i', { key: c, className: 'kv-kh kv-h-' + c }))) : null)
}
// lapisan layar (tidak ikut zoom): kursor + label kerja
function AgentKursor() {
  const sibuk = useSibuk()
  useEffect(() => {
    if (!sibuk || S.bot) return
    const id = setInterval(() => { AGEN.tick++; emit() }, 1900)
    return () => clearInterval(id)
  }, [sibuk, !!S.bot])
  if (!S.robot || S.present != null) return null
  const t = targetAgen(sibuk); if (!t) return null
  const b = S.bot, v = ukuranView(), k = kotakTarget(t)
  const pesan = t.mode === 'mikir' ? PESAN_MIKIR[AGEN.tick % PESAN_MIKIR.length] : b.pesan
  // ujung kursor di pojok kanan-bawah bingkai kerja (atau dekat pojok kiri-atas artboard)
  let x = S.pan.x + (t.el ? k.x + k.w : k.x + 24) * S.zoom + 4, y = S.pan.y + (t.el ? k.y + k.h : k.y + 24) * S.zoom + 4
  x = Math.max(8, Math.min(v.w - 24, x)); y = Math.max(8, Math.min(v.h - 140, y))
  const balik = x > v.w - 290   // mepet tepi kanan → label di kiri kursor
  return h('div', { className: 'kv-agen kv-agen-' + t.mode + (balik ? ' kv-agen-balik' : ''), style: { transform: `translate(${x}px, ${y}px)` } },
    h('i', { className: 'kv-agen-kursor', dangerouslySetInnerHTML: { __html: KURSOR_SVG } }),
    h('div', { className: 'kv-agen-bar' },
      h(Logo, { className: 'kv-agen-logo' }),
      h('span', { className: 'kv-agen-teks', key: pesan }, pesan),
      t.mode === 'kerja' && b.total > 1 ? h('b', { className: 'kv-agen-n' }, `${b.n}/${b.total}`) : null,
      t.mode === 'selesai' ? h('b', { className: 'kv-agen-ok' }, '✓') : null,
      t.mode !== 'selesai' ? h('i', { className: 'kv-agen-prog' }, h('i', { style: t.mode === 'kerja' ? { width: Math.round(b.n / b.total * 100) + '%' } : null })) : null))
}

// template bawaan: app lokal → /dist/template.json, Hermes → folder data plugin (disalin install.ps1)
const TPL = { data: null, janji: null }
function muatTemplate() {
  if (TPL.data?.length) return Promise.resolve(TPL.data)
  if (TPL.janji) return TPL.janji
  TPL.janji = (async () => {
    try {
      if (S.ctx.muatTemplate) TPL.data = await S.ctx.muatTemplate()
      else { const r = await S.ctx.files.readText('data', 'template.json'); if (r.ok) TPL.data = JSON.parse(r.text) }
    } catch {}
    TPL.data = (TPL.data || []).map(d => normalisasi(d))
    if (!TPL.data.length) TPL.data = null
    TPL.janji = null; emit(); return TPL.data || []
  })()
  return TPL.janji
}
async function desainDariTemplate(tpl, judul) {
  const d = JSON.parse(JSON.stringify(tpl)); d.judul = judul || tpl.meta?.nama || 'Design'; d.dariTemplate = tpl.meta?.id; delete d.meta
  const nama = (d.judul).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design'
  let path = nama + '.kanvas.json', n = 2
  while (S.files.includes(path)) path = `${nama}-${n++}.kanvas.json`
  const r = await S.ctx.files.writeText(S.folder.id, path, JSON.stringify(d, null, 1))
  if (!r.ok) { S.status = 'Could not create the file: ' + (r.message || r.error); return emit() }
  await muatDaftar(); await buka(path)
}
async function desainBaru(judul, preset) {
  const nama = (judul || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design'
  let path = nama + '.kanvas.json', n = 2
  while (S.files.includes(path)) path = `${nama}-${n++}.kanvas.json`
  const d = { versi: 1, judul: judul || 'Design', artboards: [{ id: uid('a'), nama: preset.nama.startsWith('Slide') ? 'Slide 1' : preset.nama, x: 0, y: 0, w: preset.w, h: preset.h, bg: '#FFFFFF', elemen: [] }] }
  const r = await S.ctx.files.writeText(S.folder.id, path, JSON.stringify(d, null, 1))
  if (!r.ok) { S.status = 'Could not create the file: ' + (r.message || r.error); return emit() }
  await muatDaftar(); await buka(path)
}

/* =============== 4. VIEW: zoom & pan =============== */
const VIEW = { el: null }
function ukuranView() { const r = VIEW.el?.isConnected ? VIEW.el.getBoundingClientRect() : null; return r ? { w: r.width, h: r.height } : { w: 0, h: 0 } }
function fitKotak(x, y, w, h, coba = 0) {
  // area kanvas belum tampil (baru pindah desain) → tunggu sebentar, jangan menghitung zoom dari ukuran 0
  if (!ukuranView().w || !ukuranView().h) { if (coba < 40) setTimeout(() => fitKotak(x, y, w, h, coba + 1), 50); return }
  // sisakan ruang untuk panel melayang yang sedang terbuka
  const v = ukuranView(), m = 40
  const panel = !S.fokus, hasChat = !!aktifChatHost()
  const kiri = panel && S.panelKiri ? 240 : 0, kanan = panel && (S.sel.length || S.propAb) ? 276 : 0
  const atas = panel && hasChat && S.film ? 74 : 0
  const bawah = panel ? (hasChat ? 124 : S.film ? 96 : 0) : 0
  const lw = Math.max(120, v.w - kiri - kanan - m * 2), lh = Math.max(120, v.h - atas - bawah - m * 2)
  S.zoom = Math.max(0.03, Math.min(4, Math.min(lw / w, lh / h)))
  S.pan = { x: kiri + m + (lw - w * S.zoom) / 2 - x * S.zoom, y: atas + m + (lh - h * S.zoom) / 2 - y * S.zoom }
  emit()
}
function fitAb(ab) { if (ab) fitKotak(ab.x, ab.y, ab.w, ab.h) }
function fitSemua() {
  const a = S.doc?.artboards || []; if (!a.length) return
  const x0 = Math.min(...a.map(b => b.x)), y0 = Math.min(...a.map(b => b.y))
  fitKotak(x0, y0, Math.max(...a.map(b => b.x + b.w)) - x0, Math.max(...a.map(b => b.y + b.h)) - y0)
}
function zoomDi(f, cx, cy) {
  const z = Math.max(0.03, Math.min(6, S.zoom * f))
  S.pan = { x: cx - (cx - S.pan.x) * z / S.zoom, y: cy - (cy - S.pan.y) * z / S.zoom }; S.zoom = z; emit()
}

/* =============== 5. AKSI ELEMEN =============== */
function tambahEl(el, ab = abAktif()) {
  if (!ab) return
  ubah(() => ab.elemen.push(el)); S.sel = [el.id]; S.ab = ab.id; S.tool = 'pilih'; emit(); tulisAktif()
}
// elemen terpilih + seluruh keturunannya (grup membawa anggotanya)
function denganTurunan(items = terpilih()) {
  const out = new Map()
  for (const { ab, el } of items) { out.set(el.id, { ab, el }); if (isGrup(el)) for (const d of keturunan(ab, el.id)) out.set(d.id, { ab, el: d }) }
  return [...out.values()]
}
function hapusSel() {
  if (!S.sel.length) return
  const items = denganTurunan()
  if (!bolehUbah(items)) return
  const buang = new Set(items.map(x => x.el.id))
  ubah(d => d.artboards.forEach(ab => { ab.elemen = ab.elemen.filter(e => !buang.has(e.id)) })); S.sel = []; emit()
}
function anakInstSet(ab) {
  const s = new Set()
  for (const e of ab.elemen) if (e.salinan) for (const d of ab.elemen) if (String(d.id).startsWith(e.id + '.')) s.add(d.id)
  return s
}
function klonPohon(asli, dx = 0, dy = 0, abTujuan = null) {
  const peta = new Map(asli.map(e => [e.id, uid(e.salinan ? 'i' : isGrup(e) ? 'g' : 'e')]))
  return asli.map(e => {
    const x = { ...clone(e), id: peta.get(e.id), x: (e.x || 0) + dx, y: (e.y || 0) + dy }
    delete x.komponen
    if (x.induk) {
      if (peta.has(x.induk)) x.induk = peta.get(x.induk)
      else if (!(abTujuan && abTujuan.elemen.some(z => z.id === x.induk))) delete x.induk
    }
    return x
  })
}
function duplikatSel() {
  const baru = [], pilihIds = new Set(S.sel)
  if (!bolehUbah(denganTurunan())) return
  ubah(() => terpilih().forEach(({ ab, el }) => {
    // lewati anak bila induknya juga ikut dipilih
    for (let x = el; x.induk;) { if (pilihIds.has(x.induk)) return; x = cariEl(x.induk)?.el; if (!x) break }
    const anakInst = anakInstSet(ab)
    const pohon = [el, ...(isGrup(el) && !el.salinan ? keturunan(ab, el.id).filter(d => !anakInst.has(d.id)) : [])]
    const salin = klonPohon(pohon, 24, 24, ab)
    const akhir = ab.elemen.indexOf(pohon.at(-1))
    ab.elemen.splice(akhir + 1, 0, ...salin); ab.elemen = urutPohon(ab.elemen); baru.push(salin[0].id)
  }))
  S.sel = baru; emit()
}
// Ctrl+G: bungkus elemen terpilih (satu artboard, induk yang sama) jadi grup; Ctrl+Shift+G: lepas grup
function grupkanSel() {
  const items = terpilih(); if (!items.length) return
  if (!bolehUbah(denganTurunan(items))) return
  const ab = items[0].ab, sama = items.filter(x => x.ab === ab && (x.el.induk || null) === (items[0].el.induk || null))
  if (!sama.length) return
  const kotak = sama.map(({ el }) => [el.x, el.y, el.x + (el.w || 100), el.y + tinggi(el)])
  const x0 = Math.min(...kotak.map(k => k[0])), y0 = Math.min(...kotak.map(k => k[1])), x1 = Math.max(...kotak.map(k => k[2])), y1 = Math.max(...kotak.map(k => k[3]))
  const g = { id: uid('g'), tipe: 'grup', nama: 'Group', x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0), fill: null, ...(items[0].el.induk ? { induk: items[0].el.induk } : {}) }
  ubah(() => {
    const pertama = Math.min(...sama.map(({ el }) => ab.elemen.indexOf(el)))
    ab.elemen.splice(pertama, 0, g)
    for (const { el } of sama) el.induk = g.id
    ab.elemen = urutPohon(ab.elemen)
  })
  S.sel = [g.id]; S.ab = ab.id; emit(); tulisAktif()
}
// ---------- komponen ----------
const semuaMaster = () => (S.doc?.artboards || []).flatMap(ab => ab.elemen.filter(e => e.komponen && isGrup(e)).map(el => ({ ab, el })))
const jumlahInstance = id => (S.doc?.artboards || []).reduce((n, ab) => n + ab.elemen.filter(e => e.salinan === id).length, 0)
function jadikanKomponen() {
  let items = terpilih(); if (!items.length) return
  if (!bolehUbah(denganTurunan(items))) return
  if (items.length > 1 || !isGrup(items[0].el)) { grupkanSel(); items = terpilih() }
  const { el } = items[0]; if (el.salinan) return
  ubah(() => { el.komponen = true; el.nama = el.nama && el.nama !== 'Group' && el.nama !== 'Grup' ? el.nama : 'Component ' + (semuaMaster().length + 1) })
  host.notify({ kind: 'info', message: `"${el.nama}" is now a component. Insert copies from Layers → Components.` }); emit()
}
function sisipInstance(id) {
  const m = semuaMaster().find(x => x.el.id === id), ab = abAktif(); if (!m || !ab) return
  const inst = { id: uid('i'), tipe: 'grup', salinan: id, x: Math.round((ab.w - (m.el.w || 200)) / 2), y: Math.round((ab.h - (m.el.h || 100)) / 2) }
  ubah(() => { ab.elemen.push(inst) }); S.sel = [inst.id]; S.ab = ab.id; emit(); tulisAktif()
}
function lepasInstanceSel() { const it = terpilih().find(x => x.el.salinan); if (!it || !bolehUbah(denganTurunan([it]))) return; ubah(d => lepasInstance(d, it.el.id, () => uid())); emit() }
function resetTimpaan() { const it = terpilih().find(x => x.el.salinan); if (!it || !bolehUbah([it])) return; ubah(() => { delete it.el.timpa }); emit() }
function keMaster() { const it = terpilih().find(x => x.el.salinan); const m = it && semuaMaster().find(x => x.el.id === it.el.salinan); if (!m) return; S.sel = [m.el.id]; S.ab = m.ab.id; fitAb(m.ab); emit() }
function PanelKomponen({ el, multi }) {
  if (multi || !isGrup(el)) return h('div', { className: 'kv-btnrow' }, h('button', { onClick: jadikanKomponen, title: 'Ctrl+Alt+K' }, '◆ Make component'))
  if (el.komponen) return h(Fragment, null, h('div', { className: 'kv-sectitle' }, '◆ Main component'),
    h('label', { className: 'kv-f' }, h('span', null, 'Component name'), h('input', { value: el.nama || '', onChange: e => ubah(() => { el.nama = e.target.value }, true) })),
    h('div', { className: 'kv-hint' }, `${jumlahInstance(el.id)} cop${jumlahInstance(el.id) === 1 ? 'y follows' : 'ies follow'} every change to this main component.`),
    h('div', { className: 'kv-btnrow' }, h('button', { onClick: () => sisipInstance(el.id) }, '＋ Insert copy'), h('button', { onClick: () => ubah(() => { delete el.komponen }) }, 'Remove component')))
  if (el.salinan) {
    const m = semuaMaster().find(x => x.el.id === el.salinan), n = Object.keys(el.timpa || {}).length
    return h(Fragment, null, h('div', { className: 'kv-sectitle' }, '◇ Component copy'),
      h('div', { className: 'kv-hint' }, `From "${m?.el.nama || el.salinan}". ${n ? n + ' part' + (n > 1 ? 's' : '') + ' overridden in this copy.' : 'No overrides yet.'} Edit text or colors inside; everything else follows the main component.`),
      h('div', { className: 'kv-btnrow' }, h('button', { onClick: keMaster }, 'Go to main'), n ? h('button', { onClick: resetTimpaan }, 'Reset') : null, h('button', { onClick: lepasInstanceSel }, 'Detach')))
  }
  return h('div', { className: 'kv-btnrow' }, h('button', { onClick: jadikanKomponen, title: 'Ctrl+Alt+K' }, '◆ Make component'))
}
function DaftarKomponen() {
  const ms = semuaMaster()
  return h(Fragment, null, h('div', { className: 'kv-sectitle', style: { marginTop: 10 } }, `Components · ${ms.length}`),
    ms.length ? h('div', { className: 'kv-kompgrid' }, ms.map(({ ab, el }) => h('button', { key: el.id, title: 'Insert a copy', onClick: () => sisipInstance(el.id) },
      h(ThumbEl, { ab, el }), h('span', null, el.nama || el.id))))
      : h('div', { className: 'kv-hint' }, 'Select a group (card, button…) and choose "Make component". Copies follow every change to the main component.'))
}
// pratinjau satu grup (untuk daftar komponen)
function ThumbEl({ ab, el }) {
  const w = el.w || 100, hh = el.h || 60, s = Math.min(92 / w, 52 / hh)
  const isi = [el, ...keturunan(ab, el.id)]
  return h('div', { className: 'kv-kthumb', style: { width: Math.round(w * s), height: Math.round(hh * s) } },
    h('div', { style: { position: 'absolute', left: 0, top: 0, width: w, height: hh, transform: `scale(${s})`, transformOrigin: '0 0', pointerEvents: 'none' } },
      h('div', { style: { position: 'absolute', left: -(el.x || 0), top: -(el.y || 0) } }, isi.map(e => h(ElView, { key: e.id, el: e })))))
}
function lepasGrup() {
  const grup = terpilih().filter(({ el }) => isGrup(el)); if (!grup.length) return
  if (!bolehUbah(grup.flatMap(x => denganTurunan([x])))) return
  const lepas = []
  ubah(() => grup.forEach(({ ab, el }) => {
    for (const c of ab.elemen) if (c.induk === el.id) { if (el.induk) c.induk = el.induk; else delete c.induk; lepas.push(c.id) }
    ab.elemen = ab.elemen.filter(e => e !== el)
  }))
  S.sel = lepas; emit(); tulisAktif()
}
function urutan(arah) {
  if (!bolehUbah(denganTurunan())) return
  ubah(() => terpilih().forEach(({ ab, el }) => {
    const i = ab.elemen.indexOf(el); ab.elemen.splice(i, 1)
    const j = arah === 'depan' ? ab.elemen.length : arah === 'belakang' ? 0 : Math.max(0, Math.min(ab.elemen.length, i + (arah === 'naik' ? 1 : -1)))
    ab.elemen.splice(j, 0, el)
  }))
}
function ratakan(cara) {
  if (!bolehUbah(denganTurunan())) return
  ubah(() => terpilih().forEach(({ ab, el }) => {
    const t = tinggi(el)
    if (cara === 'kiri') el.x = 0; if (cara === 'tengah') el.x = Math.round((ab.w - el.w) / 2); if (cara === 'kanan') el.x = ab.w - el.w
    if (cara === 'atas') el.y = 0; if (cara === 'tengahV') el.y = Math.round((ab.h - t) / 2); if (cara === 'bawah') el.y = Math.round(ab.h - t)
  }))
}
function tambahArtboard(p) {
  const a = S.doc.artboards, akhir = a.at(-1)
  const jumlahSlide = a.filter(x => /^Slide/.test(x.nama)).length
  const ab = { id: uid('a'), nama: p.nama.startsWith('Slide') ? `Slide ${jumlahSlide + 1}` : p.nama, x: akhir ? akhir.x + akhir.w + 160 : 0, y: akhir ? akhir.y : 0, w: p.w, h: p.h, bg: '#FFFFFF', elemen: [] }
  ubah(d => d.artboards.push(ab)); S.ab = ab.id; S.sel = []; S.menu = null; emit(); setTimeout(() => fitAb(ab), 20)
}
function duplikatArtboard(ab) {
  const anakInst = anakInstSet(ab), asli = ab.elemen.filter(e => !anakInst.has(e.id))
  const c = { ...clone(ab), id: uid('a'), nama: ab.nama + ' (copy)', elemen: urutPohon(klonPohon(asli)) }
  const kanan = Math.max(...S.doc.artboards.map(b => b.x + b.w)); c.x = kanan + 160; c.y = ab.y
  ubah(d => d.artboards.splice(d.artboards.indexOf(ab) + 1, 0, c)); S.ab = c.id; emit()
}
async function bacaFileGambar(file) {
  const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file) })
  const im = new Image(); im.src = url; await im.decode()
  let hasil = url
  if (file.size > 500 * 1024 || !/png|svg/.test(file.type)) {   // kecilkan supaya file desain tetap ringan
    const s = Math.min(1, 1800 / Math.max(im.naturalWidth, im.naturalHeight))
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s)
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height)
    hasil = c.toDataURL('image/jpeg', 0.86)
  }
  S.img[hasil] = { status: 'ok', url: hasil, im }
  return { src: hasil, w: im.naturalWidth, h: im.naturalHeight }
}
function pilihGambar(cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
  inp.onchange = async () => { const f = inp.files[0]; if (f) cb(await bacaFileGambar(f)) }
  inp.click()
}
// data ikon dimuat sekali: app lokal → /dist/ikon.json, Hermes → folder data plugin (disalin install.ps1)
const IKON = { data: null, janji: null }
function muatIkon() {
  if (IKON.data && Object.keys(IKON.data.ikon || {}).length) return Promise.resolve(IKON.data)
  if (IKON.janji) return IKON.janji
  IKON.janji = (async () => {
    try {
      if (S.ctx.muatIkon) IKON.data = await S.ctx.muatIkon()
      else { const r = await S.ctx.files.readText('data', 'ikon.json'); if (r.ok) IKON.data = JSON.parse(r.text) }
    } catch {}
    if (!IKON.data || !Object.keys(IKON.data.ikon || {}).length) IKON.data = null
    IKON.janji = null; emit(); return IKON.data || { ikon: {}, tag: {} }
  })()
  return IKON.janji
}
function cariIkon(q, maks = 160) {
  const d = IKON.data; if (!d) return []
  const kata = String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  const nama = Object.keys(d.ikon)
  if (!kata.length) return nama.slice(0, maks)
  const skor = n => { const t = n + ' ' + (d.tag[n] || ''); if (!kata.every(k => t.includes(k))) return -1; return (n === kata.join('-') ? 3 : 0) + (n.startsWith(kata[0]) ? 2 : 0) + (kata.every(k => n.includes(k)) ? 1 : 0) }
  return nama.map(n => [n, skor(n)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]).slice(0, maks).map(x => x[0])
}
// ikon = elemen path biasa (bisa diwarnai, diubah ukuran, diekspor). Tebal garis 2/24 dari ukuran ikon.
function elemenIkon(nama, { x = 0, y = 0, ukuran = 96, warna = '#101634', tebal = 2 } = {}) {
  return { id: uid(), tipe: 'path', nama: 'Icon ' + nama, ikon: nama, x, y, w: ukuran, h: ukuran, vb: [24, 24], d: IKON.data.ikon[nama], fill: null, garis: { tebal: Math.round(tebal * ukuran / 24 * 10) / 10, warna }, ujung: 'bulat' }
}
function PilihIkon() {
  const [q, setQ] = useState(''), ref = useRef(null)
  useEffect(() => { muatIkon(); setTimeout(() => ref.current?.focus(), 30) }, [])
  const hasil = cariIkon(q), tutup = () => { S.pilihIkon = false; emit() }
  const sisip = nama => {
    // mode ganti: ubah ikon elemen yang dipilih (di salinan komponen otomatis jadi timpaan)
    const target = S.pilihIkon?.ganti && cariEl(S.pilihIkon.ganti)?.el
    if (target) { ubah(() => { target.ikon = nama; target.d = IKON.data.ikon[nama]; target.nama = 'Icon ' + nama }); tutup(); return }
    const ab = abAktif(); if (!ab) return
    const uk = Math.round(Math.min(ab.w, ab.h) / 8)
    tambahEl(elemenIkon(nama, { x: Math.round((ab.w - uk) / 2), y: Math.round((ab.h - uk) / 2), ukuran: uk }))
    tutup()
  }
  return h('div', { className: 'kv-modal', onPointerDown: e => { if (e.target === e.currentTarget) tutup() } },
    h('div', { className: 'kv-mbox kv-ikonbox' },
      h('div', { className: 'kv-sectitle' }, `Icons · ${IKON.data ? Object.keys(IKON.data.ikon).length : '…'}`, h('button', { className: 'kv-x', onClick: tutup }, '✕')),
      h('input', { ref, className: 'kv-judul', placeholder: 'Search: coffee, arrow, check, home, chart…', value: q, onChange: e => setQ(e.target.value),
        onKeyDown: e => { e.stopPropagation(); if (e.key === 'Escape') tutup(); if (e.key === 'Enter' && hasil[0]) sisip(hasil[0]) } }),
      !IKON.data ? h('p', null, 'Loading icons…') : !hasil.length ? h('p', null, 'No icons found. Try another word (coffee, arrow, check).') : null,
      h('div', { className: 'kv-ikongrid' }, hasil.map(n => h('button', { key: n, title: n, onClick: () => sisip(n) },
        h('svg', { viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: IKON.data.ikon[n] })),
        h('span', null, n)))),
      h('p', { className: 'kv-lisensi' }, IKON.data?.lisensi || '')))
}
function sisipGambar() {
  const ab = abAktif(); if (!ab) return
  pilihGambar(g => {
    const w = Math.round(ab.w * 0.6), hh = Math.round(w * g.h / g.w)
    tambahEl({ id: uid(), tipe: 'gambar', x: Math.round((ab.w - w) / 2), y: Math.round((ab.h - hh) / 2), w, h: hh, src: g.src, fit: 'cover', radius: 0 })
  })
}

/* =============== 6. EXPORT: PNG / JPG / SVG / PDF / JSON =============== */
function gradCanvas(g, f, x, y, w, h) {
  const a = (f.sudut ?? 135) * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a)
  const L = Math.abs(w * dx) + Math.abs(h * dy), cx = x + w / 2, cy = y + h / 2
  const gr = g.createLinearGradient(cx - dx * L / 2, cy - dy * L / 2, cx + dx * L / 2, cy + dy * L / 2)
  f.warna.forEach((c, i) => gr.addColorStop(f.warna.length === 1 ? 0 : i / (f.warna.length - 1), c))
  return gr
}
function bentuk(g, el, x, y, w, h) {
  g.beginPath()
  if (el.tipe === 'elips') g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  else g.roundRect(x, y, w, h, Math.min(el.radius || 0, w / 2, h / 2))
}
async function gambarAb(ab, skala) {
  await muatFontDoc({ artboards: [ab] }); await document.fonts.ready; await tungguGambar(ab)
  const c = document.createElement('canvas'); c.width = Math.round(ab.w * skala); c.height = Math.round(ab.h * skala)
  const g = c.getContext('2d'); g.scale(skala, skala)
  g.fillStyle = isGrad(ab.bg) ? gradCanvas(g, ab.bg, 0, 0, ab.w, ab.h) : (ab.bg || '#FFFFFF'); g.fillRect(0, 0, ab.w, ab.h)
  for (const el of ab.elemen) {
    if (el.sembunyi) continue
    const w = el.w || 100, hh = tinggi(el)
    g.save(); g.globalAlpha = el.opacity ?? 1
    if (el.rotasi) { g.translate(el.x + w / 2, el.y + hh / 2); g.rotate(el.rotasi * Math.PI / 180); g.translate(-(el.x + w / 2), -(el.y + hh / 2)) }
    if (el.tipe === 'kotak' || el.tipe === 'elips' || el.tipe === 'grup') {
      if (el.bayangan) { g.shadowColor = 'rgba(16,22,52,.28)'; g.shadowBlur = 48; g.shadowOffsetY = 18 }
      bentuk(g, el, el.x, el.y, w, hh)
      if (el.fill) { g.fillStyle = isGrad(el.fill) ? gradCanvas(g, el.fill, el.x, el.y, w, hh) : el.fill; g.fill() }
      g.shadowColor = 'transparent'
      if (el.garis?.tebal) { g.lineWidth = el.garis.tebal; g.strokeStyle = el.garis.warna || '#000'; bentuk(g, el, el.x + el.garis.tebal / 2, el.y + el.garis.tebal / 2, w - el.garis.tebal, hh - el.garis.tebal); g.stroke() }
    } else if (el.tipe === 'teks') {
      const L = layoutTeks(el)
      g.font = fontStr(el); g.fillStyle = el.warna || '#101634'; g.textBaseline = 'middle'
      if ('letterSpacing' in g) g.letterSpacing = (el.spasi || 0) + 'px'
      g.textAlign = el.rata === 'tengah' ? 'center' : el.rata === 'kanan' ? 'right' : 'left'
      const tx = el.rata === 'tengah' ? el.x + w / 2 : el.rata === 'kanan' ? el.x + w : el.x
      L.lines.forEach((ln, i) => g.fillText(ln, tx, el.y + L.lh * i + L.lh / 2))
    } else if (el.tipe === 'path') {
      const k = skalaPath(el), p2 = new Path2D(String(el.d || ''))
      g.translate(el.x, el.y); g.scale(k.sx, k.sy)
      if (el.bayangan) { g.shadowColor = 'rgba(16,22,52,.28)'; g.shadowBlur = 48 / k.sx; g.shadowOffsetY = 18 / k.sy }
      if (el.fill) { g.fillStyle = isGrad(el.fill) ? gradCanvas(g, el.fill, 0, 0, k.vw, k.vh) : el.fill; g.fill(p2, el.aturan === 'evenodd' ? 'evenodd' : 'nonzero') }
      g.shadowColor = 'transparent'
      if (el.garis?.tebal) { g.lineWidth = el.garis.tebal / Math.min(k.sx, k.sy); g.strokeStyle = el.garis.warna || '#101634'; g.lineCap = CAP[el.ujung] || 'round'; g.lineJoin = el.ujung === 'datar' ? 'miter' : 'round'; g.stroke(p2) }
    } else if (el.tipe === 'gambar') {
      const gm = gambar(el.src)
      if (gm) {
        g.save(); bentuk(g, { radius: el.radius }, el.x, el.y, w, hh); g.clip()
        const iw = gm.im.naturalWidth, ih = gm.im.naturalHeight
        const s = el.fit === 'contain' ? Math.min(w / iw, hh / ih) : Math.max(w / iw, hh / ih)
        g.drawImage(gm.im, el.x + (w - iw * s) / 2, el.y + (hh - ih * s) / 2, iw * s, ih * s); g.restore()
      }
    }
    g.restore()
  }
  return c
}
const xml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
// nilai yang aman ditulis ke atribut SVG
const svgN = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const svgW = (c, cad = 'none') => /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,20})$/i.test(String(c || '').trim()) ? String(c).trim() : cad
async function svgAb(ab) {
  await tungguGambar(ab)
  const defs = [], body = []
  const isi = (f, id) => {
    if (!isGrad(f)) return svgW(f)
    const a = (f.sudut ?? 135) * Math.PI / 180, dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2
    defs.push(`<linearGradient id="${id}" x1="${svgN(0.5 - dx)}" y1="${svgN(0.5 - dy)}" x2="${svgN(0.5 + dx)}" y2="${svgN(0.5 + dy)}">${f.warna.map((c, i) => `<stop offset="${f.warna.length === 1 ? 0 : i / (f.warna.length - 1)}" stop-color="${svgW(c, '#000')}"/>`).join('')}</linearGradient>`)
    return `url(#${id})`
  }
  body.push(`<rect width="${svgN(ab.w)}" height="${svgN(ab.h)}" fill="${isi(ab.bg || '#FFFFFF', 'gbg')}"/>`)
  ab.elemen.forEach((el, n) => {
    if (el.sembunyi) return
    const w = svgN(el.w || 100), hh = svgN(tinggi(el)), X = svgN(el.x), Y = svgN(el.y), R = svgN(el.radius)
    const tr = el.rotasi ? ` transform="rotate(${svgN(el.rotasi)} ${X + w / 2} ${Y + hh / 2})"` : ''
    const op = el.opacity != null && el.opacity !== 1 ? ` opacity="${svgN(el.opacity)}"` : ''
    const gs = el.garis?.tebal ? ` stroke="${svgW(el.garis.warna, '#000')}" stroke-width="${svgN(el.garis.tebal)}"` : ''
    if (el.tipe === 'kotak' || el.tipe === 'grup') body.push(`<rect x="${X}" y="${Y}" width="${w}" height="${hh}" rx="${R}" fill="${isi(el.fill, 'g' + n)}"${gs}${op}${tr}/>`)
    else if (el.tipe === 'elips') body.push(`<ellipse cx="${X + w / 2}" cy="${Y + hh / 2}" rx="${w / 2}" ry="${hh / 2}" fill="${isi(el.fill, 'g' + n)}"${gs}${op}${tr}/>`)
    else if (el.tipe === 'path') {
      const k = skalaPath(el), sw = el.garis?.tebal ? svgN(el.garis.tebal / Math.min(k.sx, k.sy)) : 0
      const isiP = isGrad(el.fill) ? isi(el.fill, 'g' + n) : svgW(el.fill)
      body.push(`<g${tr}${op}><g transform="translate(${X} ${Y}) scale(${svgN(k.sx)} ${svgN(k.sy)})"><path d="${xml(el.d)}" fill="${isiP}" fill-rule="${el.aturan === 'evenodd' ? 'evenodd' : 'nonzero'}"${sw ? ` stroke="${svgW(el.garis.warna, '#101634')}" stroke-width="${sw}" stroke-linecap="${CAP[el.ujung] || 'round'}" stroke-linejoin="${el.ujung === 'datar' ? 'miter' : 'round'}"` : ''}/></g></g>`)
    }
    else if (el.tipe === 'teks') {
      const L = layoutTeks(el), anchor = el.rata === 'tengah' ? 'middle' : el.rata === 'kanan' ? 'end' : 'start'
      const tx = el.rata === 'tengah' ? X + w / 2 : el.rata === 'kanan' ? X + w : X
      body.push(`<text font-family="${xml(el.font || 'Plus Jakarta Sans')}, sans-serif" font-size="${svgN(el.ukuran || 32)}" font-weight="${svgN(el.tebal || 400)}"${el.miring ? ' font-style="italic"' : ''} letter-spacing="${svgN(el.spasi)}" fill="${svgW(el.warna, '#101634')}" text-anchor="${anchor}" dominant-baseline="central"${op}${tr}>${L.lines.map((ln, i) => `<tspan x="${tx}" y="${Y + L.lh * i + L.lh / 2}">${xml(ln)}</tspan>`).join('')}</text>`)
    } else if (el.tipe === 'gambar' && S.img[el.src]?.url) {
      defs.push(`<clipPath id="c${n}"><rect x="${X}" y="${Y}" width="${w}" height="${hh}" rx="${R}"/></clipPath>`)
      body.push(`<image href="${xml(S.img[el.src].url)}" x="${X}" y="${Y}" width="${w}" height="${hh}" preserveAspectRatio="xMidYMid ${el.fit === 'contain' ? 'meet' : 'slice'}" clip-path="url(#c${n})"${op}${tr}/>`)
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgN(ab.w)}" height="${svgN(ab.h)}" viewBox="0 0 ${svgN(ab.w)} ${svgN(ab.h)}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`
}
// PDF sederhana: tiap artboard = satu halaman berisi gambar JPEG (ukuran halaman = ukuran artboard)
function buatPdfBytes(hal, marker = '') {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0
  const push = d => { const b = typeof d === 'string' ? enc.encode(d) : d; parts.push(b); len += b.length }
  const obj = (id, ...isi) => { offs[id] = len; push(`${id} 0 obj\n`); isi.forEach(push); push('\nendobj\n') }
  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n')
  const n = 2 + hal.length * 3
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, `<< /Type /Pages /Kids [${hal.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${hal.length} >>`)
  hal.forEach((p, i) => {
    const pid = 3 + i * 3, W = (p.w * 0.75).toFixed(2), H = (p.h * 0.75).toFixed(2), isi = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${pid + 2} 0 R >> >> /Contents ${pid + 1} 0 R >>`)
    obj(pid + 1, `<< /Length ${isi.length} >>\nstream\n${isi}\nendstream`)
    obj(pid + 2, `<< /Type /XObject /Subtype /Image /Width ${p.pw} /Height ${p.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`, p.jpg, '\nendstream')
  })
  const xref = len
  push(`xref\n0 ${n + 1}\n0000000000 65535 f\r\n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n\r\n').join(''))
  push(`trailer\n<< /Size ${n + 1} /Root 1 0 R >>\n${marker}startxref\n${xref}\n%%EOF`)
  const out = new Uint8Array(len); let pos = 0
  for (const b of parts) { out.set(b, pos); pos += b.length }
  return out
}
const buatPdf = hal => new Blob([buatPdfBytes(hal)], { type: 'application/pdf' })
async function buatPdfHybrid(hal, doc) {
  if (S.ctx?.documentAction) {
    const r = await S.ctx.documentAction({ action: 'export_pdf', file: new File([buatPdf(hal)], 'design.pdf'), doc })
    if (r?.ok && r.blob) return r.blob
    if (!r?.unsupported) throw Error(r?.message || 'PDF belum bisa diunduh.')
  }
  // Hermes Desktop without a document endpoint uses the same v1 marker
  // before startxref. Offsets still refer to the original objects.
  const raw = new Blob([JSON.stringify(doc)])
  if (raw.size > 32 * 1024 * 1024) throw Error('Desain melebihi batas 32 MiB untuk Hybrid PDF.')
  if (typeof CompressionStream !== 'function') throw Error('Buka Kanvas Studio lokal untuk menyimpan Hybrid PDF pada perangkat ini.')
  const stream = raw.stream().pipeThrough(new CompressionStream('deflate'))
  const packed = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  for (let i = 0; i < packed.length; i += 32768) binary += String.fromCharCode(...packed.subarray(i, i + 32768))
  const bytes = buatPdfBytes(hal, '%KANVAS-DOCUMENT-1 ' + btoa(binary) + '\n')
  if (bytes.length > 64 * 1024 * 1024) throw Error('PDF melebihi 64 MiB. Kurangi resolusi ekspor.')
  return new Blob([bytes], { type: 'application/pdf' })
}
async function unduhExcel(args, nama) {
  const r = await aksiDokumen({ ...args, action: 'export_xlsx' })
  if (!r.blob) throw Error('Host belum menyediakan unduhan Excel.')
  await simpanBlob(r.blob, (nama || 'laporan') + '.xlsx', 'Excel')
}
const keBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q))
async function simpanBlob(blob, nama, jenis) {
  if (window.showSaveFilePicker) {
    try {
      const ext = nama.split('.').pop()
      const fh = await window.showSaveFilePicker({ suggestedName: nama, types: [{ description: jenis, accept: { [blob.type || 'application/octet-stream']: ['.' + ext] } }] })
      const w = await fh.createWritable(); await w.write(blob); await w.close()
      host.notify({ kind: 'info', message: `Saved: ${fh.name}` }); return
    } catch (e) { if (e?.name === 'AbortError') return }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 20000)
  host.notify({ kind: 'info', message: `Downloading ${nama}` })
}
const namaDasar = (ab) => ((S.doc?.judul || 'design') + (ab ? '-' + ab.nama : '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
async function ekspor(jenis) {
  if (jenis === 'folder') return simpanKeFolder()
  S.menu = null; S.status = 'Exporting…'; emit()
  try {
    const ab = abAktif(), sk = S.skala
    if (jenis === 'png' || jenis === 'jpg') {
      const c = await gambarAb(ab, sk)
      await simpanBlob(await keBlob(c, jenis === 'png' ? 'image/png' : 'image/jpeg', 0.92), `${namaDasar(ab)}.${jenis}`, jenis.toUpperCase())
    } else if (jenis === 'salin') {
      const c = await gambarAb(ab, sk)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': await keBlob(c, 'image/png') })])
      host.notify({ kind: 'info', message: 'Image copied to clipboard' })
    } else if (jenis === 'svg') {
      await simpanBlob(new Blob([await svgAb(ab)], { type: 'image/svg+xml' }), `${namaDasar(ab)}.svg`, 'SVG')
    } else if (jenis === 'pdf' || jenis === 'pdf1') {
      const doc = clone(jenis === 'pdf' ? S.doc : { ...S.doc, artboards: [ab] }), hal = []
      if (jenis === 'pdf1' && doc.komentar) doc.komentar = doc.komentar.filter(k => k.artboard === ab.id)
      const nama = namaDasar(jenis === 'pdf' ? null : ab)
      for (const a of doc.artboards) {
        const c = await gambarAb(a, sk)
        hal.push({ w: a.w, h: a.h, pw: c.width, ph: c.height, jpg: new Uint8Array(await (await keBlob(c, 'image/jpeg', 0.92)).arrayBuffer()) })
        for (const e of a.elemen) if (e.tipe === 'gambar' && e.src && !/^(https?:|data:)/i.test(e.src)) {
          const image = S.img[e.src]
          if (image?.status !== 'ok') throw Error('Gambar belum bisa disertakan: ' + e.src)
          e.src = image.url
        }
      }
      await simpanBlob(await buatPdfHybrid(hal, doc), nama + '.pdf', 'PDF')
    } else if (jenis === 'xlsx') {
      await unduhExcel({ doc: S.doc }, namaDasar(null))
    } else if (jenis === 'json') {
      await simpanBlob(new Blob([JSON.stringify(S.doc, null, 1)], { type: 'application/json' }), `${namaDasar(null)}.kanvas.json`, 'Design')
    } else if (jenis === 'pptx') {
      await simpanBlob(buatPptxBrowser(S.doc), `${namaDasar(null)}.pptx`, 'PowerPoint Presentation')
    } else if (jenis === 'html') {
      await simpanBlob(new Blob([eksporKodeBrowser(ab, 'html')], { type: 'text/html;charset=utf-8' }), `${namaDasar(ab)}.html`, 'HTML')
    } else if (jenis === 'react') {
      const jsx = eksporKodeBrowser(ab, 'react')
      await S.ctx.os.writeClipboard(jsx)
      host.notify({ kind: 'info', message: 'React + Tailwind JSX copied to clipboard' })
    }
    S.status = 'Exported ✓'
  } catch (e) { S.status = 'Export failed: ' + (e?.message || e); host.notify({ kind: 'info', message: S.status }) }
  emit()
}

/* =============== 7a. UMPETIN / TAMPILKAN PANE =============== */
// ✕ di tab pane = plugin dimatikan Hermes (aturan host untuk plugin dengan satu pane).
// Yang aman: lipat kolom kanan (sama dengan Ctrl+J) — pane tetap hidup, robot & pantau tetap jalan.
function umpetin() {
  const r = S.ctx.runAction?.('view.toggleRightSidebar')
  if (r && !r.ok) host.notify({ kind: 'info', message: 'Could not fold the panel: ' + (r.error || r.reason) })
}
const PANE_ID = 'kanvas-studio:pane'
const useKelihatan = typeof host.paneVisibility === 'function' && typeof useValue === 'function'
  ? () => useValue(host.paneVisibility(PANE_ID)) : () => null
// Kanvas dibuka sebagai tab di area kerja utama (host.openWorkspace). Menutup tab TIDAK mematikan plugin
// (berbeda dengan pane: menutup satu-satunya pane plugin = plugin dinonaktifkan Hermes).
const BISA_TAB = typeof host.openWorkspace === 'function'
const KANVAS = { tutup: null, terbuka: 0, otomatis: 0, ditolak: false }
function bukaKanvas(otomatis) {
  if (KANVAS.terbuka > 0 && !otomatis) { /* sudah tampil */ }
  if (BISA_TAB) {
    KANVAS.tutup = host.openWorkspace('kanvas-studio', {
      title: 'Kanvas', minWidth: 480, render: () => h(KanvasApp),
      onClose: () => { KANVAS.tutup = null; if (S.agenSibuk) KANVAS.ditolak = true }   // ditutup saat agent bekerja → jangan dibuka paksa lagi
    })
  } else host.navigate(ROUTE)
  return true
}
// dipanggil pemantau: agent mulai bekerja & kanvas tidak tampil → buka otomatis (sekali per sesi kerja agent)
function bukaOtomatisBilaPerlu() {
  if (!S.agenSibuk) { KANVAS.ditolak = false; return }
  if (KANVAS.terbuka > 0 || KANVAS.ditolak || Date.now() - KANVAS.otomatis < 20000) return
  KANVAS.otomatis = Date.now(); bukaKanvas(true)
}
function TombolStatus() {
  const lihat = useKelihatan(); useStore()
  const kerja = !!S.bot
  return h('button', {
    className: 'kv-sbtn', onClick: () => bukaKanvas(),
    title: 'Open Kanvas Studio (Ctrl+Shift+K)'
  }, h('i', { className: kerja || S.agenSibuk ? 'kv-sdot on' : 'kv-sdot' }), 'Kanvas')
}

/* =============== 7. MINTA AGENT =============== */
async function mintaAgentBaru(brief, style = '', brandId = '') {
  const styleLine = style && style !== 'auto' ? `\nPreferred Art Direction: ${style}` : ''
  const brandLine = brandId ? `\nActive Brand Kit: ${brandId} (load via kanvas_brand)` : ''
  if (aktifChatHost()) {
    const prompt = `${brief}${styleLine}${brandLine}`.trim()
    return kirimChatLokal({ prompt })
  }
  const teks = `[Kanvas Studio] New design from the brief below.\nUse the kanvas_* MCP tools: call kanvas_status, kanvas_brand (if a brand applies), and kanvas_art_direction to plan contextual aesthetics and grid without rigid recipes. Then build with kanvas_create / kanvas_campaign / kanvas_presentation / kanvas_edit / kanvas_dataviz in visible steps, and run kanvas_view (Visual QA) before finishing.${styleLine}${brandLine}\n\nBrief: ${brief}`
  const ok = await host.composer.insertText(null, teks, { mode: 'block' })
  if (ok) {
    host.composer.submit?.(null, teks) || host.composer.focus(null)
    S.sesiAgent = host.state?.focusedSessionId?.get?.() || 'tunggu'; S.ctx.storage.set('sesiAgent', S.sesiAgent); emit()
  } else { await S.ctx.os.writeClipboard(teks); host.notify({ kind: 'info', message: 'Brief copied. Paste it to your agent (Claude Code, Codex, Hermes) to start drawing here.' }) }
}

/* =============== 7b. V0.3.0 UI: BRAND KIT, DATA VIZ, SMART RESIZE, LIVE QA, PPTX & CODE =============== */
const GAYA_ARAH = [
  ['auto', 'Auto'], ['swiss-editorial', 'Swiss Editorial'], ['luxury-minimalism', 'Luxury'],
  ['brutalism', 'Brutalist'], ['cinematic', 'Cinematic'], ['corporate-premium', 'Corporate'], ['experimental', 'Experimental']
]
const RESIZE_PRESET = [
  { nama: 'IG Story 9:16', w: 1080, h: 1920 }, { nama: 'IG Feed 4:5', w: 1080, h: 1350 },
  { nama: 'IG Square', w: 1080, h: 1080 }, { nama: 'A4 Portrait', w: 794, h: 1123 },
  { nama: 'Web Banner', w: 1440, h: 600 }, { nama: 'Slide 16:9', w: 1920, h: 1080 }, { nama: 'YouTube Thumb', w: 1280, h: 720 }
]

const hexRgbUI = c => {
  let s = String(c || '').trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map(x => x + x).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)) : null
}
const lumUI = rgb => { const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]) }
const kontrasUI = (a, b) => { const ra = hexRgbUI(a), rb = hexRgbUI(b); if (!ra || !rb) return 1; const la = lumUI(ra), lb = lumUI(rb); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) }
const gelapUI = bg => { const c = typeof bg === 'string' ? bg : (Array.isArray(bg?.warna) ? bg.warna[0] : '#FFFFFF'); const r = hexRgbUI(c); return r ? lumUI(r) < 0.3 : false }

async function muatBrand() {
  if (!S.ctx?.files || !S.folder) return
  try {
    const r = await S.ctx.files.readText(S.folder.id, 'brands/index.json')
    if (r.ok) {
      const d = JSON.parse(r.text)
      S.brands = { defaultId: d.defaultId || null, map: d.brands || {} }
      emit(); return
    }
  } catch {}
  S.brands = { defaultId: null, map: {} }
}
async function simpanBrandStore(store) {
  if (!S.ctx?.files || !S.folder) return
  await S.ctx.files.writeText(S.folder.id, 'brands/index.json', JSON.stringify({ versi: 1, defaultId: store.defaultId || null, brands: store.map || {} }, null, 2))
  S.brands = store; emit()
}
async function muatAset() {
  if (!S.ctx?.files || !S.folder) return
  try {
    const r = await S.ctx.files.readText(S.folder.id, 'assets-library/index.json')
    if (r.ok) { S.assetsLib = Object.values(JSON.parse(r.text).assets || {}); emit(); return }
  } catch {}
  S.assetsLib = []
}
const daftarBrand = () => Object.values(S.brands?.map || {}).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
const brandAktif = () => (S.doc?.brand && S.brands?.map?.[S.doc.brand]) || (S.brands?.defaultId && S.brands?.map?.[S.brands.defaultId]) || null

function applyBrandUI(brand) {
  if (!brand || !S.doc) return
  const c = brand.colors || {}, f = brand.fonts || {}
  const pickInk = (bgHex, cands) => {
    for (const x of cands.filter(Boolean)) if (kontrasUI(x, bgHex) >= 4.5) return x
    let best = '#111111', bestC = -1
    for (const x of [...cands.filter(Boolean), '#111111', '#FFFFFF']) { const k = kontrasUI(x, bgHex); if (k > bestC) { bestC = k; best = x } }
    return best
  }
  ubah(d => {
    d.brand = brand.id
    for (const ab of d.artboards) {
      if (c.background && typeof ab.bg === 'string') ab.bg = c.background
      const abBg = typeof ab.bg === 'string' ? ab.bg : (ab.bg?.warna?.[0] || '#FFFFFF')
      const abArea = (ab.w || 1) * (ab.h || 1), byId = new Map(ab.elemen.map(e => [e.id, e]))
      for (const el of ab.elemen) {
        if (terkunci(ab, el)) continue
        if ((el.tipe === 'kotak' || el.tipe === 'grup') && typeof el.fill === 'string') {
          const area = (el.w || 0) * (el.h || 0)
          if (area > 0 && area < abArea * 0.08 && (c.accent || c.primary)) el.fill = c.accent || c.primary
          else if (area >= abArea * 0.08 && area < abArea * 0.7 && c.surface) el.fill = c.surface
        } else if (el.tipe === 'path' && el.ikon && el.garis?.warna && (c.accent || c.primary)) el.garis.warna = c.accent || c.primary
      }
      for (const el of ab.elemen) {
        if (el.tipe !== 'teks') continue
        if (terkunci(ab, el)) continue
        const isDisp = (el.ukuran || 32) >= 36 || ((el.ukuran || 32) >= 28 && (el.tebal || 400) >= 700)
        const nextF = isDisp && f.display ? f.display : (!isDisp && f.body ? f.body : (f.display || f.body))
        if (nextF) el.font = nextF
        const p = el.induk && byId.get(el.induk)
        const localBg = (p && typeof p.fill === 'string') ? p.fill : abBg
        const acc = c.accent || c.primary
        if (el.kapital && (el.ukuran || 32) <= 24 && acc && kontrasUI(acc, localBg) >= 3) el.warna = acc
        else el.warna = pickInk(localBg, [c.text, c.muted, '#111111', '#FFFFFF'])
      }
    }
  })
  S.menu = null; S.status = `Applied brand "${brand.name}" ✓`; emit()
}

function smartResizeUI(preset) {
  const src = abAktif(); if (!src) return
  S.menu = null
  const W = preset.w, H = preset.h, srcW = src.w || 1920, srcH = src.h || 1080
  const sx = W / srcW, sy = H / srcH, areaScale = Math.sqrt((W * H) / (srcW * srcH))
  const landToPort = (srcW / srcH) > 1.15 && (W / H) < 0.92
  const minFont = Math.max(12, Math.round(Math.min(W, H) / 60)), safeM = Math.max(24, Math.round(Math.min(W, H) * 0.065))
  const cw = Math.max(120, W - safeM * 2)
  let baruId = null
  ubah(d => {
    const map = new Map()
    const cloned = clone(src.elemen).map(e => { const nid = uid(e.tipe === 'grup' ? 'g' : 'e'); map.set(e.id, nid); return { ...e, id: nid } })
    for (const e of cloned) { if (e.induk && map.has(e.induk)) e.induk = map.get(e.induk); delete e.komponen; delete e.salinan; delete e.timpa }
    const fScale = Math.max(0.55, Math.min(1.8, areaScale))
    for (const e of cloned) {
      if (e.tipe === 'teks') e.ukuran = Math.max(minFont, Math.round((e.ukuran || 32) * fScale))
      if (e.tipe === 'grup' && e.tata && landToPort && e.tata.arah === 'baris' && (e.w || 0) >= srcW * 0.35) {
        e.tata = { ...e.tata, arah: 'kolom', rata: 'regang' }; e.lebar = 'tetap'; e.tinggi = 'peluk'
      }
    }
    const top = cloned.filter(e => !e.induk)
    if (landToPort && top.length >= 2) {
      let cy = safeM; const gap = Math.max(18, Math.round(H * 0.025))
      for (const e of top) {
        const dekor = e.tipe !== 'teks' && ((e.opacity ?? 1) < 0.55 || (e.w || 100) * (e.h || 100) > srcW * srcH * 0.55)
        if (dekor) { e.x = Math.round((e.x || 0) * sx); e.y = Math.round((e.y || 0) * sy); e.w = Math.round((e.w || 100) * sx); e.h = Math.round((e.h || 100) * sy); continue }
        const ox = e.x || 0, oy = e.y || 0
        if (e.tipe === 'teks' || e.tipe === 'grup') { e.w = cw; e.x = safeM }
        else if (e.tipe === 'path' || e.tipe === 'elips') { const s = Math.min(sx, sy); e.w = Math.max(24, Math.round((e.w || 100) * s)); e.h = Math.max(24, Math.round((e.h || 100) * s)); e.x = safeM }
        else { e.w = cw; e.h = Math.min(Math.round(H * 0.35), Math.max(48, Math.round((e.h || 100) * areaScale))); e.x = safeM }
        e.y = cy
        if (e.tipe === 'grup' && !e.tata) for (const k of cloned) if (k.induk === e.id) { k.x = (k.x || 0) + (e.x - ox); k.y = (k.y || 0) + (e.y - oy) }
        cy += tinggi(e) + gap
      }
    } else {
      for (const e of top) {
        const ox = e.x || 0, oy = e.y || 0
        e.x = Math.round(ox * sx); e.y = Math.round(oy * sy)
        if (e.tipe === 'path' || (e.tipe === 'elips' && Math.abs((e.w || 100) - (e.h || 100)) < 10)) { const s = Math.min(sx, sy); e.w = Math.max(20, Math.round((e.w || 100) * s)); e.h = Math.max(20, Math.round((e.h || 100) * s)) }
        else { e.w = Math.max(40, Math.round((e.w || 100) * sx)); if (e.tipe !== 'teks') e.h = Math.max(24, Math.round((e.h || 100) * sy)) }
        if (e.tipe === 'grup' && !e.tata) for (const k of cloned) if (k.induk === e.id) { k.x = (k.x || 0) + (e.x - ox); k.y = (k.y || 0) + (e.y - oy) }
      }
    }
    const last = d.artboards.at(-1)
    const ab = { id: uid('a'), nama: `${src.nama} (${preset.nama})`, x: last ? last.x + last.w + 160 : 0, y: last ? last.y : 0, w: W, h: H, bg: clone(src.bg), elemen: cloned }
    d.artboards.push(ab); baruId = ab.id
  })
  if (baruId) { const ab = abById(baruId); S.ab = baruId; S.sel = []; if (ab) fitAb(ab); S.status = `Smart Resized → ${preset.nama} ✓`; emit() }
}

function sisipDataViz(jenis) {
  const ab = abAktif(); if (!ab) return
  S.menu = null
  const br = brandAktif(), dark = gelapUI(ab.bg), bc = br?.colors || {}, bf = br?.fonts || {}
  const txt = bc.text || (dark ? '#F8FAFC' : '#0F172A'), mut = bc.muted || (dark ? '#94A3B8' : '#475569')
  const surf = bc.surface || (dark ? '#1E2534' : '#F4F5F8'), rule = dark ? '#2D3748' : '#DCE2EA'
  const acc = bc.accent || bc.primary || (dark ? '#FF6B4A' : '#E03E2D')
  const pal = [acc, '#1D4ED8', '#047857', '#D97706']
  const df = bf.display || 'Plus Jakarta Sans', bof = bf.body || 'Inter', mf = bf.mono || 'IBM Plex Mono'
  const W = Math.min(Math.round(ab.w * 0.72), 860), H = Math.min(Math.round(ab.h * 0.44), 420)
  const x0 = Math.round((ab.w - W) / 2), y0 = Math.round((ab.h - H) / 2), gid = uid('g'), anak = []

  if (jenis === 'bar') {
    const vals = [['Q1', 28], ['Q2', 44], ['Q3', 62], ['Q4', 86]], max = 86
    const pY = y0 + 70, pH = H - 120, slot = W / vals.length, bw = Math.min(96, Math.round(slot * 0.52))
    anak.push({ id: uid('e'), induk: gid, tipe: 'teks', x: x0, y: y0, w: W, teks: 'Quarterly Growth', font: df, ukuran: 26, tebal: 700, warna: txt })
    anak.push({ id: uid('e'), induk: gid, tipe: 'path', x: x0, y: pY + pH, w: W, h: 2, vb: [W, 2], d: `M0 1H${W}`, fill: null, garis: { tebal: 1.5, warna: rule } })
    vals.forEach(([lb, v], i) => {
      const bh = Math.round((v / max) * pH), bx = Math.round(x0 + i * slot + (slot - bw) / 2), by = pY + pH - bh
      anak.push({ id: uid('e'), induk: gid, tipe: 'kotak', x: bx, y: by, w: bw, h: bh, radius: 6, fill: i === 3 ? acc : pal[i % pal.length], opacity: i === 3 ? 1 : 0.78 })
      anak.push({ id: uid('e'), induk: gid, tipe: 'teks', x: bx - 12, y: by - 26, w: bw + 24, teks: v + 'k', font: mf, ukuran: 16, tebal: 700, warna: txt, rata: 'tengah' })
      anak.push({ id: uid('e'), induk: gid, tipe: 'teks', x: bx - 12, y: pY + pH + 10, w: bw + 24, teks: lb, font: bof, ukuran: 16, tebal: 600, warna: mut, rata: 'tengah' })
    })
  } else if (jenis === 'donut') {
    const segs = [['Product', 52], ['Services', 30], ['Partners', 18]], sz = Math.min(H - 60, Math.round(W * 0.42))
    const polar = (r, a) => [(100 + r * Math.cos(a)).toFixed(2), (100 + r * Math.sin(a)).toFixed(2)]
    let ang = -Math.PI / 2
    anak.push({ id: uid('e'), induk: gid, tipe: 'teks', x: x0, y: y0, w: W, teks: 'Revenue Mix', font: df, ukuran: 26, tebal: 700, warna: txt })
    segs.forEach(([lb, v], i) => {
      const sw = (v / 100) * Math.PI * 2, a0 = ang, a1 = ang + sw; ang = a1
      const [x1, y1] = polar(94, a0), [x2, y2] = polar(94, a1), [ix2, iy2] = polar(58, a1), [ix1, iy1] = polar(58, a0)
      anak.push({ id: uid('e'), induk: gid, tipe: 'path', x: x0, y: y0 + 50, w: sz, h: sz, vb: [200, 200], d: `M${x1} ${y1} A94 94 0 ${sw > Math.PI ? 1 : 0} 1 ${x2} ${y2} L${ix2} ${iy2} A58 58 0 ${sw > Math.PI ? 1 : 0} 0 ${ix1} ${iy1} Z`, fill: pal[i] })
      const ly = y0 + 76 + i * 48
      anak.push({ id: uid('e'), induk: gid, tipe: 'kotak', x: x0 + sz + 36, y: ly + 6, w: 16, h: 16, radius: 4, fill: pal[i] })
      anak.push({ id: uid('e'), induk: gid, tipe: 'teks', x: x0 + sz + 62, y: ly, w: W - sz - 66, teks: `${lb} — ${v}%`, font: bof, ukuran: 18, tebal: 600, warna: txt })
    })
    anak.push({ id: uid('e'), induk: gid, tipe: 'teks', x: x0 + Math.round(sz * 0.2), y: y0 + 50 + Math.round(sz * 0.4), w: Math.round(sz * 0.6), teks: '100%', font: df, ukuran: 28, tebal: 800, warna: txt, rata: 'tengah' })
  } else if (jenis === 'table') {
    const cols = ['Metric', 'Q3', 'Q4'], rows = [['Active Users', '24.2k', '38.6k'], ['Retention', '91%', '95%'], ['NPS Score', '64', '72']]
    const cw = Math.floor((W - 40) / 3), hiInk = gelapUI(acc) ? '#FFFFFF' : '#111111'
    const mkRow = (cells, bg, ink, bold) => {
      const rid = uid('g')
      return [
        { id: rid, induk: gid, tipe: 'grup', lebar: 'isi', tinggi: 'peluk', fill: bg, radius: 8, garis: bg ? null : { tebal: 1, warna: rule }, tata: { arah: 'baris', padding: [14, 20, 14, 20], rata: 'tengah' } },
        ...cells.map((t, ci) => ({ id: uid('e'), induk: rid, tipe: 'teks', w: cw, teks: t, font: ci === 0 ? bof : mf, ukuran: 17, tebal: bold ? 700 : 500, warna: ink, rata: ci === 0 ? 'kiri' : 'kanan' }))
      ]
    }
    ubah(d => {
      const cur = d.artboards.find(a => a.id === ab.id)
      cur.elemen.push(
        { id: gid, tipe: 'grup', nama: 'Data Table', x: x0, y: y0, w: W, tinggi: 'peluk', fill: null, tata: { arah: 'kolom', jarak: 8, padding: 0, rata: 'regang' } },
        ...mkRow(cols, acc, hiInk, true),
        ...rows.flatMap((r, ri) => mkRow(r, ri % 2 ? surf : null, txt, false))
      )
      cur.elemen = urutPohon(cur.elemen)
    })
    S.sel = [gid]; S.status = 'Inserted Data Table ✓'; emit(); return
  } else if (jenis === 'diagram') {
    const steps = [['01', 'Brief'], ['02', 'Art Direct'], ['03', 'Visual QA']], gap = 44, cw = Math.floor((W - gap * 2) / 3)
    steps.forEach(([num, nm], i) => {
      const cx = x0 + i * (cw + gap), cid = uid('g'), hi = i === 1, bg = hi ? acc : surf, ink = hi ? (gelapUI(acc) ? '#FFFFFF' : '#111111') : txt
      anak.push({ id: cid, induk: gid, tipe: 'grup', x: cx, y: y0 + 20, w: cw, h: 150, fill: bg, radius: 14, garis: { tebal: 1.5, warna: hi ? acc : rule }, tata: { arah: 'kolom', jarak: 10, padding: 24, rata: 'regang' } })
      anak.push({ id: uid('e'), induk: cid, tipe: 'teks', teks: num, font: mf, ukuran: 16, tebal: 700, warna: hi ? ink : acc })
      anak.push({ id: uid('e'), induk: cid, tipe: 'teks', teks: nm, font: df, ukuran: 24, tebal: 700, warna: ink })
      if (i < 2) anak.push({ id: uid('e'), induk: gid, tipe: 'path', x: cx + cw + 8, y: y0 + 86, w: gap - 16, h: 20, vb: [gap - 16, 20], d: `M0 10H${gap - 24} M${gap - 30} 4L${gap - 18} 10L${gap - 30} 16`, fill: null, garis: { tebal: 2.5, warna: acc }, ujung: 'bulat' })
    })
  }
  ubah(d => {
    const cur = d.artboards.find(a => a.id === ab.id)
    cur.elemen.push({ id: gid, tipe: 'grup', nama: `Chart (${jenis})`, x: x0, y: y0, w: W, h: H, fill: null }, ...anak)
    cur.elemen = urutPohon(cur.elemen)
  })
  S.sel = [gid]; S.status = `Inserted ${jenis} ✓`; emit()
}

// Live Visual QA score & diagnostics right inside the canvas toolbar
function hitungQaCepat(doc) {
  if (!doc?.artboards?.length) return { skor: 0, masalah: ['No artboards.'], saran: [], metrik: [] }
  const masalah = [], saran = [], metrik = [], br = doc.brand && S.brands?.map?.[doc.brand]
  const potong = (a, b) => !(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1])
  for (const ab of doc.artboards) {
    const nm = `[${ab.nama || ab.id}]`, W = ab.w || 0, H = ab.h || 0, els = ab.elemen || []
    const m0 = masalah.length, s0 = saran.length, fSet = new Set(), ukList = []
    const safeM = Math.max(16, Math.round(Math.min(W, H) * 0.032))
    let minEdge = Infinity, inkArea = 0
    const box = e => {
      if (e.tipe === 'teks') { const L = layoutTeks(e); return [e.x || 0, e.y || 0, (e.x || 0) + (e.w || 400), (e.y || 0) + L.h] }
      return [e.x || 0, e.y || 0, (e.x || 0) + (e.w || 100), (e.y || 0) + (e.h || 100)]
    }
    els.forEach((el, i) => {
      if (el.sembunyi) return
      const b = box(el), dekor = el.tipe !== 'teks' && ((el.opacity ?? 1) < 0.6 || (b[2] - b[0]) * (b[3] - b[1]) > W * H * 0.6)
      if (!dekor && !el.induk) inkArea += Math.max(0, Math.min(W, b[2]) - Math.max(0, b[0])) * Math.max(0, Math.min(H, b[3]) - Math.max(0, b[1]))
      if (el.tipe !== 'teks') return
      if (el.font) fSet.add(el.font)
      const uk = el.ukuran || 32; ukList.push(uk)
      const out = b[0] < -2 || b[1] < -2 || b[2] > W + 2 || b[3] > H + 2
      if (out) masalah.push(`${nm} ${el.id}: text outside artboard.`)
      else if (!el.rotasi && W >= 300) { const e = Math.min(b[0], b[1], W - b[2], H - b[3]); minEdge = Math.min(minEdge, e); if (e < safeM) saran.push(`${nm} ${el.id}: tight edge margin (${Math.round(e)}px).`) }
      if ((el.lh ?? 1.2) < 0.85 && layoutTeks(el).lines.length >= 2) masalah.push(`${nm} ${el.id}: colliding line-height (${el.lh}).`)
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2
      let bg = typeof ab.bg === 'string' ? ab.bg : ab.bg?.warna?.[0] || '#FFFFFF'
      for (const prev of els.slice(0, i)) {
        if (prev.sembunyi) continue
        const pb = box(prev)
        if ((prev.tipe === 'kotak' || prev.tipe === 'elips' || prev.tipe === 'grup') && prev.fill && (prev.opacity ?? 1) >= 0.6 && pb[0] <= cx && cx <= pb[2] && pb[1] <= cy && cy <= pb[3]) bg = typeof prev.fill === 'string' ? prev.fill : prev.fill.warna?.[0] || bg
        if (prev.tipe === 'teks' && potong(b, pb)) masalah.push(`${nm} ${el.id}: overlaps text ${prev.id}.`)
      }
      const k = kontrasUI(el.warna || '#101634', bg)
      if (k < (uk >= 36 ? 2.6 : 3.5)) masalah.push(`${nm} ${el.id}: low contrast (${k.toFixed(1)}:1).`)
    })
    if (fSet.size > 3) saran.push(`${nm} uses ${fSet.size} font families (aim for ≤3).`)
    if (br?.fonts) {
      const okF = new Set([br.fonts.display, br.fonts.body, br.fonts.mono].filter(Boolean).map(x => x.toLowerCase()))
      const off = [...fSet].filter(x => okF.size && !okF.has(x.toLowerCase()))
      if (off.length) saran.push(`${nm} off-brand font(s): ${off.join(', ')}.`)
    }
    const abI = masalah.length - m0, abS = saran.length - s0
    metrik.push({ id: ab.id, nama: ab.nama || ab.id, skor: Math.max(0, 100 - abI * 18 - Math.min(30, abS * 4)), whitespacePct: Math.round((1 - Math.min(1, inkArea / Math.max(1, W * H))) * 100), minMarginPx: Number.isFinite(minEdge) ? Math.round(minEdge) : null, fonts: [...fSet] })
  }
  const skor = Math.round(metrik.reduce((a, m) => a + m.skor, 0) / metrik.length)
  return { skor, masalah, saran, metrik }
}

// Pure browser editable PowerPoint (.pptx, STORE ZIP) & HTML/React code exporters
function buatZipStore(files) {
  const enc = new TextEncoder(), crcT = new Uint32Array(256)
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); crcT[i] = c >>> 0 }
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
  const locals = [], centrals = []; let off = 0
  for (const [name, content] of files) {
    const nb = enc.encode(name), data = content instanceof Uint8Array ? content : enc.encode(String(content)), crc = crc32(data)
    const lh = new Uint8Array(30), lv = new DataView(lh.buffer)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nb.length, true)
    locals.push(lh, nb, data)
    const ch = new Uint8Array(46), cv = new DataView(ch.buffer)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true)
    centrals.push(ch, nb); off += lh.length + nb.length + data.length
  }
  const cLen = centrals.reduce((s, b) => s + b.length, 0), eocd = new Uint8Array(22), ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cLen, true); ev.setUint32(16, off, true)
  return new Blob([...locals, ...centrals, eocd], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
}
function buatPptxBrowser(doc) {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const hx = c => { let s = String(c || '').replace(/^#/, ''); if (s.length === 3) s = [...s].map(x => x + x).join(''); return /^[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : null }
  const fl = f => !f ? '<a:noFill/>' : isGrad(f) ? `<a:gradFill><a:gsLst>${f.warna.map((c, i) => `<a:gs pos="${f.warna.length === 1 ? 0 : Math.round(i / (f.warna.length - 1) * 100000)}"><a:srgbClr val="${hx(c) || '101634'}"/></a:gs>`).join('')}</a:gsLst><a:lin ang="${Math.round(((((f.sudut ?? 135) - 90) % 360) + 360) % 360 * 60000)}" scaled="1"/></a:gradFill>` : (hx(f) ? `<a:solidFill><a:srgbClr val="${hx(f)}"/></a:solidFill>` : '<a:noFill/>')
  const abs = doc.artboards || [], bW = abs[0]?.w || 1920, bH = abs[0]?.h || 1080, emu = 12192000 / Math.max(bW, bH)
  const files = [], overrides = [], presRels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'], sldIds = []
  abs.forEach((ab, idx) => {
    const n = idx + 1; let sid = 2
    const shapes = (ab.elemen || []).filter(e => !e.sembunyi).map(el => {
      const w = el.w || 100, hh = tinggi(el), xf = `<a:xfrm${el.rotasi ? ` rot="${Math.round(((el.rotasi % 360) + 360) % 360 * 60000)}"` : ''}><a:off x="${Math.round((el.x || 0) * emu)}" y="${Math.round((el.y || 0) * emu)}"/><a:ext cx="${Math.max(1, Math.round(w * emu))}" cy="${Math.max(1, Math.round(hh * emu))}"/></a:xfrm>`
      if (el.tipe === 'teks') {
        const algn = el.rata === 'tengah' ? 'ctr' : el.rata === 'kanan' ? 'r' : 'l', sz = Math.max(600, Math.round((el.ukuran || 32) * 0.75 * (emu / 6350) * 100))
        const txt = el.kapital ? String(el.teks ?? '').toUpperCase() : String(el.teks ?? '')
        const ps = txt.split('\n').map(l => `<a:p><a:pPr algn="${algn}"/><a:r><a:rPr lang="en-US" sz="${sz}" b="${(el.tebal || 400) >= 600 ? 1 : 0}" i="${el.miring ? 1 : 0}"><a:solidFill><a:srgbClr val="${hx(el.warna) || '101634'}"/></a:solidFill><a:latin typeface="${esc(el.font || 'Plus Jakarta Sans')}"/></a:rPr><a:t>${esc(l)}</a:t></a:r></a:p>`).join('')
        return `<p:sp><p:nvSpPr><p:cNvPr id="${sid++}" name="${esc(el.id)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xf}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>${ps}</p:txBody></p:sp>`
      }
      if (el.tipe === 'kotak' || el.tipe === 'elips' || (el.tipe === 'grup' && (el.fill || el.garis?.tebal))) {
        const prst = el.tipe === 'elips' ? 'ellipse' : (el.radius > 0 ? 'roundRect' : 'rect')
        const ln = el.garis?.tebal ? `<a:ln w="${Math.round(el.garis.tebal * emu)}"><a:solidFill><a:srgbClr val="${hx(el.garis.warna) || '101634'}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'
        return `<p:sp><p:nvSpPr><p:cNvPr id="${sid++}" name="${esc(el.id)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xf}<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fl(el.fill)}${ln}</p:spPr></p:sp>`
      }
      return ''
    }).join('')
    files.push([`ppt/slides/slide${n}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr>${fl(ab.bg || '#FFFFFF')}<a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`])
    files.push([`ppt/slides/_rels/slide${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`])
    overrides.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    presRels.push(`<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`)
    sldIds.push(`<p:sldId id="${256 + idx}" r:id="rId${n + 1}"/>`)
  })
  files.push(
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>${overrides.join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`],
    ['ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${sldIds.join('')}</p:sldIdLst><p:sldSz cx="${Math.round(bW * emu)}" cy="${Math.round(bH * emu)}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`],
    ['ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels.join('')}</Relationships>`],
    ['ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`],
    ['ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`]
  )
  return buatZipStore(files)
}
function eksporKodeBrowser(ab, mode = 'html') {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const els = (ab.elemen || []).filter(e => !e.sembunyi), byId = new Map(els.map(e => [e.id, e])), kids = new Map(), roots = []
  for (const e of els) { if (e.induk && byId.has(e.induk)) { if (!kids.has(e.induk)) kids.set(e.induk, []); kids.get(e.induk).push(e) } else roots.push(e) }
  const renderEl = (el, p, pad = '    ') => {
    const auto = !!p?.tata, w = Math.round(el.w || 100), hh = Math.round(tinggi(el))
    const px = p ? Math.round((el.x || 0) - (p.x || 0)) : Math.round(el.x || 0), py = p ? Math.round((el.y || 0) - (p.y || 0)) : Math.round(el.y || 0)
    const st = [auto ? '' : `position:absolute;left:${px}px;top:${py}px`, el.tipe !== 'teks' ? `width:${w}px;height:${hh}px` : `width:${w}px`, el.fill ? `background:${fillCss(el.fill)}` : '', el.radius ? `border-radius:${el.radius}px` : '', el.tipe === 'elips' ? 'border-radius:9999px' : '', el.garis?.tebal ? `border:${el.garis.tebal}px solid ${el.garis.warna || '#101634'}` : '', el.tata ? `display:flex;flex-direction:${el.tata.arah === 'baris' ? 'row' : 'column'};gap:${el.tata.jarak || 0}px;padding:${padding4(el.tata.padding).map(v => v + 'px').join(' ')}` : '', el.tipe === 'teks' ? `margin:0;font:${el.tebal || 400} ${el.ukuran || 32}px/${el.lh || 1.2} "${el.font || 'Plus Jakarta Sans'}",sans-serif;color:${el.warna || '#101634'};white-space:pre-wrap` : ''].filter(Boolean).join(';')
    if (el.tipe === 'teks') return `${pad}<p style="${st}">${esc(el.teks || '')}</p>`
    if (el.tipe === 'path') { const vb = el.vb || [w, hh]; return `${pad}<svg style="${st}" viewBox="0 0 ${vb[0]} ${vb[1]}"><path d="${esc(el.d || '')}" fill="${esc(typeof el.fill === 'string' ? el.fill : 'none')}"${el.garis?.tebal ? ` stroke="${esc(el.garis.warna || '#101634')}" stroke-width="${el.garis.tebal}"` : ''} /></svg>` }
    if (el.tipe === 'grup') { const ch = (kids.get(el.id) || []).map(c => renderEl(c, el, pad + '  ')).join('\n'); return `${pad}<div style="${st}">\n${ch}\n${pad}</div>` }
    return `${pad}<div style="${st}"></div>`
  }
  const inner = roots.map(r => renderEl(r, null)).join('\n')
  if (mode === 'react') {
    const jsx = inner.replace(/style="([^"]*)"/g, (_, s) => `style={{ ${s.split(';').filter(Boolean).map(kv => { const [k, ...v] = kv.split(':'); return `${k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())}: ${JSON.stringify(v.join(':').trim())}` }).join(', ')} }}`)
    return `export default function KanvasExport() {\n  return (\n    <section style={{ position: "relative", width: ${ab.w}, height: ${ab.h}, background: ${JSON.stringify(fillCss(ab.bg || '#FFFFFF'))}, overflow: "hidden", margin: "0 auto" }}>\n${jsx}\n    </section>\n  )\n}\n`
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(ab.nama || 'Kanvas Export')}</title><link rel="stylesheet" href="${GOOGLE_FONTS}"></head><body style="margin:0;background:#0f1117;display:grid;place-items:center;min-height:100vh"><main style="position:relative;width:${ab.w}px;height:${ab.h}px;background:${fillCss(ab.bg || '#FFFFFF')};overflow:hidden">\n${inner}\n</main></body></html>`
}
function bukaModalBrand(editBrand) {
  const awal = editBrand || { name: '', colors: { background: '#F4F1EA', surface: '#EAE5DA', text: '#111111', accent: '#E03E2D' }, fonts: { display: 'Syne', body: 'Inter', mono: 'IBM Plex Mono' }, style: { direction: 'swiss-editorial' } }
  function FormBrand() {
    const [nm, setNm] = useState(awal.name || '')
    const [bg, setBg] = useState(awal.colors?.background || '#F4F1EA')
    const [sf, setSf] = useState(awal.colors?.surface || '#EAE5DA')
    const [tx, setTx] = useState(awal.colors?.text || '#111111')
    const [ac, setAc] = useState(awal.colors?.accent || awal.colors?.primary || '#E03E2D')
    const [df, setDf] = useState(awal.fonts?.display || 'Syne')
    const [bf, setBf] = useState(awal.fonts?.body || 'Inter')
    const [dir, setDir] = useState(awal.style?.direction || 'swiss-editorial')
    const simpan = async () => {
      const clean = nm.trim(); if (!clean) return
      const id = editBrand?.id || clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'brand'
      const cur = S.brands || { defaultId: null, map: {} }
      const next = {
        ...(cur.map[id] || { logos: [], assets: [] }),
        id, name: clean,
        colors: { primary: ac.toUpperCase(), accent: ac.toUpperCase(), background: bg.toUpperCase(), surface: sf.toUpperCase(), text: tx.toUpperCase(), muted: tx.toUpperCase() },
        fonts: { display: df.trim() || 'Plus Jakarta Sans', body: bf.trim() || 'Inter', mono: 'IBM Plex Mono' },
        style: { ...(cur.map[id]?.style || {}), direction: dir },
        updatedAt: new Date().toISOString()
      }
      await simpanBrandStore({ defaultId: cur.defaultId || id, map: { ...cur.map, [id]: next } })
      S.modal = null; S.status = `Saved Brand Kit "${clean}" ✓`; emit()
    }
    return h('div', { className: 'kv-bform' },
      h('label', { className: 'kv-f' }, h('span', null, 'Brand Name'), h('input', { value: nm, placeholder: 'e.g. Atelier Nord', onChange: e => setNm(e.target.value) })),
      h('div', { className: 'kv-row' },
        h('label', { className: 'kv-f' }, h('span', null, 'Display Font'), h('input', { value: df, onChange: e => setDf(e.target.value) })),
        h('label', { className: 'kv-f' }, h('span', null, 'Body Font'), h('input', { value: bf, onChange: e => setBf(e.target.value) }))),
      h('div', { className: 'kv-row' },
        [['BG', bg, setBg], ['Surface', sf, setSf], ['Text', tx, setTx], ['Accent', ac, setAc]].map(([l, v, s]) =>
          h('label', { key: l, className: 'kv-f' }, h('span', null, l), h('input', { type: 'color', value: v, onChange: e => s(e.target.value) })))),
      h('label', { className: 'kv-f' }, h('span', null, 'Art Direction'),
        h('select', { value: dir, onChange: e => setDir(e.target.value) }, GAYA_ARAH.filter(([k]) => k !== 'auto').map(([k, l]) => h('option', { key: k, value: k }, l)))),
      h('div', { className: 'kv-mact' },
        h(Button, { variant: 'secondary', size: 'sm', onClick: () => { S.modal = null; emit() } }, 'Cancel'),
        h(Button, { size: 'sm', onClick: simpan }, 'Save Brand Kit')))
  }
  S.modal = { judul: editBrand ? `Edit Brand · ${editBrand.name}` : 'New Brand Kit', konten: h(FormBrand), tanpaAksi: true }
  emit()
}

/* =============== 7c. FLOATING PROMPT BAR (BYOK / CLOUD HOST CONTRACT) =============== */
// Cloud-ready host.chat contract:
// - Hidden automatically on Hermes Desktop (where @hermes/plugin-sdk has no host.chat).
// - Active on Standalone browser (app/main.js sets host.chat) or any host providing host.chat / ctx.chat.
// - Supports optional host.chat.renderSlot() (e.g. cloud credit counter), getConfig/saveConfig, openSettings, starterChips.
function aktifChatHost() {
  const c = S.ctx?.chat !== undefined ? S.ctx.chat : host.chat
  return typeof c === 'function' ? c : null
}

const BYOK_PRESETS_DEFAULT = [
  { id: 'ollama', label: 'Ollama Lokal', baseUrl: 'http://localhost:11434/v1', defaultModel: 'qwen2.5:14b', requiresKey: false, hint: 'Gratis & lokal di perangkat Anda' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-3.5-sonnet', requiresKey: true, hint: 'Satu key untuk Claude, GPT, Gemini' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', requiresKey: true, hint: 'API resmi OpenAI' },
  { id: 'custom', label: 'Custom URL', baseUrl: '', defaultModel: '', requiresKey: false, hint: 'LM Studio, vLLM, Groq, dll.' }
]

const LABEL_ALAT_CHAT = {
  kanvas_guide: 'Membaca panduan desain…',
  kanvas_status: 'Memeriksa ruang kerja…',
  kanvas_art_direction: 'Merancang arahan visual…',
  kanvas_brand: 'Menyelaraskan Brand Kit…',
  kanvas_create: 'Membuat kanvas baru…',
  kanvas_read: 'Membaca struktur kanvas…',
  kanvas_edit: 'Menyusun layout & elemen…',
  kanvas_resize: 'Menyesuaikan ukuran kanvas…',
  kanvas_campaign: 'Menyiapkan materi kampanye…',
  kanvas_dataviz: 'Membuat grafik & tabel data…',
  kanvas_presentation: 'Menyusun slide presentasi…',
  kanvas_to_code: 'Menghasilkan kode frontend…',
  kanvas_assets: 'Mengelola pustaka aset…',
  kanvas_community: 'Mengakses template komunitas…',
  kanvas_view: 'Memeriksa kualitas visual…',
  kanvas_document: 'Membaca dokumen…',
  kanvas_export: 'Mengekspor hasil desain…',
  kanvas_templates: 'Mencari template siap pakai…',
  kanvas_comments: 'Membaca pin komentar…',
  kanvas_resolve_comment: 'Menyelesaikan pin komentar…',
  kanvas_icons: 'Mencari ikon vektor…',
  kanvas_import_image: 'Mengimpor gambar ke kanvas…',
  kanvas_open: 'Menyiapkan pratinjau studio…'
}
const labelAlatRamah = (name, explicit) => explicit || LABEL_ALAT_CHAT[name] || 'Memproses desain…'
const formatUkuranFile = b => !b ? '' : b < 1024 ? b + ' B' : b < 1024 * 1024 ? Math.round(b / 1024) + ' KB' : (b / (1024 * 1024)).toFixed(1) + ' MB'
const ikonLampiran = name => /\.pdf$/i.test(name) ? '📄' : /\.(xlsx|csv)$/i.test(name) ? '📊' : '🖼'

async function muatChatConfig(paksa = false) {
  const chat = aktifChatHost()
  if (!chat || typeof chat.getConfig !== 'function') return null
  if (S.chatConfigLoaded && !paksa) return S.chatConfig
  try {
    const r = await chat.getConfig()
    if (r?.ok) { S.chatConfig = r; S.chatConfigLoaded = true; emit(); return r }
  } catch {}
  return S.chatConfig
}

function starterChipsKontekstual(chat) {
  if (Array.isArray(chat?.starterChips) && chat.starterChips.length) return chat.starterChips.slice(0, 3)
  if (halamanQuickEdit(abAktif())) {
    return [
      { label: 'Tambal teks di PDF ini', prompt: 'Bantu periksa halaman PDF Quick Edit ini dan arahkan teks mana yang bisa diperbarui tanpa mengubah desain aslinya.' },
      { label: 'Buat ringkasan A4', prompt: 'Buat halaman laporan A4 ringkas dari isi dokumen ini dengan struktur rapi, lalu cek kualitas visualnya.' },
      { label: 'Ekspor data ke Excel', prompt: 'Ekstrak data tabel dari dokumen ini ke file Excel (.xlsx) di ruang kerja.' }
    ]
  }
  return [
    { label: 'Buat laporan A4 dari Excel', prompt: 'Buat laporan A4 dari Excel yang saya lampirkan dengan ringkasan metrik dan tabel rapi, lalu periksa kualitas visualnya.' },
    { label: 'Edit PDF tanpa ubah desain', prompt: 'Impor PDF yang saya lampirkan dalam mode Quick Edit agar latar desain asli tetap utuh dan siap ditambal teks.' },
    { label: 'Buat deck 5 slide', prompt: 'Buat deck 5 slide presentasi modern lengkap dengan cover, metrik utama, grafik pertumbuhan, tabel perbandingan, dan penutup.' }
  ]
}

function tambahLampiranChat(fileList) {
  const okExt = /\.(pdf|xlsx|csv|png|jpe?g|svg)$/i
  const next = [...(S.chatAttachments || [])]
  let ditolak = 0
  for (const f of Array.from(fileList || [])) {
    if (!okExt.test(f.name)) { ditolak++; continue }
    if (f.size > 32 * 1024 * 1024) { host.notify({ kind: 'info', message: `File "${f.name}" melebihi batas 32 MiB.` }); continue }
    if (next.length >= 6) { host.notify({ kind: 'info', message: 'Maksimal 6 file lampiran per pesan.' }); break }
    next.push({ id: uid('att'), file: f, name: f.name, size: f.size })
  }
  if (ditolak) host.notify({ kind: 'info', message: 'Format yang didukung: PDF, XLSX, CSV, PNG, JPG, atau SVG.' })
  S.chatAttachments = next
  emit()
}

function hapusLampiranChat(id) {
  S.chatAttachments = (S.chatAttachments || []).filter(x => x.id !== id)
  emit()
}

async function muatUlangFileDariChat(file) {
  if (!file || !S.folder) return
  await muatDaftar()
  if (file !== S.file || S.fase !== 'siap') {
    if (S.files.includes(file)) await buka(file)
    return
  }
  const r = await S.ctx.files.readText(S.folder.id, file)
  if (!r.ok) return
  let d; try { d = normalisasi(JSON.parse(r.text)) } catch { return }
  const lamaDoc = S.doc, lamaAb = S.doc?.artboards.length || 0
  snap()
  S.doc = d; S.lastMtime = r.mtimeMs || Date.now(); bersihSel()
  if (lamaDoc) jalankanBot(bedaDoc(lamaDoc, d))
  for (const k of Object.keys(S.img)) if (S.img[k].status === 'gagal') delete S.img[k]
  S.status = 'Diperbarui AI · ' + new Date().toLocaleTimeString()
  if (S.ikuti && d.artboards.length > lamaAb) { S.ab = d.artboards.at(-1).id; setTimeout(() => fitAb(abAktif()), 30) }
  emit()
}

function hentikanChatLokal() {
  if (S.chatAbort) { try { S.chatAbort.abort() } catch {} }
}

async function kirimChatLokal({ prompt = '', attachments } = {}) {
  const chat = aktifChatHost()
  if (!chat || S.chatBusy) return false
  const teks = String(prompt ?? S.chatDraft ?? '').trim()
  const lampiran = attachments !== undefined ? attachments : (S.chatAttachments || [])
  if (!teks && !lampiran.length) return false

  if (typeof chat.getConfig === 'function') {
    await muatChatConfig()
    if (!S.chatConfig?.configured) {
      bukaModalByok({
        notice: 'Atur Ollama lokal atau API key BYOK dulu untuk mulai chat langsung di browser — atau hubungkan lewat MCP (Claude Code / Cursor / Hermes).',
        pendingPrompt: teks
      })
      return false
    }
  }

  if (S.dirty) await simpanSekarang()
  const ac = new AbortController()
  S.chatAbort = ac
  S.chatBusy = true
  S.agenSibuk = true
  S.chatDrawerOpen = true
  S.chatDrawerMin = false
  if (prompt === '' || prompt === S.chatDraft) S.chatDraft = ''
  if (attachments === undefined) S.chatAttachments = []

  const userEntry = { id: uid('cu'), kind: 'user', text: teks || 'Proses file lampiran ke kanvas', attachments: lampiran.map(a => a.name) }
  const thinkId = uid('ck')
  S.chatLog = [...S.chatLog.slice(-40), userEntry, { id: thinkId, kind: 'thinking', text: 'Menghubungi agen desain…' }]
  emit()

  const buangThinking = () => { S.chatLog = S.chatLog.filter(x => x.kind !== 'thinking') }
  let updatedCanvas = null

  try {
    await chat({
      prompt: teks,
      attachments: lampiran,
      file: S.file,
      artboard: S.ab,
      selection: S.sel,
      history: S.chatHistory.slice(-10),
      signal: ac.signal,
      onEvent: ev => {
        if (!ev) return
        if (ev.type === 'thinking') {
          const cur = S.chatLog.find(x => x.kind === 'thinking')
          if (cur) cur.text = ev.message || 'Menyusun rencana desain…'
          else S.chatLog = [...S.chatLog, { id: uid('ck'), kind: 'thinking', text: ev.message || 'Menyusun rencana desain…' }]
          emit()
        } else if (ev.type === 'tool_call') {
          buangThinking()
          S.chatLog = [...S.chatLog, { id: uid('ct'), kind: 'tool', toolId: ev.id, name: ev.name, label: labelAlatRamah(ev.name, ev.label), status: 'running', summary: '' }]
          emit()
        } else if (ev.type === 'tool_result') {
          const item = [...S.chatLog].reverse().find(x => x.kind === 'tool' && (x.toolId === ev.id || (x.name === ev.name && x.status === 'running')))
          if (item) { item.status = ev.ok === false ? 'error' : 'done'; item.summary = ev.summary || '' }
          emit()
        } else if (ev.type === 'canvas_updated') {
          if (ev.file) { updatedCanvas = ev.file; muatUlangFileDariChat(ev.file).catch(() => {}) }
        } else if (ev.type === 'done') {
          buangThinking()
          const replyText = ev.text || (ev.file ? `Selesai memperbarui ${ev.file}.` : 'Selesai.')
          S.chatLog = [...S.chatLog, { id: uid('ca'), kind: 'assistant', text: replyText, file: ev.file || updatedCanvas }]
          S.chatHistory = [...S.chatHistory.slice(-10), { role: 'user', content: teks || userEntry.text }, { role: 'assistant', content: replyText }]
          if (updatedCanvas && ev.file && ev.file !== updatedCanvas) muatUlangFileDariChat(ev.file).catch(() => {})
          emit()
        } else if (ev.type === 'error') {
          buangThinking()
          S.chatLog = [...S.chatLog, { id: uid('ce'), kind: 'error', code: ev.code, text: ev.message || 'Gagal memproses permintaan.' }]
          emit()
          if (ev.code === 'not-configured') bukaModalByok({ notice: ev.message, pendingPrompt: teks })
        }
      }
    })
  } finally {
    buangThinking()
    S.chatBusy = false
    S.chatAbort = null
    S.agenSibuk = false
    emit()
  }
  return true
}

function bukaModalByok({ notice = '', pendingPrompt = '' } = {}) {
  const chat = aktifChatHost()
  if (!chat) return
  if (typeof chat.openSettings === 'function') { chat.openSettings(); return }
  const initCfg = S.chatConfig || { provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:14b', hasApiKey: false, apiKeyPreview: '', presets: BYOK_PRESETS_DEFAULT }
  const presets = Array.isArray(initCfg.presets) && initCfg.presets.length ? initCfg.presets : BYOK_PRESETS_DEFAULT

  function FormByok() {
    const [provider, setProvider] = useState(initCfg.provider || 'ollama')
    const [baseUrl, setBaseUrl] = useState(initCfg.baseUrl || 'http://localhost:11434/v1')
    const [model, setModel] = useState(initCfg.model || 'qwen2.5:14b')
    const [apiKey, setApiKey] = useState('')
    const [hasKey, setHasKey] = useState(!!initCfg.hasApiKey)
    const [preview, setPreview] = useState(initCfg.apiKeyPreview || '')
    const [clearKey, setClearKey] = useState(false)
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')

    useEffect(() => {
      muatChatConfig(true).then(c => {
        if (!c?.ok) return
        setProvider(c.provider || 'ollama')
        setBaseUrl(c.baseUrl || 'http://localhost:11434/v1')
        setModel(c.model || (c.provider === 'ollama' ? 'qwen2.5:14b' : ''))
        setHasKey(!!c.hasApiKey)
        setPreview(c.apiKeyPreview || '')
      })
    }, [])

    const pilihPreset = p => {
      setProvider(p.id)
      if (p.baseUrl) setBaseUrl(p.baseUrl)
      if (p.defaultModel) setModel(p.defaultModel)
      setErr('')
    }

    const aktifPreset = presets.find(p => p.id === provider) || presets[0]
    const simpan = async () => {
      if (!baseUrl.trim()) { setErr('Isi Base URL endpoint OpenAI-compatible atau pilih preset.'); return }
      if (!model.trim()) { setErr('Isi nama model yang ingin digunakan.'); return }
      if (aktifPreset?.requiresKey && !apiKey.trim() && (!hasKey || clearKey)) {
        setErr(`Provider ${aktifPreset.label} memerlukan API key. Atau pilih Ollama Lokal tanpa API key.`)
        return
      }
      setBusy(true); setErr('')
      try {
        const res = await chat.saveConfig({
          provider,
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(clearKey ? { clearApiKey: true } : {})
        })
        if (!res?.ok) { setErr(res?.message || 'Gagal menyimpan pengaturan AI.'); setBusy(false); return }
        S.chatConfig = res; S.chatConfigLoaded = true
        if (pendingPrompt && !S.chatDraft) S.chatDraft = pendingPrompt
        S.modal = null; emit()
        host.notify({ kind: 'info', message: `AI siap (${aktifPreset?.label || provider} · ${res.model}) ✓` })
      } catch (e) {
        setErr(e?.message || 'Gagal menyimpan pengaturan.')
      } finally { setBusy(false) }
    }

    const salinMcp = async () => {
      const cmd = 'npx -y kanvas-studio mcp'
      await S.ctx?.os?.writeClipboard?.(cmd)
      host.notify({ kind: 'info', message: 'Perintah MCP disalin: ' + cmd })
    }

    return h('div', { className: 'kv-byok' },
      notice ? h('div', { className: 'kv-byok-notice' }, notice) : null,
      h('div', { className: 'kv-byok-presets', role: 'group', 'aria-label': 'Preset provider AI' },
        presets.map(p => h('button', {
          key: p.id, type: 'button',
          className: 'kv-byok-preset' + (provider === p.id ? ' on' : ''),
          onClick: () => pilihPreset(p)
        }, h('b', null, p.label), h('span', null, p.hint || p.baseUrl || 'Endpoint bebas')))),
      h('label', { className: 'kv-f' },
        h('span', null, 'Base URL (OpenAI-compatible)'),
        h('input', { value: baseUrl, placeholder: 'http://localhost:11434/v1', onChange: e => setBaseUrl(e.target.value) })),
      h('label', { className: 'kv-f' },
        h('span', null, 'Nama Model'),
        h('input', { value: model, placeholder: aktifPreset?.defaultModel || 'qwen2.5:14b / gpt-4o', onChange: e => setModel(e.target.value) })),
      h('label', { className: 'kv-f' },
        h('span', null, 'API Key ', h('i', { className: 'kv-fhint' }, aktifPreset?.requiresKey ? '· wajib untuk provider ini' : '· opsional untuk Ollama / server lokal')),
        h('input', {
          type: 'password', value: apiKey, autoComplete: 'off',
          placeholder: hasKey && !clearKey ? `Tersimpan (${preview || '••••'}) — kosongkan jika tidak diubah` : (aktifPreset?.requiresKey ? 'sk-...' : 'Kosongkan untuk Ollama lokal'),
          onChange: e => { setApiKey(e.target.value); if (e.target.value) setClearKey(false) }
        })),
      hasKey && !clearKey ? h('div', { className: 'kv-byok-keyrow' },
        h('span', null, `Key tersimpan lokal: ${preview || '••••'}`),
        h('button', { type: 'button', className: 'kv-blink', onClick: () => { setClearKey(true); setApiKey('') } }, 'Hapus key')) : null,
      err ? h('div', { className: 'kv-byok-err', role: 'alert' }, err) : null,
      h('div', { className: 'kv-byok-guide' },
        h('b', null, 'Tanpa API key? Tetap bisa langsung jalan!'),
        h('p', null, 'Pilih Ollama Lokal (gratis & offline), atau hubungkan langsung Claude Code, Cursor, Codex, atau Hermes Desktop lewat MCP tanpa konfigurasi key di sini.'),
        h('div', { className: 'kv-byok-mcp' },
          h('code', null, 'npx -y kanvas-studio mcp'),
          h('button', { type: 'button', onClick: salinMcp }, 'Salin MCP'))),
      h('div', { className: 'kv-mact' },
        h(Button, { variant: 'secondary', size: 'sm', onClick: () => { S.modal = null; emit() } }, 'Batal'),
        h(Button, { size: 'sm', disabled: busy, onClick: simpan }, busy ? 'Menyimpan…' : 'Simpan Pengaturan')))
  }

  S.modal = { judul: 'Pengaturan AI Lokal (BYOK / Ollama)', konten: h(FormByok), tanpaAksi: true }
  emit()
}

function AgentProgressDrawer() {
  const chat = aktifChatHost()
  const bodyRef = useRef(null)
  useEffect(() => {
    if (bodyRef.current && !S.chatDrawerMin) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [S.chatLog.length, S.chatBusy, S.chatDrawerMin])
  if (!chat || (!S.chatDrawerOpen && !S.chatBusy) || !S.chatLog.length) return null

  const toolSteps = S.chatLog.filter(x => x.kind === 'tool')
  const runningTool = [...toolSteps].reverse().find(x => x.status === 'running')
  const lastThink = [...S.chatLog].reverse().find(x => x.kind === 'thinking')
  const lastErr = [...S.chatLog].reverse().find(x => x.kind === 'error')
  const doneCount = toolSteps.filter(x => x.status === 'done').length
  const statusText = S.chatBusy
    ? (runningTool?.label || lastThink?.text || 'Agen sedang bekerja…')
    : lastErr && S.chatLog.at(-1)?.kind === 'error'
      ? 'Perlu perhatian'
      : doneCount ? `Selesai · ${doneCount} langkah` : 'Respons agen'
  const dotCls = S.chatBusy ? 'kerja' : (S.chatLog.at(-1)?.kind === 'error' ? 'err' : 'ok')

  return h('aside', {
    className: 'kv-drawer' + (S.chatDrawerMin ? ' min' : ''),
    'aria-label': 'Progres Agen AI',
    onPointerDown: e => e.stopPropagation()
  },
    h('div', { className: 'kv-drawer-head', onClick: () => { S.chatDrawerMin = !S.chatDrawerMin; emit() } },
      h('i', { className: 'kv-drawer-dot ' + dotCls }),
      h('span', { className: 'kv-drawer-title' }, statusText),
      h('div', { className: 'kv-drawer-act', onClick: e => e.stopPropagation() },
        h('button', { type: 'button', title: S.chatDrawerMin ? 'Perluas progres' : 'Perkecil progres', 'aria-label': S.chatDrawerMin ? 'Perluas progres' : 'Perkecil progres', onClick: () => { S.chatDrawerMin = !S.chatDrawerMin; emit() } }, S.chatDrawerMin ? '▴' : '▾'),
        !S.chatBusy ? h('button', { type: 'button', title: 'Tutup progres', 'aria-label': 'Tutup progres', onClick: () => { S.chatDrawerOpen = false; emit() } }, '✕') : null)),
    !S.chatDrawerMin ? h('div', { ref: bodyRef, className: 'kv-drawer-body' },
      S.chatLog.map(item => {
        if (item.kind === 'user') return h('div', { key: item.id, className: 'kv-dmsg kv-dmsg-user' },
          h('span', null, item.text),
          item.attachments?.length ? h('div', { className: 'kv-dmsg-atts' }, item.attachments.map((n, i) => h('em', { key: i }, ikonLampiran(n) + ' ' + n))) : null)
        if (item.kind === 'thinking') return h('div', { key: item.id, className: 'kv-dstep running' }, h('i', { className: 'kv-dspin' }), h('span', null, item.text))
        if (item.kind === 'tool') return h('div', { key: item.id, className: 'kv-dstep ' + item.status },
          h('i', { className: item.status === 'running' ? 'kv-dspin' : 'kv-dcheck' }, item.status === 'done' ? '✓' : item.status === 'error' ? '!' : ''),
          h('span', null, item.label))
        if (item.kind === 'error') return h('div', { key: item.id, className: 'kv-dmsg kv-dmsg-err' }, item.text)
        return h('div', { key: item.id, className: 'kv-dmsg kv-dmsg-ai' },
          h('p', null, item.text),
          item.file && item.file !== S.file ? h('button', { type: 'button', className: 'kv-dopen', onClick: () => buka(item.file) }, 'Buka ' + item.file) : null)
      })) : null)
}

function FloatingPromptBar() {
  const chat = aktifChatHost()
  const fileRef = useRef(null), taRef = useRef(null)
  const [drag, setDrag] = useState(false)
  if (!chat) return null

  const chips = starterChipsKontekstual(chat)
  const showChips = !S.chatBusy && !S.chatLog.length && !S.chatDraft.trim() && !(S.chatAttachments || []).length
  const cfg = S.chatConfig
  const hasSettings = typeof chat.getConfig === 'function' || typeof chat.openSettings === 'function'
  const settingsTitle = cfg?.configured
    ? `Pengaturan AI · ${cfg.provider} (${cfg.model})`
    : 'Pengaturan AI (BYOK / Ollama) — belum diatur'

  const autoResize = el => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(108, Math.max(24, el.scrollHeight)) + 'px'
  }
  const pilihChip = prompt => {
    S.chatDraft = prompt; emit()
    setTimeout(() => { if (taRef.current) { taRef.current.focus(); autoResize(taRef.current) } }, 20)
  }
  const kirim = () => {
    if (S.chatBusy) return
    if (!S.chatDraft.trim() && !(S.chatAttachments || []).length) return
    kirimChatLokal({ prompt: S.chatDraft })
    setTimeout(() => autoResize(taRef.current), 20)
  }

  return h('div', {
    className: 'kv-promptwrap',
    'data-testid': 'floating-prompt-bar',
    onPointerDown: e => e.stopPropagation()
  },
    showChips ? h('div', { className: 'kv-pb-chips', role: 'list', 'aria-label': 'Contoh prompt cepat' },
      chips.map(c => h('button', { key: c.label, type: 'button', className: 'kv-pb-chip', onClick: () => pilihChip(c.prompt) }, c.label))) : null,
    h('div', {
      className: 'kv-promptbar' + (drag ? ' drag' : '') + (S.chatBusy ? ' busy' : ''),
      onDragOver: e => { e.preventDefault(); setDrag(true) },
      onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false) },
      onDrop: e => { e.preventDefault(); setDrag(false); tambahLampiranChat(e.dataTransfer.files) }
    },
      (S.chatAttachments || []).length ? h('div', { className: 'kv-pb-atts' },
        S.chatAttachments.map(a => h('span', { key: a.id, className: 'kv-pb-pill' },
          h('i', null, ikonLampiran(a.name)),
          h('b', { title: a.name }, a.name),
          a.size ? h('em', null, formatUkuranFile(a.size)) : null,
          h('button', { type: 'button', 'aria-label': 'Hapus lampiran ' + a.name, onClick: () => hapusLampiranChat(a.id) }, '×')))) : null,
      h('div', { className: 'kv-pb-row' },
        h('input', {
          ref: fileRef, type: 'file', hidden: true, multiple: true,
          accept: '.pdf,.xlsx,.csv,.png,.jpg,.jpeg,.svg',
          'aria-label': 'Lampirkan PDF, Excel, CSV, atau gambar',
          onChange: e => { tambahLampiranChat(e.target.files); e.target.value = '' }
        }),
        h('button', {
          type: 'button', className: 'kv-pb-add',
          title: 'Lampirkan PDF, Excel, CSV, atau gambar',
          'aria-label': 'Lampirkan file',
          disabled: S.chatBusy,
          onClick: () => fileRef.current?.click()
        }, '+'),
        h('textarea', {
          ref: taRef, rows: 1, className: 'kv-pb-input',
          value: S.chatDraft,
          disabled: S.chatBusy,
          placeholder: S.chatBusy ? 'Agen AI sedang bekerja…' : 'Minta AI desain, edit, atau impor…',
          onChange: e => { S.chatDraft = e.target.value; autoResize(e.target); emit() },
          onKeyDown: e => {
            e.stopPropagation()
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirim() }
          }
        }),
        typeof chat.renderSlot === 'function' ? h('div', { className: 'kv-pb-slot' }, chat.renderSlot()) : null,
        hasSettings ? h('button', {
          type: 'button', className: 'kv-pb-cfg' + (cfg?.configured ? ' ready' : ''),
          title: settingsTitle,
          'aria-label': 'Pengaturan AI',
          onClick: () => bukaModalByok()
        }, '⚙', h('i', { className: 'kv-pb-dot' })) : null,
        S.chatBusy
          ? h('button', { type: 'button', className: 'kv-pb-send stop', title: 'Hentikan agen', 'aria-label': 'Hentikan agen', onClick: hentikanChatLokal }, '■')
          : h('button', {
            type: 'button', className: 'kv-pb-send',
            title: 'Kirim (Enter)', 'aria-label': 'Kirim prompt',
            disabled: !S.chatDraft.trim() && !(S.chatAttachments || []).length,
            onClick: kirim
          }, '↑'))))
}
/* =============== 8. KOMPONEN TAMPILAN =============== */
function ElView({ el }) {
  const w = el.w || 100, hh = tinggi(el)
  const st = { position: 'absolute', left: el.x, top: el.y, width: w, height: hh, opacity: el.opacity ?? 1, transform: el.rotasi ? `rotate(${el.rotasi}deg)` : undefined, display: el.sembunyi ? 'none' : undefined, boxSizing: 'border-box' }
  if (el.tipe === 'kotak' || el.tipe === 'elips' || el.tipe === 'grup') {
    Object.assign(st, { background: fillCss(el.fill), borderRadius: el.tipe === 'elips' ? '50%' : (el.radius || 0), border: el.garis?.tebal ? `${el.garis.tebal}px solid ${el.garis.warna || '#000'}` : undefined, boxShadow: el.bayangan ? '0 18px 48px rgba(16,22,52,.28)' : undefined })
    return h('div', { 'data-id': el.id, className: S.sorot.has(el.id) ? 'kv-sorot' : undefined, style: st })
  }
  if (el.tipe === 'teks') {
    if (S.edit === el.id) return null
    const L = layoutTeks(el)
    Object.assign(st, { font: fontStr(el), color: el.warna || '#101634', letterSpacing: (el.spasi || 0) + 'px', textAlign: el.rata === 'tengah' ? 'center' : el.rata === 'kanan' ? 'right' : 'left' })
    return h('div', { 'data-id': el.id, className: S.sorot.has(el.id) ? 'kv-sorot' : undefined, style: st }, L.lines.map((ln, i) => h('div', { key: i, style: { height: L.lh, lineHeight: L.lh + 'px', whiteSpace: 'pre' } }, ln || '\u200b')))
  }
  if (el.tipe === 'path') {
    const k = skalaPath(el), gid = 'kvg-' + el.id, sw = el.garis?.tebal ? el.garis.tebal / Math.min(k.sx, k.sy) : 0
    return h('div', { 'data-id': el.id, className: S.sorot.has(el.id) ? 'kv-sorot' : undefined, style: { ...st, filter: el.bayangan ? 'drop-shadow(0 18px 24px rgba(16,22,52,.28))' : undefined } },
      h('svg', { width: '100%', height: '100%', viewBox: `0 0 ${k.vw} ${k.vh}`, preserveAspectRatio: 'none', style: { overflow: 'visible', display: 'block' } },
        isGrad(el.fill) ? h('defs', null, h('linearGradient', { id: gid, ...gradSvg(el.fill) }, el.fill.warna.map((c, i) => h('stop', { key: i, offset: el.fill.warna.length === 1 ? 0 : i / (el.fill.warna.length - 1), stopColor: c })))) : null,
        h('path', { d: String(el.d || ''), fill: isGrad(el.fill) ? `url(#${gid})` : (el.fill || 'none'), fillRule: el.aturan === 'evenodd' ? 'evenodd' : 'nonzero', stroke: sw ? (el.garis.warna || '#101634') : 'none', strokeWidth: sw, strokeLinecap: CAP[el.ujung] || 'round', strokeLinejoin: el.ujung === 'datar' ? 'miter' : 'round' })))
  }
  if (el.tipe === 'gambar') {
    const gm = gambar(el.src)
    Object.assign(st, { borderRadius: el.radius || 0, overflow: 'hidden', background: gm ? `center/${el.fit === 'contain' ? 'contain' : 'cover'} no-repeat url("${gm.url}")` : 'repeating-conic-gradient(#e9ebf2 0 25%, #f7f8fb 0 50%) 0 0/24px 24px' })
    return h('div', { 'data-id': el.id, className: S.sorot.has(el.id) ? 'kv-sorot' : undefined, style: st }, gm ? null : h('div', { className: 'kv-ph' }, S.img[el.src]?.status === 'gagal' ? 'Image not found' : 'Loading image…'))
  }
  return null
}
function AbIsi({ ab }) {
  return h('div', { style: { position: 'absolute', inset: 0, background: fillCss(ab.bg || '#FFFFFF'), overflow: 'hidden' } }, ab.elemen.map(el => h(ElView, { key: el.id, el })))
}
function Thumb({ ab, lebar }) {
  const s = lebar / ab.w
  return h('div', { className: 'kv-thumb', style: { width: lebar, height: ab.h * s } },
    h('div', { style: { position: 'absolute', left: 0, top: 0, width: ab.w, height: ab.h, transform: `scale(${s})`, transformOrigin: '0 0', pointerEvents: 'none' } }, h(AbIsi, { ab })))
}

const HANDLE = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
function Seleksi() {
  const items = terpilih().filter(f => !terkunci(f.ab, f.el)); if (!items.length) return null
  const bisaUkur = items.length === 1 && !denganTurunan(items).some(f => terkunci(f.ab, f.el))
  const z = S.zoom
  return h(Fragment, null, items.map(({ ab, el }) => {
    const w = el.w || 100, hh = tinggi(el), X = ab.x + el.x, Y = ab.y + el.y
    return h('div', { key: el.id, className: 'kv-sel', style: { left: X, top: Y, width: w, height: hh, borderWidth: 2 / z, transform: el.rotasi ? `rotate(${el.rotasi}deg)` : undefined } },
      bisaUkur ? HANDLE.filter(k => el.tipe !== 'teks' || k === 'e' || k === 'w').map(k => h('div', { key: k, 'data-h': k, className: 'kv-h kv-h-' + k, style: { width: 10 / z, height: 10 / z, margin: -5 / z, borderWidth: 1.5 / z } })) : null,
      items.length === 1 ? h('div', { className: 'kv-dim', style: { fontSize: 11 / z, top: hh + 6 / z, padding: `${2 / z}px ${6 / z}px`, borderRadius: 6 / z } }, `${Math.round(w)} × ${Math.round(hh)}`) : null)
  }))
}
function halamanQuickEdit(ab) {
  return !!ab?.elemen.some(e => e.kunci && e.tipe === 'gambar' && e.nama === 'PDF background')
}
// Use the same font metrics as layoutTeks, without changing the cover or adjacent content.
function ukurPatch(el, kotak) {
  const isi = el.kapital ? el.teks.toUpperCase() : el.teks
  const c = mctx(), jarak = (el.spasi || 0) * Math.max(0, isi.length - 1)
  const batas = Math.floor(Math.min(el.patch.ukuran, kotak.h / (el.lh || 1.2)))
  for (let ukuran = batas; ukuran >= 8; ukuran--) {
    c.font = fontStr({ ...el, ukuran })
    if (c.measureText(isi).width + jarak <= el.w - 0.5) return ukuran
  }
  return null
}
function tambahPatch() {
  const ab = abAktif()
  if (!halamanQuickEdit(ab)) return
  const v = ukuranView(), pilihan = terpilih().find(f => f.ab === ab && !terkunci(ab, f.el))?.el
  const area = S.patchArea?.ab === ab.id ? S.patchArea : pilihan && { x: pilihan.x, y: pilihan.y, w: pilihan.w, h: tinggi(pilihan) }
  const w = Math.min(ab.w, area?.w > 6 ? area.w : Math.max(64, Math.min(200, ab.w * 0.32)))
  const h = Math.min(ab.h, area?.h > 6 ? area.h : Math.max(22, Math.min(36, ab.h * 0.04)))
  const cx = v.w ? (v.w / 2 - S.pan.x) / S.zoom - ab.x : ab.w / 2
  const cy = v.h ? (v.h / 2 - S.pan.y) / S.zoom - ab.y : ab.h / 2
  const x = Math.round(Math.max(0, Math.min(ab.w - w, area?.x ?? cx - w / 2)))
  const y = Math.round(Math.max(0, Math.min(ab.h - h, area?.y ?? cy - h / 2)))
  const ukuran = Math.max(8, Math.min(pilihan?.ukuran || ab.w * 0.022, h / 1.25))
  const penutup = { id: uid(), tipe: 'kotak', nama: 'Penutup teks', x, y, w, h, fill: '#FFFFFF' }
  const teks = { id: uid(), tipe: 'teks', nama: 'Teks pengganti', x, y, w, teks: 'Teks baru', font: pilihan?.font && FONT_SISTEM.has(namaFont(pilihan.font)) ? pilihan.font : 'Arial', ukuran: Math.floor(ukuran), lh: 1.15, warna: '#172033', patch: { penutup: penutup.id, ukuran: Math.floor(ukuran) } }
  const fit = ukurPatch(teks, penutup)
  if (fit == null) { host.notify({ kind: 'info', message: 'Tandai area patch yang lebih besar.' }); return }
  teks.ukuran = fit
  ubah(() => ab.elemen.push(penutup, teks))
  S.patchArea = null; S.sel = [teks.id]; S.edit = teks.id; S.tool = 'pilih'; emit(); tulisAktif()
}
function TombolPatch() {
  return halamanQuickEdit(abAktif()) ? h('button', { onClick: tambahPatch, title: 'Tandai area pada PDF, lalu ketik teks pengganti' }, 'Tutup & Ubah Teks') : null
}
function TeksEditor() {
  const f = S.edit && cariEl(S.edit); const ref = useRef(null)
  useEffect(() => { const t = setTimeout(() => { ref.current?.focus(); ref.current?.select() }, 30); return () => clearTimeout(t) }, [S.edit])
  if (!f || terkunci(f.ab, f.el)) return null
  const { ab, el } = f
  const penutup = el.patch && ab.elemen.find(e => e.id === el.patch.penutup && e.tipe === 'kotak')
  return h('textarea', {
    ref, wrap: penutup ? 'off' : undefined, className: 'kv-teksedit', defaultValue: el.teks || '', spellCheck: false,
    style: { left: ab.x + el.x, top: ab.y + el.y, width: el.w, minHeight: tinggi(el) + 4, font: fontStr(el), color: el.warna || '#101634', letterSpacing: (el.spasi || 0) + 'px', lineHeight: ((el.ukuran || 32) * (el.lh || 1.2)) + 'px', textAlign: el.rata === 'tengah' ? 'center' : el.rata === 'kanan' ? 'right' : 'left', textTransform: el.kapital ? 'uppercase' : undefined },
    onInput: e => {
      const draft = penutup ? e.target.value.replace(/[\r\n]+/g, ' ') : e.target.value
      const ukuran = penutup ? ukurPatch({ ...el, teks: draft }, penutup) : null
      if (penutup && ukuran == null) {
        e.target.value = el.teks
        host.notify({ kind: 'info', message: 'Teks terlalu panjang untuk area ini. Tandai area yang lebih lebar.' })
        return
      }
      const caret = e.target.selectionStart
      if (penutup && draft !== e.target.value) { e.target.value = draft; e.target.setSelectionRange(caret, caret) }
      ubah(() => { el.teks = draft; if (penutup) el.ukuran = ukuran }, true)
    },
    onBlur: () => { S.edit = null; emit(); tulisAktif() },
    onKeyDown: e => { e.stopPropagation(); if (e.key === 'Escape') e.target.blur() }
  })
}

function Kanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current; VIEW.el = v
    const roda = e => {
      e.preventDefault()
      const r = v.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) zoomDi(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top)
      else { S.pan = { x: S.pan.x - e.deltaX, y: S.pan.y - e.deltaY }; emit() }
    }
    v.addEventListener('wheel', roda, { passive: false })
    return () => v.removeEventListener('wheel', roda)
  }, [])

  const keDunia = e => { const r = ref.current.getBoundingClientRect(); return { x: (e.clientX - r.left - S.pan.x) / S.zoom, y: (e.clientY - r.top - S.pan.y) / S.zoom } }
  const abDi = p => [...(S.doc?.artboards || [])].reverse().find(a => p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h)

  const mulai = e => {
    if (e.button === 2) return
    if (e.target.closest?.('.kv-teksedit')) return
    ref.current.focus()
    if (S.edit) { S.edit = null }
    const p = keDunia(e), t = e.target
    const ses = { sx: e.clientX, sy: e.clientY, p }
    if (S.editTitik && !t.closest?.('[data-titik],[data-pegangan]') && t.closest?.('[data-id]')?.dataset.id !== S.editTitik) { S.editTitik = null; S.titikSel = null }
    const panning = e.button === 1 || S.tool === 'tangan' || SPASI.on
    const hnd = t.closest?.('[data-h]')?.dataset.h
    const idEl = t.closest?.('[data-id]')?.dataset.id
    const idLabel = t.closest?.('[data-ablabel]')?.dataset.ablabel
    const idKom = t.closest?.('[data-komentar]')?.dataset.komentar
    if (idKom && !panning) { S.komentarAktif = idKom; S.draftKomentar = null; emit(); return }
    if (S.tool === 'komentar' && !panning) {
      const ab = abDi(p)
      if (ab) { S.draftKomentar = { abId: ab.id, x: p.x - ab.x, y: p.y - ab.y, elemen: idEl || null }; S.komentarAktif = null; S.sel = [] } else { S.draftKomentar = null; S.komentarAktif = null }
      emit(); return
    }
    if (S.komentarAktif || S.draftKomentar) { S.komentarAktif = null; S.draftKomentar = null }
    const idTitik = t.closest?.('[data-titik]')?.dataset.titik, idPeg = t.closest?.('[data-pegangan]')?.dataset.pegangan
    if (S.editTitik && !panning && (idTitik != null || idPeg)) {
      const f = cariEl(S.editTitik); if (!f || !bolehUbah([f])) { S.editTitik = null; S.titikSel = null; emit(); return }
      snap(); ses.tipe = 'titik'; ses.el = f.el; ses.ab = f.ab; ses.T = titikKeAb(f.el)
      ses.i = Number(idTitik ?? idPeg.split(':')[0]); ses.peg = idPeg ? idPeg.split(':')[1] : null; ses.awalT = JSON.parse(JSON.stringify(ses.T))
      S.titikSel = ses.i; emit()
    } else if (S.tool === 'pena' && !panning) {
      e.preventDefault()
      const ab = S.pena ? abById(S.pena.abId) : abDi(p)
      if (!ab) return
      const q = { x: p.x - ab.x, y: p.y - ab.y }
      if (!S.pena) { S.pena = { abId: ab.id, titik: [] }; S.sel = []; S.editTitik = null }
      const T = S.pena.titik
      if (T.length >= 2 && dekat(q, T[0])) return selesaiPena(true)
      T.push({ x: Math.round(q.x), y: Math.round(q.y) }); ses.tipe = 'pena'; ses.ab = ab; ses.tt = T.at(-1); emit()
    }
    else if (panning) ses.tipe = 'pan', ses.pan0 = { ...S.pan }
    else if (hnd && S.sel.length === 1) {
      const f = cariEl(S.sel[0]); if (!f || !bolehUbah(denganTurunan([f]))) { emit(); return }
      const { el } = f; snap(); ses.tipe = 'ukur'; ses.h = hnd; ses.awal = { x: el.x, y: el.y, w: el.w || 100, h: tinggi(el) }
    } else if (idLabel) {
      const ab = abById(idLabel); snap(); S.ab = ab.id; S.sel = []; S.propAb = true; ses.tipe = 'abgeser'; ses.ab = ab; ses.awal = { x: ab.x, y: ab.y }
    } else if (['kotak', 'elips'].includes(S.tool) && abDi(p)) {
      const ab = abDi(p); const el = { id: uid(), tipe: S.tool, x: Math.round(p.x - ab.x), y: Math.round(p.y - ab.y), w: 1, h: 1, fill: S.tool === 'kotak' ? { warna: ['#FF4D3D', '#FFA23C'], sudut: 135 } : '#7B61FF', radius: S.tool === 'kotak' ? 24 : 0 }
      snap(); ab.elemen.push(el); S.sel = [el.id]; S.ab = ab.id; ses.tipe = 'buat'; ses.el = el; ses.ab = ab
    } else if (S.tool === 'teks' && abDi(p)) {
      e.preventDefault()   // jangan biarkan kanvas mengambil fokus dari kotak ketik
      const ab = abDi(p)
      tambahEl({ id: uid(), tipe: 'teks', x: Math.round(p.x - ab.x), y: Math.round(p.y - ab.y), w: Math.round(ab.w * 0.5), teks: 'Type your text', ukuran: Math.round(ab.w / 24), tebal: 700, font: 'Plus Jakarta Sans', warna: '#101634', lh: 1.15 }, ab)
      S.edit = S.sel[0]; emit(); return
    } else if (idEl && S.tool === 'pilih') {
      // klik pertama memilih grup terluar; klik lagi masuk satu tingkat; Ctrl/Cmd+klik langsung ke elemen
      const f = cariEl(idEl); if (!f) return
      if (terkunci(f.ab, f.el)) {
        S.ab = f.ab.id; S.sel = []; S.propAb = false
        if (halamanQuickEdit(f.ab)) {
          const x0 = p.x - f.ab.x, y0 = p.y - f.ab.y
          S.patchArea = { ab: f.ab.id, x: x0, y: y0, w: 0, h: 0 }
          const area = ev => {
            const q = keDunia(ev), x = Math.max(0, Math.min(f.ab.w, q.x - f.ab.x)), y = Math.max(0, Math.min(f.ab.h, q.y - f.ab.y))
            S.patchArea = { ab: f.ab.id, x: Math.min(x0, x), y: Math.min(y0, y), w: Math.abs(x - x0), h: Math.abs(y - y0) }; emit()
          }
          const end = () => { removeEventListener('pointermove', area); removeEventListener('pointerup', end); removeEventListener('pointercancel', end) }
          addEventListener('pointermove', area); addEventListener('pointerup', end); addEventListener('pointercancel', end)
        }
        emit(); return
      }
      S.patchArea = null
      const rantai = [f.el]
      for (let x = f.el; x.induk;) { const p = cariEl(x.induk)?.el; if (!p) break; rantai.unshift(p); x = p }
      let pilih = rantai[0].id
      if (e.ctrlKey || e.metaKey) pilih = idEl
      else { const i = rantai.findIndex(x => S.sel.includes(x.id)); if (i >= 0) pilih = rantai[Math.min(i + (S.sel.includes(rantai[i].id) && rantai[i].id !== idEl ? 1 : 0), rantai.length - 1)].id }
      if (e.shiftKey) S.sel = S.sel.includes(pilih) ? S.sel.filter(x => x !== pilih) : [...S.sel, pilih]
      else if (!S.sel.includes(pilih)) S.sel = [pilih]
      S.ab = f.ab.id
      if (!bolehUbah(denganTurunan())) { emit(); return }
      snap(); ses.tipe = 'geser'; ses.awal = Object.fromEntries(denganTurunan().map(({ el }) => [el.id, { x: el.x, y: el.y }])); ses.pindah = false
    } else if (abDi(p)) { S.ab = abDi(p).id; S.sel = []; S.propAb = true; ses.tipe = 'pan'; ses.pan0 = { ...S.pan }; ses.klik = true }
    else { S.sel = []; S.propAb = false; ses.tipe = 'pan'; ses.pan0 = { ...S.pan } }
    emit(); tulisAktif()

    const gerak = ev => {
      const dx = (ev.clientX - ses.sx) / S.zoom, dy = (ev.clientY - ses.sy) / S.zoom
      if (ses.tipe === 'pan') { S.pan = { x: ses.pan0.x + ev.clientX - ses.sx, y: ses.pan0.y + ev.clientY - ses.sy } }
      else if (ses.tipe === 'pena') {
        // tarik = buat pegangan lengkung simetris
        const q = keDunia(ev), x = q.x - ses.ab.x, y = q.y - ses.ab.y, t = ses.tt
        if (Math.hypot(x - t.x, y - t.y) > 3 / S.zoom) { t.ox = Math.round(x); t.oy = Math.round(y); t.ix = Math.round(2 * t.x - x); t.iy = Math.round(2 * t.y - y) }
        S.pena.mouse = null
      } else if (ses.tipe === 'titik') {
        const q = keDunia(ev), x = q.x - ses.ab.x, y = q.y - ses.ab.y, a = ses.awalT[ses.i], t = ses.T[ses.i]
        if (!ses.peg) {   // geser titik bersama pegangannya
          const ddx = x - (ses.p.x - ses.ab.x), ddy = y - (ses.p.y - ses.ab.y)
          t.x = a.x + ddx; t.y = a.y + ddy
          if (a.ix != null) { t.ix = a.ix + ddx; t.iy = a.iy + ddy } if (a.ox != null) { t.ox = a.ox + ddx; t.oy = a.oy + ddy }
        } else {          // geser pegangan; pegangan seberang ikut simetris kecuali Alt
          const k = ses.peg, lawan = k === 'o' ? 'i' : 'o'
          t[k + 'x'] = x; t[k + 'y'] = y
          if (!ev.altKey && a[lawan + 'x'] != null) { t[lawan + 'x'] = 2 * t.x - x; t[lawan + 'y'] = 2 * t.y - y }
        }
        Object.assign(ses.el, bidangDariTitik(ses.T, ses.el.tutup))
      }
      else if (ses.tipe === 'abgeser') { ses.ab.x = Math.round(ses.awal.x + dx); ses.ab.y = Math.round(ses.awal.y + dy) }
      else if (ses.tipe === 'geser') {
        ses.pindah = true; S.guides = []
        const items = terpilih(), satu = items.length === 1 ? items[0] : null
        for (const [id, a] of Object.entries(ses.awal)) { const f = cariEl(id); if (f) { f.el.x = Math.round(a.x + dx); f.el.y = Math.round(a.y + dy) } }
        if (satu && !ev.altKey) {   // snap ke tepi & tengah artboard (keturunan grup ikut bergeser)
          const { ab, el } = satu, t = 8 / S.zoom, w = el.w || 100, hh = tinggi(el), x0 = el.x, y0 = el.y
          for (const [pos, tgt] of [[el.x, 0], [el.x + w / 2, ab.w / 2], [el.x + w, ab.w]]) if (Math.abs(pos - tgt) < t) { el.x += tgt - pos; S.guides.push({ x: ab.x + tgt, ab }); break }
          for (const [pos, tgt] of [[el.y, 0], [el.y + hh / 2, ab.h / 2], [el.y + hh, ab.h]]) if (Math.abs(pos - tgt) < t) { el.y += tgt - pos; S.guides.push({ y: ab.y + tgt, ab }); break }
          if (isGrup(el) && (el.x !== x0 || el.y !== y0)) for (const d of keturunan(ab, el.id)) { d.x += el.x - x0; d.y += el.y - y0 }
        }
      } else if (ses.tipe === 'ukur' || ses.tipe === 'buat') {
        const { el } = cariEl(S.sel[0]) || {}; if (!el) return
        if (ses.tipe === 'buat') { const p2 = keDunia(ev); el.w = Math.max(1, Math.round(Math.abs(p2.x - ses.p.x))); el.h = Math.max(1, Math.round(Math.abs(p2.y - ses.p.y))); el.x = Math.round(Math.min(p2.x, ses.p.x) - ses.ab.x); el.y = Math.round(Math.min(p2.y, ses.p.y) - ses.ab.y); if (ev.shiftKey) el.h = el.w }
        else {
          const a = ses.awal, k = ses.h; let { x, y, w, h: hh } = a
          if (k.includes('e')) w = a.w + dx; if (k.includes('w')) { w = a.w - dx; x = a.x + dx }
          if (k.includes('s')) hh = a.h + dy; if (k.includes('n')) { hh = a.h - dy; y = a.y + dy }
          if (ev.shiftKey && k.length === 2) { const r = a.w / a.h; if (w / hh > r) hh = w / r; else w = hh * r; if (k.includes('n')) y = a.y + a.h - hh; if (k.includes('w')) x = a.x + a.w - w }
          el.x = Math.round(x); el.y = Math.round(y); el.w = Math.max(8, Math.round(w)); if (el.tipe !== 'teks') el.h = Math.max(8, Math.round(hh))
          if (isGrup(el)) { if (w !== a.w && el.lebar === 'peluk') el.lebar = 'tetap'; if (hh !== a.h && el.tinggi === 'peluk') el.tinggi = 'tetap' }
        }
      }
      emit()
    }
    const lepas = () => {
      removeEventListener('pointermove', gerak); removeEventListener('pointerup', lepas)
      S.guides = []
      if (ses.tipe === 'buat') { const { el } = cariEl(S.sel[0]) || {}; if (el && el.w < 6 && el.h < 6) { el.w = 320; el.h = S.tool === 'elips' ? 320 : 220 }; S.tool = 'pilih'; tandaiUbah() }
      else if (ses.tipe === 'ukur' || ses.tipe === 'abgeser' || ses.tipe === 'titik' || (ses.tipe === 'geser' && ses.pindah)) tandaiUbah()
      else if (ses.tipe === 'pena') emit()
      else if (ses.tipe === 'geser') S.undo.pop()   // klik tanpa geser: buang snapshot
      else emit()
      tulisAktif()
    }
    addEventListener('pointermove', gerak); addEventListener('pointerup', lepas)
  }
  const dobel = e => {
    if (S.pena) { S.pena.titik.pop(); return selesaiPena(false) }   // klik kedua menambah titik kembar → buang
    const id = e.target.closest?.('[data-id]')?.dataset.id; const f = id && cariEl(id)
    if (f && terkunci(f.ab, f.el)) return
    if (f?.el.tipe === 'path' && f.el.titik && !f.el.rotasi) { e.preventDefault(); S.sel = [id]; S.editTitik = id; S.titikSel = null; emit(); return }
    if (f?.el.tipe === 'teks') { e.preventDefault(); S.sel = [id]; S.edit = id; emit() }
    else if (f?.el.tipe === 'gambar') pilihGambar(g => ubah(() => { f.el.src = g.src }))
    else if (e.target.closest?.('[data-ablabel]')) fitAb(abById(e.target.closest('[data-ablabel]').dataset.ablabel))
  }
  const z = S.zoom
  const geserPena = e => { if (!S.pena || e.buttons) return; const ab = abById(S.pena.abId); if (!ab) return; const q = keDunia(e); S.pena.mouse = { x: q.x - ab.x, y: q.y - ab.y }; emit() }
  return h('div', { ref, className: 'kv-view kv-tool-' + S.tool, tabIndex: 0, onPointerDown: mulai, onDoubleClick: dobel, onPointerMove: geserPena },
    h('div', { className: 'kv-world', style: { transform: `translate(${S.pan.x}px, ${S.pan.y}px) scale(${z})` } },
      (S.doc?.artboards || []).map(ab => h('div', { key: ab.id, className: 'kv-ab' + (ab.id === S.ab ? ' aktif' : ''), style: { left: ab.x, top: ab.y, width: ab.w, height: ab.h } },
        h('div', { 'data-ablabel': ab.id, className: 'kv-ablabel', style: { fontSize: 12 / z, top: -22 / z, height: 20 / z, lineHeight: 20 / z + 'px' } }, `${ab.nama}  ·  ${ab.w}×${ab.h}`),
        h(AbIsi, { ab }))),
      S.patchArea && S.patchArea.ab === S.ab && S.patchArea.w > 3 ? h('div', { className: 'kv-patcharea', style: { left: abAktif().x + S.patchArea.x, top: abAktif().y + S.patchArea.y, width: S.patchArea.w, height: S.patchArea.h, borderWidth: 1 / z } }) : null,
      h(AgentKerja), S.editTitik ? null : h(Seleksi), h(TeksEditor), h(PenaOverlay), h(EditTitik), h(KomentarPin),
      S.guides.map((g, i) => h('div', { key: i, className: 'kv-guide', style: g.x != null ? { left: g.x, top: g.ab.y, width: 1 / z, height: g.ab.h } : { top: g.y, left: g.ab.x, height: 1 / z, width: g.ab.w } }))))
}
const SPASI = { on: false }

/* ---------- KOMENTAR ----------
   doc.komentar = [{ id, artboard, x, y, elemen?, teks, waktu, selesai, balasan? }]  (x/y relatif ke artboard).
   Disimpan di file desain, tidak ikut diekspor. Agent membacanya lewat MCP (kanvas_comments) lalu menandai selesai. */
const komentarTerbuka = () => (S.doc?.komentar || []).filter(k => !k.selesai)
const nomorKomentar = id => komentarTerbuka().findIndex(k => k.id === id) + 1
function labelElemen(id) {
  const f = id && cariEl(id); if (!f) return null
  const e = f.el
  return e.tipe === 'teks' ? `text “${String(e.teks || '').replace(/\s+/g, ' ').slice(0, 28)}”` : (e.nama || NAMA_TIPE[e.tipe] || e.tipe)
}
function simpanKomentar(teks) {
  const d = S.draftKomentar; if (!d || !teks.trim()) { S.draftKomentar = null; return emit() }
  const k = { id: uid('c'), artboard: d.abId, x: Math.round(d.x), y: Math.round(d.y), ...(d.elemen ? { elemen: d.elemen } : {}), teks: teks.trim(), waktu: new Date().toISOString(), selesai: false }
  ubah(doc => { doc.komentar = [...(doc.komentar || []), k] }); S.draftKomentar = null; S.komentarAktif = k.id; S.tampilKomentar = true; emit()
}
const ubahKomentar = (id, fn) => ubah(doc => { const k = (doc.komentar || []).find(x => x.id === id); if (k) fn(k) })
const hapusKomentar = id => { ubah(doc => { doc.komentar = (doc.komentar || []).filter(x => x.id !== id) }); S.komentarAktif = null; emit() }
// kirim semua komentar terbuka ke chat agent (Hermes) atau salin (app lokal)
async function kirimKomentar() {
  const daftar = komentarTerbuka(); if (!daftar.length) return
  const baris = daftar.map((k, i) => { const ab = abById(k.artboard), el = labelElemen(k.elemen); return `${i + 1}. [${ab?.nama || k.artboard}${el ? ', ' + el : ''}] ${k.teks}` }).join('\n')
  const teks = `[Kanvas Studio] Please address the ${daftar.length} open comment${daftar.length > 1 ? 's' : ''} on ${S.file}.\nUse kanvas_comments to read them with element ids and positions, edit the design, then kanvas_resolve_comment with a short reply for each.\n\n${baris}`
  if (aktifChatHost() && S.chatConfig?.configured) { S.menu = null; emit(); return kirimChatLokal({ prompt: teks }) }
  const ok = await host.composer.insertText(null, teks, { mode: 'block' })
  if (ok) { host.composer.submit?.(null, teks) || host.composer.focus(null); S.sesiAgent = host.state?.focusedSessionId?.get?.() || 'tunggu'; S.ctx.storage.set('sesiAgent', S.sesiAgent) }
  else if (await S.ctx.os.writeClipboard(teks)) {
    host.notify({ kind: 'info', message: 'Comments copied. Paste them to your agent (Claude Code, Codex, Hermes).' })
  } else S.modal = { judul: 'Salin instruksi ke chat agent', input: teks }
  S.menu = null; emit()
}
// pin komentar di dunia kanvas (ikut zoom, ukuran tetap di layar)
function KomentarPin() {
  if (S.tampilKomentar === false || !S.doc?.komentar?.length) return null
  const z = S.zoom
  return h(Fragment, null, S.doc.komentar.filter(k => !k.selesai || S.lihatSelesai || S.komentarAktif === k.id).map(k => {
    const ab = abById(k.artboard); if (!ab) return null
    const n = nomorKomentar(k.id)
    return h('button', { key: k.id, 'data-komentar': k.id, title: k.teks, className: 'kv-pin' + (k.selesai ? ' selesai' : '') + (S.komentarAktif === k.id ? ' aktif' : ''),
      style: { left: ab.x + k.x, top: ab.y + k.y, transform: `translate(-4px, -100%) scale(${1 / z})` } }, k.selesai ? '✓' : n)
  }))
}
// kotak tulis komentar baru & kotak baca komentar (di layar, tidak ikut zoom)
function KomentarPopover() {
  const [teks, setTeks] = useState(''), ref = useRef(null)
  const d = S.draftKomentar, aktif = !d && S.komentarAktif && (S.doc?.komentar || []).find(k => k.id === S.komentarAktif)
  useEffect(() => { setTeks(''); setTimeout(() => ref.current?.focus(), 20) }, [d?.abId, d?.x, d?.y])
  const titik = d || aktif; if (!titik) return null
  const ab = abById(d ? d.abId : aktif.artboard); if (!ab) return null
  const v = ukuranView(), x = Math.max(8, Math.min(v.w - 300, S.pan.x + (ab.x + titik.x) * S.zoom + 14)), y = Math.max(8, Math.min(v.h - 200, S.pan.y + (ab.y + titik.y) * S.zoom - 10))
  const tutup = () => { S.draftKomentar = null; S.komentarAktif = null; emit() }
  if (d) return h('div', { className: 'kv-kpop', style: { left: x, top: y }, onPointerDown: e => e.stopPropagation() },
    d.elemen ? h('div', { className: 'kv-kpop-el' }, 'On ', labelElemen(d.elemen)) : null,
    h('textarea', { ref, autoFocus: true, rows: 3, value: teks, placeholder: 'What should change here?', onChange: e => setTeks(e.target.value),
      onKeyDown: e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); simpanKomentar(teks) } if (e.key === 'Escape') tutup() } }),
    h('div', { className: 'kv-kpop-aksi' }, h('span', null, 'Enter to post'), h('button', { onClick: tutup }, 'Cancel'), h('button', { className: 'utama', disabled: !teks.trim(), onClick: () => simpanKomentar(teks) }, 'Post')))
  const k = aktif, el = labelElemen(k.elemen)
  return h('div', { className: 'kv-kpop', style: { left: x, top: y }, onPointerDown: e => e.stopPropagation() },
    h('div', { className: 'kv-kpop-kepala' }, h('b', null, k.selesai ? 'Resolved' : `Comment ${nomorKomentar(k.id)}`), h('button', { className: 'kv-x', onClick: tutup }, '✕')),
    el ? h('div', { className: 'kv-kpop-el' }, 'On ', el) : null,
    h('p', null, k.teks),
    k.balasan ? h('div', { className: 'kv-kpop-balas' }, h(Logo, { className: 'kv-kpop-logo' }), h('span', null, k.balasan)) : null,
    h('div', { className: 'kv-kpop-aksi' },
      h('button', { onClick: () => hapusKomentar(k.id) }, 'Delete'),
      k.selesai ? h('button', { onClick: () => ubahKomentar(k.id, x => { x.selesai = false }) }, 'Reopen')
        : h('button', { className: 'utama', onClick: () => { ubahKomentar(k.id, x => { x.selesai = true }); S.komentarAktif = null; emit() } }, 'Resolve')))
}
// daftar komentar (menu di toolbar)
// .kv-top bisa di-scroll ke samping (overflow), jadi menu absolut di dalamnya terpotong. Menu toolbar ditempel ke akar .kv
// (lihat CSS .kv-top .kv-dd{position:static}) dan diposisikan dari kotak tombolnya.
const tempelMenu = (kanan, atas) => (el, jangkar) => {
  if (!el) return
  const akar = el.offsetParent || el.closest('.kv'), tombol = jangkar || el.parentElement
  if (!akar || !tombol) return
  const a = akar.getBoundingClientRect(), b = tombol.getBoundingClientRect()
  if (atas) { el.style.top = 'auto'; el.style.bottom = Math.max(8, a.bottom - b.top + 8) + 'px' }
  else { el.style.bottom = 'auto'; el.style.top = (b.bottom - a.top + 6) + 'px' }
  if (kanan) { el.style.left = 'auto'; el.style.right = Math.max(8, Math.min(a.right - b.right, a.width - el.offsetWidth - 8)) + 'px' }
  else { el.style.right = 'auto'; el.style.left = Math.max(8, Math.min(b.left - a.left, a.width - el.offsetWidth - 8)) + 'px' }
}
function MenuKomentar() {
  const semua = S.doc?.komentar || [], buka = komentarTerbuka()
  return h('div', { className: 'kv-menu kanan kv-kmenu', ref: tempelMenu(true) },
    h('div', { className: 'kv-kmenu-kepala' }, h('b', null, `Comments · ${buka.length} open`),
      h('label', null, h('input', { type: 'checkbox', checked: S.tampilKomentar !== false, onChange: e => { S.tampilKomentar = e.target.checked; emit() } }), 'Show pins'),
      h('label', null, h('input', { type: 'checkbox', checked: !!S.lihatSelesai, onChange: e => { S.lihatSelesai = e.target.checked; emit() } }), 'Resolved')),
    !semua.length ? h('p', { className: 'kv-kmenu-kosong' }, 'Pick the comment tool (C), click any spot of the design and write what should change. Your agent reads the comments and fixes them.') : null,
    semua.filter(k => !k.selesai || S.lihatSelesai).map(k => h('button', { key: k.id, className: 'kv-kitem' + (k.selesai ? ' selesai' : ''),
      onClick: () => { const ab = abById(k.artboard); S.ab = k.artboard; S.komentarAktif = k.id; S.tampilKomentar = true; S.menu = null; if (ab) fitAb(ab); emit() } },
      h('i', null, k.selesai ? '✓' : nomorKomentar(k.id)), h('span', null, k.teks, k.balasan ? h('em', null, k.balasan) : null))),
    buka.length ? h('button', { className: 'kv-kirim', onClick: kirimKomentar }, `Send ${buka.length} comment${buka.length > 1 ? 's' : ''} to agent`) : null)
}

/* ---------- ALAT PENA ----------
   Klik = titik sudut, klik-tarik = titik lengkung (pegangan simetris), klik titik pertama = tutup bentuk,
   Enter / Esc / klik dobel = selesai, Backspace = hapus titik terakhir. Hasilnya elemen path dengan `titik`. */
const dekat = (a, b, r = 9 / S.zoom) => Math.hypot(a.x - b.x, a.y - b.y) <= r
function selesaiPena(tutup) {
  const P = S.pena; S.pena = null
  if (!P || P.titik.length < 2) { emit(); return }
  const ab = abById(P.abId); if (!ab) return emit()
  const bidang = bidangDariTitik(P.titik, tutup)
  const el = { id: uid('v'), tipe: 'path', nama: tutup ? 'Shape' : 'Line', ...bidang, fill: tutup ? '#FFD166' : null, garis: { tebal: 4, warna: '#101634' }, ujung: 'bulat' }
  tambahEl(el, ab)
}
// overlay saat menggambar: path sementara + garis karet ke kursor + titik-titik
function PenaOverlay() {
  const P = S.pena; if (!P) return null
  const ab = abById(P.abId); if (!ab) return null
  const z = S.zoom, T = P.titik, m = P.mouse
  const sementara = m && T.length ? [...T, { x: m.x, y: m.y }] : T
  return h('svg', { className: 'kv-pena', style: { left: ab.x, top: ab.y, width: ab.w, height: ab.h }, viewBox: `0 0 ${ab.w} ${ab.h}` },
    h('path', { d: dariTitik(sementara, false), fill: 'none', stroke: '#7B61FF', strokeWidth: 1.5 / z, strokeDasharray: `${4 / z} ${3 / z}` }),
    h('path', { d: dariTitik(T, false), fill: 'none', stroke: '#7B61FF', strokeWidth: 2 / z }),
    T.map((t, i) => h(Fragment, { key: i },
      t.ox != null ? h('line', { x1: t.ix, y1: t.iy, x2: t.ox, y2: t.oy, stroke: '#7B61FF', strokeWidth: 1 / z }) : null,
      t.ox != null ? h('circle', { cx: t.ox, cy: t.oy, r: 3.5 / z, fill: '#fff', stroke: '#7B61FF', strokeWidth: 1.2 / z }) : null,
      h('rect', { x: t.x - 4 / z, y: t.y - 4 / z, width: 8 / z, height: 8 / z, fill: i === 0 && m && T.length > 1 && dekat(m, t) ? '#7B61FF' : '#fff', stroke: '#7B61FF', strokeWidth: 1.5 / z }))))
}
// mode edit titik: klik dobel vektor buatan pena → geser titik (bersama pegangannya) atau pegangan (Alt = patahkan)
function EditTitik() {
  const f = S.editTitik && cariEl(S.editTitik); if (!f || !f.el.titik) return null
  const { ab, el } = f, z = S.zoom, T = titikKeAb(el)
  return h('svg', { className: 'kv-pena kv-edittitik', style: { left: ab.x, top: ab.y, width: ab.w, height: ab.h, overflow: 'visible' }, viewBox: `0 0 ${ab.w} ${ab.h}` },
    h('path', { d: dariTitik(T, el.tutup), fill: 'none', stroke: '#7B61FF', strokeWidth: 1.5 / z }),
    T.map((t, i) => h(Fragment, { key: i },
      t.ix != null ? h('line', { x1: t.ix, y1: t.iy, x2: t.x, y2: t.y, stroke: '#7B61FF', strokeWidth: 1 / z }) : null,
      t.ox != null ? h('line', { x1: t.x, y1: t.y, x2: t.ox, y2: t.oy, stroke: '#7B61FF', strokeWidth: 1 / z }) : null,
      t.ix != null ? h('circle', { 'data-pegangan': i + ':i', cx: t.ix, cy: t.iy, r: 5 / z, fill: '#fff', stroke: '#7B61FF', strokeWidth: 1.5 / z }) : null,
      t.ox != null ? h('circle', { 'data-pegangan': i + ':o', cx: t.ox, cy: t.oy, r: 5 / z, fill: '#fff', stroke: '#7B61FF', strokeWidth: 1.5 / z }) : null,
      h('rect', { 'data-titik': i, x: t.x - 5 / z, y: t.y - 5 / z, width: 10 / z, height: 10 / z, fill: S.titikSel === i ? '#7B61FF' : '#fff', stroke: '#7B61FF', strokeWidth: 1.5 / z }))))
}
function hapusTitikSel() {
  const f = S.editTitik && cariEl(S.editTitik); if (!f || S.titikSel == null || !bolehUbah([f])) return
  const T = titikKeAb(f.el); if (T.length <= 2) return
  T.splice(S.titikSel, 1); S.titikSel = null
  ubah(() => Object.assign(f.el, bidangDariTitik(T, f.el.tutup && T.length > 2)))
}

/* ---------- panel kiri: artboard & layer ---------- */
const NAMA_TIPE = { teks: 'Text', kotak: 'Rectangle', elips: 'Ellipse', gambar: 'Image', path: 'Vector', grup: 'Group' }
function PanelKiri() {
  const ab = abAktif()
  if (!ab) return null
  return h('aside', { className: 'kv-left kv-float' },
    h('div', { className: 'kv-sectitle' }, `Layers · ${ab.nama}`, h('button', { className: 'kv-x', title: 'Close', onClick: () => { S.panelKiri = false; emit() } }, '✕')),
    h('div', { className: 'kv-layers' }, urutanLayer(ab).map(({ el, dalam }) => h('div', { key: el.id, className: 'kv-layer' + (S.sel.includes(el.id) ? ' aktif' : ''), style: { paddingLeft: 6 + dalam * 14 }, onClick: e => { if (terkunci(ab, el)) return; S.sel = e.shiftKey ? [...new Set([...S.sel, el.id])] : [el.id]; emit(); tulisAktif() } },
      h('i', { className: 'kv-lic kv-lic-' + el.tipe, style: el.tipe !== 'teks' && el.tipe !== 'gambar' && el.tipe !== 'grup' ? { background: fillCss(el.fill) } : null }, el.tipe === 'teks' ? 'T' : el.tipe === 'gambar' ? '▣' : el.tipe === 'grup' ? (el.komponen ? '◆' : el.salinan ? '◇' : el.tata ? (el.tata.arah === 'baris' ? '⇉' : '⇊') : '▢') : ''),
      h('span', null, el.nama || (el.tipe === 'teks' ? String(el.teks || '').slice(0, 26) : NAMA_TIPE[el.tipe]) || el.id),
      el.kunci === true ? h('button', { title: 'Buka kunci layer', 'aria-label': 'Buka kunci ' + (el.nama || el.id), onClick: e => { e.stopPropagation(); ubah(() => { delete el.kunci }) } }, '🔒') : null,
      h('button', { title: el.sembunyi ? 'Show' : 'Hide', onClick: e => { e.stopPropagation(); ubah(() => { el.sembunyi = !el.sembunyi }) } }, el.sembunyi ? '◌' : '●')))),
    h(DaftarKomponen))
}
// urutan panel layer: paling depan di atas, grup tampil di atas anggotanya (seperti Figma)
function urutanLayer(ab) {
  const m = anakDari(ab), out = []
  const jalan = (list, dalam) => { for (const el of [...list].reverse()) { out.push({ el, dalam }); if (isGrup(el)) jalan(m.get(el.id) || [], dalam + 1) } }
  jalan(ab.elemen.filter(e => !e.induk), 0); return out
}
// pengaturan auto-layout untuk grup terpilih
function PanelTata({ el, set }) {
  const t = el.tata
  const ubahTata = fn => set(() => { el.tata = { ...el.tata }; fn(el.tata) })
  const seg = (nilai, opsi, f) => h('div', { className: 'kv-seg kv-seg-penuh' }, opsi.map(([v, l, judul]) => h('button', { key: v, title: judul || l, className: nilai === v ? 'on' : '', onClick: () => f(v) }, l)))
  return h(Fragment, null,
    h('div', { className: 'kv-sectitle' }, 'Auto-layout',
      h('button', { className: 'kv-x', title: t ? 'Remove auto-layout' : 'Add auto-layout', onClick: () => set(() => {
        if (t) delete el.tata; else { el.tata = { arah: 'kolom', jarak: 16, padding: 24, rata: 'awal' }; el.lebar = el.lebar || 'tetap'; el.tinggi = 'peluk' }
      }) }, t ? '✕' : '＋')),
    t ? h(Fragment, null,
      seg(t.arah, [['kolom', '⇊ Vertical', 'Stack top to bottom'], ['baris', '⇉ Horizontal', 'Stack left to right']], v => ubahTata(x => { x.arah = v })),
      h('div', { className: 'kv-row' },
        h(NumF, { label: 'Gap', nilai: t.jarak ?? 0, min: 0, set: v => ubahTata(x => { x.jarak = Math.max(0, v || 0) }) }),
        h(NumF, { label: 'Padding', nilai: Array.isArray(t.padding) ? t.padding[0] : (t.padding ?? 0), min: 0, set: v => ubahTata(x => { x.padding = Math.max(0, v || 0) }) })),
      h('span', { className: 'kv-flabel' }, 'Align'),
      seg(t.rata || 'awal', [['awal', '⤒', 'Start'], ['tengah', '↕', 'Center'], ['akhir', '⤓', 'End'], ['regang', '⇕', 'Stretch']], v => ubahTata(x => { x.rata = v })),
      h('span', { className: 'kv-flabel' }, 'Distribute'),
      seg(t.sebar || 'awal', [['awal', 'Start'], ['tengah', 'Center'], ['akhir', 'End'], ['antara', 'Between', 'Space between']], v => ubahTata(x => { x.sebar = v })),
      h('div', { className: 'kv-row' },
        h(SelF, { label: 'Width', nilai: el.lebar || 'tetap', set: v => set(() => { el.lebar = v }), opsi: [{ v: 'tetap', l: 'Fixed' }, { v: 'peluk', l: 'Hug contents' }] }),
        h(SelF, { label: 'Height', nilai: el.tinggi || 'tetap', set: v => set(() => { el.tinggi = v }), opsi: [{ v: 'tetap', l: 'Fixed' }, { v: 'peluk', l: 'Hug contents' }] }))) : null)
}
// anggota grup ber-auto-layout: boleh memenuhi lebar/tinggi grup
function PanelAnggota({ el, set }) {
  const g = el.induk && cariEl(el.induk)?.el
  if (!g?.tata) return null
  const cek = (k, label) => h('label', { className: 'kv-check' }, h('input', { type: 'checkbox', checked: el[k] === 'isi', onChange: e => set(() => { if (e.target.checked) el[k] = 'isi'; else delete el[k] }) }), label)
  return h(Fragment, null, h('div', { className: 'kv-sectitle' }, 'Inside auto-layout'), cek('lebar', 'Fill width'), el.tipe !== 'teks' ? cek('tinggi', 'Fill height') : null)
}
// strip slide di bawah kanvas
function StripSlide() {
  const a = S.doc.artboards, btnRef = useRef(null)
  return h(Fragment, null,
    h('div', { className: 'kv-film' },
      a.map((ab, i) => h('div', { key: ab.id, className: 'kv-fitem' + (ab.id === S.ab ? ' aktif' : ''), title: `${ab.nama} · ${ab.w}×${ab.h}`, onClick: () => { S.ab = ab.id; S.sel = []; fitAb(ab); tulisAktif() } },
        h(Thumb, { ab, lebar: Math.round(46 * Math.min(2, ab.w / ab.h)) }), h('span', null, i + 1),
        h('div', { className: 'kv-fact' },
          i > 0 ? h('button', { title: 'Move left', onClick: e => { e.stopPropagation(); ubah(d => { const x = d.artboards; [x[i - 1], x[i]] = [x[i], x[i - 1]] }) } }, '‹') : null,
          h('button', { title: 'Duplicate', onClick: e => { e.stopPropagation(); duplikatArtboard(ab) } }, '⧉'),
          a.length > 1 ? h('button', { title: 'Delete', onClick: e => { e.stopPropagation(); S.modal = { judul: `Delete "${ab.nama}"?`, pesan: 'You can undo with Ctrl+Z.', ok: 'Delete', aksi: () => { ubah(d => d.artboards.splice(i, 1)); bersihSel(); emit() } }; emit() } }, '✕') : null))),
      h('div', { className: 'kv-dd' }, h('button', { ref: btnRef, className: 'kv-fadd', title: 'New artboard', onClick: () => { S.menu = S.menu === 'ab2' ? null : 'ab2'; emit() } }, '＋'))),
    S.menu === 'ab2' ? h('div', { className: 'kv-menu atas kv-dd', ref: el => tempelMenu(true, true)(el, btnRef.current) }, PRESET.map(p => h('button', { key: p.nama, onClick: () => tambahArtboard(p) }, h('b', null, p.nama), h('span', null, `${p.w}×${p.h}`)))) : null)
}

/* ---------- panel kanan: properti ---------- */
function NumF({ label, nilai, set, step, min, max, w }) {
  return h('label', { className: 'kv-f', style: w ? { flex: w } : null }, h('span', null, label),
    h('input', { type: 'number', value: nilai ?? '', step: step || 1, min, max, onChange: e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v === null || !isNaN(v)) set(v) } }))
}
function PilihFont({ nilai, set, gagal }) {
  const [v, setV] = useState(nilai)
  useEffect(() => setV(nilai), [nilai])
  const pakai = x => { const n = namaFont(x); if (n !== nilai) set(n) }
  return h('label', { className: 'kv-f' }, h('span', null, 'Font', h('i', { className: 'kv-fhint' }, ' · any Google Font')),
    h('input', { list: 'kv-font-populer', value: v, spellCheck: false, onChange: e => { setV(e.target.value); if (FONT_POPULER.includes(e.target.value)) pakai(e.target.value) },
      onBlur: e => pakai(e.target.value), onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); pakai(e.target.value) } }, style: { fontFamily: `"${namaFont(v)}", sans-serif` } }),
    h('datalist', { id: 'kv-font-populer' }, FONT_POPULER.map(f => h('option', { key: f, value: f }))),
    gagal ? h('i', { className: 'kv-fgagal' }, `"${nilai}" is not on Google Fonts, a fallback font is used`) : null)
}
function SelF({ label, nilai, set, opsi }) {
  return h('label', { className: 'kv-f' }, h('span', null, label), h('select', { value: nilai ?? '', onChange: e => set(e.target.value) }, opsi.map(o => h('option', { key: String(o.v ?? o), value: o.v ?? o }, o.l ?? o))))
}
function Warna({ label, fill, set, bisaKosong }) {
  const grad = isGrad(fill)
  const warnaIn = (c, f) => h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000', onChange: e => f(e.target.value) })
  return h('div', { className: 'kv-warna' },
    h('div', { className: 'kv-wrow' }, h('span', { className: 'kv-flabel' }, label),
      h('div', { className: 'kv-seg' },
        h('button', { className: !grad && fill ? 'on' : '', onClick: () => set(warnaUtama(fill) || '#FF4D3D') }, 'Solid'),
        h('button', { className: grad ? 'on' : '', onClick: () => set(grad ? fill : { warna: [warnaUtama(fill) || '#FF4D3D', '#FFA23C'], sudut: 135 }) }, 'Gradient'),
        bisaKosong ? h('button', { className: !fill ? 'on' : '', onClick: () => set(null) }, 'None') : null)),
    grad
      ? h('div', { className: 'kv-wrow' }, fill.warna.map((c, i) => h(Fragment, { key: i }, warnaIn(c, v => set({ ...fill, warna: fill.warna.map((x, j) => j === i ? v : x) })))),
        h('label', { className: 'kv-f kecil' }, h('span', null, 'Angle'), h('input', { type: 'number', value: fill.sudut ?? 135, onChange: e => set({ ...fill, sudut: Number(e.target.value) }) })))
      : fill ? h('div', { className: 'kv-wrow' }, warnaIn(fill, set), h('input', { className: 'kv-hex', value: fill, onChange: e => set(e.target.value) })) : null,
    h('div', { className: 'kv-swatch' },
      SWATCH.map(c => h('button', { key: c, title: c, style: { background: c }, onClick: () => set(c) })),
      GRADIEN.map((g, i) => h('button', { key: 'g' + i, style: { background: fillCss(g) }, onClick: () => set(clone(g)) }))))
}
function PanelKanan() {
  const items = terpilih(), ab = abAktif()
  const set = (fn) => ubah(fn, true)
  if (!items.length) {
    if (!ab) return h('aside', { className: 'kv-right' })
    return h('aside', { className: 'kv-right' },
      h('div', { className: 'kv-sectitle' }, 'Artboard'),
      h('label', { className: 'kv-f' }, h('span', null, 'Name'), h('input', { value: ab.nama, onChange: e => set(() => { ab.nama = e.target.value }) })),
      h('div', { className: 'kv-row' }, h(NumF, { label: 'Width', nilai: ab.w, set: v => set(() => { ab.w = Math.max(10, v || 10) }) }), h(NumF, { label: 'Height', nilai: ab.h, set: v => set(() => { ab.h = Math.max(10, v || 10) }) })),
      h(SelF, { label: 'Size preset', nilai: '', set: v => { const p = PRESET[+v]; if (p) ubah(() => { ab.w = p.w; ab.h = p.h }) }, opsi: [{ v: '', l: 'Choose a size…' }, ...PRESET.map((p, i) => ({ v: i, l: `${p.nama} (${p.w}×${p.h})` }))] }),
      h(Warna, { label: 'Background', fill: ab.bg || '#FFFFFF', set: v => set(() => { ab.bg = v }) }),
      h('div', { className: 'kv-hint' }, 'Tip: pick Text, Rectangle or Ellipse above, then click or drag on the artboard. Double-click text to type.'))
  }
  const { el } = items[0], multi = items.length > 1
  if (denganTurunan(items).some(f => terkunci(f.ab, f.el))) return h('aside', { className: 'kv-right' }, 'Buka kunci layer melalui panel Layers untuk mengubahnya.')
  const setEl = fn => set(() => items.forEach(({ el }) => fn(el)))
  return h('aside', { className: 'kv-right' },
    h('div', { className: 'kv-sectitle' }, multi ? `${items.length} elements` : (NAMA_TIPE[el.tipe] || el.tipe), h('span', { className: 'kv-id' }, multi ? '' : el.id)),
    h('div', { className: 'kv-btnrow' },
      ['kiri', 'tengah', 'kanan', 'atas', 'tengahV', 'bawah'].map(c => h('button', { key: c, title: 'Align ' + ({ kiri: 'left', tengah: 'center', kanan: 'right', atas: 'top', tengahV: 'middle', bawah: 'bottom' }[c]), onClick: () => ratakan(c) }, { kiri: '⇤', tengah: '↔', kanan: '⇥', atas: '⤒', tengahV: '↕', bawah: '⤓' }[c]))),
    !multi ? h(Fragment, null,
      h('div', { className: 'kv-row' }, h(NumF, { label: 'X', nilai: el.x, set: v => set(() => { el.x = v || 0 }) }), h(NumF, { label: 'Y', nilai: el.y, set: v => set(() => { el.y = v || 0 }) })),
      h('div', { className: 'kv-row' }, h(NumF, { label: 'Width', nilai: el.w, set: v => set(() => { el.w = Math.max(1, v || 1) }) }),
        el.tipe !== 'teks' ? h(NumF, { label: 'Height', nilai: el.h, set: v => set(() => { el.h = Math.max(1, v || 1) }) }) : h(NumF, { label: 'Rotation°', nilai: el.rotasi || 0, set: v => set(() => { el.rotasi = v || 0 }) })),
      el.tipe !== 'teks' ? h('div', { className: 'kv-row' }, h(NumF, { label: 'Rotation°', nilai: el.rotasi || 0, set: v => set(() => { el.rotasi = v || 0 }) }), el.tipe !== 'elips' ? h(NumF, { label: 'Corner radius', nilai: el.radius || 0, min: 0, set: v => set(() => { el.radius = Math.max(0, v || 0) }) }) : null) : null) : null,
    h(NumF, { label: 'Opacity (0–1)', nilai: el.opacity ?? 1, step: 0.05, min: 0, max: 1, set: v => setEl(e => { e.opacity = Math.max(0, Math.min(1, v ?? 1)) }) }),
    el.tipe === 'teks' ? h(Fragment, null,
      h('div', { className: 'kv-sectitle' }, 'Text'),
      !multi ? h('textarea', { className: 'kv-ta', value: el.teks || '', onChange: e => set(() => { el.teks = e.target.value }) }) : null,
      h(PilihFont, { nilai: el.font || 'Plus Jakarta Sans', set: v => setEl(e => { e.font = v }), gagal: !multi && fontGagal(el) }),
      h('div', { className: 'kv-row' }, h(NumF, { label: 'Size', nilai: el.ukuran || 32, set: v => setEl(e => { e.ukuran = Math.max(4, v || 4) }) }),
        h(SelF, { label: 'Weight', nilai: el.tebal || 400, set: v => setEl(e => { e.tebal = Number(v) }), opsi: [300, 400, 500, 600, 700, 800, 900] })),
      h('div', { className: 'kv-row' }, h(NumF, { label: 'Line height', nilai: el.lh || 1.2, step: 0.05, set: v => setEl(e => { e.lh = v || 1.2 }) }), h(NumF, { label: 'Letter spacing', nilai: el.spasi || 0, step: 0.5, set: v => setEl(e => { e.spasi = v || 0 }) })),
      h('div', { className: 'kv-btnrow' },
        [['kiri', 'Left'], ['tengah', 'Center'], ['kanan', 'Right']].map(([v, l]) => h('button', { key: v, className: (el.rata || 'kiri') === v ? 'on' : '', onClick: () => setEl(e => { e.rata = v }) }, l)),
        h('button', { className: el.kapital ? 'on' : '', onClick: () => setEl(e => { e.kapital = !el.kapital }) }, 'AA'),
        h('button', { className: el.miring ? 'on' : '', style: { fontStyle: 'italic' }, onClick: () => setEl(e => { e.miring = !el.miring }) }, 'I')),
      h(Warna, { label: 'Text color', fill: el.warna || '#101634', set: v => setEl(e => { e.warna = isGrad(v) ? v.warna[0] : v }) })) : null,
    h(PanelKomponen, { el, multi }),
    !multi && isGrup(el) && !el.salinan ? h(PanelTata, { el, set }) : null,
    !multi ? h(PanelAnggota, { el, set }) : null,
    !multi && el.tipe === 'path' && el.titik ? h('div', { className: 'kv-hint' }, S.editTitik === el.id ? 'Drag points or handles. Alt = break handle. Delete = remove point. Enter = done.' : 'Double-click to edit points.') : null,
    !multi && el.tipe === 'path' && el.ikon ? h('div', { className: 'kv-btnrow' }, h('button', { onClick: () => { S.pilihIkon = { ganti: el.id }; emit() } }, `✦ Replace icon (${el.ikon})…`)) : null,
    el.tipe === 'kotak' || el.tipe === 'elips' || el.tipe === 'path' || el.tipe === 'grup' ? h(Fragment, null,
      h(Warna, { label: 'Fill', fill: el.fill, bisaKosong: true, set: v => setEl(e => { e.fill = v }) }),
      h('div', { className: 'kv-row' }, h(NumF, { label: 'Stroke width', nilai: el.garis?.tebal || 0, min: 0, set: v => setEl(e => { e.garis = v ? { warna: e.garis?.warna || '#101634', tebal: v } : null }) }),
        h('label', { className: 'kv-f' }, h('span', null, 'Stroke color'), h('input', { type: 'color', value: el.garis?.warna || '#101634', onChange: ev => setEl(e => { e.garis = { tebal: e.garis?.tebal || 2, warna: ev.target.value } }) }))),
      h('label', { className: 'kv-check' }, h('input', { type: 'checkbox', checked: !!el.bayangan, onChange: ev => setEl(e => { e.bayangan = ev.target.checked }) }), 'Soft shadow')) : null,
    el.tipe === 'gambar' && !multi ? h(Fragment, null,
      h('div', { className: 'kv-sectitle' }, 'Image'),
      h(SelF, { label: 'Fit', nilai: el.fit || 'cover', set: v => set(() => { el.fit = v }), opsi: [{ v: 'cover', l: 'Fill (crop)' }, { v: 'contain', l: 'Fit (whole image)' }] }),
      h(Button, { variant: 'secondary', size: 'sm', onClick: () => pilihGambar(g => ubah(() => { el.src = g.src })) }, 'Replace image…')) : null,
    h('div', { className: 'kv-sectitle' }, 'Arrange'),
    h('div', { className: 'kv-btnrow kv-susun' },
      h('button', { onClick: () => urutan('depan') }, 'To front'), h('button', { onClick: () => urutan('naik') }, 'Forward'),
      h('button', { onClick: () => urutan('turun') }, 'Backward'), h('button', { onClick: () => urutan('belakang') }, 'To back')),
    h('div', { className: 'kv-btnrow' }, multi ? h('button', { onClick: grupkanSel, title: 'Ctrl+G' }, '▢ Group') : null, !multi && isGrup(el) ? h('button', { onClick: lepasGrup, title: 'Ctrl+Shift+G' }, 'Ungroup') : null, h('button', { onClick: duplikatSel }, '⧉ Duplicate'), h('button', { className: 'bahaya', onClick: hapusSel }, '✕ Delete')))
}

/* ---------- toolbar, menu, modal, presentasi ---------- */
const ALAT = [['pilih', '↖', 'Select (V)'], ['tangan', '✋', 'Pan (H / Space)'], ['teks', 'T', 'Text (T)'], ['kotak', '▢', 'Rectangle (R)'], ['elips', '◯', 'Ellipse (O)'], ['komentar', '💬', 'Comment (C) — click a spot, tell the agent what to change'], ['pena', '✒', 'Pen (P): click for a point, drag for a curve, click the first point to close, Enter to finish']]
function MenuBrand() {
  const list = daftarBrand(), cur = brandAktif()
  const pakaiWarna = hex => {
    const items = terpilih()
    if (!items.length) { host.notify({ kind: 'info', message: 'Select an element first to apply a swatch color.' }); return }
    ubah(() => items.forEach(({ el }) => { if (el.tipe === 'teks') el.warna = hex; else if (el.tipe === 'path' && el.ikon && el.garis) el.garis = { ...el.garis, warna: hex }; else el.fill = hex }))
  }
  return h('div', { className: 'kv-menu kanan kv-bmenu', ref: tempelMenu(true) },
    h('div', { className: 'kv-kmenu-kepala' }, h('b', null, 'Brand Kits'), h('button', { className: 'kv-mini', onClick: () => { S.menu = null; bukaModalBrand(null) } }, '+ New')),
    !list.length ? h('p', { className: 'kv-kmenu-kosong' }, 'Save reusable brand colors, fonts, and art direction. Works across Hermes Desktop and standalone MCP.') : null,
    list.map(b => {
      const c = b.colors || {}, cols = [c.background, c.surface, c.text, c.accent || c.primary].filter(Boolean)
      const isAct = cur?.id === b.id
      return h('div', { key: b.id, className: 'kv-bitem' + (isAct ? ' on' : '') },
        h('div', { className: 'kv-bhead' },
          h('b', null, b.name, b.id === S.brands?.defaultId ? h('em', { className: 'kv-tag' }, 'Default') : null),
          h('span', null, [b.fonts?.display, b.fonts?.body].filter(Boolean).join(' / '))),
        h('div', { className: 'kv-bswatch' }, cols.map((hx, i) => h('button', { key: i, title: `Apply ${hx} to selection`, style: { background: hx }, onClick: () => pakaiWarna(hx) }))),
        h('div', { className: 'kv-bact' },
          h('button', { className: 'utama', onClick: () => applyBrandUI(b) }, 'Apply to design'),
          h('button', { onClick: () => { S.menu = null; bukaModalBrand(b) } }, 'Edit')))
    }))
}
function MenuSisip() {
  const aset = S.assetsLib || []
  const sisipAset = a => {
    const ab = abAktif(); if (!ab) return
    S.menu = null
    if (a.vector?.d) {
      tambahEl({ id: uid('v'), tipe: 'path', nama: a.name, x: Math.round(ab.w / 2 - 80), y: Math.round(ab.h / 2 - 80), w: 160, h: 160, vb: a.vector.vb || [100, 100], d: a.vector.d, fill: a.vector.fill ?? '#101634', ...(a.vector.garis ? { garis: a.vector.garis } : {}) }, ab)
    } else {
      tambahEl({ id: uid('g'), tipe: 'gambar', nama: a.name, x: Math.round(ab.w / 2 - 140), y: Math.round(ab.h / 2 - 140), w: 280, h: 280, src: a.src, fit: 'contain' }, ab)
    }
  }
  return h('div', { className: 'kv-menu kv-smenu', ref: tempelMenu(false) },
    h('div', { className: 'kv-mhead' }, 'Data Visualization (editable)'),
    [['bar', 'Bar Chart', 'vertical columns'], ['donut', 'Donut Chart', 'arc segments + legend'], ['table', 'Data Table', 'auto-layout rows'], ['diagram', 'Process Diagram', 'steps + arrows']]
      .map(([k, a, b]) => h('button', { key: k, onClick: () => sisipDataViz(k) }, h('b', null, a), h('span', null, b))),
    h('div', { className: 'kv-mhead' }, `Asset Library (${aset.length})`),
    !aset.length ? h('div', { className: 'kv-mempty' }, 'No saved assets yet — import images or SVGs via kanvas_assets.') : aset.slice(0, 8).map(a =>
      h('button', { key: a.id, onClick: () => sisipAset(a) }, h('b', null, a.name), h('span', null, a.category))))
}
function MenuQa({ qa }) {
  const kirimQa = async () => {
    S.menu = null; emit()
    const items = [...qa.masalah.map(x => '- [ISSUE] ' + x), ...qa.saran.slice(0, 6).map(x => '- [SUGGESTION] ' + x)].join('\n')
    const teks = `[Kanvas Studio] Please fix these Visual QA findings in ${S.file || 'the active design'} (current QA score: ${qa.skor}/100) using kanvas_edit, then verify with kanvas_view:\n${items}`
    if (aktifChatHost() && S.chatConfig?.configured) return kirimChatLokal({ prompt: teks })
    const ok = await host.composer.insertText(null, teks, { mode: 'block' })
    if (ok) host.composer.submit?.(null, teks) || host.composer.focus(null)
    else { await S.ctx.os.writeClipboard(teks); host.notify({ kind: 'info', message: 'QA checklist copied to clipboard for your agent.' }) }
  }
  return h('div', { className: 'kv-menu kanan kv-qmenu', ref: tempelMenu(true) },
    h('div', { className: 'kv-kmenu-kepala' }, h('b', null, `Visual QA · ${qa.skor}/100`), h('span', { className: 'kv-qstat' }, qa.masalah.length ? `${qa.masalah.length} issue(s)` : 'Clean ✓')),
    qa.metrik.map(m => h('div', { key: m.id, className: 'kv-qmet' }, h('b', null, m.nama), h('span', null, `${m.skor}/100 · space ~${m.whitespacePct}%${m.minMarginPx != null ? ` · margin ${m.minMarginPx}px` : ''}`))),
    qa.masalah.length ? h('div', { className: 'kv-qsec err' }, h('b', null, 'Issues (fix)'), qa.masalah.slice(0, 6).map((x, i) => h('p', { key: i }, '✗ ' + x))) : null,
    qa.saran.length ? h('div', { className: 'kv-qsec' }, h('b', null, 'Suggestions'), qa.saran.slice(0, 6).map((x, i) => h('p', { key: i }, '• ' + x))) : null,
    !qa.masalah.length && !qa.saran.length ? h('p', { className: 'kv-kmenu-kosong' }, 'Zero overlap, clean margins, strong contrast, and cohesive typography.') : null,
    (qa.masalah.length || qa.saran.length) ? h('button', { className: 'kv-kirim', onClick: kirimQa }, 'Send QA fixes to agent') : null)
}

function Atas({ diPane } = {}) {
  const qa = hitungQaCepat(S.doc), br = brandAktif()
  const qaCls = qa.masalah.length || qa.skor < 65 ? 'err' : qa.skor < 85 ? 'warn' : 'ok'
  return h('header', { className: 'kv-top' },
    h('div', { className: 'kv-brand' }, h(Logo), h('span', null, 'Kanvas Studio')),
    h('select', { className: 'kv-file', value: S.file || '', onChange: e => buka(e.target.value) }, S.files.map(f => h('option', { key: f, value: f }, f.replace(/\.kanvas\.json$/i, '')))),
    h('button', { className: 'kv-ib', title: 'Home', onClick: () => { S.fase = 'pilih-file'; emit() } }, '＋'),
    h('div', { className: 'kv-tools' },
      ALAT.map(([id, ic, t]) => h('button', { key: id, title: t, className: S.tool === id ? 'on' : '', onClick: () => { S.tool = id; emit() } }, ic)),
      h('button', { title: 'Insert image', onClick: sisipGambar }, '🖼'),
      h('button', { title: 'Icons (I): 2,000+ icons', onClick: () => { S.pilihIkon = true; emit() } }, '✦'),
      h('div', { className: 'kv-dd' }, h('button', { title: 'Insert Data Viz (Chart/Table/Diagram) & Asset Library', className: S.menu === 'ins' ? 'on' : '', onClick: () => { muatAset(); S.menu = S.menu === 'ins' ? null : 'ins'; emit() } }, '▤'),
        S.menu === 'ins' ? h(MenuSisip) : null),
      h('div', { className: 'kv-dd' }, h('button', { title: 'New artboard or Smart Resize', onClick: () => { S.menu = S.menu === 'ab' ? null : 'ab'; emit() } }, '⊞', h('span', { className: 'kv-lbl2' }, ' Artboard')),
        S.menu === 'ab' ? h('div', { className: 'kv-menu kv-abmenu', ref: tempelMenu(false) },
          h('div', { className: 'kv-mhead' }, 'New artboard'),
          PRESET.map(p => h('button', { key: p.nama, onClick: () => tambahArtboard(p) }, h('b', null, p.nama), h('span', null, `${p.w}×${p.h}`))),
          h('div', { className: 'kv-mhead' }, 'Smart Resize (copy active)'),
          RESIZE_PRESET.map(p => h('button', { key: 'r-' + p.nama, onClick: () => smartResizeUI(p) }, h('b', null, '⇄ ' + p.nama), h('span', null, `${p.w}×${p.h}`)))) : null)),
    h('div', { className: 'kv-tools' },
      h(TombolPatch), h('button', { title: 'Undo (Ctrl+Z)', disabled: !S.undo.length, onClick: undo }, '↶'), h('button', { title: 'Redo (Ctrl+Y)', disabled: !S.redo.length, onClick: redo }, '↷')),
    h('div', { style: { flex: 1 } }),
    h('div', { className: 'kv-dd' }, h('button', { className: 'kv-ghost', title: 'Brand Kits (colors, fonts, apply)', onClick: () => { muatBrand(); S.menu = S.menu === 'brand' ? null : 'brand'; emit() } },
      '🎨', h('span', { className: 'kv-lbl' }, br ? ` ${br.name.slice(0, 12)}` : ' Brand')),
      S.menu === 'brand' ? h(MenuBrand) : null),
    h('div', { className: 'kv-dd' }, h('button', { className: 'kv-qa ' + qaCls, title: 'Live Visual QA Score & Inspector', onClick: () => { S.menu = S.menu === 'qa' ? null : 'qa'; emit() } },
      (qa.masalah.length ? '⚠ ' : '✓ ') + 'QA ' + qa.skor),
      S.menu === 'qa' ? h(MenuQa, { qa }) : null),
    h('button', { className: 'kv-ghost kv-ic', title: S.tema === 'terang' ? 'Dark theme' : 'Light theme', onClick: () => { S.tema = S.tema === 'terang' ? 'gelap' : 'terang'; S.ctx.storage.set('tema', S.tema); emit() } }, S.tema === 'terang' ? '☾' : '☀'),
    h('button', { className: 'kv-ghost', onClick: () => { S.present = Math.max(0, S.doc.artboards.findIndex(a => a.id === S.ab)); emit() } }, '▶', h('span', { className: 'kv-lbl' }, ' Present')),
    h('div', { className: 'kv-dd' }, h('button', { className: 'kv-ghost', onClick: () => { S.menu = S.menu === 'ex' ? null : 'ex'; emit() } }, '⤓', h('span', { className: 'kv-lbl' }, ' Export')),
      S.menu === 'ex' ? h('div', { className: 'kv-menu kanan', ref: tempelMenu(true) },
        h('div', { className: 'kv-mrow' }, 'Resolution', [1, 2, 3, 4].map(k => h('button', { key: k, className: S.skala === k ? 'on' : '', onClick: () => { S.skala = k; emit() } }, k + 'x'))),
        [['png', 'PNG', 'current artboard'], ['jpg', 'JPG', 'current artboard'], ['pdf', 'Hybrid PDF', 'all artboards (deck)'], ['pdf1', 'Hybrid PDF', 'current artboard'], ['xlsx', 'Excel (.xlsx)', 'editable tables'], ['pptx', 'PowerPoint (.pptx)', 'all artboards, editable'], ['svg', 'SVG', 'current artboard, editable'], ['html', 'HTML / CSS', 'Flexbox code export'], ['react', 'Copy React JSX', 'to clipboard'], ['json', 'Design file', '.kanvas.json'], ['folder', 'Save to folder…', 'copy design + images'], ['salin', 'Copy PNG', 'to clipboard']]
          .map(([k, a, b]) => h('button', { key: k, onClick: () => ekspor(k) }, h('b', null, a), h('span', null, b)))) : null),
    diPane && S.ctx.runAction ? h('button', { className: 'kv-ghost kv-ic', title: 'Fold the canvas (Ctrl+J)', onClick: umpetin }, '⇥') : null,
    h('div', { className: 'kv-dd' }, h('button', { className: 'kv-agent', title: 'Comments for your agent', onClick: () => { S.menu = S.menu === 'kom' ? null : 'kom'; emit() } },
      '💬 Comments', komentarTerbuka().length ? h('b', { className: 'kv-kbadge' }, komentarTerbuka().length) : null),
      S.menu === 'kom' ? h(MenuKomentar) : null))
}
function Modal() {
  const m = S.modal; const [v, setV] = useState(m.input ?? '')
  const tutup = () => { S.modal = null; emit() }
  return h('div', { className: 'kv-modal', onPointerDown: e => { if (e.target === e.currentTarget) tutup() } },
    h('div', { className: 'kv-mbox' }, h('b', null, m.judul), m.pesan ? h('p', null, m.pesan) : null,
      m.input !== undefined ? h('textarea', { autoFocus: true, value: v, rows: 4, onChange: e => setV(e.target.value), onKeyDown: e => { e.stopPropagation(); if (m.aksi && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { tutup(); m.aksi(v) } } }) : null,
      m.konten || null,
      m.tanpaAksi ? null : h('div', { className: 'kv-mact' }, h(Button, { variant: 'secondary', size: 'sm', onClick: tutup }, 'Cancel'), m.ok ? h(Button, { size: 'sm', onClick: () => { tutup(); m.aksi?.(v) } }, m.ok) : null)))
}
function Presentasi() {
  const ref = useRef(null), [sz, setSz] = useState({ w: innerWidth, h: innerHeight })
  const ab = S.doc.artboards[S.present]
  useEffect(() => {
    ref.current?.focus(); ref.current?.requestFullscreen?.().catch(() => {})
    const r = () => setSz({ w: innerWidth, h: innerHeight }); addEventListener('resize', r)
    return () => { removeEventListener('resize', r); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }
  }, [])
  if (!ab) return null
  const s = Math.min(sz.w / ab.w, sz.h / ab.h) * 0.98
  const ke = d => { S.present = Math.max(0, Math.min(S.doc.artboards.length - 1, S.present + d)); emit() }
  return h('div', { ref, tabIndex: 0, className: 'kv-present', onClick: e => ke(e.clientX > innerWidth / 2 ? 1 : -1),
    onKeyDown: e => { e.stopPropagation(); if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) ke(1); if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) ke(-1); if (e.key === 'Escape') { S.present = null; emit() } } },
    h('div', { style: { width: ab.w * s, height: ab.h * s, position: 'relative', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.5)' } },
      h('div', { style: { position: 'absolute', left: 0, top: 0, width: ab.w, height: ab.h, transform: `scale(${s})`, transformOrigin: '0 0' } }, h(AbIsi, { ab }))),
    h('div', { className: 'kv-pinfo' }, `${S.present + 1} / ${S.doc.artboards.length}  ·  ← → navigate  ·  Esc to exit`))
}
function PilihRuang() {
  return h('select', { className: 'kv-ruang', value: S.folder?.id || 'data', title: 'Workspace (where designs are saved)', onChange: e => pilihRuang(e.target.value) },
    (S.folders || []).map(f => h('option', { key: f.id, value: f.id }, f.data ? '⌂ ' + f.name : '▣ ' + (f.name || f.path))),
    S.ctx?.files?.requestFolder ? h('option', { value: '+' }, '+ Use another folder…') : null)
}
// ---------- BERANDA ----------
// Panggung navy: brief langsung ke agent + demo hidup agent menggambar (satu-satunya animasi di halaman).
const BRIEF_CEPAT = [
  ['Swiss editorial poster', 'Design an A4 Swiss editorial exhibition poster for "Form & Signal 2026" — asymmetric grid, crisp hairlines, bold Syne typography, vermilion accent, verified with Visual QA.'],
  ['Data-driven deck (.pptx)', 'Build a 6-slide corporate investor presentation with KPI stats, a quarterly revenue bar chart, and a comparison table, then export an editable PowerPoint (.pptx).'],
  ['Multi-format campaign', 'Create a coordinated campaign pack (IG Feed, IG Story, Web Banner, and 4-slide Carousel) for our product launch using our active Brand Kit.'],
  ['Landing hero → React', 'Design a modern SaaS landing hero banner (1440×600) using auto-layout frames, then export clean React + Tailwind code via kanvas_to_code.']
]
const GRUP_UKURAN = [['Presentation', ['Slide 16:9', 'Slide 4:3']], ['Print', ['A4 Portrait', 'A4 Landscape', 'A3 Portrait', 'A2 Portrait', 'A1 Portrait']], ['Social media', ['IG Feed 4:5', 'IG Square', 'IG Story 9:16']]]
function DemoAgen() {
  // artboard mini yang "digambar" agent: elemen muncul bergiliran, kursor + bar mengikuti, lalu ulang
  return h('div', { className: 'kv-demo', 'aria-hidden': true },
    h('div', { className: 'kv-demo-ab' },
      h('i', { className: 'kv-demo-scan' }),
      h('i', { className: 'kv-demo-el kv-d1' }), h('i', { className: 'kv-demo-el kv-d2' }), h('i', { className: 'kv-demo-el kv-d3' }),
      h('i', { className: 'kv-demo-el kv-d4' }, h('b'), h('b')), h('i', { className: 'kv-demo-el kv-d5' }),
      h('div', { className: 'kv-demo-kursor' },
        h('i', { dangerouslySetInnerHTML: { __html: KURSOR_SVG } }),
        h('div', { className: 'kv-demo-bar' }, h(Logo, { className: 'kv-demo-logo' }),
          h('span', { className: 'kv-demo-t kv-t1' }, 'Setting the background'), h('span', { className: 'kv-demo-t kv-t2' }, 'Writing the headline'),
          h('span', { className: 'kv-demo-t kv-t3' }, 'Placing the image'), h('span', { className: 'kv-demo-t kv-t4' }, 'Adding a button'),
          h('span', { className: 'kv-demo-t kv-t5 kv-demo-ok' }, 'Done, 5 changes')))),
    h('div', { className: 'kv-demo-cap' }, 'A4 poster, your agent at work'))
}
const TERAKHIR = { daftar: null, kunci: '' }
function muatTerakhir() {
  const kunci = S.folder?.id + '|' + S.files.join('|')
  if (TERAKHIR.kunci === kunci) return
  TERAKHIR.kunci = kunci
  ;(async () => {
    const hasil = []
    for (const f of S.files.slice(0, 24)) {
      const st = await S.ctx.files.stat(S.folder.id, f)
      hasil.push({ f, mtime: st.mtimeMs || 0 })
    }
    hasil.sort((a, b) => b.mtime - a.mtime)
    const atas = hasil.slice(0, 8)
    for (const x of atas) { try { const r = await S.ctx.files.readText(S.folder.id, x.f); if (r.ok) x.doc = normalisasi(JSON.parse(r.text)) } catch {} }
    TERAKHIR.daftar = atas.filter(x => x.doc); emit()
  })()
}
const waktuLalu = ms => { const d = (Date.now() - ms) / 60000; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : Math.round(d / 1440) + ' days ago' }
const muatKotak = (ab, W, H) => Math.round(ab.w / ab.h > W / H ? W : H * ab.w / ab.h)

async function aksiDokumen(args) {
  if (typeof S.ctx?.documentAction !== 'function') throw Error('Fitur dokumen belum tersedia di host ini. Buka file melalui Kanvas Studio lokal.')
  const r = await S.ctx.documentAction({ ...args, folder: S.folder?.id })
  if (!r?.ok) throw Error(r?.message || 'Dokumen belum bisa diproses. Coba lagi melalui Kanvas Studio lokal.')
  return r
}
function ImporDokumen() {
  const input = useRef(null), [drag, setDrag] = useState(false), [error, setError] = useState('')
  async function pilih(file) {
    if (!file || S.documentBusy) return
    setError('')
    const pdf = /\.pdf$/i.test(file.name)
    if (!pdf && !/\.(xlsx|csv)$/i.test(file.name)) { setError('Pilih file PDF, XLSX, atau CSV.'); return }
    S.documentBusy = true; emit()
    try {
      if (S.dirty) { await simpanSekarang(); if (S.dirty) throw Error(S.status) }
      const r = await aksiDokumen(pdf ? { action: 'import_pdf', mode: 'quick_edit', file }
        : { action: 'import_xlsx', create_report: true, file })
      if (!r.file) throw Error('Host tidak mengembalikan dokumen yang bisa dibuka.')
      await muatDaftar(); await buka(r.file)
      if (S.file !== r.file || S.fase !== 'siap') throw Error(S.status || 'Dokumen belum bisa dibuka.')
      S.tool = 'pilih'; S.fokus = false
      S.status = r.message || (!pdf ? 'Draft laporan siap diperiksa.' : r.isHybrid ? 'PDF dibuka dengan desain aslinya.' : 'Latar PDF terkunci. Tandai area, lalu pilih Tutup & Ubah Teks.')
    } catch (e) { setError(e?.message || 'Dokumen belum bisa dibuka.') }
    finally { S.documentBusy = false; emit() }
  }
  return h('div', { className: 'kv-impor' + (drag ? ' kv-drop' : ''),
    onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = S.documentBusy ? 'none' : 'copy'; if (!S.documentBusy) setDrag(true) },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false) },
    onDrop: e => { e.preventDefault(); setDrag(false); pilih(e.dataTransfer.files[0]) } },
    h('input', { type: 'file', ref: input, hidden: true, accept: '.pdf,.xlsx,.csv', 'aria-label': 'Impor PDF / Excel',
      onChange: e => { const f = e.target.files[0]; e.target.value = ''; pilih(f) } }),
    h('button', { type: 'button', disabled: S.documentBusy, onClick: () => input.current?.click() }, S.documentBusy ? 'Memproses dokumen…' : 'Impor PDF / Excel'),
    h('small', null, 'atau tarik PDF, XLSX, atau CSV ke sini'),
    error ? h('small', { role: 'alert' }, error) : null)
}
function Mulai() {
  const [brief, setBrief] = useState(''), [judul, setJudul] = useState(''), [gaya, setGaya] = useState('auto')
  useEffect(() => { muatFont('Bricolage Grotesque', 800); muatTemplate(); muatBrand(); muatAset(); muatChatConfig() }, [])
  useEffect(() => { muatTerakhir(); muatBrand(); muatAset() }, [S.files.join('|'), S.folder?.id])
  const brands = daftarBrand(), defBr = S.brands?.defaultId, chat = aktifChatHost(), cfg = S.chatConfig
  const kirim = () => { if (brief.trim()) mintaAgentBaru(brief.trim(), gaya, defBr || '') }
  const terakhir = (TERAKHIR.daftar || []).filter(x => S.files.includes(x.f))
  for (const x of terakhir) terapkanTata(x.doc)   // auto-layout pratinjau dihitung di browser
  return h('div', { className: 'kv-start' },
    h('section', { className: 'kv-panggung' },
      h('div', { className: 'kv-panggung-kiri' },
        h('div', { className: 'kv-merek kv-merek-mode' },
          h(Logo), h('span', null, 'Kanvas Studio'), h(PilihRuang),
          chat ? h('div', { className: 'kv-home-ai' },
            typeof chat.renderSlot === 'function' ? h('span', { className: 'kv-pb-slot' }, chat.renderSlot()) : null,
            (typeof chat.getConfig === 'function' || typeof chat.openSettings === 'function')
              ? h('button', {
                type: 'button', className: 'kv-home-cfg' + (cfg?.configured ? ' ready' : ''),
                title: 'Pengaturan AI Lokal (BYOK / Ollama)',
                onClick: () => bukaModalByok()
              }, h('i', { className: 'kv-pb-dot' }), cfg?.configured ? `⚙ ${cfg.model || cfg.provider}` : '⚙ Pengaturan AI')
              : null) : null),
        h('div', { className: 'kv-hero-copy' },
          h('h1', null, 'Design anything.', h('br'), 'Your agent draws it.'),
          h('p', null, 'Adaptive Design Intelligence, multi-brand Brand Kits, native charts & decks (.pptx), Smart Resize, and Visual QA — 100% free, open-source, and local-first.')),
        h('div', { className: 'kv-brief' },
          h('textarea', { rows: 2, value: brief, placeholder: 'For example: a Swiss editorial A4 exhibition poster, or a 6-slide Q4 investor deck with bar chart', onChange: e => setBrief(e.target.value),
            onKeyDown: e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); kirim() } } }),
          h('button', { className: 'kv-brief-kirim', disabled: !brief.trim() || S.chatBusy, onClick: kirim }, S.chatBusy ? 'Working…' : 'Send to agent')),
        h('div', { className: 'kv-gaya-bar' },
          h('span', null, 'Art direction:'),
          GAYA_ARAH.map(([k, l]) => h('button', { key: k, className: gaya === k ? 'on' : '', onClick: () => setGaya(k) }, l))),
        h('div', { className: 'kv-chips' }, BRIEF_CEPAT.map(([l, b]) => h('button', { key: l, onClick: () => setBrief(b) }, l))),
        h(ImporDokumen)),
      h(DemoAgen)),
    terakhir.length ? h('section', { className: 'kv-bag' },
      h('div', { className: 'kv-bag-head' }, h('h2', null, 'Continue'), h('span', { className: 'kv-bag-sub' }, `${terakhir.length} recent design${terakhir.length > 1 ? 's' : ''}`)),
      h('div', { className: 'kv-rak kv-rak-gulir' }, terakhir.map(x => h('button', { key: x.f, className: 'kv-karya', onClick: () => buka(x.f) },
        h('div', { className: 'kv-karya-ab' }, h(Thumb, { ab: x.doc.artboards[0], lebar: muatKotak(x.doc.artboards[0], 200, 132) })),
        h('b', null, x.doc.judul || x.f.replace(/\.kanvas\.json$/i, '')), h('span', null, `${x.doc.artboards.length > 1 ? x.doc.artboards.length + ' artboards, ' : ''}edited ${waktuLalu(x.mtime)}`))))) : null,
    TPL.data?.length ? h('section', { className: 'kv-bag' },
      h('div', { className: 'kv-bag-head' }, h('h2', null, 'Start from a template'), h('span', { className: 'kv-bag-sub' }, 'Ready-to-edit layouts')),
      h('div', { className: 'kv-rak' }, TPL.data.map(t => {
        terapkanTata(t)
        const ab = t.artboards[0]
        return h('button', { key: t.meta?.id, className: 'kv-karya', title: t.meta?.deskripsi, onClick: () => desainDariTemplate(t, judul || t.meta?.nama) },
          h('div', { className: 'kv-karya-ab' }, h(Thumb, { ab, lebar: muatKotak(ab, 200, 132) })),
          h('b', null, t.meta?.nama), h('span', null, t.artboards.length > 1 ? `${t.meta?.kategori}, ${t.artboards.length} slides` : t.meta?.kategori))
      }))) : null,
    h('section', { className: 'kv-bag' },
      h('div', { className: 'kv-bag-head' }, h('h2', null, 'Brand Kits'), h('button', { className: 'kv-mini', onClick: () => bukaModalBrand(null) }, '+ New Brand Kit')),
      h('div', { className: 'kv-brgrid' },
        brands.map(b => {
          const c = b.colors || {}, cols = [c.background, c.surface, c.text, c.accent || c.primary].filter(Boolean)
          const isDef = b.id === defBr
          return h('div', { key: b.id, className: 'kv-bcard' + (isDef ? ' on' : '') },
            h('div', { className: 'kv-bcard-top' },
              h('b', null, b.name),
              isDef ? h('em', { className: 'kv-tag' }, 'Default') : h('button', { className: 'kv-blink', onClick: () => simpanBrandStore({ defaultId: b.id, map: S.brands.map }) }, 'Set default')),
            h('div', { className: 'kv-bswatch' }, cols.map((hx, i) => h('i', { key: i, style: { background: hx }, title: hx }))),
            h('div', { className: 'kv-bcard-meta' }, h('span', null, [b.fonts?.display, b.fonts?.body].filter(Boolean).join(' · ') || 'Custom fonts'),
              h('button', { className: 'kv-blink', onClick: () => bukaModalBrand(b) }, 'Edit')))
        }),
        h('button', { className: 'kv-bcard kv-badd', onClick: () => bukaModalBrand(null) }, h('b', null, '+ Add Brand Kit'), h('span', null, 'Save colors, fonts & art direction')))),
    h('section', { className: 'kv-bag' },
      h('div', { className: 'kv-bag-head' }, h('h2', null, 'Blank canvas'), h('span', { className: 'kv-bag-sub' }, 'Pick a preset size to start from scratch')),
      h('input', { className: 'kv-judul', placeholder: 'Design name (optional)', value: judul, onChange: e => setJudul(e.target.value) }),
      h('div', { className: 'kv-ukuran' }, GRUP_UKURAN.map(([g, nama]) => h('div', { key: g, className: 'kv-ukuran-grup' },
        h('span', null, g),
        h('div', null, nama.map(n => PRESET.find(p => p.nama === n)).filter(Boolean).map(p => h('button', { key: p.nama, className: 'kv-ukuran-btn', onClick: () => desainBaru(judul || p.nama, p) },
          h('i', { style: { width: muatKotak(p, 54, 54), height: Math.round(muatKotak(p, 54, 54) * p.h / p.w) } }),
          h('b', null, p.nama.replace(' Portrait', '')), h('span', null, `${p.w} × ${p.h}`)))))))),
    S.doc ? h('div', null, h(Button, { variant: 'secondary', size: 'sm', onClick: () => { S.fase = 'siap'; emit() } }, 'Back to design')) : null,
    chat ? h(AgentProgressDrawer) : null,
    h('footer', { className: 'kv-homefoot' },
      h('span', null, 'Kanvas Studio v0.5.0 · Free forever · MIT Open Source · Local first'),
      h('a', { href: 'https://github.com/sponsors/ranggaoscar', target: '_blank', rel: 'noopener noreferrer' }, '♥ Support on GitHub')))
}

function KanvasApp({ diPane } = {}) {
  useEffect(() => { KANVAS.terbuka++; muatBrand(); muatAset(); muatChatConfig(); return () => { KANVAS.terbuka-- } }, [])
  useStore()
  const root = useRef(null)
  const kunci = e => {
    if (S.fase !== 'siap' || /input|textarea|select/i.test(e.target.tagName) || S.modal || S.pilihIkon || S.present != null) return
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase()
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
    else if (mod && k === 'y') { e.preventDefault(); redo() }
    else if (mod && k === 'd') { e.preventDefault(); duplikatSel() }
    else if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? lepasGrup() : grupkanSel() }
    else if (mod && e.altKey && k === 'k') { e.preventDefault(); jadikanKomponen() }
    else if (mod && k === 'c') {
      const pilihIds = new Set(S.sel)
      S.clip = terpilih().filter(({ el }) => { for (let x = el; x.induk;) { if (pilihIds.has(x.induk)) return false; x = cariEl(x.induk)?.el; if (!x) break } return true })
        .map(({ ab, el }) => { const ai = anakInstSet(ab); return clone([el, ...(isGrup(el) && !el.salinan ? keturunan(ab, el.id).filter(d => !ai.has(d.id)) : [])]) })
    }
    else if (mod && k === 'v' && S.clip?.length) {
      e.preventDefault(); const ab = abAktif(); if (!ab) return
      const akar = []
      ubah(() => {
        for (const pohon of S.clip) { const salin = klonPohon(pohon, 24, 24, ab); ab.elemen.push(...salin); if (salin[0]) akar.push(salin[0].id) }
        ab.elemen = urutPohon(ab.elemen)
      })
      S.sel = akar; emit()
    }
    else if (S.pena && k === 'backspace') { e.preventDefault(); S.pena.titik.pop(); if (!S.pena.titik.length) S.pena = null; emit() }
    else if (S.editTitik && S.titikSel != null && (k === 'delete' || k === 'backspace')) { e.preventDefault(); hapusTitikSel() }
    else if (S.editTitik && (k === 'delete' || k === 'backspace')) { e.preventDefault() }   // mode edit titik: jangan hapus seluruh vektor
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); hapusSel() }
    else if (S.pena && (k === 'enter' || k === 'escape')) { e.preventDefault(); selesaiPena(false) }
    else if (S.editTitik && (k === 'enter' || k === 'escape')) { S.editTitik = null; S.titikSel = null; emit() }
    else if (k === 'escape') { S.sel = []; S.patchArea = null; S.tool = 'pilih'; S.menu = null; S.komentarAktif = null; S.draftKomentar = null; emit() }
    else if (k.startsWith('arrow') && S.sel.length) { e.preventDefault(); const items = denganTurunan(); if (!bolehUbah(items)) return; const d = e.shiftKey ? 10 : 1; ubah(() => items.forEach(({ el }) => { if (k === 'arrowleft') el.x -= d; if (k === 'arrowright') el.x += d; if (k === 'arrowup') el.y -= d; if (k === 'arrowdown') el.y += d }), true) }
    else if (k === ' ' && !SPASI.on) { SPASI.on = true; root.current?.classList.add('kv-spasi') }
    else if (!mod && k === 'i') { S.pilihIkon = true; emit() }
    else if (!mod && k === 'c') { S.tool = 'komentar'; emit() }
    else if (!mod && { v: 1, h: 1, t: 1, r: 1, o: 1, p: 1 }[k]) { if (S.pena) selesaiPena(false); S.tool = { v: 'pilih', h: 'tangan', t: 'teks', r: 'kotak', o: 'elips', p: 'pena' }[k]; emit() }
    else if (mod && k === '.') { e.preventDefault(); S.fokus = !S.fokus; emit() }
    else if (e.shiftKey && k === '!') fitSemua()
    else if (e.shiftKey && k === '@') fitAb(abAktif())
  }
  const lepasKunci = e => { if (e.key === ' ') { SPASI.on = false; root.current?.classList.remove('kv-spasi') } }

  let isi
  if (S.fase === 'muat') isi = h('div', { className: 'kv-kosong' }, 'Loading…')
  else if (S.fase === 'perlu-folder' || S.fase === 'error') isi = h('div', { className: 'kv-kosong' },
    h(Logo, { className: 'kv-orb' }), h('h2', null, 'Kanvas Studio'),
    h('p', null, S.fase === 'error' ? S.pesan : 'Kanvas Studio could not open its workspace.'),
    null)
  else if (S.fase === 'pilih-file' || !S.doc) isi = h(Mulai)
  else {
    const props = S.panelKanan && (S.sel.length || S.propAb)
    const hasChat = !!aktifChatHost()
    isi = h(Fragment, null, S.fokus ? null : h(Atas, { diPane }),
      h('div', { className: 'kv-main' + (hasChat ? ' kv-has-chat' : '') + (props ? ' kv-r-open' : '') },
        h(Kanvas),
        h(AgentKursor), h(KomentarPopover),
        !S.fokus && S.panelKiri ? h(PanelKiri) : null,
        !S.fokus && props ? h('div', { className: 'kv-float kv-float-r' }, h('button', { className: 'kv-x kv-xr', title: 'Close panel', onClick: () => { S.sel = []; S.propAb = false; emit() } }, '✕'), h(PanelKanan)) : null,
        !S.fokus && S.film ? h(StripSlide) : null,
        !S.fokus && hasChat ? h(FloatingPromptBar) : null,
        !S.fokus && hasChat ? h(AgentProgressDrawer) : null,
        h('div', { className: 'kv-corner' },
          h('button', { className: S.panelKiri ? 'on' : '', title: 'Layers', onClick: () => { S.panelKiri = !S.panelKiri; emit() } }, '☰'),
          h('button', { className: S.film ? 'on' : '', title: 'Artboard strip', onClick: () => { S.film = !S.film; emit() } }, '▭'),
          h('button', { className: S.fokus ? 'on' : '', title: 'Focus mode (Ctrl+.)', onClick: () => { S.fokus = !S.fokus; emit() } }, '⛶'),
          h('i', { className: 'kv-sep' }),
          h('button', { title: 'Zoom out', onClick: () => { const v = ukuranView(); zoomDi(1 / 1.25, v.w / 2, v.h / 2) } }, '−'),
          h('button', { className: 'kv-zoom', title: 'Zoom to fit (Shift+1)', onClick: fitSemua }, Math.round(S.zoom * 100) + '%'),
          h('button', { title: 'Zoom in', onClick: () => { const v = ukuranView(); zoomDi(1.25, v.w / 2, v.h / 2) } }, '+'))),
      S.fokus ? null : h('footer', { className: 'kv-status' },
        h('span', null, S.status || (S.dirty ? 'Unsaved…' : 'Saved ✓')),
        h('label', null, h('input', { type: 'checkbox', checked: S.ikuti, onChange: e => { S.ikuti = e.target.checked; emit() } }), 'Follow agent'),
        h('label', null, h('input', { type: 'checkbox', checked: S.robot, onChange: e => { S.robot = e.target.checked; S.ctx.storage.set('robot', S.robot); emit() } }), 'Agent animation'),
        h('span', { style: { flex: 1 } }),
        h(PilihRuang),
        h('span', { className: 'kv-path', title: pathLengkap(S.file) || '' }, S.file),
        h('button', { onClick: simpanKeFolder, title: 'Copy this design to a folder of your choice' }, 'Save to folder…'),
        pathFolder() ? h('button', { onClick: () => S.ctx.os.revealPath(pathFolder()) }, 'Show folder') : null),
      S.present != null ? h(Presentasi) : null)
  }
  return h('div', { ref: root, className: 'kv kv-' + S.tema, tabIndex: -1, onKeyDown: kunci, onKeyUp: lepasKunci, onPointerDown: e => { if (S.menu && !e.target.closest('.kv-dd')) { S.menu = null; emit() } } },
    isi, S.modal ? h(Modal, { key: S.modal.judul }) : null, S.pilihIkon ? h(PilihIkon) : null)
}

/* =============== 9. GAYA =============== */
const CSS = `
.kv{--kv-acc:#ff5a3c;--kv-grad:${AKSEN};display:flex;flex-direction:column;height:100%;min-height:0;color:var(--ui-text-primary);font-family:"Plus Jakarta Sans",var(--font-sans,system-ui),sans-serif;font-size:12.5px;outline:none;position:relative;background:var(--ui-bg-primary)}
.kv button{font:inherit;color:inherit;cursor:pointer}
.kv{container-type:inline-size;position:relative}
.kv-top{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--ui-stroke-secondary);flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
.kv-top>*{flex:none}
@container (max-width:1180px){.kv-lbl{display:none}}
@container (max-width:900px){.kv-lbl2{display:none}.kv-brand span{display:none}.kv-file{max-width:120px}}
.kv-brand{display:flex;align-items:center;gap:7px;font-weight:800;letter-spacing:-.01em;font-size:13.5px}
.kv-logo{display:inline-block;flex:none;line-height:0}.kv-logo svg{display:block}
.kv-brand .kv-logo{width:20px;height:20px}
.kv-file{max-width:170px;height:28px;border-radius:8px;border:1px solid var(--ui-stroke-secondary);background:transparent;color:inherit;padding:0 6px}
.kv-tools{display:flex;gap:2px;padding:2px;border-radius:10px;background:var(--ui-bg-elevated);border:1px solid var(--ui-stroke-tertiary,var(--ui-stroke-secondary))}
.kv-tools button,.kv-ib{min-width:28px;height:26px;padding:0 7px;border:0;border-radius:7px;background:transparent;font-size:13px}
.kv-tools button:hover,.kv-ib:hover{background:var(--ui-stroke-tertiary,rgba(127,127,127,.15))}
.kv-tools button.on{background:var(--kv-grad);color:#fff;box-shadow:0 3px 10px rgba(255,90,60,.35)}
.kv-tools button:disabled{opacity:.35;cursor:default}
.kv-zoom{min-width:50px!important;font-variant-numeric:tabular-nums;font-weight:700}
.kv-ghost{height:28px;padding:0 11px;border-radius:8px;border:1px solid var(--ui-stroke-secondary);background:transparent;font-weight:600}
.kv-ghost:hover{border-color:var(--kv-acc)}
.kv-agent{height:28px;padding:0 13px;border-radius:8px;border:0;background:var(--kv-grad);color:#fff!important;font-weight:800;box-shadow:0 4px 14px rgba(255,90,60,.4)}
.kv-dd{position:relative}
.kv-top .kv-dd{position:static}
.kv-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:30;min-width:230px;background:var(--ui-bg-elevated);border:1px solid var(--ui-stroke-secondary);border-radius:12px;padding:6px;box-shadow:0 18px 50px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:1px}
.kv-menu.kanan{left:auto;right:0}
.kv-menu>button{display:flex;justify-content:space-between;gap:14px;text-align:left;border:0;background:transparent;padding:7px 9px;border-radius:8px}
.kv-menu>button:hover{background:var(--ui-stroke-tertiary,rgba(127,127,127,.15))}
.kv-menu span{color:var(--ui-text-tertiary)}
.kv-mrow{display:flex;align-items:center;gap:4px;padding:4px 9px 8px;color:var(--ui-text-tertiary);border-bottom:1px solid var(--ui-stroke-secondary);margin-bottom:4px}
.kv-mrow button{border:1px solid var(--ui-stroke-secondary);background:transparent;border-radius:6px;padding:1px 7px}
.kv-mrow button.on{background:var(--kv-grad);color:#fff;border-color:transparent}
.kv-main{flex:1;min-height:0;display:flex}
.kv-left,.kv-right{width:210px;flex:none;overflow:auto;border-right:1px solid var(--ui-stroke-secondary);padding:10px;display:flex;flex-direction:column;gap:12px}
.kv-right{width:240px;border-right:0;border-left:1px solid var(--ui-stroke-secondary);gap:8px}
.kv-sec.grow{flex:1;min-height:0}
.kv-right>*{flex:none}
.kv-right{overflow-x:hidden}
.kv-right .kv-btnrow button{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;padding:0 4px}
.kv-susun{display:grid!important;grid-template-columns:1fr 1fr}
.kv-sectitle{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ui-text-tertiary);margin:4px 0 6px}
.kv-id{font-family:monospace;text-transform:none;letter-spacing:0;font-weight:500}
.kv-abrow{display:flex;align-items:center;gap:8px;padding:5px;border-radius:9px;cursor:pointer;border:1px solid transparent}
.kv-abrow:hover{background:var(--ui-bg-elevated)}
.kv-abrow.aktif{border-color:var(--kv-acc);background:var(--ui-bg-elevated)}
.kv-thumb{position:relative;overflow:hidden;border-radius:4px;flex:none;box-shadow:0 1px 4px rgba(0,0,0,.2);background:#fff}
.kv-abmeta{flex:1;min-width:0;display:flex;flex-direction:column}
.kv-abmeta b{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kv-abmeta span{font-size:10px;color:var(--ui-text-tertiary)}
.kv-abact{display:none;gap:1px}.kv-abrow:hover .kv-abact{display:flex}
.kv-abact button,.kv-layer button{border:0;background:transparent;padding:1px 4px;border-radius:5px;color:var(--ui-text-tertiary)}
.kv-abact button:hover,.kv-layer button:hover{color:var(--kv-acc)}
.kv-layer{display:flex;align-items:center;gap:7px;padding:5px 6px;border-radius:7px;cursor:pointer}
.kv-layer:hover{background:var(--ui-bg-elevated)}
.kv-layer.aktif{background:rgba(255,90,60,.14)}
.kv-layer span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kv-lic{width:16px;height:16px;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;font-size:10px;font-style:normal;font-weight:800;border:1px solid var(--ui-stroke-secondary)}
.kv-lic-elips{border-radius:50%}
.kv-view{flex:1;min-width:0;position:relative;overflow:hidden;outline:none;background-color:var(--ui-bg-editor,var(--ui-bg-primary));background-image:radial-gradient(var(--ui-stroke-secondary) 1px,transparent 1px);background-size:22px 22px;cursor:default;touch-action:none}
.kv-tool-tangan,.kv-spasi .kv-view{cursor:grab}
.kv-tool-teks{cursor:text}.kv-tool-komentar{cursor:copy}
.kv-pin{position:absolute;z-index:7;width:26px;height:26px;border-radius:13px 13px 13px 3px;border:2px solid #fff;background:#FF4D3D;color:#fff;font:800 12px "Plus Jakarta Sans",system-ui;display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 12px rgba(16,22,52,.35);transform-origin:4px 100%;padding:0}
.kv-pin.aktif{background:#101634}.kv-pin.selesai{background:#06A77D}
.kv-kpop{position:absolute;z-index:30;width:280px;background:#fff;color:#141826;border-radius:14px;padding:12px;box-shadow:0 18px 44px rgba(16,22,52,.28),0 0 0 1px rgba(16,22,52,.06);display:flex;flex-direction:column;gap:8px;font:13px "Plus Jakarta Sans",system-ui}
.kv-kpop textarea{border:1px solid #E3E6EF;border-radius:9px;padding:8px 10px;font:inherit;resize:none;outline:none;color:inherit}
.kv-kpop textarea:focus{border-color:#FF4D3D}
.kv-kpop p{margin:0;line-height:1.5;white-space:pre-wrap}
.kv-kpop-kepala{display:flex;align-items:center;justify-content:space-between}
.kv-kpop-el{font-size:11.5px;color:#6B7192}
.kv-kpop-balas{display:flex;gap:8px;align-items:flex-start;background:#F2F4F9;border-radius:9px;padding:8px;font-size:12px;color:#2A2F4A}
.kv-kpop-logo{width:18px;height:18px;flex:none}
.kv-kpop-aksi{display:flex;gap:6px;justify-content:flex-end;align-items:center}
.kv-kpop-aksi span{flex:1;font-size:11px;color:#9AA0B8}
.kv-kpop-aksi button{border:1px solid #E3E6EF;background:#fff;border-radius:8px;padding:5px 11px;font:700 12px "Plus Jakarta Sans",system-ui;cursor:pointer;color:#141826}
.kv-kpop-aksi button.utama{background:#101634;border-color:#101634;color:#fff}.kv-kpop-aksi button:disabled{opacity:.4}
.kv-kbadge{margin-left:6px;background:#fff;color:#FF4D3D;border-radius:9px;padding:0 6px;font-size:11px}
.kv-kmenu{width:320px;max-height:60vh;overflow:auto;padding:10px!important}
.kv-kmenu-kepala{display:flex;align-items:center;gap:10px;font-size:12px;margin-bottom:6px}.kv-kmenu-kepala b{flex:1}
.kv-kmenu-kepala label{display:flex;gap:4px;align-items:center;color:var(--ui-text-tertiary)}
.kv-kmenu-kosong{font-size:12px;color:var(--ui-text-tertiary);line-height:1.5;margin:6px 2px}
.kv-kitem{display:flex!important;gap:8px;align-items:flex-start;text-align:left;width:100%}
.kv-kitem i{flex:none;width:20px;height:20px;border-radius:10px 10px 10px 3px;background:#FF4D3D;color:#fff;font:800 10.5px system-ui;font-style:normal;display:grid;place-items:center}
.kv-kitem.selesai i{background:#06A77D}
.kv-kitem span{font-size:12.5px;line-height:1.4}.kv-kitem em{display:block;font-style:normal;color:var(--ui-text-tertiary);font-size:11.5px;margin-top:2px}
.kv-kirim{margin-top:8px;width:100%;border:0!important;border-radius:9px;padding:9px!important;background:linear-gradient(135deg,#FF4D3D,#FFA23C)!important;color:#fff!important;font-weight:800!important;justify-content:center!important}.kv-tool-kotak,.kv-tool-elips,.kv-tool-pena{cursor:crosshair}
.kv-pena{position:absolute;pointer-events:none;overflow:visible;z-index:6}
.kv-edittitik{pointer-events:none}.kv-edittitik rect,.kv-edittitik circle{pointer-events:all;cursor:move}
.kv-world{position:absolute;left:0;top:0;transform-origin:0 0}
.kv-ab{position:absolute;box-shadow:0 10px 40px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06)}
.kv-ab.aktif{box-shadow:0 14px 50px rgba(0,0,0,.24),0 0 0 2px var(--kv-acc)}
.kv-ablabel{position:absolute;left:0;white-space:nowrap;color:var(--ui-text-tertiary);font-weight:700;cursor:move;user-select:none}
.kv-ab.aktif .kv-ablabel{color:var(--kv-acc)}
.kv-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8a90a8;font:600 18px system-ui}
.kv-sel{position:absolute;border-style:solid;border-color:var(--kv-acc);pointer-events:none;box-sizing:border-box}
.kv-h{position:absolute;background:#fff;border-style:solid;border-color:var(--kv-acc);border-radius:3px;pointer-events:auto;box-sizing:border-box}
.kv-h-nw{left:0;top:0;cursor:nwse-resize}.kv-h-n{left:50%;top:0;cursor:ns-resize}.kv-h-ne{right:0;top:0;cursor:nesw-resize}.kv-h-e{right:0;top:50%;cursor:ew-resize}
.kv-h-se{right:0;bottom:0;cursor:nwse-resize}.kv-h-s{left:50%;bottom:0;cursor:ns-resize}.kv-h-sw{left:0;bottom:0;cursor:nesw-resize}.kv-h-w{left:0;top:50%;cursor:ew-resize}
.kv-h-n,.kv-h-s{transform:translateX(-50%)}.kv-h-e,.kv-h-w{transform:translateY(-50%)}
.kv-dim{position:absolute;left:50%;transform:translateX(-50%);background:var(--kv-grad);color:#fff;font-weight:700;white-space:nowrap}
.kv-guide{position:absolute;background:#ff2bd6;pointer-events:none}
.kv-teksedit{position:absolute;background:rgba(255,255,255,.6);border:0;outline:2px solid var(--kv-acc);resize:none;padding:0;margin:0;overflow:hidden;white-space:pre-wrap;box-sizing:content-box}
.kv-f{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}
.kv-f span,.kv-flabel{font-size:10.5px;color:var(--ui-text-tertiary);font-weight:600}
.kv-f input,.kv-f select,.kv-hex,.kv-ta{width:100%;height:28px;border:1px solid var(--ui-stroke-secondary);border-radius:7px;background:transparent;color:inherit;padding:0 7px;font:inherit;outline:none;box-sizing:border-box}
.kv-f input:focus,.kv-f select:focus,.kv-ta:focus,.kv-hex:focus{border-color:var(--kv-acc)}
.kv-f select option{color:#101634}
.kv-f.kecil{max-width:70px}
.kv-ta{height:auto;min-height:64px;padding:6px 7px;resize:vertical}
.kv-row{display:flex;gap:7px}
.kv-btnrow{display:flex;flex-wrap:wrap;gap:4px}
.kv-btnrow button{flex:1;min-width:30px;height:27px;border:1px solid var(--ui-stroke-secondary);background:transparent;border-radius:7px;padding:0 6px;font-size:11.5px;white-space:nowrap}
.kv-btnrow button:hover{border-color:var(--kv-acc)}
.kv-btnrow button.on{background:var(--kv-grad);color:#fff;border-color:transparent}
.kv-btnrow button.bahaya:hover{border-color:#e5484d;color:#e5484d}
.kv-warna{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:10px;background:var(--ui-bg-elevated)}
.kv-wrow{display:flex;align-items:center;gap:6px}
.kv-wrow input[type=color]{width:34px;height:28px;padding:0;border:1px solid var(--ui-stroke-secondary);border-radius:7px;background:transparent}
.kv-wrow .kv-flabel{flex:1}
.kv-seg{display:flex;border:1px solid var(--ui-stroke-secondary);border-radius:7px;overflow:hidden}
.kv-seg button{border:0;background:transparent;padding:3px 7px;font-size:10.5px}
.kv-seg button.on{background:var(--kv-grad);color:#fff}
.kv-swatch{display:grid;grid-template-columns:repeat(8,1fr);gap:4px}
.kv-swatch button{aspect-ratio:1;border-radius:6px;border:1px solid rgba(0,0,0,.12);padding:0}
.kv-swatch button:hover{transform:scale(1.12)}
.kv-check{display:flex;align-items:center;gap:6px;font-size:11.5px}
.kv-hint{font-size:11px;line-height:1.5;color:var(--ui-text-tertiary);padding:8px;border-radius:9px;border:1px dashed var(--ui-stroke-secondary)}
.kv-status{display:flex;align-items:center;gap:10px;padding:4px 10px;border-top:1px solid var(--ui-stroke-secondary);font-size:11px;color:var(--ui-text-tertiary)}
.kv-status button{border:0;background:transparent;padding:2px 4px;color:inherit}
.kv-status button:hover{color:var(--kv-acc)}
.kv-status label{display:flex;align-items:center;gap:4px}
.kv-path{max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv-kosong{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:30px;text-align:center}
.kv-kosong p{max-width:420px;line-height:1.55;color:var(--ui-text-secondary)}
.kv-orb{width:74px;height:74px;filter:drop-shadow(0 16px 30px rgba(16,22,52,.28))}
@keyframes kvputar{to{filter:hue-rotate(360deg)}}
.kv-start{flex:1;overflow:auto;padding:20px 24px 40px;display:flex;flex-direction:column;gap:30px;container-type:inline-size;
  background-color:var(--ui-bg-editor);background-image:radial-gradient(color-mix(in srgb,var(--ui-text-tertiary) 22%,transparent) 1px,transparent 1px);background-size:22px 22px}
.kv-start>*{flex-shrink:0}
.kv-merek-mode{flex-wrap:wrap}
.kv-patcharea{position:absolute;box-sizing:border-box;border:1px dashed #a54226;background:#ff92391c;pointer-events:none}
.kv-impor{align-self:flex-start;display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;max-width:100%;border-radius:8px}
.kv .kv-impor button{min-height:34px;padding:6px 11px;border:1px solid #ffffff55;border-radius:7px;background:transparent;color:inherit;font-size:13px;font-weight:700}
.kv-impor button:hover,.kv-impor.kv-drop{background:#ffffff18}
.kv-impor button:focus-visible{outline:2px solid #ff8a6b;outline-offset:2px}
.kv-impor small{color:#d5d7e3;font-size:12px;line-height:1.4}
.kv-impor [role=alert]{flex-basis:100%;color:#ffd5c7}
.kv-panggung{position:relative;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:28px;align-items:center;padding:30px 32px 32px;border-radius:26px;
  background:radial-gradient(120% 90% at 100% 0%,#262d63 0%,transparent 55%),#101634;color:#F3F0E9;box-shadow:0 30px 60px -30px rgba(16,22,52,.6);overflow:hidden}
.kv-panggung-kiri{display:flex;flex-direction:column;gap:16px;min-width:0}
.kv-merek{display:flex;align-items:center;gap:9px;font-weight:800;font-size:14px}
.kv-merek .kv-logo{width:28px;height:28px}
.kv-merek-isi{flex:1}
.kv-merek .kv-ruang{color:#C9CCE8;border-color:rgba(255,255,255,.16);height:26px}
.kv-panggung h1{margin:6px 0 0;font:800 clamp(34px,5.2cqi,58px)/1.0 "Bricolage Grotesque","Plus Jakarta Sans",sans-serif;letter-spacing:-.035em}
.kv-panggung p{margin:0;max-width:46ch;color:#AEB3D6;font-size:14.5px;line-height:1.6}
.kv-brief{display:flex;gap:8px;align-items:stretch;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:6px;transition:border-color .2s,background .2s}
.kv-brief:focus-within{border-color:#FF8A6B;background:rgba(255,255,255,.09)}
.kv-brief textarea{flex:1;min-width:0;resize:none;border:0;background:transparent;color:#fff;font:14px/1.45 "Plus Jakarta Sans",system-ui,sans-serif;padding:8px 10px;outline:none}
.kv-brief textarea::placeholder{color:#7F86B5}
.kv-brief-kirim{flex:none;border:0;border-radius:11px;padding:0 18px;font:800 13.5px "Plus Jakarta Sans",system-ui;color:#fff;background:linear-gradient(135deg,#FF4D3D,#FFA23C);cursor:pointer;box-shadow:0 8px 20px -8px rgba(255,90,60,.8)}
.kv-brief-kirim:disabled{opacity:.45;cursor:default;box-shadow:none}
.kv-brief-kirim:focus-visible,.kv-chips button:focus-visible,.kv-karya:focus-visible,.kv-ukuran-btn:focus-visible{outline:2px solid #FF8A6B;outline-offset:2px}
.kv-chips{display:flex;flex-wrap:wrap;gap:6px}
.kv-chips button{border:1px solid rgba(255,255,255,.14);background:transparent;color:#D5D8F0;border-radius:999px;padding:6px 12px;font:600 12px "Plus Jakarta Sans",system-ui;cursor:pointer}
.kv-chips button:hover{background:rgba(255,255,255,.08);color:#fff}
/* demo: agent menggambar poster mini */
.kv-demo{display:flex;flex-direction:column;align-items:center;gap:10px}
.kv-demo-ab{position:relative;width:min(100%,250px);aspect-ratio:794/1123;border-radius:6px;background:#FFF7EF;box-shadow:0 30px 60px -20px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);overflow:visible}
.kv-demo-scan{position:absolute;inset:0;overflow:hidden;border-radius:6px}
.kv-demo-scan::after{content:'';position:absolute;left:0;right:0;height:30%;top:-30%;background:linear-gradient(180deg,transparent,rgba(255,77,61,.12));border-bottom:1.5px solid #FF4D3D;animation:kvdscan 10s cubic-bezier(.45,0,.55,1) infinite}
@keyframes kvdscan{0%{top:-30%}12%{top:100%}100%{top:100%}}
.kv-demo-el{position:absolute;display:block;opacity:0;animation:kvdmuncul 10s cubic-bezier(.22,1,.36,1) infinite both}
.kv-d1{left:0;top:0;right:0;height:44%;border-radius:6px 6px 0 0;background:linear-gradient(150deg,#FF4D3D,#FFA23C);animation-delay:.4s}
.kv-d2{left:9%;top:51%;width:74%;height:7%;border-radius:4px;background:#101634;animation-delay:1.6s}
.kv-d3{left:9%;top:61%;width:52%;height:7%;border-radius:4px;background:#101634;animation-delay:2.4s}
.kv-d4{left:58%;top:9%;width:32%;aspect-ratio:1;border-radius:50%;background:#fff;box-shadow:0 10px 24px -8px rgba(16,22,52,.45);animation-delay:3.6s}
.kv-d4 b{position:absolute;left:24%;right:24%;height:9%;border-radius:4px;background:#FF4D3D;top:38%}.kv-d4 b+b{top:55%;left:32%;right:32%;background:#101634}
.kv-d5{left:9%;top:80%;width:44%;height:8%;border-radius:999px;background:#101634;animation-delay:5s}
@keyframes kvdmuncul{0%{opacity:0;transform:scale(.9)}5%{opacity:1;transform:scale(1)}72%{opacity:1;transform:scale(1)}80%{opacity:0}100%{opacity:0}}
.kv-demo-kursor{position:absolute;left:0;top:0;z-index:2;animation:kvdkursor 10s cubic-bezier(.65,0,.35,1) infinite}
.kv-demo-kursor>i{display:block;line-height:0;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))}
@keyframes kvdkursor{0%{left:40%;top:20%}6%,13%{left:70%;top:32%}18%,24%{left:72%;top:56%}26%,33%{left:50%;top:66%}38%,47%{left:82%;top:34%}52%,60%{left:46%;top:86%}70%,92%{left:62%;top:92%}100%{left:40%;top:20%}}
.kv-demo-bar{position:absolute;left:14px;top:16px;display:flex;align-items:center;gap:6px;height:26px;padding:0 10px 0 4px;border-radius:9px;background:#101634;color:#F3F0E9;font:700 11px "Plus Jakarta Sans",system-ui;white-space:nowrap;box-shadow:0 8px 18px rgba(0,0,0,.35);width:max-content}
.kv-demo-logo{width:18px;height:18px}
.kv-demo-t{display:none}
.kv-t1{display:inline;animation:kvdt1 10s steps(1) infinite}.kv-t2{animation:kvdt2 10s steps(1) infinite}.kv-t3{animation:kvdt3 10s steps(1) infinite}.kv-t4{animation:kvdt4 10s steps(1) infinite}.kv-t5{animation:kvdt5 10s steps(1) infinite}
@keyframes kvdt1{0%{display:inline}15%,100%{display:none}}
@keyframes kvdt2{0%{display:none}15%{display:inline}35%,100%{display:none}}
@keyframes kvdt3{0%{display:none}35%{display:inline}50%,100%{display:none}}
@keyframes kvdt4{0%{display:none}50%{display:inline}66%,100%{display:none}}
@keyframes kvdt5{0%{display:none}66%{display:inline}95%,100%{display:none}}
.kv-demo-ok{color:#5EF2C0}
.kv-demo-cap{font-size:11.5px;color:#7F86B5}
/* bagian bawah: karya & template sebagai artboard di atas kanvas bertitik */
.kv-bag{display:flex;flex-direction:column;gap:12px}
.kv-bag h2{margin:0;font:800 17px "Plus Jakarta Sans",system-ui;letter-spacing:-.01em;color:var(--ui-text-primary)}
.kv-rak{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:22px 18px}
.kv-rak-gulir{display:flex;overflow-x:auto;padding-bottom:6px}.kv-rak-gulir .kv-karya{flex:0 0 190px}
.kv-karya{display:flex;flex-direction:column;align-items:flex-start;gap:3px;border:0;background:none;padding:0;color:inherit;text-align:left;cursor:pointer;min-width:0}
.kv-karya-ab{width:100%;height:150px;display:grid;place-items:center;margin-bottom:7px}
.kv-karya-ab .kv-thumb{box-shadow:0 1px 2px rgba(16,22,52,.12),0 14px 30px -16px rgba(16,22,52,.45);border-radius:3px;transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s}
.kv-karya:hover .kv-thumb{transform:translateY(-3px);box-shadow:0 0 0 2px #FF4D3D,0 20px 36px -16px rgba(16,22,52,.5)}
.kv-karya b{font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv-karya span{font-size:11.5px;color:var(--ui-text-tertiary)}
.kv-ukuran{display:flex;flex-wrap:wrap;gap:18px 28px}
.kv-ukuran-grup{display:flex;flex-direction:column;gap:8px}
.kv-ukuran-grup>span{font-size:12px;font-weight:700;color:var(--ui-text-secondary)}
.kv-ukuran-grup>div{display:flex;gap:8px;flex-wrap:wrap}
.kv-ukuran-btn{display:flex;flex-direction:column;align-items:center;gap:4px;width:92px;padding:10px 6px 9px;border:1px solid var(--ui-stroke-secondary);border-radius:12px;background:var(--ui-bg-primary);color:inherit;cursor:pointer}
.kv-ukuran-btn i{display:block;border:1.5px solid var(--ui-text-secondary);border-radius:2px;background:var(--ui-bg-elevated);margin:4px 0 3px}
.kv-ukuran-btn:hover{border-color:#FF4D3D}.kv-ukuran-btn:hover i{border-color:#FF4D3D;background:#FFE6DF}
.kv-ukuran-btn b{font-size:11.5px}.kv-ukuran-btn span{font-size:10px;color:var(--ui-text-tertiary)}
.kv-judul{height:38px;border-radius:10px;border:1px solid var(--ui-stroke-secondary);background:transparent;color:inherit;padding:0 12px;font:inherit;font-size:14px;outline:none;max-width:520px}
.kv-judul:focus{border-color:var(--kv-acc)}
.kv-start .kv-judul{max-width:320px;background:var(--ui-bg-primary)}
@container (max-width:760px){.kv-panggung{grid-template-columns:1fr;padding:24px 22px}.kv-demo-ab{width:min(60%,210px)}}
@media (prefers-reduced-motion:reduce){.kv-demo *,.kv-demo *::after{animation:none!important}.kv-demo-el{opacity:1}.kv-demo-kursor{left:46%;top:86%}.kv-t1{display:none}.kv-t5{display:inline}}
.kv-modal{position:absolute;inset:0;z-index:50;background:rgba(10,12,28,.45);display:flex;align-items:center;justify-content:center}
.kv-mbox{width:min(440px,90%);background:var(--ui-bg-elevated);border:1px solid var(--ui-stroke-secondary);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
.kv-mbox b{font-size:15px}.kv-mbox p{margin:0;color:var(--ui-text-secondary);line-height:1.5}
.kv-mbox textarea{border:1px solid var(--ui-stroke-secondary);border-radius:9px;background:transparent;color:inherit;padding:8px 10px;font:inherit;outline:none;resize:vertical}
.kv-mbox textarea:focus{border-color:var(--kv-acc)}
.kv-mact{display:flex;justify-content:flex-end;gap:6px}
.kv-present{position:fixed;inset:0;z-index:9999;background:#0b0d18;display:flex;align-items:center;justify-content:center;outline:none;cursor:pointer}
.kv-pinfo{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.45);font:12px system-ui}
/* tema terang (default) — menimpa warna tema Hermes hanya di dalam Kanvas */
.kv.kv-terang{--ui-bg-primary:#ffffff;--ui-bg-elevated:#f5f6fa;--ui-bg-editor:#eef0f5;--ui-text-primary:#141826;--ui-text-secondary:#4b5274;--ui-text-tertiary:#8a90a8;--ui-stroke-secondary:#e3e6ef;--ui-stroke-tertiary:#eceef4;color:#141826}
.kv.kv-terang .kv-view{background-color:#eef0f5;background-image:radial-gradient(#cfd4e2 1px,transparent 1px)}
.kv.kv-terang .kv-float{background:rgba(255,255,255,.86)}
/* kanvas penuh, panel melayang */
.kv-main{position:relative;overflow:hidden}
.kv-float{position:absolute;z-index:12;background:color-mix(in srgb,var(--ui-bg-elevated) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--ui-stroke-secondary);border-radius:14px;box-shadow:0 12px 40px rgba(16,22,52,.16)}
.kv-left.kv-float{left:10px;top:10px;bottom:84px;width:220px;border-right:1px solid var(--ui-stroke-secondary);padding:10px 8px}
.kv-layers{overflow:auto;flex:1;min-height:0}
.kv-tplgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:8px}
.kv-tpl{display:flex;flex-direction:column;gap:4px;align-items:flex-start;text-align:left;padding:10px;border:1px solid var(--ui-stroke-secondary);border-radius:14px;background:var(--ui-bg-elevated);color:inherit;cursor:pointer;transition:transform .15s,border-color .15s}
.kv-tpl:hover{transform:translateY(-2px);border-color:var(--kv-acc)}
.kv-tpl b{font-size:12.5px}.kv-tpl span{font-size:10.5px;color:var(--ui-text-tertiary)}
.kv-tplthumb{width:100%;height:150px;display:grid;place-items:center;overflow:hidden;border-radius:9px;background:var(--ui-bg-editor);margin-bottom:4px}
.kv-kompgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:34%;overflow:auto}
.kv-kompgrid button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border:1px solid var(--ui-stroke-tertiary);border-radius:9px;background:transparent;color:inherit;cursor:pointer;min-width:0}
.kv-kompgrid button:hover{border-color:#7B61FF}
.kv-kompgrid span{font-size:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv-kthumb{position:relative;overflow:hidden;border-radius:4px}
.kv-lic-grup{color:#7B61FF}
.kv-ikonbox{width:min(720px,94%);max-height:80vh}
.kv-ikongrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;overflow:auto;min-height:0;flex:1;padding:2px}
.kv-ikongrid button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px 8px;border:1px solid var(--ui-stroke-tertiary);border-radius:10px;background:transparent;color:inherit;cursor:pointer}
.kv-ikongrid button:hover{border-color:var(--kv-acc);color:var(--kv-acc)}
.kv-ikongrid span{font-size:9.5px;color:var(--ui-text-tertiary);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv-lisensi{font-size:10px!important;color:var(--ui-text-tertiary)!important}
.kv-fhint{font-style:normal;color:var(--ui-text-tertiary);font-weight:400}
.kv-fgagal{display:block;font-style:normal;font-size:10.5px;color:#e5484d;margin-top:3px}
.kv-seg-penuh{display:flex;width:100%;margin:2px 0 6px}.kv-seg-penuh button{flex:1}
.kv-lic-grup{display:grid;place-items:center;font-size:10px;border:1.5px dashed var(--ui-text-tertiary);background:transparent!important}
.kv-float-r{right:10px;top:10px;bottom:84px;width:256px;display:flex;flex-direction:column}
.kv-float-r .kv-right{width:auto;flex:1;border:0;background:transparent;padding:12px 12px 14px}
.kv-x{border:0;background:transparent;color:var(--ui-text-tertiary);padding:2px 5px;border-radius:6px;font-size:11px;letter-spacing:0}
.kv-x:hover{color:var(--kv-acc);background:var(--ui-stroke-tertiary)}
.kv-xr{position:absolute;right:8px;top:8px;z-index:2}
.kv-float-r .kv-right>.kv-sectitle:first-child{padding-right:26px}
.kv-film{position:absolute;left:236px;right:12px;margin:0 auto;width:fit-content;max-width:calc(100% - 248px);bottom:12px;z-index:11;display:flex;align-items:flex-end;gap:8px;overflow-x:auto;padding:8px 10px;border-radius:16px;background:color-mix(in srgb,var(--ui-bg-elevated) 88%,transparent);backdrop-filter:blur(14px);border:1px solid var(--ui-stroke-secondary);box-shadow:0 12px 40px rgba(16,22,52,.16)}
.kv.kv-terang .kv-film{background:rgba(255,255,255,.86)}
.kv-fitem{position:relative;flex:none;cursor:pointer;border-radius:7px;padding:2px;border:2px solid transparent;transition:transform .12s}
.kv-fitem:hover{transform:translateY(-2px)}
.kv-fitem.aktif{border-color:var(--kv-acc)}
.kv-fitem>span{position:absolute;left:5px;bottom:5px;font-size:9px;font-weight:800;color:#fff;background:rgba(16,22,52,.7);border-radius:4px;padding:0 4px}
.kv-fact{position:absolute;right:3px;top:3px;display:none;gap:1px}
.kv-fitem:hover .kv-fact{display:flex}
.kv-fact button{border:0;background:rgba(16,22,52,.75);color:#fff;border-radius:4px;font-size:10px;padding:0 4px;line-height:16px}
.kv-fadd{width:40px;height:46px;border-radius:9px;border:1.5px dashed var(--ui-stroke-secondary);background:transparent;font-size:18px;color:var(--ui-text-tertiary)}
.kv-fadd:hover{border-color:var(--kv-acc);color:var(--kv-acc)}
.kv-menu.atas{top:auto;bottom:calc(100% + 8px);left:auto;right:0;max-height:60vh;overflow:auto}
.kv-corner{position:absolute;left:10px;bottom:12px;z-index:13;display:flex;gap:3px;padding:3px;border-radius:11px;background:color-mix(in srgb,var(--ui-bg-elevated) 88%,transparent);border:1px solid var(--ui-stroke-secondary);box-shadow:0 6px 20px rgba(16,22,52,.12)}
.kv.kv-terang .kv-corner{background:rgba(255,255,255,.9)}
.kv-corner button{width:30px;height:28px;border:0;border-radius:8px;background:transparent;font-size:13px}
.kv-corner button.on{background:var(--kv-grad);color:#fff}
.kv-corner .kv-zoom{width:auto!important;min-width:46px;font-weight:700;font-variant-numeric:tabular-nums;font-size:11.5px}
.kv-sep{width:1px;background:var(--ui-stroke-secondary);margin:4px 2px}
.kv-ic{min-width:30px;padding:0 8px!important}
.kv-ruang{max-width:190px;height:22px;border:1px solid var(--ui-stroke-secondary);border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:11px}
.kv-ruang option{color:#141826}
.kv-ruangbar{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ui-text-tertiary)}.kv-ruangbar .kv-ruang{height:28px;font-size:12px;max-width:260px}
.kv-sbtn{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;padding:0 6px;cursor:pointer;opacity:.85}.kv-sbtn:hover{opacity:1}
.kv-sdot{width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#ff4d3d,#ff9a3c)}.kv-sdot.on{background:#FF4D3D;animation:kvdenyut 1s ease-in-out infinite}@keyframes kvdenyut{50%{opacity:.3}}
/* sorot elemen yang diubah agent (tipis, setelah bingkai kerja lewat) */
.kv-sorot{outline:2px dashed rgba(255,77,61,.55);outline-offset:3px}
/* pindaian artboard */
.kv-scan{position:absolute;pointer-events:none;overflow:hidden;z-index:3}
.kv-scan-band{position:absolute;left:0;right:0;height:38%;top:-38%;background:linear-gradient(180deg,rgba(255,77,61,0) 0%,rgba(255,77,61,.05) 55%,rgba(255,122,61,.16) 100%);border-bottom:var(--t) solid #FF4D3D;box-shadow:0 0 calc(var(--t)*14) rgba(255,77,61,.55);animation:kvscan 2.6s cubic-bezier(.45,0,.55,1) infinite}
.kv-scan-band::after{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,77,61,.28) calc(var(--t)*.9),transparent 0);background-size:calc(var(--d)*4) calc(var(--d)*4);-webkit-mask:linear-gradient(180deg,transparent,#000);mask:linear-gradient(180deg,transparent,#000)}
.kv-scan-kerja .kv-scan-band{animation-duration:1.5s;opacity:.75}
@keyframes kvscan{from{top:-38%}to{top:100%}}
.kv-scan-sudut{position:absolute;border-style:none;border-color:#FF4D3D;opacity:.9}
.kv-sd-nw{left:0;top:0;border-left-style:solid;border-top-style:solid}.kv-sd-ne{right:0;top:0;border-right-style:solid;border-top-style:solid}
.kv-sd-sw{left:0;bottom:0;border-left-style:solid;border-bottom-style:solid}.kv-sd-se{right:0;bottom:0;border-right-style:solid;border-bottom-style:solid}
/* bingkai kerja: semut berbaris + kilau di elemen yang sedang diedit */
.kv-kerja{position:absolute;pointer-events:none;z-index:4;transition:left .5s cubic-bezier(.22,1,.36,1),top .5s cubic-bezier(.22,1,.36,1),width .5s cubic-bezier(.22,1,.36,1),height .5s cubic-bezier(.22,1,.36,1);background:linear-gradient(90deg,#FF4D3D 50%,transparent 0) repeat-x 0 0/var(--d) var(--t),linear-gradient(90deg,#FF4D3D 50%,transparent 0) repeat-x 0 100%/var(--d) var(--t),linear-gradient(0deg,#FF4D3D 50%,transparent 0) repeat-y 0 0/var(--t) var(--d),linear-gradient(0deg,#FF4D3D 50%,transparent 0) repeat-y 100% 0/var(--t) var(--d);animation:kvsemut .5s linear infinite}
@keyframes kvsemut{to{background-position:var(--d) 0,calc(var(--d)*-1) 100%,0 calc(var(--d)*-1),100% var(--d)}}
.kv-kerja-isi{position:absolute;inset:var(--t);overflow:hidden;background:rgba(255,77,61,.06)}
.kv-kerja-isi::after{content:'';position:absolute;top:0;bottom:0;width:45%;left:-45%;background:linear-gradient(100deg,transparent,rgba(255,180,120,.35),transparent);animation:kvkilau 1.2s ease-in-out infinite}
.kv-kerja-mikir .kv-kerja-isi{background:transparent}
.kv-kerja-mikir .kv-kerja-isi::after{animation-duration:1.9s;opacity:.6}
.kv-kerja-selesai{animation:none;background:none;outline:var(--t) solid #06D6A0}
.kv-kerja-selesai .kv-kerja-isi::after{display:none}
@keyframes kvkilau{to{left:110%}}
.kv-kh{position:absolute;width:var(--hs);height:var(--hs);background:#fff;border:var(--t) solid #FF4D3D;border-radius:2px;box-sizing:border-box}
.kv-kh.kv-h-nw{left:calc(var(--hs)/-2);top:calc(var(--hs)/-2)}.kv-kh.kv-h-ne{right:calc(var(--hs)/-2);top:calc(var(--hs)/-2)}
.kv-kh.kv-h-sw{left:calc(var(--hs)/-2);bottom:calc(var(--hs)/-2)}.kv-kh.kv-h-se{right:calc(var(--hs)/-2);bottom:calc(var(--hs)/-2)}
.kv-kerja-selesai .kv-kh{border-color:#06D6A0}
/* kursor + bar agent */
.kv-agen{position:absolute;left:0;top:0;z-index:20;pointer-events:none;transition:transform .55s cubic-bezier(.22,1,.36,1)}
.kv-agen-kursor{position:absolute;left:-3px;top:-3px;line-height:0;filter:drop-shadow(0 2px 4px rgba(16,22,52,.35))}
.kv-agen-bar{position:relative;margin:16px 0 0 14px;display:flex;align-items:center;gap:7px;max-width:250px;padding:5px 10px 5px 5px;border-radius:10px;background:#101634;color:#F3F0E9;font:700 12px "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 10px 26px rgba(16,22,52,.35),0 0 0 1px rgba(255,255,255,.06) inset;overflow:hidden}
.kv-agen-balik .kv-agen-bar{position:absolute;right:4px;top:0;margin:16px 0 0;width:max-content}
.kv-agen-logo{width:20px;height:20px}
.kv-agen-logo .kvl-kaki{transform-origin:30.5px 32px;animation:kvkaki .7s ease-in-out infinite alternate}
.kv-agen-selesai .kv-agen-logo .kvl-kaki{animation:none}
@keyframes kvkaki{from{transform:rotate(-10deg)}to{transform:rotate(8deg)}}
.kv-agen-teks{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:linear-gradient(90deg,#F3F0E9 0%,#F3F0E9 35%,#FFB08A 50%,#F3F0E9 65%,#F3F0E9 100%) 0 0/250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:kvteks 1.6s linear infinite,kvmasuk .3s ease-out}
.kv-agen-selesai .kv-agen-teks{animation:kvmasuk .3s ease-out;color:#F3F0E9;background:none}
@keyframes kvteks{from{background-position:100% 0}to{background-position:-50% 0}}
@keyframes kvmasuk{from{opacity:0;transform:translateY(4px)}}
.kv-agen-n{font-size:10.5px;font-variant-numeric:tabular-nums;color:#FF8A6B;padding-left:2px}
.kv-agen-ok{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:#06D6A0;color:#101634;font-size:10px}
.kv-agen-prog{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.08)}
.kv-agen-prog i{position:absolute;left:0;top:0;bottom:0;width:30%;background:linear-gradient(90deg,#FF4D3D,#FFA23C);transition:width .4s}
.kv-agen-mikir .kv-agen-prog i{animation:kvprog 1.3s ease-in-out infinite}
@keyframes kvprog{0%{left:-30%}100%{left:100%}}
.kv-agen-selesai .kv-agen-bar{background:linear-gradient(135deg,#0b8f73,#118AB2)}
@media (prefers-reduced-motion: reduce){.kv-agen,.kv-agen *,.kv-scan,.kv-scan *,.kv-kerja,.kv-kerja *{animation:none!important;transition:none!important}.kv-scan-band{top:auto;bottom:0}}
/* v0.3.0 UI: Art Direction pills, Brand Kit cards/drawer, Data Viz/Smart Resize menus, Live QA badge, subtle Support footer */
.kv-gaya-bar{display:flex;flex-wrap:wrap;align-items:center;gap:5px;font-size:11px;color:#9BA2CE}
.kv-gaya-bar button{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#C9CCE8;border-radius:999px;padding:3px 9px;font:600 11px "Plus Jakarta Sans",system-ui}
.kv-gaya-bar button:hover{color:#fff;border-color:rgba(255,255,255,.3)}
.kv-gaya-bar button.on{background:#FF5A3C;border-color:#FF5A3C;color:#fff}
.kv-bag-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.kv-mini{border:1px solid var(--ui-stroke-secondary);background:var(--ui-bg-primary);color:inherit;border-radius:8px;padding:4px 10px;font-size:11.5px;font-weight:700}
.kv-mini:hover{border-color:var(--kv-acc);color:var(--kv-acc)}
.kv-brgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:12px}
.kv-bcard{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:14px;border:1px solid var(--ui-stroke-secondary);background:var(--ui-bg-primary);text-align:left}
.kv-bcard.on{border-color:var(--kv-acc);box-shadow:0 0 0 1px var(--kv-acc)}
.kv-bcard-top,.kv-bcard-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}
.kv-bcard-top b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv-bcard-meta span{font-size:11px;color:var(--ui-text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv-badd{border-style:dashed;justify-content:center;align-items:center;text-align:center;color:var(--ui-text-secondary);min-height:92px}
.kv-badd:hover{border-color:var(--kv-acc);color:var(--kv-acc)}
.kv-badd span{font-size:11px;color:var(--ui-text-tertiary)}
.kv-bswatch{display:flex;gap:6px}
.kv-bswatch i,.kv-bswatch button{width:22px;height:22px;border-radius:6px;border:1px solid rgba(16,22,52,.16);padding:0;display:inline-block}
.kv-bswatch button:hover{transform:scale(1.12)}
.kv-tag{font-style:normal;font-size:10px;font-weight:800;padding:1px 6px;border-radius:999px;background:rgba(255,90,60,.14);color:var(--kv-acc);margin-left:6px}
.kv-blink{border:0;background:transparent;color:var(--kv-acc);font-size:11px;font-weight:700;padding:0}
.kv-blink:hover{text-decoration:underline}
.kv-bmenu,.kv-qmenu{width:300px;max-height:66vh;overflow:auto;padding:10px!important;gap:8px!important}
.kv-smenu,.kv-abmenu{max-height:68vh;overflow:auto}
.kv-bitem{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:10px;border:1px solid var(--ui-stroke-secondary)}
.kv-bitem.on{border-color:var(--kv-acc)}
.kv-bhead{display:flex;flex-direction:column;gap:2px}
.kv-bhead span{font-size:10.5px;color:var(--ui-text-tertiary)}
.kv-bact{display:flex;gap:6px}
.kv-bact button{flex:1;border:1px solid var(--ui-stroke-secondary);background:transparent;border-radius:7px;padding:4px 8px;font-size:11px;font-weight:700}
.kv-bact button.utama{background:#101634;border-color:#101634;color:#fff}
.kv-bform{display:flex;flex-direction:column;gap:10px}
.kv-bform input[type=color]{height:32px;padding:2px}
.kv-mhead{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ui-text-tertiary);padding:6px 9px 3px}
.kv-mempty{font-size:11.5px;color:var(--ui-text-tertiary);padding:6px 9px;line-height:1.4}
.kv-qa{height:28px;padding:0 10px;border-radius:8px;border:1px solid transparent;font-weight:800;font-size:11.5px;font-variant-numeric:tabular-nums}
.kv-qa.ok{background:rgba(6,167,125,.14);color:#068a67;border-color:rgba(6,167,125,.3)}
.kv-qa.warn{background:rgba(217,119,6,.14);color:#b45309;border-color:rgba(217,119,6,.3)}
.kv-qa.err{background:rgba(229,72,77,.14);color:#d92d34;border-color:rgba(229,72,77,.35)}
.kv-qstat{font-size:11px;font-weight:700;color:var(--ui-text-tertiary)}
.kv-qmet{display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:5px 7px;border-radius:7px;background:var(--ui-bg-primary);border:1px solid var(--ui-stroke-secondary)}
.kv-qsec{display:flex;flex-direction:column;gap:4px;font-size:11.5px}
.kv-qsec b{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--ui-text-tertiary)}
.kv-qsec.err b,.kv-qsec.err p{color:#d92d34}
.kv-qsec p{margin:0;line-height:1.4}
.kv-homefoot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding-top:14px;border-top:1px solid var(--ui-stroke-secondary);font-size:11.5px;color:var(--ui-text-tertiary)}
.kv-homefoot a{color:var(--kv-acc);text-decoration:none;font-weight:700}
.kv-homefoot a:hover{text-decoration:underline}
/* v0.5.0: Toolbar & Home hierarchy polish + Floating Prompt Bar, Progress Drawer & BYOK Setup */
.kv-top{padding:8px 12px;gap:7px;background:var(--ui-bg-primary)}
.kv-tools{border-radius:11px;padding:3px;gap:2px}
.kv-ghost{transition:border-color .15s,background .15s}
.kv-ghost:hover{background:var(--ui-bg-elevated)}
.kv-hero-copy{display:flex;flex-direction:column;gap:8px}
.kv-bag-sub{font-size:12px;color:var(--ui-text-tertiary);font-weight:500}
.kv-impor{padding:9px 12px;border:1px dashed rgba(255,255,255,.22);border-radius:12px;background:rgba(255,255,255,.04);transition:background .15s,border-color .15s}
.kv-impor.kv-drop{border-color:#FF8A6B;background:rgba(255,138,107,.12)}
.kv-home-ai{display:flex;align-items:center;gap:6px;margin-left:auto}
.kv-home-cfg{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#eef0fb;font:700 11.5px "Plus Jakarta Sans",system-ui;transition:background .15s,border-color .15s}
.kv-home-cfg:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.35)}
.kv-home-cfg .kv-pb-dot{position:static;width:7px;height:7px}
/* Filmstrip moves cleanly to top-center when Floating Prompt Bar is active */
.kv-has-chat .kv-film{top:12px;bottom:auto;left:50%;right:auto;transform:translateX(-50%);margin:0;max-width:calc(100% - 560px);padding:6px 8px;border-radius:14px}
.kv-has-chat .kv-left.kv-float,.kv-has-chat .kv-float-r{bottom:92px}
/* Floating Bottom Prompt Bar (pen.dev style) */
.kv-promptwrap{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:21;width:min(620px,calc(100% - 480px));min-width:340px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
.kv-promptwrap>*{pointer-events:auto}
.kv-pb-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;max-width:100%}
.kv-pb-chip{border:1px solid var(--ui-stroke-secondary);background:color-mix(in srgb,var(--ui-bg-primary) 92%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:var(--ui-text-secondary);border-radius:999px;padding:5px 12px;font:600 11.5px "Plus Jakarta Sans",system-ui;box-shadow:0 6px 18px rgba(16,22,52,.08);transition:transform .15s,border-color .15s,color .15s}
.kv-pb-chip:hover{transform:translateY(-1px);border-color:var(--kv-acc);color:var(--ui-text-primary)}
.kv-promptbar{width:100%;display:flex;flex-direction:column;gap:6px;padding:7px 8px;border-radius:20px;background:color-mix(in srgb,var(--ui-bg-primary) 94%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--ui-stroke-secondary);box-shadow:0 16px 44px rgba(16,22,52,.18),0 2px 8px rgba(16,22,52,.06);transition:border-color .2s,box-shadow .2s;box-sizing:border-box}
.kv.kv-terang .kv-promptbar{background:rgba(255,255,255,.94)}
.kv-promptbar:focus-within{border-color:var(--kv-acc);box-shadow:0 18px 48px rgba(16,22,52,.22),0 0 0 3px rgba(255,90,60,.14)}
.kv-promptbar.drag{border-color:var(--kv-acc);background:color-mix(in srgb,var(--kv-acc) 6%,var(--ui-bg-primary))}
.kv-pb-atts{display:flex;flex-wrap:wrap;gap:6px;padding:2px 4px 0}
.kv-pb-pill{display:inline-flex;align-items:center;gap:5px;max-width:210px;padding:3px 6px 3px 8px;border-radius:999px;background:var(--ui-bg-elevated);border:1px solid var(--ui-stroke-secondary);font-size:11.5px}
.kv-pb-pill i{font-style:normal;font-size:12px}
.kv-pb-pill b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv-pb-pill em{font-style:normal;font-size:10px;color:var(--ui-text-tertiary);flex:none}
.kv-pb-pill button{border:0;background:transparent;color:var(--ui-text-tertiary);width:18px;height:18px;border-radius:50%;display:grid;place-items:center;padding:0;font-size:13px;line-height:1}
.kv-pb-pill button:hover{background:rgba(229,72,77,.14);color:#e5484d}
.kv-pb-row{display:flex;align-items:flex-end;gap:6px}
.kv-pb-add,.kv-pb-cfg,.kv-pb-send{flex:none;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;padding:0;transition:background .15s,border-color .15s,transform .12s}
.kv-pb-add{border:1px solid var(--ui-stroke-secondary);background:var(--ui-bg-elevated);color:var(--ui-text-primary);font-size:18px;font-weight:600;line-height:1}
.kv-pb-add:hover:not(:disabled){border-color:var(--kv-acc);color:var(--kv-acc)}
.kv-pb-add:disabled{opacity:.45;cursor:default}
.kv-pb-input{flex:1;min-width:0;border:0;background:transparent;color:var(--ui-text-primary);font:13.5px/1.4 "Plus Jakarta Sans",system-ui,sans-serif;padding:7px 4px;margin:0;resize:none;outline:none;max-height:108px;min-height:24px;overflow-y:auto;scrollbar-width:none;box-sizing:border-box}
.kv-pb-input::-webkit-scrollbar{display:none}
.kv-pb-input::placeholder{color:var(--ui-text-tertiary)}
.kv-pb-slot{display:inline-flex;align-items:center;flex:none}
.kv-pb-cfg{position:relative;border:1px solid transparent;background:transparent;color:var(--ui-text-secondary);font-size:16px}
.kv-pb-cfg:hover{background:var(--ui-bg-elevated);color:var(--ui-text-primary)}
.kv-pb-dot{position:absolute;right:5px;top:5px;width:7px;height:7px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 1.5px var(--ui-bg-primary)}
.kv-pb-cfg.ready .kv-pb-dot,.kv-home-cfg.ready .kv-pb-dot{background:#10b981}
.kv-pb-send{border:0;background:var(--kv-grad);color:#fff!important;font-size:16px;font-weight:800;box-shadow:0 6px 16px -6px rgba(255,90,60,.7)}
.kv-pb-send:hover:not(:disabled){transform:translateY(-1px)}
.kv-pb-send:disabled{opacity:.38;box-shadow:none;cursor:default}
.kv-pb-send.stop{background:#101634;box-shadow:none;font-size:12px}
/* Floating Agent Progress Drawer */
.kv-drawer{position:absolute;right:14px;bottom:14px;z-index:22;width:308px;max-width:calc(100% - 28px);display:flex;flex-direction:column;border-radius:16px;background:color-mix(in srgb,var(--ui-bg-primary) 94%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--ui-stroke-secondary);box-shadow:0 16px 42px rgba(16,22,52,.2);overflow:hidden}
.kv.kv-terang .kv-drawer{background:rgba(255,255,255,.95)}
.kv-start .kv-drawer{position:fixed;right:20px;bottom:20px}
.kv-r-open .kv-drawer{right:276px}
.kv-drawer-head{display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer;user-select:none;border-bottom:1px solid var(--ui-stroke-tertiary)}
.kv-drawer.min .kv-drawer-head{border-bottom:0}
.kv-drawer-dot{width:8px;height:8px;border-radius:50%;flex:none;background:#10b981}
.kv-drawer-dot.kerja{background:#FF4D3D;animation:kvdenyut 1s ease-in-out infinite}
.kv-drawer-dot.err{background:#e5484d}
.kv-drawer-title{flex:1;min-width:0;font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kv-drawer-act{display:flex;gap:2px}
.kv-drawer-act button{border:0;background:transparent;color:var(--ui-text-tertiary);width:22px;height:22px;border-radius:6px;display:grid;place-items:center;padding:0;font-size:11px}
.kv-drawer-act button:hover{background:var(--ui-bg-elevated);color:var(--ui-text-primary)}
.kv-drawer-body{display:flex;flex-direction:column;gap:7px;padding:10px 11px;max-height:240px;overflow-y:auto;font-size:12px;line-height:1.45}
.kv-dmsg{padding:7px 10px;border-radius:10px}
.kv-dmsg p{margin:0;white-space:pre-wrap}
.kv-dmsg-user{background:var(--ui-bg-elevated);border:1px solid var(--ui-stroke-tertiary);font-weight:600}
.kv-dmsg-atts{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.kv-dmsg-atts em{font-style:normal;font-size:10.5px;padding:2px 6px;border-radius:6px;background:var(--ui-bg-primary);border:1px solid var(--ui-stroke-secondary);color:var(--ui-text-secondary)}
.kv-dmsg-ai{background:color-mix(in srgb,#10b981 8%,var(--ui-bg-primary));border:1px solid color-mix(in srgb,#10b981 24%,transparent)}
.kv-dmsg-err{background:rgba(229,72,77,.1);border:1px solid rgba(229,72,77,.28);color:#d92d34}
.kv-dstep{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ui-text-secondary);padding:2px 4px}
.kv-dstep.done{color:var(--ui-text-tertiary)}
.kv-dstep.error{color:#d92d34}
.kv-dspin{width:12px;height:12px;border-radius:50%;border:2px solid var(--ui-stroke-secondary);border-top-color:var(--kv-acc);animation:kvspin .8s linear infinite;flex:none}
@keyframes kvspin{to{transform:rotate(360deg)}}
.kv-dcheck{width:14px;height:14px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:9.5px;font-weight:800;background:rgba(16,185,129,.16);color:#059669;flex:none}
.kv-dstep.error .kv-dcheck{background:rgba(229,72,77,.16);color:#d92d34}
.kv-dopen{margin-top:6px;border:1px solid var(--ui-stroke-secondary);background:var(--ui-bg-primary);border-radius:7px;padding:4px 9px;font-size:11px;font-weight:700}
.kv-dopen:hover{border-color:var(--kv-acc);color:var(--kv-acc)}
/* Modal BYOK Setup */
.kv-mbox{width:min(480px,calc(100% - 24px));max-height:calc(100% - 24px);overflow-y:auto}
.kv-byok{display:flex;flex-direction:column;gap:10px}
.kv-byok-notice{padding:9px 11px;border-radius:10px;background:rgba(255,90,60,.1);border:1px solid rgba(255,90,60,.28);color:var(--ui-text-primary);font-size:12px;line-height:1.45}
.kv-byok-presets{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.kv-byok-preset{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:9px 10px;border-radius:11px;border:1px solid var(--ui-stroke-secondary);background:var(--ui-bg-primary);text-align:left;transition:border-color .15s,background .15s}
.kv-byok-preset:hover{border-color:var(--kv-acc)}
.kv-byok-preset.on{border-color:var(--kv-acc);background:color-mix(in srgb,var(--kv-acc) 9%,var(--ui-bg-primary));box-shadow:0 0 0 1px var(--kv-acc)}
.kv-byok-preset b{font-size:12.5px}
.kv-byok-preset span{font-size:10.5px;color:var(--ui-text-tertiary);line-height:1.3}
.kv-byok-keyrow{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--ui-text-secondary);padding:0 2px}
.kv-byok-err{padding:8px 10px;border-radius:9px;background:rgba(229,72,77,.12);border:1px solid rgba(229,72,77,.3);color:#d92d34;font-size:12px}
.kv-byok-guide{padding:10px 11px;border-radius:11px;background:var(--ui-bg-primary);border:1px dashed var(--ui-stroke-secondary);display:flex;flex-direction:column;gap:5px}
.kv-byok-guide b{font-size:12px!important}
.kv-byok-guide p{font-size:11.5px;margin:0;color:var(--ui-text-secondary);line-height:1.45}
.kv-byok-mcp{display:flex;align-items:center;gap:8px;margin-top:2px}
.kv-byok-mcp code{flex:1;padding:5px 8px;border-radius:7px;background:var(--ui-bg-elevated);border:1px solid var(--ui-stroke-secondary);font:600 11px ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kv-byok-mcp button{flex:none;border:1px solid var(--ui-stroke-secondary);background:var(--ui-bg-elevated);border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700}
.kv-byok-mcp button:hover{border-color:var(--kv-acc);color:var(--kv-acc)}
/* Responsive layout for narrow tablets & mobile (390x844) */
@container (max-width:1120px){
  .kv-promptwrap{width:min(540px,calc(100% - 260px));min-width:280px}
  .kv-drawer{bottom:96px;right:12px;width:296px}
  .kv-r-open .kv-drawer{right:12px}
}
@container (max-width:720px){
  .kv-start{padding:14px 14px 32px;gap:22px}
  .kv-panggung{padding:20px 16px;border-radius:20px;gap:18px}
  .kv-brief{flex-direction:column}
  .kv-brief textarea{min-height:66px;scrollbar-width:none}
  .kv-brief textarea::-webkit-scrollbar{display:none}
  .kv-brief-kirim{height:38px}
  .kv-has-chat .kv-corner{top:10px;bottom:auto;left:10px;padding:2px}
  .kv-has-chat .kv-corner button{width:27px;height:26px;font-size:12px}
  .kv-has-chat .kv-film{top:48px;left:10px;right:10px;transform:none;max-width:calc(100% - 20px);width:auto}
  .kv-promptwrap{left:10px;right:10px;bottom:10px;transform:none;width:auto;min-width:0}
  .kv-pb-input{font-size:12.5px}
  .kv-pb-chips{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;width:100%;scrollbar-width:none;padding-bottom:2px}
  .kv-pb-chip{flex:none;white-space:nowrap}
  .kv-drawer{left:10px;right:10px;bottom:116px;width:auto;max-width:none}
  .kv-drawer-body{max-height:165px}
  .kv-byok-presets{grid-template-columns:1fr}
  .kv-status{overflow-x:auto;white-space:nowrap;scrollbar-width:none;gap:8px}
  .kv-status>*{flex:none}
}
`

/* =============== 10. DAFTAR KE HERMES =============== */
export default {
  id: 'kanvas-studio',
  name: 'Kanvas Studio',
  register(ctx) {
    resetStore(); S.ctx = ctx; S.tema = ctx.storage.get('tema', 'terang'); S.robot = ctx.storage.get('robot', true); S.sesiAgent = ctx.storage.get('sesiAgent', null)
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st)
    const lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = GOOGLE_FONTS; document.head.append(lk)
    const fontSiap = () => emit()
    document.fonts?.addEventListener?.('loadingdone', fontSiap)
    ctx.onDispose(() => { st.remove(); lk.remove(); document.fonts?.removeEventListener?.('loadingdone', fontSiap); clearTimeout(_simpanT); clearTimeout(_aktifT); if (S.dirty) simpanSekarang() })
    ctx.setInterval(() => { pantau().catch(() => {}) }, 1200)
    siapFolder().catch(e => { S.fase = 'error'; S.pesan = e?.message || String(e); emit() })

    ctx.registerMany([
      // Hermes lama tanpa openWorkspace: pane seperti sebelumnya (menutupnya menonaktifkan plugin, aturan Hermes)
      ...(BISA_TAB ? [] : [{ id: 'pane', area: PANES_AREA, title: 'Kanvas', data: { placement: 'right', width: '780px' }, render: () => h(KanvasApp, { diPane: true }) }]),
      { id: 'page', area: ROUTES_AREA, data: { path: ROUTE }, render: () => h(KanvasApp) },
      ...(STATUSBAR_AREAS ? [{ id: 'status', area: STATUSBAR_AREAS.right, order: 130, render: () => h(TombolStatus) }] : []),
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: ROUTE, label: 'Kanvas Studio', codicon: 'paintcan' } },
      { id: 'open', area: PALETTE_AREA, data: { id: 'kanvas-studio.open', label: 'Kanvas Studio: open canvas', keywords: ['kanvas', 'desain', 'poster', 'deck', 'slide', 'canvas'], run: () => bukaKanvas() } },
      ...(KEYBINDS_AREA ? [{ id: 'key', area: KEYBINDS_AREA, data: { id: 'kanvas-studio.open', label: 'Open Kanvas Studio', category: 'Kanvas Studio', defaults: ['mod+shift+k'], run: () => bukaKanvas() } }] : [])
    ])
  }
}

/* =============== 11. ENGINE (dipakai app lokal & perender untuk agent) =============== */
export const engine = { S, emit, buka, urlGambarAman, sinkronKomponen, bidangDariTitik, terapkanTata, urutPohon, muatFontDoc, fontGagal, namaFont, normalisasi, layoutTeks, tinggi, fontStr, gambarAb, svgAb, buatPdf, buatPdfBytes, keBlob, GOOGLE_FONTS, LOGO_SVG }

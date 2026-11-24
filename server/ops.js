// Operasi edit desain untuk agent. Semua operasi dalam satu panggilan diterapkan atomik:
// kalau satu gagal, tidak ada yang ditulis. Id elemen dibuat otomatis bila tidak diberi.
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sinkronKomponen, catatTimpaan, lepasInstance } from './komponen.js'
import { bidangDariTitik } from './pena.js'

const TIPE = ['teks', 'kotak', 'elips', 'gambar', 'path', 'grup']
// ikon Lucide (app/dist/ikon.json, dibuat saat build)
let _ikon = null
export function dataIkon() {
  if (_ikon) return _ikon
  const p = join(dirname(fileURLToPath(import.meta.url)), '../app/dist/ikon.json')
  _ikon = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { ikon: {}, tag: {} }
  return _ikon
}
export function cariIkon(q, maks = 40) {
  const d = dataIkon(), kata = String(q || '').toLowerCase().trim().split(/[\s,]+/).filter(Boolean)
  const nama = Object.keys(d.ikon)
  if (!kata.length) return nama.slice(0, maks)
  const skor = n => { const t = n + ' ' + (d.tag[n] || ''); const kena = kata.filter(k => t.includes(k)).length; if (!kena) return -1; return kena * 10 + (n === kata.join('-') ? 30 : 0) - n.length / 100 + (kata.includes(n) ? 8 : 0) + (kata.some(k => n.startsWith(k)) ? 3 : 0) + (kata.every(k => n.includes(k)) ? 2 : 0) }
  return nama.map(n => [n, skor(n)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]).slice(0, maks).map(x => x[0])
}
// gula untuk agent: { tipe: "ikon", ikon: "coffee", w: 64, warna, tebal } → elemen path vektor
function ikonKePath(e) {
  const d = dataIkon(), nama = String(e.ikon || e.nama_ikon || '').trim()
  if (!d.ikon[nama]) { const mirip = cariIkon(nama.replace(/-/g, ' '), 6); salah(`icon "${nama}" does not exist.${mirip.length ? ' Similar: ' + mirip.join(', ') : ''} (search with kanvas_icons)`) }
  const { ikon, warna, tebal, ukuran, ...sisa } = e, uk = Number(ukuran ?? e.w ?? e.h ?? 64)
  return { ...sisa, tipe: 'path', ikon: nama, nama: e.nama || 'Icon ' + nama, w: e.w ?? uk, h: e.h ?? uk, vb: [24, 24], d: d.ikon[nama], fill: e.fill ?? null,
    garis: e.garis || { tebal: Math.round((Number(tebal) || 2) * uk / 24 * 10) / 10, warna: warna || '#101634' }, ujung: e.ujung || 'bulat' }
}
const ALIAS = {
  add_artboard: 'artboard', update_artboard: 'ubah_artboard', delete_artboard: 'hapus_artboard',
  add: 'tambah', update: 'ubah', delete: 'hapus', order: 'urut', title: 'judul', tambah_artboard: 'artboard', group: 'grupkan', ungroup: 'lepas_grup', make_component: 'jadikan_komponen', detach: 'lepas_salinan'
}
export const PRESET = {
  'slide': [1920, 1080], 'slide-16x9': [1920, 1080], 'slide-4x3': [1600, 1200],
  'a4': [794, 1123], 'a4-landscape': [1123, 794], 'a3': [1123, 1587], 'a2': [1587, 2245], 'a1': [2245, 3179],
  'ig-feed': [1080, 1350], 'ig-square': [1080, 1080], 'ig-story': [1080, 1920], 'logo': [1200, 1200],
  'og-image': [1200, 630], 'yt-thumbnail': [1280, 720], 'banner-web': [1440, 600]
}

const uid = (p, pakai) => { let id; do id = p + Math.random().toString(36).slice(2, 7); while (pakai.has(id)); pakai.add(id); return id }
const salah = m => { throw new Error(m) }
const angka = (v, nama) => (v == null || Number.isFinite(Number(v))) ? v : salah(`${nama} must be a number`)

function semuaId(doc) {
  const s = new Set()
  for (const ab of doc.artboards) { s.add(ab.id); for (const e of ab.elemen) s.add(e.id) }
  return s
}
function cari(doc, id) {
  for (const ab of doc.artboards) { const i = ab.elemen.findIndex(e => e.id === id); if (i >= 0) return { ab, i, el: ab.elemen[i] } }
  return null
}
// grup lalu seluruh keturunannya, berurutan (sama dengan engine di UI)
function urutPohon(els) {
  const ada = new Map(els.map(e => [e.id, e])), anak = new Map(), akar = []
  for (const e of els) {
    if (e.induk && ada.get(e.induk)?.tipe === 'grup' && e.induk !== e.id) { if (!anak.has(e.induk)) anak.set(e.induk, []); anak.get(e.induk).push(e) }
    else { delete e.induk; akar.push(e) }
  }
  const out = [], lewat = new Set()
  const tulis = e => { if (lewat.has(e.id)) return; lewat.add(e.id); out.push(e); for (const c of anak.get(e.id) || []) tulis(c) }
  akar.forEach(tulis)
  for (const e of els) if (!lewat.has(e.id)) { delete e.induk; out.push(e) }
  return out
}
const keturunan = (ab, id) => { const out = [], jalan = x => { for (const c of ab.elemen) if (c.induk === x) { out.push(c); jalan(c.id) } }; jalan(id); return out }
// elemen bersarang { tipe: "grup", anak: [...] } → daftar datar dengan `induk`
function ratakan(list, induk, pakai, out = [], cariInduk = () => null) {
  for (const e of list) {
    const { anak, ...el } = e
    const id = el.id && !pakai.has(el.id) ? (pakai.add(el.id), el.id) : uid(el.tipe === 'grup' ? 'g' : 'e', pakai)
    const idInduk = induk || el.induk, g = idInduk ? (out.find(x => x.id === idInduk) || cariInduk(idInduk)) : null
    // teks tanpa lebar di dalam auto-layout: kolom → memenuhi lebar grup, baris → selebar isinya; di luar grup → 600
    if (el.tipe === 'teks' && el.w == null && el.lebar == null) { if (g?.tata) el.lebar = g.tata.arah === 'baris' ? 'peluk' : 'isi'; else el.w = 600 }
    out.push(cekElemen({ ...el, id, ...(idInduk ? { induk: idInduk } : {}) }))
    if (Array.isArray(anak)) { if (el.tipe !== 'grup') salah(`${id}: only a grup can have "anak" (children)`); ratakan(anak, id, pakai, out, cariInduk) }
  }
  return out
}
function cekTata(el) {
  const t = el.tata; if (!t) return
  if (typeof t !== 'object') salah(`${el.id}.tata must be an object`)
  if (t.arah && !['baris', 'kolom'].includes(t.arah)) salah(`${el.id}.tata.arah: baris (horizontal) | kolom (vertical)`)
  if (t.rata && !['awal', 'tengah', 'akhir', 'regang'].includes(t.rata)) salah(`${el.id}.tata.rata: awal | tengah | akhir | regang`)
  if (t.sebar && !['awal', 'tengah', 'akhir', 'antara'].includes(t.sebar)) salah(`${el.id}.tata.sebar: awal | tengah | akhir | antara`)
  t.arah ??= 'kolom'
}
// { tipe: "salinan", dari: "<id atau nama komponen>", timpa: { "<id/nama bagian>": { teks: … } } } → grup instance
let MASTER = new Map()
function siapkanSalinan(el) {
  const m = MASTER.get(el.dari) || [...MASTER.values()].find(x => x.nama === el.dari)
  if (!m) salah(`component "${el.dari}" does not exist. Components: ${[...MASTER.values()].map(x => x.nama || x.id).join(', ') || '(none yet, create one with op jadikan_komponen)'}`)
  const timpa = {}
  for (const [k, v] of Object.entries(el.timpa || {})) {
    const bagian = k === '@' ? '@' : (m.bagian.find(b => b.id === k) || m.bagian.find(b => b.nama === k) || m.bagian.find(b => b.teks === k))?.id
    if (!bagian) salah(`part "${k}" is not in component "${m.nama}". Parts: ${m.bagian.map(b => b.nama || b.id).join(', ')}`)
    if (v?.ikon) { const d = dataIkon().ikon[v.ikon]; if (!d) salah(`icon "${v.ikon}" does not exist (search with kanvas_icons)`); v.d = d }   // ganti ikon = ganti bentuknya
    timpa[bagian] = v
  }
  const { dari, timpa: _, ...sisa } = el
  return { ...sisa, tipe: 'grup', salinan: m.id, ...(Object.keys(timpa).length ? { timpa } : {}) }
}
function cekElemen(el) {
  if (el.tipe === 'salinan') { const p = siapkanSalinan(el); for (const k of Object.keys(el)) delete el[k]; Object.assign(el, p); return el }
  if (el.tipe === 'ikon') { const p = ikonKePath(el); for (const k of Object.keys(el)) delete el[k]; Object.assign(el, p) }
  if (!TIPE.includes(el.tipe)) salah(`unknown type "${el.tipe}" (use: ${TIPE.join(', ')}, or ikon / salinan)`)
  for (const k of ['x', 'y', 'w', 'h', 'ukuran', 'tebal', 'radius', 'rotasi', 'opacity', 'lh', 'spasi']) angka(el[k], `${el.id}.${k}`)
  // path dari titik (koordinat artboard): { tipe: "path", titik: [{ x, y, ix?, iy?, ox?, oy? }], tutup } → kotak, vb, d dihitung
  if (el.tipe === 'path' && Array.isArray(el.titik) && !el.d) {
    if (el.titik.length < 2 || el.titik.some(t => !Number.isFinite(Number(t.x)) || !Number.isFinite(Number(t.y)))) salah(`${el.id}: "titik" needs at least 2 points { x, y }`)
    Object.assign(el, bidangDariTitik(el.titik.map(t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Number(v)]))), el.tutup))
  }
  if (el.tipe === 'path' && el.ikon) {
    const d = dataIkon().ikon[el.ikon]
    if (!d) { const mirip = cariIkon(String(el.ikon).replace(/-/g, ' '), 6); salah(`icon "${el.ikon}" does not exist.${mirip.length ? ' Similar: ' + mirip.join(', ') : ''} (search with kanvas_icons)`) }
    el.d = d
  }
  if (el.tipe === 'path' && !String(el.d || '').trim()) salah(`${el.id}: a path needs "d" or "titik"`)
  if (el.tipe === 'grup') cekTata(el)
  for (const k of ['lebar', 'tinggi']) if (el[k] != null && !['tetap', 'peluk', 'isi'].includes(el[k])) salah(`${el.id}.${k}: tetap | peluk | isi`)
  if (el.tipe === 'teks' && el.w == null && el.lebar == null && !el.induk) el.w = 600
  if (el.tipe === 'teks' && el.teks == null) el.teks = ''
  // grup auto-layout tanpa ukuran = memeluk isinya (engine yang menghitung); elemen lain dapat ukuran awal
  const ikutTata = el.tipe === 'grup' && el.tata
  if (ikutTata) { if (el.lebar == null && el.w == null) el.lebar = 'peluk'; if (el.tinggi == null && el.h == null) el.tinggi = 'peluk' }
  else {
    if (el.tipe !== 'teks' && el.h == null && el.tinggi !== 'isi') el.h = el.w ?? 100
    if (el.w == null && el.lebar !== 'isi' && el.lebar !== 'peluk' && !(el.tipe === 'teks' && el.induk)) el.w = el.tipe === 'teks' ? 600 : 100
  }
  el.x ??= 0; el.y ??= 0
  return el
}
function terapkanSet(obj, set) {
  for (const [k, v] of Object.entries(set || {})) {
    if (k === 'id') continue
    if (v === null) delete obj[k]; else obj[k] = v
  }
}

export function normalisasi(doc) {
  doc.versi ??= 1; doc.judul ??= 'Design'; doc.artboards = Array.isArray(doc.artboards) ? doc.artboards : []
  for (const ab of doc.artboards) ab.elemen = urutPohon(Array.isArray(ab.elemen) ? ab.elemen : [])
  sinkronKomponen(doc)
  for (const ab of doc.artboards) ab.elemen = urutPohon(ab.elemen)
  return doc
}

export function desainBaru({ judul = 'Design', ukuran, w, h, nama, bg = '#FFFFFF' }) {
  const [W, H] = w && h ? [Number(w), Number(h)] : PRESET[String(ukuran || 'slide').toLowerCase()] || salah(`unknown size "${ukuran}". Options: ${Object.keys(PRESET).join(', ')}, or give w & h`)
  return { versi: 1, judul, artboards: [{ id: 'a1', nama: nama || 'Artboard 1', x: 0, y: 0, w: W, h: H, bg, elemen: [] }] }
}

export function terapkanOps(asli, ops) {
  if (!Array.isArray(ops) || !ops.length) salah('ops must be an array with at least 1 operation')
  const doc = normalisasi(JSON.parse(JSON.stringify(asli))), pakai = semuaId(doc), hasil = []
  const sebelum = JSON.parse(JSON.stringify(doc))
  const daftarMaster = () => { MASTER = new Map(); for (const ab of doc.artboards) for (const e of ab.elemen) if (e.komponen && e.tipe === 'grup') MASTER.set(e.id, { id: e.id, nama: e.nama, bagian: ab.elemen.filter(x => isiDari(ab, e.id, x) && !String(x.id).includes('.')) }) }   // anak hasil salinan lain (id ber-titik) bukan bagian master
  const isiDari = (ab, mid, x) => { for (let y = x; y?.induk;) { if (y.induk === mid) return true; y = ab.elemen.find(z => z.id === y.induk) } return false }
  daftarMaster()
  ops.forEach((o, n) => {
    const op = ALIAS[o.op] || o.op, tag = `ops[${n}] (${o.op})`
    try {
      if (op === 'judul') { doc.judul = String(o.judul ?? o.title ?? doc.judul); hasil.push(`title → ${doc.judul}`) }
      else if (op === 'artboard') {
        const akhir = doc.artboards.at(-1)
        const [W, H] = o.w && o.h ? [o.w, o.h] : PRESET[String(o.ukuran || '').toLowerCase()] || (akhir ? [akhir.w, akhir.h] : [1920, 1080])
        const id = o.id && !pakai.has(o.id) ? (pakai.add(o.id), o.id) : uid('a', pakai)
        const ab = { id, nama: o.nama || `Artboard ${doc.artboards.length + 1}`, x: o.x ?? (akhir ? akhir.x + akhir.w + 160 : 0), y: o.y ?? (akhir ? akhir.y : 0), w: W, h: H, bg: o.bg ?? '#FFFFFF', elemen: [] }
        ab.elemen.push(...ratakan(o.elemen || [], null, pakai))
        doc.artboards.push(ab); hasil.push(`artboard ${id} "${ab.nama}" ${W}×${H}` + (ab.elemen.length ? ` + ${ab.elemen.length} element(s) (${ab.elemen.map(e => e.id).join(', ')})` : ''))
      } else if (op === 'ubah_artboard') {
        const ab = doc.artboards.find(a => a.id === o.id) || salah(`artboard ${o.id} does not exist`)
        const { elemen, ...set } = o.set || {}; terapkanSet(ab, set); hasil.push(`artboard ${ab.id} updated`)
      } else if (op === 'hapus_artboard') {
        const i = doc.artboards.findIndex(a => a.id === o.id); if (i < 0) salah(`artboard ${o.id} does not exist`)
        doc.artboards.splice(i, 1); hasil.push(`artboard ${o.id} deleted`)
      } else if (op === 'tambah') {
        const ab = (o.artboard ? doc.artboards.find(a => a.id === o.artboard) : doc.artboards.at(-1)) || salah(`artboard ${o.artboard} does not exist`)
        const list = Array.isArray(o.elemen) ? o.elemen : [o.elemen || salah('"elemen" is required')]
        const induk = o.ke_grup || o.induk || null
        if (induk && ab.elemen.find(e => e.id === induk)?.tipe !== 'grup') salah(`group ${induk} does not exist on artboard ${ab.id}`)
        const baru = ratakan(list.map(e => (induk && !e.induk ? { ...e, induk } : e)), null, pakai, [], id => ab.elemen.find(x => x.id === id))
        for (const e of baru) if (e.induk && !baru.some(b => b.id === e.induk) && ab.elemen.find(x => x.id === e.induk)?.tipe !== 'grup') salah(`${e.id}: parent ${e.induk} is not a group`)
        const pos = o.sebelum ? ab.elemen.findIndex(e => e.id === o.sebelum) : -1
        if (pos >= 0) ab.elemen.splice(pos, 0, ...baru); else ab.elemen.push(...baru)
        ab.elemen = urutPohon(ab.elemen); sinkronKomponen(doc); daftarMaster()
        hasil.push(`+${baru.length} on ${ab.id}: ${baru.map(e => `${e.id} (${e.tipe}${e.induk ? ' ⊂ ' + e.induk : ''})`).join(', ')}`)
      } else if (op === 'ubah') {
        const ids = Array.isArray(o.ids) ? o.ids : [o.id]
        for (const id of ids) { const f = cari(doc, id) || salah(`element ${id} does not exist`); terapkanSet(f.el, o.set); cekElemen(f.el) }
        hasil.push(`updated: ${ids.join(', ')}`)
      } else if (op === 'hapus') {
        const ids = Array.isArray(o.ids) ? o.ids : [o.id]
        for (const id of ids) {
          const f = cari(doc, id); if (!f) { if (hasil.some(h => h.includes(id))) continue; salah(`element ${id} does not exist`) }
          const buang = new Set([id, ...keturunan(f.ab, id).map(e => e.id)])
          f.ab.elemen = f.ab.elemen.filter(e => !buang.has(e.id)); hasil.push(`deleted: ${[...buang].join(', ')}`)
        }
      } else if (op === 'urut') {
        const f = cari(doc, o.id) || salah(`element ${o.id} does not exist`), L = f.ab.elemen
        L.splice(f.i, 1)
        const j = o.ke === 'depan' ? L.length : o.ke === 'belakang' ? 0 : o.ke === 'naik' ? Math.min(L.length, f.i + 1) : o.ke === 'turun' ? Math.max(0, f.i - 1) : Number.isInteger(o.ke) ? Math.max(0, Math.min(L.length, o.ke)) : salah('ke: depan (front) | belakang (back) | naik (forward) | turun (backward) | index')
        L.splice(j, 0, f.el); hasil.push(`${o.id} → ${o.ke}`)
      } else if (op === 'grupkan') {
        const ids = o.ids || salah('"ids" is required (elements to group)')
        const fs = ids.map(id => cari(doc, id) || salah(`element ${id} does not exist`)), ab = fs[0].ab
        if (fs.some(f => f.ab !== ab)) salah('all elements must be on the same artboard')
        const kotak = fs.map(({ el }) => [el.x || 0, el.y || 0, (el.x || 0) + (el.w || 100), (el.y || 0) + (el.h || (el.ukuran || 32) * (el.lh || 1.2))])
        const x0 = Math.min(...kotak.map(k => k[0])), y0 = Math.min(...kotak.map(k => k[1]))
        const g = cekElemen({ tipe: 'grup', nama: 'Group', x: x0, y: y0, w: Math.max(...kotak.map(k => k[2])) - x0, h: Math.max(...kotak.map(k => k[3])) - y0, fill: null, ...(o.set || {}),
          id: o.id && !pakai.has(o.id) ? (pakai.add(o.id), o.id) : uid('g', pakai) })
        if (fs[0].el.induk) g.induk = fs[0].el.induk
        ab.elemen.splice(Math.min(...fs.map(f => ab.elemen.indexOf(f.el))), 0, g)
        for (const { el } of fs) el.induk = g.id
        ab.elemen = urutPohon(ab.elemen); hasil.push(`group ${g.id}: ${ids.join(', ')}`)
      } else if (op === 'jadikan_komponen') {
        const f = cari(doc, o.id) || salah(`element ${o.id} does not exist`)
        if (f.el.tipe !== 'grup') salah(`${o.id} is not a group (group it first, or create a grup with "anak")`)
        if (f.el.salinan) salah(`${o.id} is a component copy; detach it first with lepas_salinan`)
        f.el.komponen = true; if (o.nama) f.el.nama = o.nama
        daftarMaster(); hasil.push(`component "${f.el.nama || f.el.id}" (${f.el.id}). Use it: { "tipe": "salinan", "dari": "${f.el.nama || f.el.id}", "x": …, "y": …, "timpa": { "<part name>": { "teks": "…" } } }`)
      } else if (op === 'lepas_salinan') {
        const f = cari(doc, o.id) || salah(`element ${o.id} does not exist`); if (!f.el.salinan) salah(`${o.id} is not a component copy`)
        sinkronKomponen(doc); let n = 0; lepasInstance(doc, o.id, () => uid('e', pakai)); void n
        hasil.push(`copy ${o.id} detached into a normal group`)
      } else if (op === 'lepas_grup') {
        const f = cari(doc, o.id) || salah(`group ${o.id} does not exist`); if (f.el.tipe !== 'grup') salah(`${o.id} is not a group`)
        for (const c of f.ab.elemen) if (c.induk === o.id) { if (f.el.induk) c.induk = f.el.induk; else delete c.induk }
        f.ab.elemen.splice(f.ab.elemen.indexOf(f.el), 1); hasil.push(`group ${o.id} ungrouped`)
      } else salah(`unknown op "${o.op}"`)
    } catch (e) { throw new Error(`${tag}: ${e.message}`) }
  })
  catatTimpaan(doc, sebelum)
  sinkronKomponen(doc)
  for (const ab of doc.artboards) ab.elemen = urutPohon(ab.elemen)
  return { doc, hasil }
}

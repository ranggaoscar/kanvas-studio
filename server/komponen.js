// Komponen & instance (sumber tunggal: file ini; scripts/build.js menyalinnya ke desktop/plugin.js).
// Tanpa import & tanpa DOM, supaya bisa dipakai server (operasi agent) dan kanvas (browser).
//
// Master  = elemen grup dengan `komponen: true` (+ `nama`). Isinya elemen biasa (induk = master).
// Instance = elemen grup dengan `salinan: "<id master>"`. Anak-anaknya DIBUAT dari master setiap sinkron:
//   id anak = "<id instance>.<id elemen master>", sehingga stabil.
//   `timpa`: { "<id elemen master>": { teks, warna, fill, … } } = bagian yang diubah khusus di instance ini.
//   `timpa["@"]` = timpaan untuk grup instance itu sendiri (mis. fill, w, lebar).
// Master berubah → semua instance ikut, kecuali bagian yang ditimpa.

export const KUNCI_TIMPA = ['teks', 'warna', 'fill', 'garis', 'ikon', 'd', 'src', 'sembunyi', 'font', 'ukuran', 'tebal', 'opacity', 'radius', 'w', 'h', 'lebar', 'tinggi', 'rata', 'kapital', 'miring']
const KUNCI_AKAR = ['tata', 'fill', 'radius', 'garis', 'bayangan', 'opacity', 'lebar', 'tinggi', 'w', 'h', 'nama']
const salinObj = o => JSON.parse(JSON.stringify(o))
const PEMISAH = '.'

// id elemen master yang menjadi sumber anak instance: "<instance>.<master-el>" → "<master-el>"
export function kunciAnak(instId, anakId) { return String(anakId).startsWith(instId + PEMISAH) ? String(anakId).slice(instId.length + 1) : null }

// keturunan "asli" sebuah grup: anak hasil instance lain di dalamnya dilewati (dibuat ulang oleh instance itu)
function keturunanAsli(els, id) {
  const out = [], jalan = x => { for (const c of els) if (c.induk === x) { out.push(c); if (!c.salinan) jalan(c.id) } }
  jalan(id); return out
}

export function sinkronKomponen(doc) {
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
export function catatTimpaan(doc, sebelum) {
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
export function lepasInstance(doc, instId, buatId) {
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

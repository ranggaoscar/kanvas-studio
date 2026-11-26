// Linear structural checks plus server-estimated text/auto-layout. No browser or network.
import { resolveLayout, layoutTeksServer } from './layout.js'

const TIPE = new Set(['teks', 'kotak', 'elips', 'gambar', 'path', 'grup'])

function grupSah(byId) {
  const done = new Set()
  for (const e of byId.values()) {
    const seen = new Set()
    for (let cur = e; cur && !done.has(cur.id); cur = byId.get(cur.induk)) {
      if (seen.has(cur.id) || (cur.induk && byId.get(cur.induk)?.tipe !== 'grup')) return false
      seen.add(cur.id)
    }
    for (const id of seen) done.add(id)
  }
  return true
}

export function fastQa(doc) {
  const masalah = [], saran = [], metrik = [], ids = new Set()
  if (!doc.artboards.length) masalah.push('No artboards.')
  for (const ab of doc.artboards) {
    const awalM = masalah.length, awalS = saran.length, nama = ab.nama || ab.id, label = `[${nama}]`
    const els = ab.elemen || [], byId = new Map(), W = Number(ab.w), H = Number(ab.h)
    const sizeOk = Number.isFinite(W) && W > 0 && Number.isFinite(H) && H > 0
    if (!sizeOk) masalah.push(`${label}: invalid artboard dimensions.`)
    for (const e of els) {
      const tag = `${label} ${e.id || '(no id)'}`
      if (!e.id) masalah.push(`${tag}: has no id.`)
      else if (ids.has(e.id)) masalah.push(`${tag}: duplicate id.`)
      if (e.id) { ids.add(e.id); byId.set(e.id, e) }
      if (!TIPE.has(e.tipe)) masalah.push(`${tag}: unknown type.`)
      if (e.tipe === 'path' && !String(e.d || '').trim()) masalah.push(`${tag}: path without "d".`)
      if (!e.sembunyi && e.tipe === 'gambar' && !e.src) masalah.push(`${tag}: empty src.`)
    }
    const layoutOk = byId.size === els.length && grupSah(byId)
    if (byId.size === els.length && !layoutOk) masalah.push(`${label}: invalid or cyclic group parent.`)
    if (layoutOk) resolveLayout({ artboards: [ab] })
    for (const e of els) {
      if (e.tipe !== 'teks' || e.sembunyi) continue
      const tag = `${label} ${e.id || '(no id)'}`, L = layoutTeksServer(e), lh = Number(e.lh ?? 1.2)
      if (L.lines.length >= 2 && lh < 0.85) masalah.push(`${tag}: line-height ${lh} causes vertical line collisions.`)
      else if (L.lines.length >= 2 && (lh < 0.92 || lh > 2.1)) saran.push(`${tag}: unusual line-height ${lh}.`)
      const Wtext = Number(e.w) || 400, x = (Number(e.x) || 0) + (e.rata === 'tengah' ? (Wtext - L.lw) / 2 : e.rata === 'kanan' ? Wtext - L.lw : 0), y = Number(e.y) || 0
      if (sizeOk && !e.rotasi && (x < -2 || y < -2 || x + L.lw > W + 2 || y + L.h > H + 2)) masalah.push(`${tag}: estimated text outside the artboard.`)
    }
    const issues = masalah.length - awalM, suggestions = saran.length - awalS
    metrik.push({ id: ab.id, nama, elemen: els.length, skor: Math.max(0, 100 - issues * 18 - Math.min(30, suggestions * 4)), issues, suggestions })
  }
  const skor = metrik.length ? Math.round(metrik.reduce((sum, m) => sum + m.skor, 0) / metrik.length) : 0
  return { skor, metrik, masalah, saran }
}

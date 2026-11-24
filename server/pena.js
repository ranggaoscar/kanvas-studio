// Path dari titik (alat Pena). Sumber tunggal: scripts/build.js menyalinnya ke desktop/plugin.js.
// Titik: { x, y, ix?, iy?, ox?, oy? } — (ix,iy) pegangan masuk, (ox,oy) pegangan keluar, koordinat mutlak.
// Segmen dengan pegangan → kurva bezier kubik, tanpa pegangan → garis lurus.

const bulat = n => Math.round(n * 100) / 100

export function dariTitik(titik, tutup) {
  if (!titik?.length) return ''
  const seg = (a, b) => (a.ox != null || b.ix != null)
    ? `C${bulat(a.ox ?? a.x)} ${bulat(a.oy ?? a.y)} ${bulat(b.ix ?? b.x)} ${bulat(b.iy ?? b.y)} ${bulat(b.x)} ${bulat(b.y)}`
    : `L${bulat(b.x)} ${bulat(b.y)}`
  let d = `M${bulat(titik[0].x)} ${bulat(titik[0].y)}`
  for (let i = 1; i < titik.length; i++) d += seg(titik[i - 1], titik[i])
  if (tutup && titik.length > 2) d += seg(titik.at(-1), titik[0]) + 'Z'
  return d
}

export function kotakTitik(titik) {
  const xs = [], ys = []
  for (const t of titik) { xs.push(t.x); ys.push(t.y); if (t.ix != null) { xs.push(t.ix); ys.push(t.iy) } if (t.ox != null) { xs.push(t.ox); ys.push(t.oy) } }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

// titik (koordinat artboard) → bidang elemen path: x/y/w/h, vb, titik relatif terhadap kotak, d
export function bidangDariTitik(titikAb, tutup) {
  const k = kotakTitik(titikAb), w = Math.max(1, k.x1 - k.x0), h = Math.max(1, k.y1 - k.y0)
  const geser = t => { const r = { x: bulat(t.x - k.x0), y: bulat(t.y - k.y0) }; if (t.ix != null) { r.ix = bulat(t.ix - k.x0); r.iy = bulat(t.iy - k.y0) } if (t.ox != null) { r.ox = bulat(t.ox - k.x0); r.oy = bulat(t.oy - k.y0) } return r }
  const titik = titikAb.map(geser)
  return { x: bulat(k.x0), y: bulat(k.y0), w: bulat(w), h: bulat(h), vb: [bulat(w), bulat(h)], titik, tutup: !!tutup, d: dariTitik(titik, tutup) }
}

// titik elemen (relatif, satuan vb) → koordinat artboard (memperhitungkan ukuran elemen yang sudah diubah)
export function titikKeAb(el) {
  const vb = Array.isArray(el.vb) ? el.vb : [el.w || 1, el.h || 1], sx = (el.w || vb[0]) / vb[0], sy = (el.h || vb[1]) / vb[1]
  const ubah = (x, y) => [(el.x || 0) + x * sx, (el.y || 0) + y * sy]
  return (el.titik || []).map(t => {
    const [x, y] = ubah(t.x, t.y), r = { x, y }
    if (t.ix != null) [r.ix, r.iy] = ubah(t.ix, t.iy)
    if (t.ox != null) [r.ox, r.oy] = ubah(t.ox, t.oy)
    return r
  })
}

// Pemeriksa desain (versi JS dari kanvas_cek.py). Ukuran teks diambil dari mesin yang sama dengan kanvas,
// jadi hasilnya persis seperti yang dilihat user. Mengembalikan { masalah: [], saran: [] }.
const TIPE = ['teks', 'kotak', 'elips', 'gambar', 'path', 'grup']

function hexRgb(c) {
  let s = String(c || '').trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map(x => x + x).join('')
  if (!/^[0-9a-f]{6}/i.test(s)) return null
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16))
}
function warnaRata(fill) {
  if (fill && typeof fill === 'object' && Array.isArray(fill.warna)) {
    const cs = fill.warna.map(hexRgb).filter(Boolean)
    return cs.length ? [0, 1, 2].map(i => cs.reduce((a, c) => a + c[i], 0) / cs.length) : null
  }
  return hexRgb(fill)
}
const lum = rgb => { const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]) }
const kontras = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) }
const potong = (a, b) => !(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1])
const hex = rgb => '#' + rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()

export function periksa(doc, { layoutTeks, fontStr, adaGambar = () => true, fontGagal = () => false }) {
  const fontHilang = new Set()
  const masalah = [], saran = [], ids = new Set()
  const mc = document.createElement('canvas').getContext('2d')
  const ukurTeks = el => {
    const L = layoutTeks(el); mc.font = fontStr(el)
    const lw = Math.max(0, ...L.lines.map(s => mc.measureText(s).width + (el.spasi || 0) * Math.max(0, s.length - 1)))
    return { ...L, lw }
  }
  const kotak = el => {
    const x = el.x || 0, y = el.y || 0
    if (el.tipe === 'teks') {
      const L = ukurTeks(el), W = el.w || 400
      const x0 = el.rata === 'tengah' ? x + (W - L.lw) / 2 : el.rata === 'kanan' ? x + W - L.lw : x
      return [x0, y, x0 + L.lw, y + L.h]
    }
    return [x, y, x + (el.w || 100), y + (el.h || 100)]
  }
  const abs = doc.artboards || []
  if (!abs.length) masalah.push('No artboards.')
  for (const ab of abs) {
    const nm = `[${ab.nama || ab.id}]`, W = ab.w || 0, H = ab.h || 0, els = ab.elemen || [], kecil = []
    const minimal = Math.max(12, Math.round(Math.min(W, H) / 60))
    els.forEach((el, i) => {
      const lab = `${nm} ${el.id || '#' + i} (${el.tipe})`
      if (!el.id) masalah.push(`${lab}: has no id.`)
      else if (ids.has(el.id)) masalah.push(`${lab}: duplicate id.`)
      ids.add(el.id)
      if (!TIPE.includes(el.tipe)) masalah.push(`${lab}: unknown type.`)
      if (el.tipe === 'path' && !String(el.d || '').trim()) masalah.push(`${lab}: path without "d".`)
      if (el.sembunyi) return
      const [x0, y0, x1, y1] = kotak(el)
      const dekor = el.tipe !== 'teks' && ((el.opacity ?? 1) < 0.6 || (x1 - x0) * (y1 - y0) > W * H * 0.6)
      if (!dekor && (x0 < -2 || y0 < -2 || x1 > W + 2 || y1 > H + 2))
        (el.tipe === 'teks' ? masalah : saran).push(`${lab}: outside the artboard (x ${x0 | 0}..${x1 | 0}, y ${y0 | 0}..${y1 | 0} of ${W}×${H}).`)
      if (el.tipe === 'gambar') {
        if (!el.src) masalah.push(`${lab}: empty src.`)
        else if (!adaGambar(el.src)) masalah.push(`${lab}: image file not found: ${el.src}`)
      }
      if (el.tipe !== 'teks') return
      if (fontGagal(el)) fontHilang.add(String(el.font))
      const uk = el.ukuran || 32, n = layoutTeks(el).lines.length
      if (uk < minimal) kecil.push([uk, el.id])
      if (uk >= 60 && n > 3) saran.push(`${lab}: headline wraps to ${n} lines; widen w or reduce the size.`)
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
      let latar = warnaRata(ab.bg || '#FFFFFF')
      for (const b of els.slice(0, i)) {
        if (b.sembunyi) continue
        const bx = kotak(b), kena = bx[0] <= cx && cx <= bx[2] && bx[1] <= cy && cy <= bx[3]
        if (!kena) continue
        if ((b.tipe === 'kotak' || b.tipe === 'elips' || b.tipe === 'grup') && b.fill && (b.opacity ?? 1) >= 0.6) latar = warnaRata(b.fill) || latar
        if (b.tipe === 'gambar') latar = null
      }
      const tw = hexRgb(el.warna || '#101634')
      if (latar && tw) {
        // WCAG: teks besar (≥24px, atau ≥18.66px tebal) cukup 3:1
        const besar = uk >= 24 || (uk >= 18.66 && (el.tebal || 400) >= 700)
        const k = kontras(tw, latar), [keras, lunak] = uk >= 60 ? [2.2, 3] : uk >= 36 ? [2.6, 3] : besar ? [3, 4.5] : [3.5, 4.5]
        const pesan = `${lab}: contrast ${k.toFixed(1)}:1 (aim for ≥${lunak}:1): text ${el.warna} on background ~${hex(latar)}.`
        if (k < keras) masalah.push(pesan); else if (k < lunak) saran.push(pesan)
      }
      // tertutup: elemen buram yang digambar SETELAH teks ini (di atasnya), bukan grup induknya, menimpa teks
      const leluhur = new Set(); for (let x = el; x?.induk;) { leluhur.add(x.induk); x = els.find(e => e.id === x.induk) }
      for (const b of els.slice(i + 1)) {
        if (b.sembunyi || leluhur.has(b.id) || (b.opacity ?? 1) < 0.6) continue
        const buram = (['kotak', 'elips', 'grup'].includes(b.tipe) && b.fill) || b.tipe === 'gambar'
        if (!buram) continue
        const bx = kotak(b), tx = kotak(el)
        const iw = Math.min(bx[2], tx[2]) - Math.max(bx[0], tx[0]), ih = Math.min(bx[3], tx[3]) - Math.max(bx[1], tx[1])
        if (iw > 4 && ih > 4 && iw * ih > (tx[2] - tx[0]) * (tx[3] - tx[1]) * 0.05) { masalah.push(`${lab}: covered by ${b.tipe} ${b.id} drawn on top of it (text ends at y ${tx[3] | 0}, ${b.id} starts at y ${bx[1] | 0}).`); break }
      }
      for (const b of els.slice(0, i)) {
        if (b.tipe === 'teks' && !b.sembunyi && potong(kotak(el), kotak(b))) masalah.push(`${lab}: overlaps text ${b.id} ("${String(b.teks || '').slice(0, 24)}").`)
        if ((b.tipe === 'kotak' || (b.tipe === 'grup' && b.fill)) && !b.sembunyi && (b.w || 0) * (b.h || 0) < W * H * 0.6) {
          const bx = kotak(b)
          if (bx[0] <= x0 && x0 <= bx[2] && bx[1] <= y0 && y0 <= bx[3] && (x1 > bx[2] + 2 || y1 > bx[3] + 2))
            masalah.push(`${lab}: overflows card ${b.id} (text ends at y ${y1 | 0}, card ends at ${bx[3] | 0}).`)
        }
      }
    })
    if (kecil.length) {
      kecil.sort((a, b) => a[0] - b[0])
      saran.push(`${nm} ${kecil.length} text element(s) below ~${minimal}px (smallest ${kecil[0][0]}px: ${kecil.slice(0, 6).map(x => x[1]).join(', ')}); hard to read.`)
    }
  }
  for (const f of fontHilang) saran.push(`Font "${f}" was not found on Google Fonts, a fallback font is used. Check the spelling (e.g. "DM Sans", "Playfair Display").`)
  return { masalah, saran }
}

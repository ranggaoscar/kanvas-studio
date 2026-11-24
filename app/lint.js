// Visual Quality Assurance engine for Kanvas Studio.
// Measures text with the exact same Canvas 2D engine as the live canvas and checks:
// structure, overlap, overflow, coverage, multi-point & gradient WCAG contrast,
// safe margins, typographic hierarchy, font discipline, line-height, whitespace,
// near-miss alignment, vertical balance, and Brand Kit consistency.
// Returns { masalah: [], saran: [], skor: 0..100, metrik: [...] }.
const TIPE = ['teks', 'kotak', 'elips', 'gambar', 'path', 'grup']

function hexRgb(c) {
  let s = String(c || '').trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map(x => x + x).join('')
  if (!/^[0-9a-f]{6}/i.test(s)) return null
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16))
}

function warnaKandidat(fill) {
  if (fill && typeof fill === 'object' && Array.isArray(fill.warna)) {
    const cs = fill.warna.map(hexRgb).filter(Boolean)
    if (!cs.length) return null
    const avg = [0, 1, 2].map(i => cs.reduce((a, c) => a + c[i], 0) / cs.length)
    return [...cs, avg]
  }
  const c = hexRgb(fill)
  return c ? [c] : null
}

const lum = rgb => { const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]) }
const kontras = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) }
const potong = (a, b) => !(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1])
const hex = rgb => '#' + rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()

export function periksa(doc, { layoutTeks, fontStr, adaGambar = () => true, fontGagal = () => false, brand = null }) {
  const fontHilang = new Set()
  const masalah = [], saran = [], ids = new Set(), metrik = []
  const mc = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  const ukurTeks = el => {
    const L = layoutTeks(el)
    if (!mc) return { ...L, lw: el.w || 400 }
    mc.font = fontStr(el)
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
  const latarDi = (ab, els, uptoIdx, px, py) => {
    let latar = warnaKandidat(ab.bg || '#FFFFFF')
    for (const b of els.slice(0, uptoIdx)) {
      if (b.sembunyi) continue
      const bx = kotak(b), kena = bx[0] <= px && px <= bx[2] && bx[1] <= py && py <= bx[3]
      if (!kena) continue
      if ((b.tipe === 'kotak' || b.tipe === 'elips' || b.tipe === 'grup') && b.fill && (b.opacity ?? 1) >= 0.6) latar = warnaKandidat(b.fill) || latar
      if (b.tipe === 'gambar') latar = null
    }
    return latar
  }

  const abs = doc.artboards || []
  if (!abs.length) masalah.push('No artboards.')
  for (const ab of abs) {
    const nm = `[${ab.nama || ab.id}]`, W = ab.w || 0, H = ab.h || 0, els = ab.elemen || []
    const mStart = masalah.length, sStart = saran.length
    const kecil = [], ukuranTeks = [], fontSet = new Set(), topNonDecor = []
    const minimal = Math.max(12, Math.round(Math.min(W, H) / 60))
    const safeMargin = Math.max(16, Math.round(Math.min(W, H) * 0.032))
    let minEdgeMargin = Infinity, maxContentY = 0, inkArea = 0, nonDecorCount = 0

    els.forEach((el, i) => {
      const lab = `${nm} ${el.id || '#' + i} (${el.tipe})`
      if (!el.id) masalah.push(`${lab}: has no id.`)
      else if (ids.has(el.id)) masalah.push(`${lab}: duplicate id.`)
      ids.add(el.id)
      if (!TIPE.includes(el.tipe)) masalah.push(`${lab}: unknown type.`)
      if (el.tipe === 'path' && !String(el.d || '').trim()) masalah.push(`${lab}: path without "d".`)
      if (el.sembunyi) return

      const box = kotak(el)
      const [x0, y0, x1, y1] = box
      const elArea = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
      const dekor = el.tipe !== 'teks' && ((el.opacity ?? 1) < 0.6 || elArea > W * H * 0.6)
      const outside = x0 < -2 || y0 < -2 || x1 > W + 2 || y1 > H + 2

      if (!dekor && outside) {
        (el.tipe === 'teks' ? masalah : saran).push(`${lab}: outside the artboard (x ${x0 | 0}..${x1 | 0}, y ${y0 | 0}..${y1 | 0} of ${W}×${H}).`)
      }
      if (!dekor) {
        nonDecorCount++
        maxContentY = Math.max(maxContentY, Math.min(H, y1))
        if (!el.induk) {
          topNonDecor.push({ id: el.id, tipe: el.tipe, box })
          const cw = Math.max(0, Math.min(W, x1) - Math.max(0, x0))
          const ch = Math.max(0, Math.min(H, y1) - Math.max(0, y0))
          inkArea += cw * ch
        }
      }
      if (el.tipe === 'gambar') {
        if (!el.src) masalah.push(`${lab}: empty src.`)
        else if (!adaGambar(el.src)) masalah.push(`${lab}: image file not found: ${el.src}`)
      }
      if (el.tipe !== 'teks') return

      if (fontGagal(el)) fontHilang.add(String(el.font))
      if (el.font) fontSet.add(String(el.font).trim())
      const L = ukurTeks(el), uk = el.ukuran || 32, n = L.lines.length
      ukuranTeks.push(uk)
      if (uk < minimal) kecil.push([uk, el.id])

      // Safe edge margin for non-rotated text inside artboard
      if (!outside && !el.rotasi && W >= 300 && H >= 300) {
        const edge = Math.min(x0, y0, W - x1, H - y1)
        minEdgeMargin = Math.min(minEdgeMargin, edge)
        if (edge < safeMargin) {
          saran.push(`${lab}: tight edge margin (${Math.round(edge)}px; aim for ≥${safeMargin}px breathing room from artboard edges).`)
        }
      }

      // Line-height discipline
      const lh = el.lh ?? 1.2
      if (n >= 2 && lh < 0.85) masalah.push(`${lab}: line-height ${lh} causes vertical line collisions on ${n}-line text (use ≥0.92).`)
      else if (n >= 2 && lh < 0.92) saran.push(`${lab}: very tight line-height (${lh}) on ${n}-line text; verify ascenders/descenders don't touch.`)
      else if (lh > 2.1) saran.push(`${lab}: overly loose line-height (${lh}); tighten for cohesive text rhythm.`)

      if (uk >= 60 && n > 3) saran.push(`${lab}: headline wraps to ${n} lines; widen w or reduce the size.`)
      const avgChars = n ? L.lines.reduce((s, ln) => s + ln.length, 0) / n : 0
      if (uk < 36 && avgChars > 105) saran.push(`${lab}: wide reading measure (~${Math.round(avgChars)} chars/line); narrow text width or tighten copy to ~45–80 chars/line.`)
      if (W > H && uk < 36 && n > 9) saran.push(`${lab}: dense text block (${n} lines on a landscape slide); break into scannable points.`)

      // Multi-point + worst-case gradient WCAG contrast check
      const tw = hexRgb(el.warna || '#101634')
      if (tw) {
        const cy = (y0 + y1) / 2
        const inset = Math.min(12, Math.max(2, (x1 - x0) * 0.15))
        const pts = (x1 - x0) > 40 ? [[x0 + inset, cy], [(x0 + x1) / 2, cy], [x1 - inset, cy]] : [[(x0 + x1) / 2, cy]]
        let worstK = Infinity, worstBg = null
        for (const [px, py] of pts) {
          const cands = latarDi(ab, els, i, px, py)
          if (!cands) continue
          for (const bgRgb of cands) {
            const k = kontras(tw, bgRgb)
            if (k < worstK) { worstK = k; worstBg = bgRgb }
          }
        }
        if (worstBg && Number.isFinite(worstK)) {
          const besar = uk >= 24 || (uk >= 18.66 && (el.tebal || 400) >= 700)
          const [keras, lunak] = uk >= 60 ? [2.2, 3] : uk >= 36 ? [2.6, 3] : besar ? [3, 4.5] : [3.5, 4.5]
          const pesan = `${lab}: contrast ${worstK.toFixed(1)}:1 (aim for ≥${lunak}:1): text ${el.warna} on background ~${hex(worstBg)}.`
          if (worstK < keras) masalah.push(pesan); else if (worstK < lunak) saran.push(pesan)
        }
      }

      // Covered by opaque element drawn AFTER this text (not its ancestor group)
      const leluhur = new Set(); for (let x = el; x?.induk;) { leluhur.add(x.induk); x = els.find(e => e.id === x.induk) }
      for (const b of els.slice(i + 1)) {
        if (b.sembunyi || leluhur.has(b.id) || (b.opacity ?? 1) < 0.6) continue
        const buram = (['kotak', 'elips', 'grup'].includes(b.tipe) && b.fill) || b.tipe === 'gambar'
        if (!buram) continue
        const bx = kotak(b)
        const iw = Math.min(bx[2], box[2]) - Math.max(bx[0], box[0]), ih = Math.min(bx[3], box[3]) - Math.max(bx[1], box[1])
        if (iw > 4 && ih > 4 && iw * ih > (box[2] - box[0]) * (box[3] - box[1]) * 0.05) {
          masalah.push(`${lab}: covered by ${b.tipe} ${b.id} drawn on top of it (text ends at y ${box[3] | 0}, ${b.id} starts at y ${bx[1] | 0}).`)
          break
        }
      }

      // Overlaps earlier text, overlaps icon vector, or overflows card behind it
      for (const b of els.slice(0, i)) {
        if (b.sembunyi) continue
        if (b.tipe === 'teks' && potong(box, kotak(b))) {
          masalah.push(`${lab}: overlaps text ${b.id} ("${String(b.teks || '').slice(0, 24)}").`)
        }
        if (b.tipe === 'path' && b.ikon && (b.opacity ?? 1) >= 0.4 && (b.w || 0) * (b.h || 0) < W * H * 0.15) {
          const bx = kotak(b)
          const iw = Math.min(bx[2], box[2]) - Math.max(bx[0], box[0]), ih = Math.min(bx[3], box[3]) - Math.max(bx[1], box[1])
          if (iw > 4 && ih > 4 && iw * ih > Math.min((bx[2] - bx[0]) * (bx[3] - bx[1]), (box[2] - box[0]) * (box[3] - box[1])) * 0.15) {
            masalah.push(`${lab}: overlaps icon ${b.id} ("${b.ikon}").`)
          }
        }
        if ((b.tipe === 'kotak' || (b.tipe === 'grup' && b.fill)) && (b.w || 0) * (b.h || 0) < W * H * 0.6) {
          const bx = kotak(b)
          if (bx[0] <= x0 && x0 <= bx[2] && bx[1] <= y0 && y0 <= bx[3] && (x1 > bx[2] + 2 || y1 > bx[3] + 2)) {
            masalah.push(`${lab}: overflows card ${b.id} (text ends at y ${y1 | 0}, card ends at ${bx[3] | 0}).`)
          }
        }
      }
    })

    if (kecil.length) {
      kecil.sort((a, b) => a[0] - b[0])
      saran.push(`${nm} ${kecil.length} text element(s) below ~${minimal}px (smallest ${kecil[0][0]}px: ${kecil.slice(0, 6).map(x => x[1]).join(', ')}); hard to read.`)
    }

    // Font discipline
    if (fontSet.size > 3) {
      saran.push(`${nm} uses ${fontSet.size} font families (${[...fontSet].join(', ')}); consolidate to 2–3 complementary families for stronger cohesion.`)
    }

    // Typographic hierarchy ratio
    let typeRatio = null
    if (ukuranTeks.length >= 3) {
      const sorted = [...ukuranTeks].sort((a, b) => a - b)
      const minSz = sorted[0], medSz = sorted[Math.floor(sorted.length / 2)], maxSz = sorted[sorted.length - 1]
      typeRatio = Math.round((maxSz / Math.max(1, minSz)) * 10) / 10
      if (maxSz / Math.max(1, medSz) < 1.3 && (maxSz - minSz) < 12) {
        saran.push(`${nm} flat typographic hierarchy (sizes ${minSz}–${maxSz}px); increase display-to-body contrast (aim for ≥2× headline scale).`)
      }
    }

    // Whitespace / density & vertical balance
    const coverage = W * H > 0 ? Math.min(1, inkArea / (W * H)) : 0
    const whitespacePct = Math.round((1 - coverage) * 100)
    if (nonDecorCount >= 4 && whitespacePct < 14) {
      saran.push(`${nm} appears overcrowded (~${whitespacePct}% open space); add breathing room or simplify content.`)
    }
    if (nonDecorCount >= 3 && H >= 500 && maxContentY > 0 && maxContentY < H * 0.34) {
      saran.push(`${nm} all foreground elements sit in the top ${Math.round((maxContentY / H) * 100)}% of the artboard; check vertical balance.`)
    }

    // Near-miss left-edge alignment between top-level blocks (3..12px drift)
    const nearMiss = []
    for (let a = 0; a < topNonDecor.length && nearMiss.length < 3; a++) {
      for (let b = a + 1; b < topNonDecor.length && nearMiss.length < 3; b++) {
        const dx = Math.abs(topNonDecor[a].box[0] - topNonDecor[b].box[0])
        if (dx >= 3 && dx <= 12) {
          nearMiss.push(`${topNonDecor[a].id} (x=${Math.round(topNonDecor[a].box[0])}) vs ${topNonDecor[b].id} (x=${Math.round(topNonDecor[b].box[0])})`)
        }
      }
    }
    if (nearMiss.length) {
      saran.push(`${nm} near-miss left alignment (${nearMiss.join('; ')}); snap to a shared grid line.`)
    }

    // Brand Kit font consistency (when design is linked to a brand)
    if (brand?.fonts) {
      const allowed = new Set([brand.fonts.display, brand.fonts.body, brand.fonts.mono].filter(Boolean).map(f => f.toLowerCase()))
      if (allowed.size && fontSet.size) {
        const offBrand = [...fontSet].filter(f => !allowed.has(f.toLowerCase()))
        if (offBrand.length) {
          saran.push(`${nm} Brand Kit "${brand.name}" defines fonts [${[brand.fonts.display, brand.fonts.body, brand.fonts.mono].filter(Boolean).join(', ')}]; found off-brand font(s): ${offBrand.join(', ')}.`)
        }
      }
    }

    const abIssues = masalah.length - mStart
    const abSuggs = saran.length - sStart
    const abSkor = Math.max(0, Math.min(100, 100 - abIssues * 18 - Math.min(30, abSuggs * 4)))
    metrik.push({
      id: ab.id,
      nama: ab.nama || ab.id,
      skor: abSkor,
      elemen: els.length,
      teks: ukuranTeks.length,
      fontFamilies: [...fontSet],
      typeRatio,
      minMarginPx: Number.isFinite(minEdgeMargin) ? Math.round(minEdgeMargin) : null,
      whitespacePct,
      issues: abIssues,
      suggestions: abSuggs
    })
  }

  for (const f of fontHilang) saran.push(`Font "${f}" was not found on Google Fonts, a fallback font is used. Check the spelling (e.g. "DM Sans", "Playfair Display").`)
  const skor = metrik.length ? Math.round(metrik.reduce((s, m) => s + m.skor, 0) / metrik.length) : 0
  return { masalah, saran, skor, metrik }
}

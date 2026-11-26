// Linear structural checks + deterministic design-taste evaluation (server-estimated text/auto-layout).
// Zero browser or network calls: checks schema, bounds, line-height, wall-of-text,
// visual balance & focal hierarchy, 60-30-10 color discipline, and spacing rhythm.
import { resolveLayout, layoutTeksServer } from './layout.js'

const TIPE = new Set(['teks', 'kotak', 'elips', 'gambar', 'path', 'grup'])

function hexRgb(c) {
  let s = String(c || '').trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map(x => x + x).join('')
  if (!/^[0-9a-f]{6}$/i.test(s)) return null
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16))
}

function rgbHsl(rgb) {
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

const hueDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 360 - d) }

function recordAccentHue(clusters, raw) {
  const rgb = hexRgb(raw)
  if (!rgb) return
  if (Math.max(...rgb) - Math.min(...rgb) < 48) return
  const [h, s, l] = rgbHsl(rgb)
  if (s < 0.32 || l < 0.14 || l > 0.86) return
  const hexStr = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
  if (!clusters.some(c => hueDist(c.h, h) < 32)) clusters.push({ h, hex: hexStr })
}

function hasTextStructure(rawText) {
  if (/\n\s*\n/.test(rawText)) return true
  return rawText.split('\n').filter(ln => /^\s*([•\-—✓✔▪▸*]|\d+[.)]|0\d)\s+/.test(ln)).length >= 2
}

function verticalGaps(topBlocks, H) {
  const blocks = topBlocks.filter(b => (b.box[3] - b.box[1]) > 4).sort((a, b) => a.box[1] - b.box[1])
  const maxGap = Math.min(110, H * 0.14)
  const gaps = []
  for (let i = 0; i < blocks.length - 1; i++) {
    const a = blocks[i].box, b = blocks[i + 1].box
    if (Math.min(a[2], b[2]) - Math.max(a[0], b[0]) <= 20) continue
    const g = Math.round(b[1] - a[3])
    if (g >= 4 && g <= maxGap) gaps.push(g)
  }
  return gaps
}

function spacingIsErratic(gaps) {
  if (gaps.length < 3) return false
  const uniq = []
  for (const g of gaps) if (!uniq.some(u => Math.abs(u - g) <= 4)) uniq.push(g)
  const spread = Math.max(...gaps) - Math.min(...gaps)
  const off8 = gaps.filter(g => Math.min(g % 8, 8 - (g % 8)) >= 2).length
  const off4 = gaps.filter(g => g % 4 !== 0).length
  return uniq.length >= 3 && spread >= 18 && off8 >= 2 && !(off4 === 0 && uniq.length <= 3)
}

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

    const ukuranTeks = [], accentHues = [], topNonDecor = [], tataJarak = new Set()
    let nonDecorCount = 0, bodyTextArea = 0, bodyChars = 0
    let minContentX = Infinity, maxContentX = 0, minContentY = Infinity, maxContentY = 0
    let weightSum = 0, weightedX = 0

    if (typeof ab.bg === 'string') recordAccentHue(accentHues, ab.bg)
    else if (Array.isArray(ab.bg?.warna)) for (const c of ab.bg.warna) recordAccentHue(accentHues, c)

    for (const e of els) {
      if (e.sembunyi) continue
      if ((e.opacity ?? 1) >= 0.35) {
        if (typeof e.fill === 'string') recordAccentHue(accentHues, e.fill)
        else if (Array.isArray(e.fill?.warna)) recordAccentHue(accentHues, e.fill.warna[0])
        if (e.garis?.warna) recordAccentHue(accentHues, e.garis.warna)
        if (e.tipe === 'teks' && e.warna) recordAccentHue(accentHues, e.warna)
      }
      if (e.tipe === 'grup' && e.tata && Number(e.tata.jarak) > 0) tataJarak.add(Math.round(Number(e.tata.jarak)))

      let box
      if (e.tipe === 'teks') {
        const tag = `${label} ${e.id || '(no id)'}`, L = layoutTeksServer(e), lh = Number(e.lh ?? 1.2)
        const uk = Number(e.ukuran) || 32, rawText = String(e.teks || '').trim()
        ukuranTeks.push(uk)
        if (L.lines.length >= 2 && lh < 0.85) masalah.push(`${tag}: line-height ${lh} causes vertical line collisions.`)
        else if (L.lines.length >= 2 && (lh < 0.92 || lh > 2.1)) saran.push(`${tag}: unusual line-height ${lh}.`)
        const Wtext = Number(e.w) || 400
        const x0 = (Number(e.x) || 0) + (e.rata === 'tengah' ? (Wtext - L.lw) / 2 : e.rata === 'kanan' ? Wtext - L.lw : 0)
        const y0 = Number(e.y) || 0
        box = [x0, y0, x0 + L.lw, y0 + L.h]
        if (sizeOk && !e.rotasi && (x0 < -2 || y0 < -2 || x0 + L.lw > W + 2 || y0 + L.h > H + 2)) {
          masalah.push(`${tag}: estimated text outside the artboard.`)
        }
        if (uk < 36) {
          bodyTextArea += Math.max(0, L.lw) * Math.max(0, L.h)
          bodyChars += rawText.length
          if (!hasTextStructure(rawText) && ((rawText.length >= 260 && L.lines.length >= 6) || L.lines.length >= 10)) {
            saran.push(`${tag}: wall-of-text (${L.lines.length} lines, ${rawText.length} chars); split into ≤3-line points or add subheadings.`)
          }
        }
      } else {
        const x0 = Number(e.x) || 0, y0 = Number(e.y) || 0
        box = [x0, y0, x0 + (Number(e.w) || 100), y0 + (Number(e.h) || 100)]
      }

      if (sizeOk) {
        const elArea = Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1])
        const dekor = e.tipe !== 'teks' && ((e.opacity ?? 1) < 0.6 || elArea > W * H * 0.6)
        if (!dekor) {
          nonDecorCount++
          minContentX = Math.min(minContentX, Math.max(0, box[0]))
          maxContentX = Math.max(maxContentX, Math.min(W, box[2]))
          minContentY = Math.min(minContentY, Math.max(0, box[1]))
          maxContentY = Math.max(maxContentY, Math.min(H, box[3]))
          if (!e.induk) {
            topNonDecor.push({ id: e.id, box })
            const cw = Math.max(0, Math.min(W, box[2]) - Math.max(0, box[0]))
            const ch = Math.max(0, Math.min(H, box[3]) - Math.max(0, box[1]))
            const clipped = cw * ch
            if (clipped > 0) {
              const wt = Math.max(400, Math.min(clipped, W * H * 0.25))
              weightSum += wt
              weightedX += ((Math.max(0, box[0]) + Math.min(W, box[2])) / 2) * wt
            }
          }
        }
      }
    }

    // Typographic hierarchy & focal point
    let typeRatio = null
    if (ukuranTeks.length >= 3) {
      const sorted = [...ukuranTeks].sort((a, b) => a - b)
      const minSz = sorted[0], medSz = sorted[Math.floor(sorted.length / 2)], maxSz = sorted[sorted.length - 1]
      typeRatio = Math.round((maxSz / Math.max(1, minSz)) * 10) / 10
      const medRatio = maxSz / Math.max(1, medSz)
      if (medRatio < 1.3 && (maxSz - minSz) < 12) {
        saran.push(`${label} flat typographic hierarchy (sizes ${minSz}–${maxSz}px); increase display-to-body contrast (≥2×).`)
      } else if (medRatio < 1.5 && typeRatio < 1.75) {
        saran.push(`${label} weak focal point (text ${minSz}–${maxSz}px, ${medRatio.toFixed(1)}× median); raise primary headline ≥1.8× body.`)
      }
    }

    // Page-level wall-of-text density & visual balance
    const bodyTextPct = sizeOk ? Math.round((Math.min(W * H, bodyTextArea) / (W * H)) * 100) : 0
    if (sizeOk && bodyTextPct > 42 && bodyChars >= 450) {
      saran.push(`${label} wall-of-text density (~${bodyTextPct}% body-text area, ${bodyChars} chars); trim copy or paginate.`)
    }
    if (sizeOk && nonDecorCount >= 3 && H >= 500) {
      if (maxContentY > 0 && maxContentY < H * 0.34) {
        saran.push(`${label} foreground elements sit in the top ${Math.round((maxContentY / H) * 100)}%; check vertical balance.`)
      } else if (Number.isFinite(minContentY) && minContentY > H * 0.66) {
        saran.push(`${label} foreground elements sit in the bottom ${Math.round(((H - minContentY) / H) * 100)}%; rebalance vertical weight.`)
      }
    }
    if (sizeOk && nonDecorCount >= 3 && W >= 500 && weightSum > 0) {
      const hx = (weightedX / weightSum) / W
      if (hx < 0.26 && maxContentX < W * 0.52) {
        saran.push(`${label} off-balance layout (weight skewed left, center ~${Math.round(hx * 100)}%); widen primary zone or add counterbalance.`)
      } else if (hx > 0.74 && minContentX > W * 0.48) {
        saran.push(`${label} off-balance layout (weight skewed right, center ~${Math.round(hx * 100)}%); widen primary zone or add counterbalance.`)
      }
    }

    // Color discipline (60-30-10) & spacing rhythm
    if (accentHues.length > 3) {
      saran.push(`${label} noisy color palette (${accentHues.length} accent hues: ${accentHues.slice(0, 4).map(c => c.hex).join(', ')}); follow 60-30-10 with 1–2 accents + neutrals.`)
    }
    if (sizeOk) {
      const gaps = verticalGaps(topNonDecor, H)
      if (spacingIsErratic(gaps)) {
        saran.push(`${label} inconsistent spacing rhythm (gaps: ${gaps.slice(0, 5).join(', ')}px); snap to an 8px scale or use tata auto-layout.`)
      } else if (tataJarak.size >= 4 && [...tataJarak].filter(j => j % 4 !== 0).length >= 3) {
        saran.push(`${label} erratic auto-layout gaps (${[...tataJarak].sort((a, b) => a - b).slice(0, 5).join(', ')}px); standardize to a 4/8px scale.`)
      }
    }

    const issues = masalah.length - awalM, suggestions = saran.length - awalS
    metrik.push({
      id: ab.id, nama, elemen: els.length,
      skor: Math.max(0, 100 - issues * 18 - Math.min(30, suggestions * 4)),
      typeRatio, accentHues: accentHues.length, bodyTextPct,
      issues, suggestions
    })
  }
  const skor = metrik.length ? Math.round(metrik.reduce((sum, m) => sum + m.skor, 0) / metrik.length) : 0
  return { skor, metrik, masalah, saran }
}

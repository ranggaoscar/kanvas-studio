// Native Data Visualization generator for Kanvas Studio (P1).
// Generates 100% standard, editable Kanvas Studio elements (grup, kotak, elips, path, teks)
// for bar, hbar, line, donut, table, and process/flow diagram visuals — rendering identically
// across Canvas 2D, SVG, PDF, PNG, and editable PPTX.

const DEFAULT_SERIES = ['#E03E2D', '#1D4ED8', '#047857', '#D97706', '#7C3AED', '#0F766E']
const DARK_SERIES = ['#FF6B4A', '#60A5FA', '#34D399', '#FBBF24', '#C084FC', '#2DD4BF']

function hexToRgb(c) {
  let s = String(c || '').trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map(x => x + x).join('')
  if (!/^[0-9a-f]{6}$/i.test(s)) return null
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16))
}
function isDarkBg(bg) {
  const c = typeof bg === 'string' ? bg : (Array.isArray(bg?.warna) ? bg.warna[0] : '#FFFFFF')
  const rgb = hexToRgb(c)
  if (!rgb) return false
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return (0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])) < 0.3
}
function contrastHex(bgHex) {
  return isDarkBg(bgHex) ? '#F8FAFC' : '#111827'
}
function relLum(rgb) {
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])
}
function ensureInkContrast(fgHex, bgHex, minRatio = 4.6) {
  const fg = hexToRgb(fgHex), bg = hexToRgb(typeof bgHex === 'string' ? bgHex : '#FFFFFF')
  if (!fg || !bg) return fgHex
  const bgL = relLum(bg)
  const ratio = rgb => { const l = relLum(rgb); return (Math.max(l, bgL) + 0.05) / (Math.min(l, bgL) + 0.05) }
  if (ratio(fg) >= minRatio) return fgHex
  const target = bgL < 0.35 ? [255, 255, 255] : [12, 16, 24]
  for (let step = 1; step <= 20; step++) {
    const t = step / 20
    const mix = fg.map((v, i) => Math.round(v + (target[i] - v) * t))
    if (ratio(mix) >= minRatio) return '#' + mix.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
  }
  return bgL < 0.35 ? '#F8FAFC' : '#0F172A'
}
function fmtVal(v, unit = '') {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  const s = Math.abs(n) >= 1000 && Number.isInteger(n) ? n.toLocaleString('en-US') : (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))
  return unit ? `${s}${unit}` : s
}

export function resolveVizTheme({ abBg = '#FFFFFF', brand = null, theme = {} } = {}) {
  const dark = isDarkBg(abBg)
  const bc = brand?.colors || {}, bf = brand?.fonts || {}
  const basePalette = [
    ...(Array.isArray(theme.palette) ? theme.palette : []),
    theme.accent,
    bc.accent, bc.primary, bc.secondary,
    ...(Array.isArray(bc.palette) ? bc.palette : []),
    ...(dark ? DARK_SERIES : DEFAULT_SERIES)
  ].filter(Boolean)
  const palette = [...new Set(basePalette)]
  return {
    dark,
    bg: theme.bg || (dark ? '#161B26' : '#FFFFFF'),
    surface: theme.surface || bc.surface || (dark ? '#1E2534' : '#F4F5F8'),
    text: theme.text || bc.text || (dark ? '#F8FAFC' : '#0F172A'),
    muted: theme.muted || bc.muted || (dark ? '#94A3B8' : '#475569'),
    rule: theme.rule || (dark ? '#2D3748' : '#DCE2EA'),
    accent: theme.accent || bc.accent || bc.primary || palette[0],
    palette,
    displayFont: theme.displayFont || bf.display || 'Plus Jakarta Sans',
    bodyFont: theme.bodyFont || bf.body || 'Inter',
    monoFont: theme.monoFont || bf.mono || 'IBM Plex Mono'
  }
}

function clipText(s, maxChars) {
  const str = String(s ?? '').trim()
  if (!maxChars || str.length <= maxChars) return str
  return str.slice(0, Math.max(1, maxChars - 1)).trimEnd() + '…'
}

function headerNodes(x, y, w, { title, subtitle }, T, compact = false) {
  const nodes = []
  let cy = y
  const titleSz = compact ? 18 : 26
  const subSz = compact ? 13 : 16
  if (title) {
    const tStr = clipText(title, compact ? 38 : 68)
    nodes.push({ tipe: 'teks', nama: 'Chart Title', x, y: cy, w, teks: tStr, font: T.displayFont, ukuran: titleSz, tebal: 700, warna: T.text, lh: 1.15 })
    cy += Math.ceil(titleSz * 1.15) + 6
  }
  if (subtitle) {
    const sStr = clipText(subtitle, compact ? 48 : 88)
    nodes.push({ tipe: 'teks', nama: 'Chart Subtitle', x, y: cy, w, teks: sStr, font: T.bodyFont, ukuran: subSz, tebal: 400, warna: T.muted, lh: 1.25 })
    cy += Math.ceil(subSz * 1.25) + 6
  }
  return { nodes, nextY: cy + (nodes.length ? (compact ? 10 : 14) : 0) }
}

function buildBarChart(opts, T) {
  const { x = 120, y = 200, w = 960, h = 520, data = [], unit = '', highlightIndex, showCard = false } = opts
  if (!Array.isArray(data) || !data.length) throw new Error('bar chart requires non-empty "data": [{ label, value, color? }]')
  const compact = w < 580
  const pad = showCard ? (compact ? 22 : 32) : 8
  const innerX = x + pad, innerW = Math.max(200, w - pad * 2)
  const { nodes, nextY } = headerNodes(innerX, y + pad, innerW, opts, T, compact)

  const valSz = compact ? 13 : 16
  const lblSz = compact ? 13 : 15
  const labelH = compact ? 30 : 38, topValH = compact ? 26 : 32
  const plotX = innerX, plotY = nextY + topValH
  const plotW = innerW, plotH = Math.max(96, (y + h - pad) - plotY - labelH)
  const maxVal = Math.max(1, ...data.map(d => Math.max(0, Number(d.value) || 0)))

  // 4 horizontal gridlines
  for (let g = 0; g <= 3; g++) {
    const gy = Math.round(plotY + (plotH * g) / 3)
    nodes.push({
      tipe: 'path', nama: `Grid ${g}`, x: plotX, y: gy, w: plotW, h: 2, vb: [plotW, 2],
      d: `M0 1H${plotW}`, fill: null, garis: { tebal: g === 3 ? 2 : 1, warna: T.rule }, opacity: g === 3 ? 0.95 : 0.65
    })
  }

  const n = data.length
  const slotW = plotW / n
  const barW = Math.max(18, Math.min(compact ? 54 : 104, Math.round(slotW * 0.54)))
  const lblW = Math.max(24, Math.floor(slotW - 6))
  const maxLblChars = Math.max(3, Math.floor(lblW / (lblSz * 0.62)))
  const maxValChars = Math.max(4, Math.floor(lblW / (valSz * 0.62)))

  const cardBg = showCard ? T.surface : T.bg
  const hiInk = ensureInkContrast(T.accent, cardBg, 4.6)

  data.forEach((d, idx) => {
    const val = Math.max(0, Number(d.value) || 0)
    const bh = Math.max(6, Math.round((val / maxVal) * plotH))
    const bx = Math.round(plotX + idx * slotW + (slotW - barW) / 2)
    const by = Math.round(plotY + plotH - bh)
    const isHi = highlightIndex != null ? idx === highlightIndex : false
    const mutedBar = T.dark ? '#475569' : '#94A3B8'
    const color = d.color || (isHi ? T.accent : (highlightIndex != null ? mutedBar : T.palette[idx % T.palette.length]))
    nodes.push({ tipe: 'kotak', nama: `Bar ${d.label}`, x: bx, y: by, w: barW, h: bh, radius: compact ? 4 : 6, fill: color, opacity: highlightIndex != null && !isHi ? 0.65 : 1 })
    const lx = Math.round(plotX + idx * slotW + (slotW - lblW) / 2)
    const valY = Math.max(nextY, by - Math.ceil(valSz * 1.2) - 6)
    nodes.push({ tipe: 'teks', nama: `Value ${d.label}`, x: lx, y: valY, w: lblW, teks: clipText(fmtVal(val, unit), maxValChars), font: T.monoFont, ukuran: valSz, tebal: isHi ? 700 : 600, warna: isHi ? hiInk : T.text, rata: 'tengah', lh: 1.15 })
    nodes.push({ tipe: 'teks', nama: `Label ${d.label}`, x: lx, y: plotY + plotH + 10, w: lblW, teks: clipText(d.label, maxLblChars), font: T.bodyFont, ukuran: lblSz, tebal: isHi ? 700 : 600, warna: isHi ? T.text : T.muted, rata: 'tengah', lh: 1.15 })
  })

  return {
    tipe: 'grup', nama: opts.title || 'Bar Chart', x, y, w, h,
    ...(showCard ? { fill: T.surface, radius: 12, garis: { tebal: 1, warna: T.rule } } : { fill: null }),
    anak: nodes
  }
}

function buildHBarChart(opts, T) {
  const { x = 120, y = 200, w = 960, h = 480, data = [], unit = '', highlightIndex, showCard = false } = opts
  if (!Array.isArray(data) || !data.length) throw new Error('hbar chart requires non-empty "data": [{ label, value, color? }]')
  const compact = w < 580
  const pad = showCard ? (compact ? 22 : 32) : 8
  const innerX = x + pad, innerW = Math.max(220, w - pad * 2)
  const { nodes, nextY } = headerNodes(innerX, y + pad, innerW, opts, T, compact)

  const fontSz = compact ? 13 : 16
  const maxVal = Math.max(1, ...data.map(d => Math.max(0, Number(d.value) || 0)))
  const labelW = Math.round(innerW * (compact ? 0.31 : 0.27))
  const valW = Math.round(innerW * (compact ? 0.23 : 0.17))
  const gap = compact ? 10 : 16
  const trackX = innerX + labelW + gap, trackW = Math.max(70, innerW - labelW - valW - gap * 2)
  const availH = Math.max(100, (y + h - pad) - nextY)
  const rowH = Math.max(30, Math.floor(availH / data.length))
  const barH = Math.max(12, Math.min(compact ? 22 : 30, Math.round(rowH * 0.48)))
  const textH = Math.ceil(fontSz * 1.2)
  const maxLblChars = Math.max(6, Math.floor(labelW / (fontSz * 0.6)))
  const maxValChars = Math.max(5, Math.floor(valW / (fontSz * 0.64)))
  const mutedBar = T.dark ? '#475569' : '#94A3B8'
  const cardBg = showCard ? T.surface : T.bg
  const hiInk = ensureInkContrast(T.accent, cardBg, 4.6)

  data.forEach((d, idx) => {
    const val = Math.max(0, Number(d.value) || 0)
    const ry = Math.round(nextY + idx * rowH)
    const barY = Math.round(ry + (rowH - barH) / 2)
    const textY = Math.round(ry + (rowH - textH) / 2)
    const bw = Math.max(8, Math.round((val / maxVal) * trackW))
    const isHi = highlightIndex != null ? idx === highlightIndex : false
    const color = d.color || (isHi ? T.accent : (highlightIndex != null ? mutedBar : T.palette[idx % T.palette.length]))
    nodes.push({ tipe: 'teks', nama: `Row ${d.label}`, x: innerX, y: textY, w: labelW, teks: clipText(d.label, maxLblChars), font: T.bodyFont, ukuran: fontSz, tebal: isHi ? 700 : 600, warna: T.text, rata: 'kiri', lh: 1.2 })
    nodes.push({ tipe: 'kotak', nama: `Track ${d.label}`, x: trackX, y: barY, w: trackW, h: barH, radius: Math.round(barH / 2), fill: T.rule, opacity: 0.45 })
    nodes.push({ tipe: 'kotak', nama: `Bar ${d.label}`, x: trackX, y: barY, w: bw, h: barH, radius: Math.round(barH / 2), fill: color, opacity: highlightIndex != null && !isHi ? 0.72 : 1 })
    nodes.push({ tipe: 'teks', nama: `Val ${d.label}`, x: trackX + trackW + gap, y: textY, w: valW, teks: clipText(fmtVal(val, unit), maxValChars), font: T.monoFont, ukuran: fontSz, tebal: 700, warna: isHi ? hiInk : T.text, rata: 'kanan', lh: 1.2 })
  })

  return {
    tipe: 'grup', nama: opts.title || 'Horizontal Bar Chart', x, y, w, h,
    ...(showCard ? { fill: T.surface, radius: 12, garis: { tebal: 1, warna: T.rule } } : { fill: null }),
    anak: nodes
  }
}

function buildLineChart(opts, T) {
  const { x = 120, y = 200, w = 960, h = 520, labels = [], series = [], unit = '', showArea = true, showCard = false } = opts
  const normalizedSeries = Array.isArray(series) && series.length
    ? series
    : (Array.isArray(opts.data) && opts.data.length ? [{ name: opts.title || 'Series', values: opts.data.map(d => Number(d.value) || 0) }] : [])
  const xLabels = labels.length ? labels : (Array.isArray(opts.data) ? opts.data.map(d => String(d.label || '')) : [])
  if (!normalizedSeries.length || !normalizedSeries[0].values?.length) throw new Error('line chart requires "series": [{ name, values: [n...] }] or "data": [{ label, value }]')

  const compact = w < 580
  const pad = showCard ? (compact ? 22 : 32) : 8
  const innerX = x + pad, innerW = Math.max(220, w - pad * 2)
  const { nodes, nextY: hdrEnd } = headerNodes(innerX, y + pad, innerW, opts, T, compact)

  let nextY = hdrEnd
  // Clean horizontal legend row below header when >1 series (never collides with title)
  if (normalizedSeries.length > 1) {
    const legSz = compact ? 13 : 14
    const itemW = Math.min(168, Math.floor(innerW / normalizedSeries.length))
    normalizedSeries.forEach((s, si) => {
      const lx = innerX + si * itemW
      const color = s.color || T.palette[si % T.palette.length]
      nodes.push({ tipe: 'kotak', x: Math.round(lx), y: nextY + 3, w: 12, h: 12, radius: 3, fill: color })
      nodes.push({ tipe: 'teks', x: Math.round(lx + 18), y: nextY, w: Math.max(40, itemW - 24), teks: clipText(s.name || `Series ${si + 1}`, Math.max(6, Math.floor((itemW - 24) / (legSz * 0.6)))), font: T.bodyFont, ukuran: legSz, tebal: 600, warna: T.text, lh: 1.2 })
    })
    nextY += 26
  }

  const yAxisW = compact ? 68 : 76, xAxisH = compact ? 32 : 38
  const tickSz = compact ? 13 : 14
  const plotX = innerX + yAxisW, plotY = nextY + 8
  const plotW = Math.max(120, innerW - yAxisW - 8)
  const plotH = Math.max(100, (y + h - pad) - plotY - xAxisH)

  const allVals = normalizedSeries.flatMap(s => (s.values || []).map(Number).filter(Number.isFinite))
  const minVal = Math.min(0, ...allVals), maxVal = Math.max(1, ...allVals)
  const span = Math.max(1e-6, maxVal - minVal)

  // Horizontal gridlines + Y labels (clean integer rounding when max >= 15)
  for (let g = 0; g <= 3; g++) {
    const gy = Math.round(plotY + (plotH * g) / 3)
    const rawTick = maxVal - (span * g) / 3
    const tickVal = Math.abs(maxVal) >= 15 ? Math.round(rawTick) : Math.round(rawTick * 10) / 10
    nodes.push({ tipe: 'teks', x: innerX, y: Math.max(nextY, gy - 9), w: yAxisW - 10, teks: clipText(fmtVal(tickVal, unit), Math.max(6, Math.floor((yAxisW - 10) / (tickSz * 0.56)))), font: T.monoFont, ukuran: tickSz, tebal: 500, warna: T.muted, rata: 'kanan', lh: 1.15 })
    nodes.push({ tipe: 'path', x: plotX, y: gy, w: plotW, h: 2, vb: [plotW, 2], d: `M0 1H${plotW}`, fill: null, garis: { tebal: g === 3 ? 2 : 1, warna: T.rule }, opacity: g === 3 ? 0.9 : 0.6 })
  }

  // Series lines + optional area + point markers
  normalizedSeries.forEach((s, si) => {
    const vals = (s.values || []).map(v => Number(v) || 0)
    const color = s.color || T.palette[si % T.palette.length]
    const n = vals.length
    const pts = vals.map((v, i) => {
      const px = n === 1 ? plotW / 2 : (i / (n - 1)) * plotW
      const py = plotH - ((v - minVal) / span) * plotH
      return [Math.round(px * 10) / 10, Math.round(py * 10) / 10]
    })
    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ')
    if (showArea && si === 0 && pts.length >= 2) {
      const areaD = `${lineD} L${pts.at(-1)[0]} ${plotH} L${pts[0][0]} ${plotH} Z`
      nodes.push({ tipe: 'path', nama: `${s.name || 'Series'} Area`, x: plotX, y: plotY, w: plotW, h: plotH, vb: [plotW, plotH], d: areaD, fill: color, opacity: 0.12 })
    }
    nodes.push({ tipe: 'path', nama: `${s.name || 'Series'} Line`, x: plotX, y: plotY, w: plotW, h: plotH, vb: [plotW, plotH], d: lineD, fill: null, garis: { tebal: compact ? 3 : 4, warna: color }, ujung: 'bulat' })
    pts.forEach(([px, py], i) => {
      const isHi = si === 0 && opts.highlightIndex === i
      const r = isHi ? 7 : 5
      nodes.push({ tipe: 'elips', nama: `Pt ${i + 1}`, x: Math.round(plotX + px - r), y: Math.round(plotY + py - r), w: r * 2, h: r * 2, fill: color, garis: { tebal: 2, warna: T.bg } })
    })
  })

  // X-axis labels strictly bounded inside [plotX .. plotX + plotW]
  const nLbl = xLabels.length
  if (nLbl) {
    const shortLabels = xLabels.every(l => String(l).length <= 4)
    const maxTicks = compact ? (shortLabels ? 6 : 5) : 8
    const step = Math.max(1, Math.ceil(nLbl / maxTicks))
    const tickIndices = []
    for (let i = 0; i < nLbl; i += step) tickIndices.push(i)
    if (tickIndices.at(-1) !== nLbl - 1 && nLbl > 1) tickIndices[tickIndices.length - 1] = nLbl - 1
    const slotW = Math.floor(plotW / Math.max(1, tickIndices.length))
    const lblW = Math.max(32, slotW - 6)
    const maxChars = Math.max(3, Math.floor(lblW / (tickSz * 0.6)))
    tickIndices.forEach((i, ti) => {
      const px = nLbl === 1 ? plotW / 2 : (i / (nLbl - 1)) * plotW
      const isFirst = ti === 0 && tickIndices.length > 1
      const isLast = ti === tickIndices.length - 1 && tickIndices.length > 1
      const lx = isFirst ? plotX : isLast ? (plotX + plotW - lblW) : Math.max(plotX, Math.min(plotX + plotW - lblW, Math.round(plotX + px - lblW / 2)))
      const align = isFirst ? 'kiri' : isLast ? 'kanan' : 'tengah'
      nodes.push({ tipe: 'teks', x: lx, y: plotY + plotH + 10, w: lblW, teks: clipText(xLabels[i], maxChars), font: T.bodyFont, ukuran: tickSz, tebal: 500, warna: T.muted, rata: align, lh: 1.15 })
    })
  }

  return {
    tipe: 'grup', nama: opts.title || 'Line Chart', x, y, w, h,
    ...(showCard ? { fill: T.surface, radius: 12, garis: { tebal: 1, warna: T.rule } } : { fill: null }),
    anak: nodes
  }
}

function buildDonutChart(opts, T) {
  const { x = 120, y = 200, w = 860, h = 440, data = [], centerLabel = 'TOTAL', centerValue, unit = '', showCard = false } = opts
  if (!Array.isArray(data) || !data.length) throw new Error('donut chart requires non-empty "data": [{ label, value, color? }]')
  const compact = w < 640
  const pad = showCard ? (compact ? 22 : 28) : 8
  const innerX = x + pad, innerW = Math.max(240, w - pad * 2)
  const { nodes, nextY } = headerNodes(innerX, y + pad, innerW, opts, T, compact)

  const availH = Math.max(150, (y + h - pad) - nextY)
  const size = Math.min(availH - 8, Math.round(innerW * (compact ? 0.36 : 0.36)))
  const total = data.reduce((s, d) => s + Math.max(0, Number(d.value) || 0), 0) || 1
  const cx = 100, cy = 100, R = 94, r = 58
  let angle = -Math.PI / 2

  const polar = (rad, a) => [Math.round((cx + rad * Math.cos(a)) * 100) / 100, Math.round((cy + rad * Math.sin(a)) * 100) / 100]
  const ringTop = Math.round(nextY + (availH - size) / 2)
  data.forEach((d, idx) => {
    const val = Math.max(0, Number(d.value) || 0)
    const frac = val / total
    if (frac <= 0) return
    const sweep = Math.min(Math.PI * 1.998, frac * Math.PI * 2)
    const a0 = angle, a1 = angle + sweep
    angle = a1
    const large = sweep > Math.PI ? 1 : 0
    const [x1, y1] = polar(R, a0), [x2, y2] = polar(R, a1)
    const [ix2, iy2] = polar(r, a1), [ix1, iy1] = polar(r, a0)
    const pathD = `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`
    const color = d.color || T.palette[idx % T.palette.length]
    nodes.push({ tipe: 'path', nama: `Slice ${d.label}`, x: innerX, y: ringTop, w: size, h: size, vb: [200, 200], d: pathD, fill: color })
  })

  // Center figure strictly inside donut hole (min 13px for Visual QA readability)
  const holeW = Math.round(size * 0.56)
  const holeX = Math.round(innerX + (size - holeW) / 2)
  const valStr = centerValue != null ? String(centerValue) : fmtVal(total, unit)
  const valSz = Math.max(16, Math.min(Math.round(size * 0.14), Math.floor(holeW / Math.max(3.5, valStr.length * 0.62))))
  const lblSz = Math.max(13, Math.min(14, Math.round(size * 0.06)))
  const valY = Math.round(ringTop + size / 2 - valSz * 0.85)
  const lblY = valY + Math.ceil(valSz * 1.1) + 4
  nodes.push({ tipe: 'teks', nama: 'Center Value', x: holeX, y: valY, w: holeW, teks: valStr, font: T.displayFont, ukuran: valSz, tebal: 800, warna: T.text, rata: 'tengah', lh: 1.05 })
  nodes.push({ tipe: 'teks', nama: 'Center Label', x: holeX, y: lblY, w: holeW, teks: clipText(centerLabel, Math.max(5, Math.floor(holeW / (lblSz * 0.72)))), font: T.monoFont, ukuran: lblSz, tebal: 600, kapital: true, spasi: 1, warna: T.muted, rata: 'tengah', lh: 1.15 })

  // Structured legend strictly inside [innerX + size + legGap .. innerX + innerW]
  const legGap = compact ? 22 : 36
  const legX = innerX + size + legGap, legW = Math.max(140, innerW - size - legGap)
  const legSz = compact ? 13 : 15
  const legRowH = Math.min(44, Math.max(28, Math.floor(availH / Math.max(1, data.length))))
  const legStartY = Math.round(nextY + Math.max(0, (availH - data.length * legRowH) / 2))
  const textArea = Math.max(90, legW - 22)
  const lblColW = Math.round(textArea * 0.56)
  const valColW = Math.max(56, textArea - lblColW - 8)
  const maxLblChars = Math.max(6, Math.floor(lblColW / (legSz * 0.58)))

  data.forEach((d, idx) => {
    const val = Math.max(0, Number(d.value) || 0)
    const pct = Math.round((val / total) * 100)
    const ry = legStartY + idx * legRowH
    const color = d.color || T.palette[idx % T.palette.length]
    const txtY = Math.round(ry + (legRowH - Math.ceil(legSz * 1.2)) / 2)
    nodes.push({ tipe: 'kotak', x: legX, y: txtY + 2, w: 12, h: 12, radius: 3, fill: color })
    nodes.push({ tipe: 'teks', x: legX + 20, y: txtY, w: lblColW, teks: clipText(d.label, maxLblChars), font: T.bodyFont, ukuran: legSz, tebal: 600, warna: T.text, lh: 1.2 })
    const rightTxt = unit === '%' ? `${pct}%` : `${fmtVal(val, unit)} (${pct}%)`
    nodes.push({ tipe: 'teks', x: legX + 20 + lblColW + 8, y: txtY, w: valColW, teks: clipText(rightTxt, Math.max(4, Math.floor(valColW / (legSz * 0.62)))), font: T.monoFont, ukuran: legSz, tebal: 700, warna: T.muted, rata: 'kanan', lh: 1.2 })
  })

  return {
    tipe: 'grup', nama: opts.title || 'Donut Chart', x, y, w, h,
    ...(showCard ? { fill: T.surface, radius: 12, garis: { tebal: 1, warna: T.rule } } : { fill: null }),
    anak: nodes
  }
}

function buildTable(opts, T) {
  const { x = 120, y = 200, w = 1040, columns = [], rows = [], title, subtitle } = opts
  if (!Array.isArray(columns) || !columns.length) throw new Error('table requires non-empty "columns": ["Col 1", ...]')
  const safeRows = Array.isArray(rows) ? rows : []
  const padX = 20, padY = 16, colCount = columns.length
  const colW = Math.floor((w - padX * 2) / colCount)

  const tableChildren = []
  if (title) tableChildren.push({ tipe: 'teks', nama: 'Table Title', teks: String(title), font: T.displayFont, ukuran: 28, tebal: 700, warna: T.text, lh: 1.15 })
  if (subtitle) tableChildren.push({ tipe: 'teks', nama: 'Table Subtitle', teks: String(subtitle), font: T.bodyFont, ukuran: 18, tebal: 400, warna: T.muted, lh: 1.3 })

  const headerBg = T.accent
  const headerInk = contrastHex(headerBg)
  tableChildren.push({
    tipe: 'grup', nama: 'Header Row', lebar: 'isi', tinggi: 'peluk', fill: headerBg, radius: 8,
    tata: { arah: 'baris', jarak: 0, padding: [padY, padX, padY, padX], rata: 'tengah' },
    anak: columns.map((c, ci) => ({
      tipe: 'teks', nama: `H${ci + 1}`, w: colW, teks: String(c),
      font: T.monoFont, ukuran: 16, tebal: 700, kapital: true, spasi: 1, warna: headerInk,
      rata: ci === 0 ? 'kiri' : 'kanan', lh: 1.2
    }))
  })

  safeRows.forEach((row, ri) => {
    const cells = Array.isArray(row) ? row : columns.map(c => row?.[c] ?? '')
    tableChildren.push({
      tipe: 'grup', nama: `Row ${ri + 1}`, lebar: 'isi', tinggi: 'peluk',
      fill: ri % 2 === 1 ? T.surface : null, radius: 6,
      garis: { tebal: 1, warna: T.rule },
      tata: { arah: 'baris', jarak: 0, padding: [padY, padX, padY, padX], rata: 'tengah' },
      anak: columns.map((_, ci) => ({
        tipe: 'teks', nama: `R${ri + 1}C${ci + 1}`, w: colW, teks: String(cells[ci] ?? ''),
        font: ci === 0 ? T.bodyFont : T.monoFont, ukuran: 18, tebal: ci === 0 ? 600 : 500,
        warna: T.text, rata: ci === 0 ? 'kiri' : 'kanan', lh: 1.25
      }))
    })
  })

  return {
    tipe: 'grup', nama: title || 'Data Table', x, y, w, tinggi: 'peluk', fill: null,
    tata: { arah: 'kolom', jarak: 8, padding: 0, rata: 'regang' },
    anak: tableChildren
  }
}

function buildDiagram(opts, T) {
  const { x = 120, y = 240, w = 1200, h = 360, nodes: steps = [], direction = 'horizontal', title, subtitle } = opts
  if (!Array.isArray(steps) || steps.length < 2) throw new Error('diagram requires "nodes": [{ title, detail?, badge? }] (at least 2 steps)')
  const { nodes, nextY } = headerNodes(x, y, w, { title, subtitle }, T)
  const n = steps.length
  const horiz = direction !== 'vertical'
  const arrowGap = horiz ? 48 : 42

  if (horiz) {
    const cardW = Math.max(140, Math.floor((w - arrowGap * (n - 1)) / n))
    const cardH = Math.max(140, (y + h) - nextY)
    steps.forEach((st, i) => {
      const cx = x + i * (cardW + arrowGap)
      const isHighlight = Boolean(st.highlight)
      const cardBg = isHighlight ? T.accent : T.surface
      const ink = isHighlight ? contrastHex(cardBg) : T.text
      const subInk = isHighlight ? ink : T.muted
      nodes.push({
        tipe: 'grup', nama: `Step ${i + 1}`, x: cx, y: nextY, w: cardW, h: cardH,
        fill: cardBg, radius: 14, garis: { tebal: 1.5, warna: isHighlight ? cardBg : T.rule },
        tata: { arah: 'kolom', jarak: 10, padding: 22, rata: 'regang' },
        anak: [
          { tipe: 'teks', teks: String(st.badge || String(i + 1).padStart(2, '0')), font: T.monoFont, ukuran: 16, tebal: 700, kapital: true, spasi: 1.5, warna: isHighlight ? ink : T.accent, lh: 1.2 },
          { tipe: 'teks', teks: String(st.title || `Step ${i + 1}`), font: T.displayFont, ukuran: 22, tebal: 700, warna: ink, lh: 1.15 },
          ...(st.detail ? [{ tipe: 'teks', teks: String(st.detail), font: T.bodyFont, ukuran: 16, tebal: 400, warna: subInk, lh: 1.35 }] : [])
        ]
      })
      if (i < n - 1) {
        const ax = cx + cardW + 8, ay = Math.round(nextY + cardH / 2 - 10), aw = arrowGap - 16
        nodes.push({
          tipe: 'path', nama: `Arrow ${i + 1}`, x: ax, y: ay, w: aw, h: 20, vb: [aw, 20],
          d: `M0 10 H${aw - 8} M${aw - 14} 4 L${aw - 2} 10 L${aw - 14} 16`,
          fill: null, garis: { tebal: 2.5, warna: T.accent }, ujung: 'bulat'
        })
      }
    })
  } else {
    const availH = Math.max(240, (y + h) - nextY)
    const cardH = Math.max(76, Math.floor((availH - arrowGap * (n - 1)) / n))
    steps.forEach((st, i) => {
      const cy = nextY + i * (cardH + arrowGap)
      const isHighlight = Boolean(st.highlight)
      const cardBg = isHighlight ? T.accent : T.surface
      const ink = isHighlight ? contrastHex(cardBg) : T.text
      nodes.push({
        tipe: 'grup', nama: `Step ${i + 1}`, x, y: cy, w, h: cardH,
        fill: cardBg, radius: 12, garis: { tebal: 1.5, warna: isHighlight ? cardBg : T.rule },
        tata: { arah: 'baris', jarak: 20, padding: [16, 24, 16, 24], rata: 'tengah' },
        anak: [
          { tipe: 'teks', w: 54, teks: String(st.badge || String(i + 1).padStart(2, '0')), font: T.monoFont, ukuran: 18, tebal: 700, warna: isHighlight ? ink : T.accent, lh: 1.2 },
          { tipe: 'teks', lebar: 'isi', teks: st.detail ? `${st.title} — ${st.detail}` : String(st.title || `Step ${i + 1}`), font: T.bodyFont, ukuran: 19, tebal: 600, warna: ink, lh: 1.25 }
        ]
      })
      if (i < n - 1) {
        const ax = Math.round(x + w / 2 - 10), ay = cy + cardH + 6, ah = arrowGap - 12
        nodes.push({
          tipe: 'path', nama: `Arrow ${i + 1}`, x: ax, y: ay, w: 20, h: ah, vb: [20, ah],
          d: `M10 0 V${ah - 6} M4 ${ah - 12} L10 ${ah - 2} L16 ${ah - 12}`,
          fill: null, garis: { tebal: 2.5, warna: T.accent }, ujung: 'bulat'
        })
      }
    })
  }

  return { tipe: 'grup', nama: title || 'Flow Diagram', x, y, w, h, fill: null, anak: nodes }
}

export function buildDataVizElement(opts, { abBg = '#FFFFFF', brand = null } = {}) {
  const T = resolveVizTheme({ abBg, brand, theme: opts.theme })
  const type = String(opts.type || '').toLowerCase()
  if (type === 'bar') return buildBarChart(opts, T)
  if (type === 'hbar') return buildHBarChart(opts, T)
  if (type === 'line') return buildLineChart(opts, T)
  if (type === 'donut' || type === 'pie') return buildDonutChart(opts, T)
  if (type === 'table') return buildTable(opts, T)
  if (type === 'diagram' || type === 'flow') return buildDiagram(opts, T)
  throw new Error(`Unknown dataviz type "${opts.type}". Use: bar, hbar, line, donut, table, diagram.`)
}

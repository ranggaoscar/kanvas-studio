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

function headerNodes(x, y, w, { title, subtitle }, T) {
  const nodes = []
  let cy = y
  if (title) {
    nodes.push({ tipe: 'teks', nama: 'Chart Title', x, y: cy, w, teks: String(title), font: T.displayFont, ukuran: 28, tebal: 700, warna: T.text, lh: 1.15 })
    cy += 38
  }
  if (subtitle) {
    nodes.push({ tipe: 'teks', nama: 'Chart Subtitle', x, y: cy, w, teks: String(subtitle), font: T.bodyFont, ukuran: 18, tebal: 400, warna: T.muted, lh: 1.3 })
    cy += 28
  }
  return { nodes, nextY: cy + (nodes.length ? 16 : 0) }
}

function buildBarChart(opts, T) {
  const { x = 120, y = 200, w = 960, h = 520, data = [], unit = '', highlightIndex, showCard = false } = opts
  if (!Array.isArray(data) || !data.length) throw new Error('bar chart requires non-empty "data": [{ label, value, color? }]')
  const pad = showCard ? 36 : 8
  const innerX = x + pad, innerW = Math.max(200, w - pad * 2)
  const { nodes, nextY } = headerNodes(innerX, y + pad, innerW, opts, T)

  const labelH = 44, topValH = 34
  const plotX = innerX, plotY = nextY + topValH
  const plotW = innerW, plotH = Math.max(120, (y + h - pad) - plotY - labelH)
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
  const barW = Math.max(20, Math.min(110, Math.round(slotW * 0.56)))
  data.forEach((d, idx) => {
    const val = Math.max(0, Number(d.value) || 0)
    const bh = Math.max(6, Math.round((val / maxVal) * plotH))
    const bx = Math.round(plotX + idx * slotW + (slotW - barW) / 2)
    const by = Math.round(plotY + plotH - bh)
    const isHi = highlightIndex != null ? idx === highlightIndex : false
    const color = d.color || (isHi ? T.accent : (highlightIndex != null ? T.muted : T.palette[idx % T.palette.length]))
    nodes.push({ tipe: 'kotak', nama: `Bar ${d.label}`, x: bx, y: by, w: barW, h: bh, radius: 6, fill: color, opacity: highlightIndex != null && !isHi ? 0.55 : 1 })
    const lblW = Math.max(barW + 24, Math.round(slotW - 8))
    const lx = Math.round(plotX + idx * slotW + (slotW - lblW) / 2)
    nodes.push({ tipe: 'teks', nama: `Value ${d.label}`, x: lx, y: Math.max(nextY, by - 28), w: lblW, teks: fmtVal(val, unit), font: T.monoFont, ukuran: 17, tebal: 700, warna: T.text, rata: 'tengah', lh: 1.2 })
    nodes.push({ tipe: 'teks', nama: `Label ${d.label}`, x: lx, y: plotY + plotH + 12, w: lblW, teks: String(d.label || ''), font: T.bodyFont, ukuran: 16, tebal: 600, warna: T.muted, rata: 'tengah', lh: 1.2 })
  })

  return {
    tipe: 'grup', nama: opts.title || 'Bar Chart', x, y, w, h,
    ...(showCard ? { fill: T.surface, radius: 16, garis: { tebal: 1, warna: T.rule } } : { fill: null }),
    anak: nodes
  }
}

function buildHBarChart(opts, T) {
  const { x = 120, y = 200, w = 960, h = 480, data = [], unit = '', highlightIndex, showCard = false } = opts
  if (!Array.isArray(data) || !data.length) throw new Error('hbar chart requires non-empty "data": [{ label, value, color? }]')
  const pad = showCard ? 36 : 8
  const innerX = x + pad, innerW = Math.max(240, w - pad * 2)
  const { nodes, nextY } = headerNodes(innerX, y + pad, innerW, opts, T)

  const maxVal = Math.max(1, ...data.map(d => Math.max(0, Number(d.value) || 0)))
  const labelW = Math.round(innerW * 0.28), valW = Math.round(innerW * 0.14), gap = 18
  const trackX = innerX + labelW + gap, trackW = Math.max(100, innerW - labelW - valW - gap * 2)
  const availH = Math.max(120, (y + h - pad) - nextY)
  const rowH = Math.max(36, Math.floor(availH / data.length))
  const barH = Math.max(16, Math.min(34, Math.round(rowH * 0.52)))

  data.forEach((d, idx) => {
    const val = Math.max(0, Number(d.value) || 0)
    const ry = Math.round(nextY + idx * rowH)
    const barY = Math.round(ry + (rowH - barH) / 2)
    const bw = Math.max(8, Math.round((val / maxVal) * trackW))
    const isHi = highlightIndex != null ? idx === highlightIndex : false
    const color = d.color || (isHi ? T.accent : T.palette[idx % T.palette.length])
    nodes.push({ tipe: 'teks', nama: `Row ${d.label}`, x: innerX, y: Math.round(ry + (rowH - 22) / 2), w: labelW, teks: String(d.label || ''), font: T.bodyFont, ukuran: 18, tebal: 600, warna: T.text, rata: 'kiri', lh: 1.2 })
    nodes.push({ tipe: 'kotak', nama: `Track ${d.label}`, x: trackX, y: barY, w: trackW, h: barH, radius: Math.round(barH / 2), fill: T.rule, opacity: 0.45 })
    nodes.push({ tipe: 'kotak', nama: `Bar ${d.label}`, x: trackX, y: barY, w: bw, h: barH, radius: Math.round(barH / 2), fill: color })
    nodes.push({ tipe: 'teks', nama: `Val ${d.label}`, x: trackX + trackW + gap, y: Math.round(ry + (rowH - 22) / 2), w: valW, teks: fmtVal(val, unit), font: T.monoFont, ukuran: 18, tebal: 700, warna: T.text, rata: 'kanan', lh: 1.2 })
  })

  return {
    tipe: 'grup', nama: opts.title || 'Horizontal Bar Chart', x, y, w, h,
    ...(showCard ? { fill: T.surface, radius: 16, garis: { tebal: 1, warna: T.rule } } : { fill: null }),
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

  const pad = showCard ? 36 : 8
  const innerX = x + pad, innerW = Math.max(240, w - pad * 2)
  const { nodes, nextY } = headerNodes(innerX, y + pad, innerW, opts, T)

  const yAxisW = 68, xAxisH = 40
  const plotX = innerX + yAxisW, plotY = nextY + 12
  const plotW = Math.max(160, innerW - yAxisW - 12)
  const plotH = Math.max(120, (y + h - pad) - plotY - xAxisH)

  const allVals = normalizedSeries.flatMap(s => (s.values || []).map(Number).filter(Number.isFinite))
  const minVal = Math.min(0, ...allVals), maxVal = Math.max(1, ...allVals)
  const span = Math.max(1e-6, maxVal - minVal)

  // Horizontal gridlines + Y labels
  for (let g = 0; g <= 3; g++) {
    const gy = Math.round(plotY + (plotH * g) / 3)
    const tickVal = maxVal - (span * g) / 3
    nodes.push({ tipe: 'teks', x: innerX, y: gy - 11, w: yAxisW - 12, teks: fmtVal(Math.round(tickVal * 10) / 10, unit), font: T.monoFont, ukuran: 14, tebal: 500, warna: T.muted, rata: 'kanan', lh: 1.2 })
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
    nodes.push({ tipe: 'path', nama: `${s.name || 'Series'} Line`, x: plotX, y: plotY, w: plotW, h: plotH, vb: [plotW, plotH], d: lineD, fill: null, garis: { tebal: 4, warna: color }, ujung: 'bulat' })
    pts.forEach(([px, py], i) => {
      nodes.push({ tipe: 'elips', nama: `Pt ${i + 1}`, x: Math.round(plotX + px - 6), y: Math.round(plotY + py - 6), w: 12, h: 12, fill: color, garis: { tebal: 2, warna: T.bg } })
    })
  })

  // X-axis labels
  const nLbl = xLabels.length
  if (nLbl) {
    const step = Math.max(1, Math.ceil(nLbl / 8))
    const lblW = Math.max(60, Math.round(plotW / Math.min(nLbl, 8)))
    for (let i = 0; i < nLbl; i += step) {
      const px = nLbl === 1 ? plotW / 2 : (i / (nLbl - 1)) * plotW
      nodes.push({ tipe: 'teks', x: Math.round(plotX + px - lblW / 2), y: plotY + plotH + 12, w: lblW, teks: String(xLabels[i]), font: T.bodyFont, ukuran: 15, tebal: 500, warna: T.muted, rata: 'tengah', lh: 1.2 })
    }
  }

  // Series legend (top-right when >1 series)
  if (normalizedSeries.length > 1) {
    const legW = Math.min(innerW * 0.55, normalizedSeries.length * 160)
    let lx = innerX + innerW - legW
    normalizedSeries.forEach((s, si) => {
      const color = s.color || T.palette[si % T.palette.length]
      nodes.push({ tipe: 'kotak', x: Math.round(lx), y: y + pad + 10, w: 14, h: 14, radius: 4, fill: color })
      nodes.push({ tipe: 'teks', x: Math.round(lx + 20), y: y + pad + 6, w: 130, teks: String(s.name || `Series ${si + 1}`), font: T.bodyFont, ukuran: 15, tebal: 600, warna: T.text, lh: 1.2 })
      lx += 156
    })
  }

  return {
    tipe: 'grup', nama: opts.title || 'Line Chart', x, y, w, h,
    ...(showCard ? { fill: T.surface, radius: 16, garis: { tebal: 1, warna: T.rule } } : { fill: null }),
    anak: nodes
  }
}

function buildDonutChart(opts, T) {
  const { x = 120, y = 200, w = 860, h = 440, data = [], centerLabel = 'TOTAL', centerValue, unit = '', showCard = false } = opts
  if (!Array.isArray(data) || !data.length) throw new Error('donut chart requires non-empty "data": [{ label, value, color? }]')
  const pad = showCard ? 36 : 8
  const innerX = x + pad, innerW = Math.max(260, w - pad * 2)
  const { nodes, nextY } = headerNodes(innerX, y + pad, innerW, opts, T)

  const availH = Math.max(180, (y + h - pad) - nextY)
  const size = Math.min(availH, Math.round(innerW * 0.44))
  const total = data.reduce((s, d) => s + Math.max(0, Number(d.value) || 0), 0) || 1
  const cx = 100, cy = 100, R = 94, r = 58
  let angle = -Math.PI / 2

  const polar = (rad, a) => [Math.round((cx + rad * Math.cos(a)) * 100) / 100, Math.round((cy + rad * Math.sin(a)) * 100) / 100]
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
    nodes.push({ tipe: 'path', nama: `Slice ${d.label}`, x: innerX, y: Math.round(nextY + (availH - size) / 2), w: size, h: size, vb: [200, 200], d: pathD, fill: color })
  })

  // Center figure inside hole
  const ringTop = Math.round(nextY + (availH - size) / 2)
  const holeW = Math.round(size * 0.56)
  const holeX = Math.round(innerX + (size - holeW) / 2)
  nodes.push({ tipe: 'teks', nama: 'Center Value', x: holeX, y: Math.round(ringTop + size * 0.38), w: holeW, teks: centerValue != null ? String(centerValue) : fmtVal(total, unit), font: T.displayFont, ukuran: Math.max(22, Math.round(size * 0.13)), tebal: 800, warna: T.text, rata: 'tengah', lh: 1.05 })
  nodes.push({ tipe: 'teks', nama: 'Center Label', x: holeX, y: Math.round(ringTop + size * 0.55), w: holeW, teks: String(centerLabel), font: T.monoFont, ukuran: Math.max(12, Math.round(size * 0.048)), tebal: 600, kapital: true, spasi: 1.5, warna: T.muted, rata: 'tengah', lh: 1.2 })

  // Structured legend on the right
  const legX = innerX + size + 44, legW = Math.max(180, innerW - size - 44)
  const legRowH = Math.min(48, Math.max(32, Math.floor(availH / Math.max(1, data.length))))
  const legStartY = Math.round(nextY + Math.max(0, (availH - data.length * legRowH) / 2))
  data.forEach((d, idx) => {
    const val = Math.max(0, Number(d.value) || 0)
    const pct = Math.round((val / total) * 100)
    const ry = legStartY + idx * legRowH
    const color = d.color || T.palette[idx % T.palette.length]
    nodes.push({ tipe: 'kotak', x: legX, y: ry + 8, w: 16, h: 16, radius: 4, fill: color })
    nodes.push({ tipe: 'teks', x: legX + 26, y: ry + 4, w: Math.round(legW * 0.56), teks: String(d.label || ''), font: T.bodyFont, ukuran: 18, tebal: 600, warna: T.text, lh: 1.2 })
    nodes.push({ tipe: 'teks', x: legX + Math.round(legW * 0.62), y: ry + 4, w: Math.round(legW * 0.38), teks: `${fmtVal(val, unit)} (${pct}%)`, font: T.monoFont, ukuran: 17, tebal: 700, warna: T.muted, rata: 'kanan', lh: 1.2 })
  })

  return {
    tipe: 'grup', nama: opts.title || 'Donut Chart', x, y, w, h,
    ...(showCard ? { fill: T.surface, radius: 16, garis: { tebal: 1, warna: T.rule } } : { fill: null }),
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

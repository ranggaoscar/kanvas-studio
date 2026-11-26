// Presentation & Business/Admin Report Engine for Kanvas Studio.
// Builds cohesive, non-monotonous multi-slide presentations and structured A4 Business/Admin
// Reports (cover, KPI + chart, paginated zebra-striped tables, conclusions/actions) — powered by
// Design Intelligence, Brand Kit, native Data Visualization, and editable PPTX/PDF export.
import { PRESET, normalisasi } from './ops.js'
import { buildArtDirection, scaleSystem, DOCUMENT_PRESETS } from './design-intelligence.js'
import { buildDataVizElement } from './dataviz.js'
import { resolveLayout } from './layout.js'

export const REPORT_RULES = {
  dimensions: DOCUMENT_PRESETS['admin-report'].dimensions,
  margins: DOCUMENT_PRESETS['admin-report'].margins,
  maxRowsFirstPage: DOCUMENT_PRESETS['admin-report'].pagination.maxTableRowsFirstPage,
  maxRowsContinuation: DOCUMENT_PRESETS['admin-report'].pagination.maxTableRowsContinuation,
  rowHeightPx: DOCUMENT_PRESETS['admin-report'].pagination.rowHeightPx,
  minFontPx: 13
}

function flatten(list, parentId = null, out = [], seq = { n: 0 }, pfx = '') {
  for (const item of list) {
    const { anak, ...rest } = item
    const id = rest.id || `${pfx ? pfx + '_' : ''}${rest.tipe === 'grup' ? 'g' : 'e'}${++seq.n}`
    const el = { ...rest, id, ...(parentId ? { induk: parentId } : {}) }
    if (el.tipe === 'teks' && el.w == null && el.lebar == null) el.lebar = 'isi'
    el.x ??= 0; el.y ??= 0
    out.push(el)
    if (Array.isArray(anak)) flatten(anak, id, out, seq, pfx)
  }
  return out
}

function hexRgb(c) {
  let s = String(c || '').trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map(x => x + x).join('')
  if (!/^[0-9a-f]{6}$/i.test(s)) return null
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16))
}

function contrastInk(bgHex) {
  const rgb = hexRgb(bgHex)
  if (!rgb) return '#FFFFFF'
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const lum = 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])
  return lum > 0.35 ? '#0F172A' : '#FFFFFF'
}

export function paginateTableRows(rows = [], { firstPageMax = REPORT_RULES.maxRowsFirstPage, nextPageMax = REPORT_RULES.maxRowsContinuation } = {}) {
  const safe = Array.isArray(rows) ? rows : []
  if (!safe.length) return [[]]
  const cap1 = Math.max(1, Number(firstPageMax) || REPORT_RULES.maxRowsFirstPage)
  const capN = Math.max(1, Number(nextPageMax) || REPORT_RULES.maxRowsContinuation)
  if (safe.length <= cap1) return [safe]
  const chunks = [safe.slice(0, cap1)]
  for (let i = cap1; i < safe.length; i += capN) chunks.push(safe.slice(i, i + capN))
  return chunks
}

function railElements(pfx, { W, H, mx, my, deckTitle, slideNum, total, palette, mono, rule }) {
  return [
    { id: `${pfx}_rf`, tipe: 'kotak', x: mx, y: H - my - 34, w: W - mx * 2, h: 1, fill: rule, radius: 0 },
    { id: `${pfx}_rt`, tipe: 'teks', x: mx, y: H - my - 22, w: Math.round((W - mx * 2) * 0.7), teks: deckTitle, font: mono, ukuran: 15, tebal: 600, kapital: true, spasi: 1.5, warna: palette.muted, lh: 1.2 },
    { id: `${pfx}_rn`, tipe: 'teks', x: W - mx - 180, y: H - my - 22, w: 180, teks: `${String(slideNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, font: mono, ukuran: 15, tebal: 700, warna: palette.muted, rata: 'kanan', lh: 1.2 }
  ]
}

function reportHeaderRail(pfx, { mx, cw, docTitle, section, palette, mono, accent, rule }) {
  const leftW = Math.round(cw * 0.62), rightW = cw - leftW - 16
  return [
    { id: `${pfx}_ht`, tipe: 'teks', x: mx, y: 56, w: leftW, teks: docTitle, font: mono, ukuran: 13, tebal: 600, kapital: true, spasi: 1.4, warna: palette.muted, lh: 1.2 },
    { id: `${pfx}_hs`, tipe: 'teks', x: mx + leftW + 16, y: 56, w: rightW, teks: section, font: mono, ukuran: 13, tebal: 700, kapital: true, spasi: 1.4, warna: accent, rata: 'kanan', lh: 1.2 },
    { id: `${pfx}_hr`, tipe: 'kotak', x: mx, y: 88, w: cw, h: 1, fill: rule, radius: 0 }
  ]
}

function reportFooterRail(pfx, { mx, cw, footerLabel, pageNum, total, palette, mono, rule }) {
  const leftW = Math.round(cw * 0.70), rightW = cw - leftW - 16
  return [
    { id: `${pfx}_fr`, tipe: 'kotak', x: mx, y: 1046, w: cw, h: 1, fill: rule, radius: 0 },
    { id: `${pfx}_fl`, tipe: 'teks', x: mx, y: 1058, w: leftW, teks: footerLabel, font: mono, ukuran: 13, tebal: 500, kapital: true, spasi: 1.2, warna: palette.muted, lh: 1.2 },
    { id: `${pfx}_fn`, tipe: 'teks', x: mx + leftW + 16, y: 1058, w: rightW, teks: `PAGE ${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, font: mono, ukuran: 13, tebal: 700, kapital: true, spasi: 1.2, warna: palette.muted, rata: 'kanan', lh: 1.2 }
  ]
}

function buildReportTable(pfx, { x, y, w, columns = [], rows = [], totalRow = null, rightAlignFrom = 1, palette, fonts, accent, rule }) {
  const cols = Array.isArray(columns) && columns.length ? columns : ['Item', 'Value']
  const n = cols.length
  const padX = 14, innerW = w - padX * 2
  const firstRatio = n === 2 ? 0.60 : n === 3 ? 0.44 : n === 4 ? 0.36 : 0.30
  const firstW = Math.round(innerW * firstRatio)
  const restW = n > 1 ? Math.floor((innerW - firstW) / (n - 1)) : innerW
  const colWidths = cols.map((_, ci) => ci === 0 ? firstW : (ci === n - 1 ? innerW - firstW - restW * (n - 2) : restW))
  const headerBg = palette.text
  const headerInk = contrastInk(headerBg)
  const zebraBg = palette.surface === palette.bg ? '#F4F6F9' : palette.surface

  const tableRows = [{
    id: `${pfx}_th`, tipe: 'grup', nama: 'Table Header', lebar: 'isi', tinggi: 'peluk', fill: headerBg, radius: 4,
    tata: { arah: 'baris', jarak: 0, padding: [12, padX, 12, padX], rata: 'tengah' },
    anak: cols.map((c, ci) => ({
      tipe: 'teks', nama: `H${ci + 1}`, w: colWidths[ci], teks: String(c),
      font: fonts.mono, ukuran: 13, tebal: 700, kapital: true, spasi: 0.8, warna: headerInk,
      rata: ci >= rightAlignFrom ? 'kanan' : 'kiri', lh: 1.2
    }))
  }]

  rows.forEach((row, ri) => {
    const cells = Array.isArray(row) ? row : cols.map(c => row?.[c] ?? '')
    tableRows.push({
      id: `${pfx}_r${ri + 1}`, tipe: 'grup', nama: `Row ${ri + 1}`, lebar: 'isi', tinggi: 'peluk',
      fill: ri % 2 === 1 ? zebraBg : palette.bg, radius: 0,
      garis: { tebal: 1, warna: rule },
      tata: { arah: 'baris', jarak: 0, padding: [11, padX, 11, padX], rata: 'tengah' },
      anak: cols.map((_, ci) => ({
        tipe: 'teks', nama: `R${ri + 1}C${ci + 1}`, w: colWidths[ci], teks: String(cells[ci] ?? ''),
        font: ci >= rightAlignFrom ? fonts.mono : fonts.body, ukuran: 14, tebal: ci === 0 ? 600 : 500,
        warna: palette.text, rata: ci >= rightAlignFrom ? 'kanan' : 'kiri', lh: 1.25
      }))
    })
  })

  if (Array.isArray(totalRow) && totalRow.length) {
    tableRows.push({ id: `${pfx}_tsep`, tipe: 'kotak', lebar: 'isi', h: 2, fill: palette.text, radius: 0 })
    tableRows.push({
      id: `${pfx}_tot`, tipe: 'grup', nama: 'Total Row', lebar: 'isi', tinggi: 'peluk',
      fill: zebraBg, radius: 4,
      tata: { arah: 'baris', jarak: 0, padding: [12, padX, 12, padX], rata: 'tengah' },
      anak: cols.map((_, ci) => ({
        tipe: 'teks', nama: `T${ci + 1}`, w: colWidths[ci], teks: String(totalRow[ci] ?? ''),
        font: ci >= rightAlignFrom ? fonts.mono : fonts.body, ukuran: 14, tebal: 700,
        warna: ci === n - 1 ? accent : palette.text, rata: ci >= rightAlignFrom ? 'kanan' : 'kiri', lh: 1.25
      }))
    })
  }

  return {
    id: `${pfx}_tbl`, tipe: 'grup', nama: 'Data Table', x, y, w, tinggi: 'peluk', fill: null,
    tata: { arah: 'kolom', jarak: 0, padding: 0, rata: 'regang' },
    anak: tableRows
  }
}

export function buildAdminReportDoc({
  judul = 'Executive Business Report',
  subtitle = '',
  organization = 'Operations & Finance',
  period = '',
  author = '',
  date = '',
  docId = '',
  confidentiality = 'INTERNAL',
  pages = [],
  style = 'corporate-premium',
  brand = null
} = {}) {
  if (!Array.isArray(pages) || !pages.length) {
    throw new Error('Admin report requires a non-empty "pages" array.')
  }
  const W = REPORT_RULES.dimensions.w, H = REPORT_RULES.dimensions.h
  const mx = REPORT_RULES.margins.x, cw = REPORT_RULES.margins.contentW
  const effectiveStyle = ['corporate-premium', 'swiss-editorial'].includes(style) ? style : 'corporate-premium'
  const ad = buildArtDirection({ brief: `${judul} ${subtitle} admin report`, style: effectiveStyle, format: 'a4', w: W, h: H, brand })
  const basePal = ad.palette
  // Ensure clean editorial contrast between canvas (#FFFFFF) and tinted surface (#F4F6F9) when default light palette is used
  const palette = brand?.colors
    ? basePal
    : { ...basePal, bg: '#FFFFFF', surface: '#F4F6F9', text: '#0F172A', muted: '#475569', accent: basePal.accent || '#0B5D56', rule: '#DCE3EC' }
  const fonts = ad.fonts[0]
  const accent = palette.accent || '#0B5D56'
  const rule = palette.rule || '#DCE3EC'
  const logoSrc = brand?.logos?.[0]?.src || null

  // Pre-expand paginated data-table pages so Page XX / NN numbering is exact
  const expanded = []
  for (const pg of pages) {
    const rawType = String(pg.type || 'notes-summary').toLowerCase()
    const isTable = rawType === 'data-table' || rawType === 'table'
    const tbl = pg.table || (pg.columns ? { columns: pg.columns, rows: pg.rows, totalRow: pg.totalRow, rightAlignFrom: pg.rightAlignFrom } : null)
    if (isTable && tbl && Array.isArray(tbl.rows) && tbl.rows.length > (pg.maxRowsFirstPage || REPORT_RULES.maxRowsFirstPage)) {
      const chunks = paginateTableRows(tbl.rows, {
        firstPageMax: pg.maxRowsFirstPage || REPORT_RULES.maxRowsFirstPage,
        nextPageMax: pg.maxRowsContinuation || REPORT_RULES.maxRowsContinuation
      })
      chunks.forEach((chunk, ci) => {
        const isLast = ci === chunks.length - 1
        expanded.push({
          ...pg,
          type: 'data-table',
          isContinuation: ci > 0,
          heading: ci > 0 ? `${pg.heading || 'Data Breakdown'} (cont.)` : (pg.heading || 'Data Breakdown'),
          table: { ...tbl, rows: chunk, totalRow: isLast ? tbl.totalRow : null },
          footnote: isLast ? pg.footnote : `Continued on next page (${chunk.length} rows shown).`
        })
      })
    } else {
      expanded.push({ ...pg, type: rawType, ...(tbl ? { table: tbl } : {}) })
    }
  }

  const total = expanded.length
  const footerLabel = [organization, confidentiality].filter(Boolean).join('  ·  ')
  const artboards = []

  expanded.forEach((pg, idx) => {
    const pfx = `p${idx + 1}`
    const type = pg.type
    const els = []

    if (type === 'cover' || type === 'report-cover') {
      if (logoSrc) els.push({ id: `${pfx}_logo`, tipe: 'gambar', x: mx, y: 52, w: 56, h: 56, src: logoSrc, fit: 'contain' })
      els.push({ id: `${pfx}_org`, tipe: 'teks', x: logoSrc ? mx + 72 : mx, y: 64, w: Math.round(cw * 0.58), teks: String(pg.eyebrow || organization), font: fonts.mono, ukuran: 13, tebal: 700, kapital: true, spasi: 2, warna: accent, lh: 1.2 })
      if (pg.period || period) {
        els.push({ id: `${pfx}_per`, tipe: 'teks', x: mx + Math.round(cw * 0.64), y: 64, w: Math.round(cw * 0.36), teks: String(pg.period || period), font: fonts.mono, ukuran: 13, tebal: 600, kapital: true, spasi: 1.4, warna: palette.muted, rata: 'kanan', lh: 1.2 })
      }
      els.push({ id: `${pfx}_bar`, tipe: 'kotak', x: mx, y: 120, w: 72, h: 4, fill: accent, radius: 0 })
      els.push({ id: `${pfx}_t`, tipe: 'teks', x: mx, y: 184, w: cw, teks: String(pg.heading || judul), font: fonts.display, ukuran: 48, tebal: 700, warna: palette.text, lh: 1.08, spasi: -1 })
      if (pg.body || subtitle) {
        els.push({ id: `${pfx}_sub`, tipe: 'teks', x: mx, y: 344, w: Math.round(cw * 0.88), teks: String(pg.body || subtitle), font: fonts.body, ukuran: 18, tebal: 400, warna: palette.muted, lh: 1.5 })
      }
      const highlights = Array.isArray(pg.highlights || pg.metrics) ? (pg.highlights || pg.metrics).slice(0, 3) : []
      if (highlights.length) {
        els.push({
          id: `${pfx}_snap`, tipe: 'grup', nama: 'Executive Snapshot', x: mx, y: 520, w: cw, tinggi: 'peluk', fill: null,
          tata: { arah: 'baris', jarak: 16, padding: 0, rata: 'regang' },
          anak: highlights.map((m, mi) => ({
            tipe: 'grup', nama: `Highlight ${mi + 1}`, lebar: 'isi', tinggi: 'peluk',
            fill: palette.surface, radius: 6, garis: { tebal: 1, warna: mi === 0 ? accent : rule },
            tata: { arah: 'kolom', jarak: 8, padding: 20, rata: 'regang' },
            anak: [
              { tipe: 'teks', teks: String(m.label || ''), font: fonts.mono, ukuran: 13, tebal: 600, kapital: true, spasi: 1.2, warna: palette.muted, lh: 1.2 },
              { tipe: 'teks', teks: String(m.value || ''), font: fonts.display, ukuran: 34, tebal: 700, warna: mi === 0 ? accent : palette.text, lh: 1.05 },
              ...(m.detail ? [{ tipe: 'teks', teks: String(m.detail), font: fonts.body, ukuran: 13, tebal: 500, warna: palette.muted, lh: 1.3 }] : [])
            ]
          }))
        })
      }
      els.push({ id: `${pfx}_mrule`, tipe: 'kotak', x: mx, y: 956, w: cw, h: 1, fill: rule, radius: 0 })
      const metaItems = [
        { k: 'PREPARED BY', v: pg.author || author || organization },
        { k: 'REPORT PERIOD', v: pg.date || date || period || 'Current Cycle' },
        { k: 'DOCUMENT ID', v: pg.docId || docId || `${confidentiality} · A4` }
      ]
      els.push({
        id: `${pfx}_meta`, tipe: 'grup', nama: 'Cover Metadata', x: mx, y: 976, w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'baris', jarak: 20, padding: 0, rata: 'awal' },
        anak: metaItems.map(mi => ({
          tipe: 'grup', lebar: 'isi', tinggi: 'peluk', fill: null,
          tata: { arah: 'kolom', jarak: 4, padding: 0, rata: 'regang' },
          anak: [
            { tipe: 'teks', teks: mi.k, font: fonts.mono, ukuran: 13, tebal: 600, kapital: true, spasi: 1.2, warna: palette.muted, lh: 1.2 },
            { tipe: 'teks', teks: String(mi.v), font: fonts.body, ukuran: 14, tebal: 600, warna: palette.text, lh: 1.3 }
          ]
        }))
      })
    } else if (type === 'kpi-summary' || type === 'kpi-chart' || type === 'stats' || type === 'chart') {
      els.push(...reportHeaderRail(pfx, { mx, cw, docTitle: judul, section: pg.section || '01 / KPI SUMMARY', palette, mono: fonts.mono, accent, rule }))
      els.push({
        id: `${pfx}_hdr`, tipe: 'grup', nama: 'Page Heading', x: mx, y: 112, w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'kolom', jarak: 8, padding: 0, rata: 'regang' },
        anak: [
          { id: `${pfx}_hd`, tipe: 'teks', teks: String(pg.heading || 'Executive KPI Summary'), font: fonts.display, ukuran: 28, tebal: 700, warna: palette.text, lh: 1.15, spasi: -0.5 },
          ...(pg.subtitle ? [{ id: `${pfx}_sub`, tipe: 'teks', teks: String(pg.subtitle), font: fonts.body, ukuran: 14, tebal: 400, warna: palette.muted, lh: 1.4 }] : [])
        ]
      })
      const metrics = Array.isArray(pg.metrics) ? pg.metrics.slice(0, 4) : []
      let nextY = pg.subtitle ? 220 : 196
      if (metrics.length) {
        els.push({
          id: `${pfx}_kpis`, tipe: 'grup', nama: 'KPI Row', x: mx, y: nextY, w: cw, tinggi: 'peluk', fill: null,
          tata: { arah: 'baris', jarak: 16, padding: 0, rata: 'regang' },
          anak: metrics.map((m, mi) => ({
            tipe: 'grup', nama: `KPI ${mi + 1}`, lebar: 'isi', tinggi: 'peluk',
            fill: palette.surface, radius: 6, garis: { tebal: 1, warna: mi === 0 ? accent : rule },
            tata: { arah: 'kolom', jarak: 8, padding: 18, rata: 'regang' },
            anak: [
              { tipe: 'teks', teks: String(m.label || ''), font: fonts.mono, ukuran: 13, tebal: 600, kapital: true, spasi: 1, warna: palette.muted, lh: 1.2 },
              { tipe: 'teks', teks: String(m.value || ''), font: fonts.display, ukuran: 34, tebal: 700, warna: mi === 0 ? accent : palette.text, lh: 1.05 },
              ...(m.detail ? [{ tipe: 'teks', teks: String(m.detail), font: fonts.mono, ukuran: 13, tebal: 600, warna: mi === 0 ? accent : palette.muted, lh: 1.25 }] : [])
            ]
          }))
        })
        nextY += 164
      }
      if (pg.chart) {
        const vizTheme = {
          bg: palette.bg, surface: palette.surface, text: palette.text, muted: palette.muted, rule, accent,
          displayFont: fonts.display, bodyFont: fonts.body, monoFont: fonts.mono, ...(pg.chart.theme || {})
        }
        const chartH = pg.bullets?.length || pg.body ? 356 : 480
        els.push(buildDataVizElement({ showCard: true, ...pg.chart, theme: vizTheme, x: mx, y: nextY, w: cw, h: chartH }, { abBg: palette.bg, brand }))
        nextY += chartH + 24
      }
      const notes = Array.isArray(pg.bullets) ? pg.bullets.slice(0, 3) : []
      if (pg.body || notes.length) {
        const noteKids = [{ tipe: 'teks', teks: String(pg.takeawayTitle || 'EXECUTIVE TAKEAWAYS'), font: fonts.mono, ukuran: 13, tebal: 700, kapital: true, spasi: 1.5, warna: accent, lh: 1.2 }]
        if (pg.body) noteKids.push({ tipe: 'teks', teks: String(pg.body), font: fonts.body, ukuran: 14, tebal: 500, warna: palette.text, lh: 1.45 })
        for (const b of notes) noteKids.push({ tipe: 'teks', teks: `—  ${b}`, font: fonts.body, ukuran: 14, tebal: 400, warna: palette.muted, lh: 1.4 })
        els.push({
          id: `${pfx}_tk`, tipe: 'grup', nama: 'Key Takeaways', x: mx, y: Math.min(nextY, 804), w: cw, tinggi: 'peluk',
          fill: palette.surface, radius: 6, garis: { tebal: 1, warna: rule },
          tata: { arah: 'kolom', jarak: 10, padding: 20, rata: 'regang' },
          anak: noteKids
        })
      }
      els.push(...reportFooterRail(pfx, { mx, cw, footerLabel, pageNum: idx + 1, total, palette, mono: fonts.mono, rule }))
    } else if (type === 'data-table' || type === 'table') {
      els.push(...reportHeaderRail(pfx, { mx, cw, docTitle: judul, section: pg.section || '02 / DATA TABLE', palette, mono: fonts.mono, accent, rule }))
      els.push({
        id: `${pfx}_hdr`, tipe: 'grup', nama: 'Page Heading', x: mx, y: 112, w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'kolom', jarak: 8, padding: 0, rata: 'regang' },
        anak: [
          { id: `${pfx}_hd`, tipe: 'teks', teks: String(pg.heading || 'Structured Data Breakdown'), font: fonts.display, ukuran: 28, tebal: 700, warna: palette.text, lh: 1.15, spasi: -0.5 },
          ...(pg.subtitle && !pg.isContinuation ? [{ id: `${pfx}_sub`, tipe: 'teks', teks: String(pg.subtitle), font: fonts.body, ukuran: 14, tebal: 400, warna: palette.muted, lh: 1.35 }] : [])
        ]
      })
      const tbl = pg.table || { columns: ['Metric', 'Value'], rows: [] }
      const tableY = pg.subtitle && !pg.isContinuation ? 220 : 196
      els.push(buildReportTable(pfx, {
        x: mx, y: tableY, w: cw,
        columns: tbl.columns, rows: tbl.rows || [], totalRow: tbl.totalRow || null,
        rightAlignFrom: tbl.rightAlignFrom ?? 1, palette, fonts, accent, rule
      }))
      if (pg.footnote) {
        els.push({
          id: `${pfx}_fnbox`, tipe: 'grup', nama: 'Audit Footnote', x: mx, y: 944, w: cw, tinggi: 'peluk',
          fill: palette.surface, radius: 6, garis: { tebal: 1, warna: rule },
          tata: { arah: 'kolom', jarak: 6, padding: [14, 18, 14, 18], rata: 'regang' },
          anak: [
            { tipe: 'teks', teks: 'NOTES & METHODOLOGY', font: fonts.mono, ukuran: 13, tebal: 700, kapital: true, spasi: 1.3, warna: accent, lh: 1.2 },
            { tipe: 'teks', teks: String(pg.footnote), font: fonts.body, ukuran: 13, tebal: 400, warna: palette.muted, lh: 1.4 }
          ]
        })
      }
      els.push(...reportFooterRail(pfx, { mx, cw, footerLabel, pageNum: idx + 1, total, palette, mono: fonts.mono, rule }))
    } else {
      // notes-summary / conclusions / actions
      els.push(...reportHeaderRail(pfx, { mx, cw, docTitle: judul, section: pg.section || '03 / CONCLUSIONS', palette, mono: fonts.mono, accent, rule }))
      els.push({
        id: `${pfx}_hdr`, tipe: 'grup', nama: 'Page Heading', x: mx, y: 112, w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'kolom', jarak: 8, padding: 0, rata: 'regang' },
        anak: [
          { id: `${pfx}_hd`, tipe: 'teks', teks: String(pg.heading || 'Key Conclusions & Action Plan'), font: fonts.display, ukuran: 28, tebal: 700, warna: palette.text, lh: 1.15, spasi: -0.5 },
          ...(pg.body ? [{ id: `${pfx}_lead`, tipe: 'teks', teks: String(pg.body), font: fonts.body, ukuran: 15, tebal: 400, warna: palette.muted, lh: 1.45 }] : [])
        ]
      })
      const findings = Array.isArray(pg.findings || pg.bullets) ? (pg.findings || pg.bullets).slice(0, 4) : []
      let curY = pg.body ? 236 : 200
      if (findings.length) {
        els.push({
          id: `${pfx}_fnd`, tipe: 'grup', nama: 'Key Findings', x: mx, y: curY, w: cw, tinggi: 'peluk', fill: null,
          tata: { arah: 'kolom', jarak: 12, padding: 0, rata: 'regang' },
          anak: findings.map((f, fi) => {
            const title = typeof f === 'string' ? f : String(f.title || '')
            const detail = typeof f === 'object' && f?.detail ? String(f.detail) : ''
            return {
              tipe: 'grup', lebar: 'isi', tinggi: 'peluk', fill: palette.surface, radius: 6, garis: { tebal: 1, warna: rule },
              tata: { arah: 'baris', jarak: 16, padding: [14, 18, 14, 18], rata: 'awal' },
              anak: [
                { tipe: 'teks', w: 34, teks: String(fi + 1).padStart(2, '0'), font: fonts.mono, ukuran: 16, tebal: 700, warna: accent, lh: 1.2 },
                {
                  tipe: 'grup', lebar: 'isi', tinggi: 'peluk', fill: null,
                  tata: { arah: 'kolom', jarak: 4, padding: 0, rata: 'regang' },
                  anak: [
                    { tipe: 'teks', teks: title, font: fonts.body, ukuran: 15, tebal: 700, warna: palette.text, lh: 1.3 },
                    ...(detail ? [{ tipe: 'teks', teks: detail, font: fonts.body, ukuran: 14, tebal: 400, warna: palette.muted, lh: 1.4 }] : [])
                  ]
                }
              ]
            }
          })
        })
        curY += findings.length * 88 + 20
      }
      const actions = Array.isArray(pg.actions) ? pg.actions.slice(0, 5) : []
      if (actions.length) {
        els.push({ id: `${pfx}_act_lbl`, tipe: 'teks', x: mx, y: Math.min(curY, 580), w: cw, teks: 'NEXT-CYCLE ACTION PLAN', font: fonts.mono, ukuran: 13, tebal: 700, kapital: true, spasi: 1.5, warna: accent, lh: 1.2 })
        els.push(buildReportTable(`${pfx}_act`, {
          x: mx, y: Math.min(curY + 26, 606), w: cw,
          columns: ['Initiative', 'Owner', 'Target', 'Status'],
          rows: actions.map(a => Array.isArray(a) ? a : [a.action || a.title || '', a.owner || '', a.due || a.target || '', a.status || 'Planned']),
          rightAlignFrom: 2, palette, fonts, accent, rule
        }))
      }
      const signoff = Array.isArray(pg.signoff) && pg.signoff.length ? pg.signoff.slice(0, 3) : [
        { role: 'PREPARED BY', name: author || organization },
        { role: 'CLASSIFICATION', name: confidentiality },
        { role: 'DATE', name: date || period || '2026' }
      ]
      els.push({
        id: `${pfx}_sign`, tipe: 'grup', nama: 'Sign-Off Strip', x: mx, y: 944, w: cw, tinggi: 'peluk',
        fill: palette.surface, radius: 6, garis: { tebal: 1, warna: rule },
        tata: { arah: 'baris', jarak: 16, padding: [14, 18, 14, 18], rata: 'awal' },
        anak: signoff.map(s => ({
          tipe: 'grup', lebar: 'isi', tinggi: 'peluk', fill: null,
          tata: { arah: 'kolom', jarak: 4, padding: 0, rata: 'regang' },
          anak: [
            { tipe: 'teks', teks: String(s.role || ''), font: fonts.mono, ukuran: 13, tebal: 600, kapital: true, spasi: 1, warna: palette.muted, lh: 1.2 },
            { tipe: 'teks', teks: String(s.name || ''), font: fonts.body, ukuran: 14, tebal: 600, warna: palette.text, lh: 1.25 }
          ]
        }))
      })
      els.push(...reportFooterRail(pfx, { mx, cw, footerLabel, pageNum: idx + 1, total, palette, mono: fonts.mono, rule }))
    }

    artboards.push({
      id: `a${idx + 1}`,
      nama: String(pg.name || pg.heading || `Page ${idx + 1}`).slice(0, 48),
      x: idx * (W + 120),
      y: 0,
      w: W,
      h: H,
      bg: palette.bg,
      ...(pg.notes ? { catatan: String(pg.notes) } : {}),
      elemen: flatten(els, null, [], { n: 0 }, pfx)
    })
  })

  const doc = normalisasi({
    versi: 1,
    judul,
    ...(brand ? { brand: brand.id } : {}),
    artboards
  })
  resolveLayout(doc)
  return { doc, direction: ad.direction, preset: 'admin-report', pageCount: artboards.length, slideCount: artboards.length }
}

export function buildPresentationDoc({
  judul = 'Presentation',
  subtitle = '',
  author = '',
  date = '',
  slides = [],
  style = '',
  brand = null,
  ukuran = 'slide',
  preset = '',
  organization = '',
  period = '',
  docId = '',
  confidentiality = 'INTERNAL'
} = {}) {
  if (!Array.isArray(slides) || !slides.length) {
    throw new Error('Presentation requires a non-empty "slides" array.')
  }
  const fmt = String(ukuran || 'slide').toLowerCase()
  const pre = String(preset || '').toLowerCase()
  if (pre === 'admin-report' || pre === 'business-report' || fmt === 'a4' || fmt === 'admin-report') {
    return buildAdminReportDoc({
      judul, subtitle, organization: organization || author || 'Operations & Finance',
      period, author, date, docId, confidentiality, pages: slides, style: style || 'corporate-premium', brand
    })
  }
  const [W, H] = PRESET[fmt] || [1920, 1080]
  const ad = buildArtDirection({ brief: `${judul} ${subtitle} presentation deck`, style, format: ukuran, w: W, h: H, brand })
  const palette = ad.palette
  const fonts = ad.fonts[0]
  const accent = palette.accent || palette.primary || '#E03E2D'
  const rule = palette.rule || palette.muted || '#CBD5E1'
  const radius = brand?.style?.radius ?? (ad.direction === 'brutalism' ? 0 : ad.direction === 'swiss-editorial' || ad.direction === 'luxury-minimalism' ? 4 : 14)
  const strokeW = brand?.style?.strokeWidth ?? (ad.direction === 'brutalism' ? 3.5 : 1)
  const grid = scaleSystem(W, H, ad.direction === 'luxury-minimalism' ? 0.095 : 0.07)
  const mx = grid.margins.x, my = grid.margins.y, cw = grid.margins.contentW
  const logoSrc = brand?.logos?.[0]?.src || null

  const total = slides.length
  const artboards = []

  slides.forEach((sl, idx) => {
    const pfx = `s${idx + 1}`
    const type = String(sl.type || (idx === 0 ? 'cover' : 'narrative')).toLowerCase()
    const els = []
    const contentTop = my + 16
    const bodyTop = my + 178
    const bodyBottom = H - my - 56
    const bodyH = Math.max(260, bodyBottom - bodyTop)

    const pushHeader = () => {
      if (sl.eyebrow) {
        els.push({ id: `${pfx}_ey`, tipe: 'teks', x: mx, y: contentTop, w: cw - 120, teks: String(sl.eyebrow), font: fonts.mono, ukuran: 18, tebal: 700, kapital: true, spasi: 2.5, warna: accent, lh: 1.2 })
      }
      if (sl.heading) {
        els.push({ id: `${pfx}_hd`, tipe: 'teks', x: mx, y: contentTop + (sl.eyebrow ? 34 : 0), w: cw, teks: String(sl.heading), font: fonts.display, ukuran: 56, tebal: 800, warna: palette.text, lh: 1.08, spasi: -1.5 })
      }
      els.push({ id: `${pfx}_hr`, tipe: 'kotak', x: mx, y: bodyTop - 22, w: 96, h: 4, fill: accent, radius: 0 })
    }

    if (type === 'cover') {
      if (logoSrc) els.push({ id: `${pfx}_logo`, tipe: 'gambar', x: mx, y: my, w: 88, h: 88, src: logoSrc, fit: 'contain' })
      if (sl.eyebrow) els.push({ id: `${pfx}_ey`, tipe: 'teks', x: mx, y: logoSrc ? my + 120 : my + 32, w: Math.round(cw * 0.75), teks: String(sl.eyebrow), font: fonts.mono, ukuran: 20, tebal: 700, kapital: true, spasi: 3, warna: accent, lh: 1.2 })
      els.push({ id: `${pfx}_t`, tipe: 'teks', x: mx, y: Math.round(H * 0.30), w: Math.round(cw * 0.82), teks: String(sl.heading || judul), font: fonts.display, ukuran: 96, tebal: 800, warna: palette.text, lh: 1.0, spasi: -2.5 })
      if (sl.body || subtitle) {
        els.push({ id: `${pfx}_sub`, tipe: 'teks', x: mx, y: Math.round(H * 0.58), w: Math.round(cw * 0.65), teks: String(sl.body || subtitle), font: fonts.body, ukuran: 32, tebal: 400, warna: palette.muted, lh: 1.45 })
      }
      const meta = [sl.author || author, sl.date || date].filter(Boolean).join('  ·  ')
      if (meta) {
        els.push({ id: `${pfx}_rule`, tipe: 'kotak', x: mx, y: H - my - 72, w: cw, h: 1, fill: rule, radius: 0 })
        els.push({ id: `${pfx}_meta`, tipe: 'teks', x: mx, y: H - my - 48, w: cw, teks: meta, font: fonts.mono, ukuran: 18, tebal: 600, warna: palette.muted, lh: 1.2 })
      }
    } else if (type === 'stats') {
      pushHeader()
      const metrics = Array.isArray(sl.metrics) && sl.metrics.length ? sl.metrics.slice(0, 4) : [{ value: '—', label: 'Metric' }]
      els.push({
        id: `${pfx}_row`, tipe: 'grup', nama: 'Metrics Row', x: mx, y: bodyTop + 20, w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'baris', jarak: 28, padding: 0, rata: 'regang' },
        anak: metrics.map((m, mi) => ({
          tipe: 'grup', nama: `Metric ${mi + 1}`, lebar: 'isi', tinggi: 'peluk',
          fill: palette.surface, radius, garis: { tebal: strokeW, warna: mi === 0 ? accent : rule },
          tata: { arah: 'kolom', jarak: 14, padding: 36, rata: 'regang' },
          anak: [
            { tipe: 'teks', teks: String(m.value ?? ''), font: fonts.display, ukuran: 84, tebal: 800, warna: mi === 0 ? accent : palette.text, lh: 1.0 },
            { tipe: 'teks', teks: String(m.label ?? ''), font: fonts.body, ukuran: 24, tebal: 700, warna: palette.text, lh: 1.25 },
            ...(m.detail ? [{ tipe: 'teks', teks: String(m.detail), font: fonts.body, ukuran: 19, tebal: 400, warna: palette.muted, lh: 1.4 }] : [])
          ]
        }))
      })
      if (sl.body) {
        els.push({ id: `${pfx}_note`, tipe: 'teks', x: mx, y: bodyBottom - 76, w: cw, teks: String(sl.body), font: fonts.body, ukuran: 22, tebal: 400, warna: palette.muted, lh: 1.4 })
      }
    } else if (type === 'chart' && sl.chart) {
      pushHeader()
      const hasNote = Boolean(sl.body || (Array.isArray(sl.bullets) && sl.bullets.length))
      const vizW = hasNote ? Math.round(cw * 0.68) : cw
      const vizTheme = { displayFont: fonts.display, bodyFont: fonts.body, monoFont: fonts.mono, ...(sl.chart.theme || {}) }
      const vizEl = buildDataVizElement({ ...sl.chart, theme: vizTheme, x: mx, y: bodyTop + 12, w: vizW, h: bodyH - 24 }, { abBg: palette.bg, brand })
      els.push(vizEl)
      if (hasNote) {
        const rx = mx + vizW + 40, rw = cw - vizW - 40
        const noteKids = [
          { tipe: 'teks', teks: 'KEY TAKEAWAYS', font: fonts.mono, ukuran: 16, tebal: 700, kapital: true, spasi: 2, warna: accent, lh: 1.2 }
        ]
        if (sl.body) noteKids.push({ tipe: 'teks', teks: String(sl.body), font: fonts.body, ukuran: 22, tebal: 500, warna: palette.text, lh: 1.45 })
        for (const b of (sl.bullets || []).slice(0, 4)) {
          noteKids.push({ tipe: 'teks', teks: `— ${b}`, font: fonts.body, ukuran: 20, tebal: 400, warna: palette.muted, lh: 1.4 })
        }
        els.push({
          id: `${pfx}_tk`, tipe: 'grup', nama: 'Key Takeaways', x: rx, y: bodyTop + 12, w: rw, tinggi: 'peluk',
          fill: palette.surface, radius, garis: { tebal: strokeW, warna: rule },
          tata: { arah: 'kolom', jarak: 16, padding: 30, rata: 'regang' },
          anak: noteKids
        })
      }
    } else if (type === 'table' && sl.table) {
      pushHeader()
      els.push(buildDataVizElement({ type: 'table', ...sl.table, x: mx, y: bodyTop + 16, w: cw }, { abBg: palette.bg, brand }))
    } else if ((type === 'timeline' || type === 'diagram') && (sl.nodes || sl.steps)) {
      pushHeader()
      const nodes = (sl.nodes || sl.steps).map((s, i) => typeof s === 'string' ? { badge: String(i + 1).padStart(2, '0'), title: s } : s)
      els.push(buildDataVizElement({ type: 'diagram', nodes, direction: sl.direction || 'horizontal', x: mx, y: bodyTop + 28, w: cw, h: Math.min(420, bodyH - 40) }, { abBg: palette.bg, brand }))
    } else if (type === 'split') {
      pushHeader()
      const leftW = Math.round(cw * 0.54), rightX = mx + leftW + 48, rightW = cw - leftW - 48
      const leftKids = []
      if (sl.body) leftKids.push({ tipe: 'teks', teks: String(sl.body), font: fonts.body, ukuran: 28, tebal: 400, warna: palette.text, lh: 1.45 })
      for (const b of (sl.bullets || []).slice(0, 5)) {
        leftKids.push({ tipe: 'teks', teks: `•  ${b}`, font: fonts.body, ukuran: 24, tebal: 500, warna: palette.muted, lh: 1.4 })
      }
      els.push({
        id: `${pfx}_l`, tipe: 'grup', x: mx, y: bodyTop + 16, w: leftW, tinggi: 'peluk', fill: null,
        tata: { arah: 'kolom', jarak: 20, padding: 0, rata: 'regang' },
        anak: leftKids.length ? leftKids : [{ tipe: 'teks', teks: '', font: fonts.body, ukuran: 24, warna: palette.text }]
      })
      if (sl.imageSrc) {
        els.push({ id: `${pfx}_img`, tipe: 'gambar', x: rightX, y: bodyTop + 16, w: rightW, h: bodyH - 36, src: sl.imageSrc, fit: 'cover', radius })
      } else {
        els.push({
          id: `${pfx}_r`, tipe: 'grup', nama: 'Highlight Card', x: rightX, y: bodyTop + 16, w: rightW, h: Math.min(460, bodyH - 36),
          fill: palette.surface, radius, garis: { tebal: strokeW, warna: rule },
          tata: { arah: 'kolom', jarak: 16, padding: 36, rata: 'regang', sebar: 'tengah' },
          anak: [
            { tipe: 'teks', teks: String(sl.calloutTitle || sl.eyebrow || 'HIGHLIGHT'), font: fonts.mono, ukuran: 18, tebal: 700, kapital: true, spasi: 2, warna: accent, lh: 1.2 },
            { tipe: 'teks', teks: String(sl.callout || sl.quote || 'Key evidence or visual focus'), font: fonts.display, ukuran: 34, tebal: 700, warna: palette.text, lh: 1.22 }
          ]
        })
      }
    } else if (type === 'quote') {
      els.push({ id: `${pfx}_qm`, tipe: 'teks', x: mx, y: Math.round(H * 0.20), w: 120, teks: '“', font: fonts.display, ukuran: 140, tebal: 800, warna: accent, lh: 0.9 })
      els.push({ id: `${pfx}_qt`, tipe: 'teks', x: mx, y: Math.round(H * 0.34), w: Math.round(cw * 0.86), teks: String(sl.quote || sl.heading || ''), font: fonts.display, ukuran: 54, tebal: 700, warna: palette.text, lh: 1.2 })
      if (sl.author) {
        els.push({ id: `${pfx}_qa`, tipe: 'teks', x: mx, y: Math.round(H * 0.72), w: cw, teks: `— ${sl.author}`, font: fonts.mono, ukuran: 22, tebal: 600, warna: palette.muted, lh: 1.3 })
      }
    } else if (type === 'closing') {
      if (logoSrc) els.push({ id: `${pfx}_logo`, tipe: 'gambar', x: mx, y: my + 24, w: 92, h: 92, src: logoSrc, fit: 'contain' })
      els.push({ id: `${pfx}_ch`, tipe: 'teks', x: mx, y: Math.round(H * 0.34), w: cw, teks: String(sl.heading || 'Thank you'), font: fonts.display, ukuran: 92, tebal: 800, warna: palette.text, lh: 1.02, spasi: -2 })
      if (sl.body) els.push({ id: `${pfx}_cb`, tipe: 'teks', x: mx, y: Math.round(H * 0.56), w: Math.round(cw * 0.7), teks: String(sl.body), font: fonts.body, ukuran: 30, tebal: 400, warna: palette.muted, lh: 1.45 })
      if (sl.contact || author) els.push({ id: `${pfx}_cc`, tipe: 'teks', x: mx, y: H - my - 80, w: cw, teks: String(sl.contact || author), font: fonts.mono, ukuran: 20, tebal: 600, warna: accent, lh: 1.3 })
    } else {
      pushHeader()
      const items = Array.isArray(sl.bullets) ? sl.bullets : []
      if (type === 'agenda' && items.length) {
        els.push({
          id: `${pfx}_ag`, tipe: 'grup', x: mx, y: bodyTop + 20, w: cw, tinggi: 'peluk', fill: null,
          tata: { arah: 'kolom', jarak: 16, padding: 0, rata: 'regang' },
          anak: items.slice(0, 6).map((item, ii) => ({
            tipe: 'grup', lebar: 'isi', tinggi: 'peluk', fill: palette.surface, radius, garis: { tebal: strokeW, warna: rule },
            tata: { arah: 'baris', jarak: 24, padding: [20, 28, 20, 28], rata: 'tengah' },
            anak: [
              { tipe: 'teks', w: 60, teks: String(ii + 1).padStart(2, '0'), font: fonts.mono, ukuran: 24, tebal: 700, warna: accent, lh: 1.2 },
              { tipe: 'teks', lebar: 'isi', teks: String(item), font: fonts.display, ukuran: 28, tebal: 700, warna: palette.text, lh: 1.2 }
            ]
          }))
        })
      } else {
        const stackKids = []
        if (sl.body) stackKids.push({ tipe: 'teks', teks: String(sl.body), font: fonts.body, ukuran: 30, tebal: 400, warna: palette.text, lh: 1.48 })
        for (const b of items.slice(0, 6)) {
          stackKids.push({ tipe: 'teks', teks: `—  ${b}`, font: fonts.body, ukuran: 25, tebal: 500, warna: palette.muted, lh: 1.4 })
        }
        els.push({
          id: `${pfx}_nar`, tipe: 'grup', x: mx, y: bodyTop + 20, w: Math.round(cw * 0.85), tinggi: 'peluk', fill: null,
          tata: { arah: 'kolom', jarak: 20, padding: 0, rata: 'regang' },
          anak: stackKids.length ? stackKids : [{ tipe: 'teks', teks: '', font: fonts.body, ukuran: 26, warna: palette.text }]
        })
      }
    }

    if (type !== 'cover' && type !== 'closing') {
      els.push(...railElements(pfx, { W, H, mx, my, deckTitle: judul, slideNum: idx + 1, total, palette, mono: fonts.mono, rule }))
    }

    artboards.push({
      id: `a${idx + 1}`,
      nama: String(sl.name || sl.heading || `Slide ${idx + 1}`).slice(0, 48),
      x: idx * (W + 160),
      y: 0,
      w: W,
      h: H,
      bg: palette.bg,
      ...(sl.notes ? { catatan: String(sl.notes) } : {}),
      elemen: flatten(els, null, [], { n: 0 }, pfx)
    })
  })

  const doc = normalisasi({
    versi: 1,
    judul,
    ...(brand ? { brand: brand.id } : {}),
    artboards
  })
  resolveLayout(doc)
  return { doc, direction: ad.direction, slideCount: artboards.length }
}

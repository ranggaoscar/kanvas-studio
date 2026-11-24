// Presentation Engine for Kanvas Studio (P1).
// Builds cohesive, non-monotonous multi-slide presentations from structured research,
// outlines, metrics, charts, tables, and diagrams — powered by Design Intelligence,
// Brand Kit, native Data Visualization, and editable PowerPoint (.pptx) speaker notes.
import { PRESET, normalisasi } from './ops.js'
import { buildArtDirection, scaleSystem } from './design-intelligence.js'
import { buildDataVizElement } from './dataviz.js'
import { resolveLayout } from './layout.js'

function flatten(list, parentId = null, out = [], seq = { n: 0 }) {
  for (const item of list) {
    const { anak, ...rest } = item
    const id = rest.id || `${rest.tipe === 'grup' ? 'g' : 'e'}${++seq.n}`
    const el = { ...rest, id, ...(parentId ? { induk: parentId } : {}) }
    if (el.tipe === 'teks' && el.w == null && el.lebar == null) el.lebar = 'isi'
    el.x ??= 0; el.y ??= 0
    out.push(el)
    if (Array.isArray(anak)) flatten(anak, id, out, seq)
  }
  return out
}

function railElements(pfx, { W, H, mx, my, deckTitle, slideNum, total, palette, mono, rule }) {
  return [
    { id: `${pfx}_rf`, tipe: 'kotak', x: mx, y: H - my - 34, w: W - mx * 2, h: 1, fill: rule, radius: 0 },
    { id: `${pfx}_rt`, tipe: 'teks', x: mx, y: H - my - 22, w: Math.round((W - mx * 2) * 0.7), teks: deckTitle, font: mono, ukuran: 15, tebal: 600, kapital: true, spasi: 1.5, warna: palette.muted, lh: 1.2 },
    { id: `${pfx}_rn`, tipe: 'teks', x: W - mx - 180, y: H - my - 22, w: 180, teks: `${String(slideNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, font: mono, ukuran: 15, tebal: 700, warna: palette.muted, rata: 'kanan', lh: 1.2 }
  ]
}

export function buildPresentationDoc({
  judul = 'Presentation',
  subtitle = '',
  author = '',
  date = '',
  slides = [],
  style = '',
  brand = null,
  ukuran = 'slide'
} = {}) {
  if (!Array.isArray(slides) || !slides.length) {
    throw new Error('Presentation requires a non-empty "slides" array.')
  }
  const [W, H] = PRESET[String(ukuran || 'slide').toLowerCase()] || [1920, 1080]
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
      // agenda or narrative
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
      elemen: flatten(els)
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

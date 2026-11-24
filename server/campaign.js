// Marketing Automation engine for Kanvas Studio (P1).
// Generates a cohesive multi-format campaign pack (IG Feed, IG Story, Carousel, A4 Poster,
// YouTube Thumbnail, Web Banner, OG Card) from one brief + Design Intelligence + Brand Kit.
import { PRESET, normalisasi } from './ops.js'
import { buildArtDirection, scaleSystem } from './design-intelligence.js'
import { resolveLayout } from './layout.js'

const FORMAT_LABELS = {
  'ig-feed': 'IG Feed 4:5',
  'ig-square': 'IG Square',
  'ig-story': 'IG Story 9:16',
  'a4': 'A4 Poster',
  'yt-thumbnail': 'YouTube Thumbnail',
  'banner-web': 'Web Banner',
  'og-image': 'Social OG Card',
  'slide': 'Hero Slide 16:9'
}

function hexToRgb(c) {
  let s = String(c || '').trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map(x => x + x).join('')
  if (!/^[0-9a-f]{6}$/i.test(s)) return null
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16))
}
function contrastInk(bgHex) {
  const rgb = hexToRgb(bgHex)
  if (!rgb) return '#FFFFFF'
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const lum = 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])
  return lum > 0.42 ? '#111111' : '#FAF9F6'
}

function styleProfile(directionId, brand) {
  const dir = directionId || 'editorial-product'
  const brutal = dir === 'brutalism'
  const luxury = dir === 'luxury-minimalism'
  const swiss = dir === 'swiss-editorial'
  return {
    radius: brand?.style?.radius ?? (brutal ? 0 : swiss ? 4 : luxury ? 2 : 16),
    pillRadius: brutal ? 2 : luxury ? 2 : 999,
    borderWidth: brand?.style?.strokeWidth ?? (brutal ? 4 : swiss || luxury ? 1.5 : 1),
    marginRatio: luxury ? 0.10 : brutal ? 0.055 : 0.07,
    shadow: !brutal && !swiss && !luxury
  }
}

function buildCtaButton(id, label, { accent, bodyFont, radius, size = 22, padX = 32, padY = 16, border }) {
  const ink = contrastInk(accent)
  return {
    id, tipe: 'grup', nama: 'CTA Button', lebar: 'peluk', tinggi: 'peluk',
    fill: accent, radius,
    ...(border ? { garis: border } : {}),
    tata: { arah: 'baris', padding: [padY, padX, padY, padX], rata: 'tengah' },
    anak: [{ tipe: 'teks', teks: label, lebar: 'peluk', font: bodyFont, ukuran: size, tebal: 700, warna: ink, lh: 1.15 }]
  }
}

function buildCampaignArtboard(fmt, cfg, abIndex, posX) {
  const [W, H] = PRESET[fmt] || [1080, 1350]
  const { palette, fonts, prof, headline, subhead, cta, eyebrow, details, points, logoSrc, imageSrc } = cfg
  const grid = scaleSystem(W, H, prof.marginRatio)
  const mx = grid.margins.x, my = grid.margins.y, cw = grid.margins.contentW, ch = grid.margins.contentH
  const display = fonts.display, body = fonts.body, mono = fonts.mono
  const accent = palette.accent || palette.primary || '#E03E2D'
  const rule = palette.rule || palette.muted || '#CBD5E1'
  const pfx = `c${abIndex}`
  const els = []

  // Top decorative hairline or structural accent bar (direction-aware, never generic circles)
  if (cfg.direction === 'brutalism') {
    els.push({ id: `${pfx}_frame`, tipe: 'kotak', nama: 'Brutalist Frame', x: Math.round(mx * 0.5), y: Math.round(my * 0.5), w: W - Math.round(mx), h: H - Math.round(my), fill: null, garis: { tebal: prof.borderWidth, warna: palette.text }, radius: prof.radius })
  } else if (cfg.direction === 'swiss-editorial') {
    els.push({ id: `${pfx}_rule`, tipe: 'kotak', nama: 'Top Signal Rule', x: mx, y: my, w: cw, h: 4, fill: accent, radius: 0 })
  }

  const topY = cfg.direction === 'swiss-editorial' ? my + 24 : my
  const isWide = W / H > 1.35
  const isStory = fmt === 'ig-story'
  const isThumb = fmt === 'yt-thumbnail'

  if (isThumb) {
    // High-impact YouTube thumbnail: monumental short headline left + strong visual/badge right
    const leftW = Math.round(cw * 0.62)
    els.push({ id: `${pfx}_ey`, tipe: 'teks', x: mx, y: topY, w: leftW, teks: eyebrow || 'NEW RELEASE', font: mono, ukuran: 22, tebal: 700, kapital: true, spasi: 3, warna: accent, lh: 1.2 })
    els.push({ id: `${pfx}_h1`, tipe: 'teks', x: mx, y: topY + 56, w: leftW, teks: headline, font: display, ukuran: 92, tebal: 800, warna: palette.text, lh: 0.98, spasi: -2 })
    if (subhead) els.push({ id: `${pfx}_sub`, tipe: 'teks', x: mx, y: H - my - 72, w: leftW, teks: subhead, font: body, ukuran: 28, tebal: 600, warna: palette.muted, lh: 1.25 })
    const cardX = mx + leftW + 32, cardW = W - mx - cardX, cardH = H - my * 2
    if (imageSrc) {
      els.push({ id: `${pfx}_img`, tipe: 'gambar', x: cardX, y: my, w: cardW, h: cardH, src: imageSrc, fit: 'cover', radius: prof.radius })
    } else {
      els.push({
        id: `${pfx}_box`, tipe: 'grup', x: cardX, y: my, w: cardW, h: cardH, fill: accent, radius: prof.radius,
        tata: { arah: 'kolom', jarak: 16, padding: 36, rata: 'tengah', sebar: 'tengah' },
        anak: [
          ...(logoSrc ? [{ tipe: 'gambar', w: 96, h: 96, src: logoSrc, fit: 'contain' }] : []),
          { tipe: 'teks', teks: cta || details || 'WATCH NOW', font: display, ukuran: 42, tebal: 800, warna: contrastInk(accent), rata: 'tengah', lh: 1.1 }
        ]
      })
    }
  } else if (isWide) {
    // Web Banner / OG Image / Hero Slide: clean asymmetric 62/38 horizontal split
    const leftW = Math.round(cw * 0.60), rightX = mx + leftW + 40, rightW = cw - leftW - 40
    const hSize = Math.max(44, Math.min(84, Math.round(H * 0.095)))
    const bSize = Math.max(18, Math.min(28, Math.round(H * 0.036)))
    els.push({
      id: `${pfx}_left`, tipe: 'grup', nama: 'Primary Copy', x: mx, y: topY, w: leftW, tinggi: 'peluk', fill: null,
      tata: { arah: 'kolom', jarak: Math.round(H * 0.025), padding: 0, rata: 'awal' },
      anak: [
        ...(eyebrow ? [{ tipe: 'teks', teks: eyebrow, font: mono, ukuran: Math.max(14, Math.round(bSize * 0.72)), tebal: 700, kapital: true, spasi: 2.5, warna: accent, lh: 1.2 }] : []),
        { tipe: 'teks', teks: headline, lebar: 'isi', font: display, ukuran: hSize, tebal: 800, warna: palette.text, lh: 1.02, spasi: -1.5 },
        ...(subhead ? [{ tipe: 'teks', teks: subhead, lebar: 'isi', font: body, ukuran: bSize, tebal: 400, warna: palette.muted, lh: 1.4 }] : []),
        ...(cta ? [buildCtaButton(`${pfx}_cta`, cta, { accent, bodyFont: body, radius: prof.pillRadius, size: Math.max(16, Math.round(bSize * 0.85)), padX: 28, padY: 14 })] : [])
      ]
    })
    if (imageSrc) {
      els.push({ id: `${pfx}_img`, tipe: 'gambar', x: rightX, y: topY, w: rightW, h: H - topY - my, src: imageSrc, fit: 'cover', radius: prof.radius })
    } else {
      const cardChildren = []
      if (logoSrc) cardChildren.push({ tipe: 'gambar', w: 72, h: 72, src: logoSrc, fit: 'contain' })
      if (points.length) {
        points.slice(0, 3).forEach((pt, pi) => {
          cardChildren.push({ tipe: 'teks', teks: `${String(pi + 1).padStart(2, '0')}  ${pt}`, font: body, ukuran: Math.max(16, Math.round(bSize * 0.85)), tebal: 600, warna: palette.text, lh: 1.3 })
        })
      } else if (details) {
        cardChildren.push({ tipe: 'teks', teks: details, font: mono, ukuran: Math.max(15, Math.round(bSize * 0.8)), tebal: 600, warna: palette.text, lh: 1.4 })
      }
      els.push({
        id: `${pfx}_card`, tipe: 'grup', nama: 'Side Panel', x: rightX, y: topY, w: rightW, h: H - topY - my,
        fill: palette.surface, radius: prof.radius, garis: { tebal: prof.borderWidth, warna: rule },
        tata: { arah: 'kolom', jarak: 16, padding: 32, rata: 'regang', sebar: 'tengah' },
        anak: cardChildren.length ? cardChildren : [{ tipe: 'teks', teks: eyebrow || 'CAMPAIGN', font: mono, ukuran: 18, tebal: 700, warna: accent, rata: 'tengah' }]
      })
    }
  } else {
    // Portrait / Square (IG Feed 4:5, IG Story 9:16, A4 Poster, IG Square)
    const safeTop = isStory ? Math.round(H * 0.11) : topY
    const safeBot = isStory ? Math.round(H * 0.10) : my
    const hSize = Math.max(46, Math.min(92, Math.round(W * (isStory ? 0.082 : 0.078))))
    const bSize = Math.max(16, Math.min(30, Math.round(W * 0.026)))

    // Header bar (eyebrow + optional logo)
    const headerChildren = [
      { tipe: 'teks', lebar: 'isi', teks: eyebrow || 'CAMPAIGN', font: mono, ukuran: Math.max(13, Math.round(bSize * 0.72)), tebal: 700, kapital: true, spasi: 2.5, warna: accent, lh: 1.2 }
    ]
    if (logoSrc) headerChildren.push({ tipe: 'gambar', w: Math.round(W * 0.08), h: Math.round(W * 0.08), src: logoSrc, fit: 'contain' })
    els.push({
      id: `${pfx}_hdr`, tipe: 'grup', nama: 'Header', x: mx, y: safeTop, w: cw, tinggi: 'peluk', fill: null,
      tata: { arah: 'baris', jarak: 16, padding: 0, rata: 'tengah', sebar: 'antara' },
      anak: headerChildren
    })

    // Main stack: headline + subhead + optional hero image or highlights card
    const stackY = safeTop + Math.round(H * (isStory ? 0.09 : 0.07))
    const stackKids = [
      { tipe: 'teks', teks: headline, lebar: 'isi', font: display, ukuran: hSize, tebal: 800, warna: palette.text, lh: 1.0, spasi: -1.5 }
    ]
    if (subhead) {
      stackKids.push({ tipe: 'teks', teks: subhead, lebar: 'isi', font: body, ukuran: bSize, tebal: 400, warna: palette.muted, lh: 1.42 })
    }
    if (imageSrc) {
      stackKids.push({ tipe: 'gambar', lebar: 'isi', h: Math.round(H * 0.28), src: imageSrc, fit: 'cover', radius: prof.radius })
    } else if (points.length) {
      stackKids.push({
        tipe: 'grup', nama: 'Key Highlights', lebar: 'isi', tinggi: 'peluk',
        fill: palette.surface, radius: prof.radius, garis: { tebal: prof.borderWidth, warna: rule },
        tata: { arah: 'kolom', jarak: 14, padding: Math.round(W * 0.032), rata: 'regang' },
        anak: points.slice(0, 3).map((pt, pi) => ({
          tipe: 'teks', teks: `${String(pi + 1).padStart(2, '0')} · ${pt}`, font: body, ukuran: Math.max(15, Math.round(bSize * 0.9)), tebal: 600, warna: palette.text, lh: 1.32
        }))
      })
    }
    els.push({
      id: `${pfx}_main`, tipe: 'grup', nama: 'Main Narrative', x: mx, y: stackY, w: cw, tinggi: 'peluk', fill: null,
      tata: { arah: 'kolom', jarak: Math.round(H * 0.026), padding: 0, rata: 'regang' },
      anak: stackKids
    })

    // Footer rail: CTA + details pinned cleanly near bottom margin
    const footerKids = []
    if (cta) footerKids.push(buildCtaButton(`${pfx}_cta`, cta, { accent, bodyFont: body, radius: prof.pillRadius, size: Math.max(15, Math.round(bSize * 0.88)), padX: Math.round(W * 0.036), padY: Math.round(H * 0.015) }))
    if (details) footerKids.push({ tipe: 'teks', lebar: 'isi', teks: details, font: mono, ukuran: Math.max(13, Math.round(bSize * 0.68)), tebal: 600, warna: palette.muted, rata: cta ? 'kanan' : 'kiri', lh: 1.3 })
    if (footerKids.length) {
      els.push({
        id: `${pfx}_ftr`, tipe: 'grup', nama: 'Footer Rail', x: mx, y: H - safeBot - 84, w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'baris', jarak: 20, padding: 0, rata: 'tengah', sebar: 'antara' },
        anak: footerKids
      })
    }
  }

  return {
    id: `a${abIndex + 1}`,
    nama: FORMAT_LABELS[fmt] || fmt,
    x: posX,
    y: 0,
    w: W,
    h: H,
    bg: palette.bg,
    elemen: flattenNested(els)
  }
}

function buildCarouselArtboards(cfg, startIdx, startX) {
  const [W, H] = PRESET['ig-feed']
  const { palette, fonts, prof, headline, subhead, cta, eyebrow, details, points, logoSrc } = cfg
  const grid = scaleSystem(W, H, prof.marginRatio)
  const mx = grid.margins.x, my = grid.margins.y, cw = grid.margins.contentW
  const accent = palette.accent || palette.primary || '#E03E2D'
  const rule = palette.rule || palette.muted || '#CBD5E1'

  const slidesSpec = [
    { kind: 'cover', title: headline, body: subhead || 'Swipe through to explore.' },
    ...(points.length ? points.slice(0, 4).map((p, i) => ({ kind: 'point', num: i + 1, title: p, body: '' })) : [
      { kind: 'point', num: 1, title: 'Designed with clarity', body: 'Consistent brand grid, typography, and contrast across every touchpoint.' },
      { kind: 'point', num: 2, title: 'Ready to edit anywhere', body: 'Auto-layout frames keep text and spacing crisp on canvas.' }
    ]),
    { kind: 'cta', title: cta || 'Get started today', body: details || subhead || '' }
  ]

  const total = slidesSpec.length
  const out = []
  let curX = startX
  slidesSpec.forEach((sp, si) => {
    const idx = startIdx + si
    const pfx = `car${idx}`
    const counter = `${String(si + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
    const els = [
      {
        id: `${pfx}_top`, tipe: 'grup', x: mx, y: my, w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'baris', jarak: 16, padding: 0, rata: 'tengah', sebar: 'antara' },
        anak: [
          { tipe: 'teks', lebar: 'isi', teks: eyebrow || 'CAROUSEL', font: fonts.mono, ukuran: 18, tebal: 700, kapital: true, spasi: 2.5, warna: accent, lh: 1.2 },
          { tipe: 'teks', lebar: 'peluk', teks: counter, font: fonts.mono, ukuran: 18, tebal: 700, warna: palette.muted, lh: 1.2 }
        ]
      },
      { id: `${pfx}_line`, tipe: 'kotak', x: mx, y: my + 44, w: cw, h: 2, fill: rule, radius: 0 }
    ]

    if (sp.kind === 'cover') {
      els.push({
        id: `${pfx}_body`, tipe: 'grup', x: mx, y: Math.round(H * 0.26), w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'kolom', jarak: 28, padding: 0, rata: 'regang' },
        anak: [
          { tipe: 'teks', teks: sp.title, font: fonts.display, ukuran: 86, tebal: 800, warna: palette.text, lh: 1.0, spasi: -2 },
          { tipe: 'teks', teks: sp.body, font: fonts.body, ukuran: 28, tebal: 400, warna: palette.muted, lh: 1.45 }
        ]
      })
      els.push({ id: `${pfx}_swipe`, tipe: 'teks', x: mx, y: H - my - 36, w: cw, teks: 'SWIPE →', font: fonts.mono, ukuran: 18, tebal: 700, spasi: 2.5, warna: accent, rata: 'kanan', lh: 1.2 })
    } else if (sp.kind === 'point') {
      els.push({ id: `${pfx}_num`, tipe: 'teks', x: mx, y: Math.round(H * 0.22), w: cw, teks: String(sp.num).padStart(2, '0'), font: fonts.display, ukuran: 140, tebal: 800, warna: accent, lh: 0.95 })
      els.push({
        id: `${pfx}_card`, tipe: 'grup', x: mx, y: Math.round(H * 0.42), w: cw, tinggi: 'peluk',
        fill: palette.surface, radius: prof.radius, garis: { tebal: prof.borderWidth, warna: rule },
        tata: { arah: 'kolom', jarak: 20, padding: 40, rata: 'regang' },
        anak: [
          { tipe: 'teks', teks: sp.title, font: fonts.display, ukuran: 48, tebal: 700, warna: palette.text, lh: 1.12 },
          ...(sp.body ? [{ tipe: 'teks', teks: sp.body, font: fonts.body, ukuran: 26, tebal: 400, warna: palette.muted, lh: 1.45 }] : [])
        ]
      })
    } else {
      els.push({
        id: `${pfx}_end`, tipe: 'grup', x: mx, y: Math.round(H * 0.28), w: cw, tinggi: 'peluk', fill: null,
        tata: { arah: 'kolom', jarak: 28, padding: 0, rata: 'awal' },
        anak: [
          ...(logoSrc ? [{ tipe: 'gambar', w: 92, h: 92, src: logoSrc, fit: 'contain' }] : []),
          { tipe: 'teks', teks: sp.title, lebar: 'isi', font: fonts.display, ukuran: 74, tebal: 800, warna: palette.text, lh: 1.04 },
          ...(sp.body ? [{ tipe: 'teks', teks: sp.body, lebar: 'isi', font: fonts.body, ukuran: 26, tebal: 400, warna: palette.muted, lh: 1.4 }] : []),
          buildCtaButton(`${pfx}_btn`, cta || 'Learn More', { accent, bodyFont: fonts.body, radius: prof.pillRadius, size: 24, padX: 36, padY: 18 })
        ]
      })
    }

    out.push({ id: `a${idx + 1}`, nama: `Carousel ${si + 1}`, x: curX, y: 0, w: W, h: H, bg: palette.bg, elemen: flattenNested(els) })
    curX += W + 160
  })
  return { artboards: out, nextX: curX }
}

function flattenNested(list, parentId = null, out = [], seq = { n: 0 }) {
  for (const item of list) {
    const { anak, ...rest } = item
    const id = rest.id || `${rest.tipe === 'grup' ? 'g' : 'e'}${++seq.n}`
    const el = { ...rest, id, ...(parentId ? { induk: parentId } : {}) }
    if (el.tipe === 'teks' && el.w == null && el.lebar == null) el.lebar = 'isi'
    el.x ??= 0; el.y ??= 0
    out.push(el)
    if (Array.isArray(anak)) flattenNested(anak, id, out, seq)
  }
  return out
}

export function buildCampaignDoc({
  judul = 'Campaign Pack',
  brief = '',
  headline,
  subhead = '',
  cta = 'Learn more',
  eyebrow = '',
  details = '',
  points = [],
  formats = ['ig-feed', 'ig-story', 'banner-web', 'a4'],
  style = '',
  brand = null,
  logoSrc = null,
  imageSrc = null
} = {}) {
  if (!headline && !brief) throw new Error('Campaign requires "headline" (or "brief").')
  const ad = buildArtDirection({ brief: brief || headline, style, format: formats[0] || 'ig-feed', w: 1080, h: 1350, brand })
  const prof = styleProfile(ad.direction, brand)
  const resolvedLogo = logoSrc || brand?.logos?.[0]?.src || null
  const cfg = {
    direction: ad.direction,
    palette: ad.palette,
    fonts: ad.fonts[0],
    prof,
    headline: String(headline || brief).trim(),
    subhead: String(subhead || '').trim(),
    cta: String(cta || '').trim(),
    eyebrow: String(eyebrow || brand?.name || '').trim(),
    details: String(details || '').trim(),
    points: Array.isArray(points) ? points.map(String).filter(Boolean) : [],
    logoSrc: resolvedLogo,
    imageSrc: imageSrc || null
  }

  const requested = Array.isArray(formats) && formats.length ? formats : ['ig-feed', 'ig-story', 'banner-web', 'a4']
  const artboards = []
  let posX = 0

  for (const rawFmt of requested) {
    const fmt = String(rawFmt).toLowerCase().trim()
    if (fmt === 'carousel') {
      const car = buildCarouselArtboards(cfg, artboards.length, posX)
      artboards.push(...car.artboards)
      posX = car.nextX
    } else if (PRESET[fmt]) {
      const ab = buildCampaignArtboard(fmt, cfg, artboards.length, posX)
      artboards.push(ab)
      posX += ab.w + 160
    } else {
      throw new Error(`Unknown campaign format "${rawFmt}". Use: carousel, ${Object.keys(PRESET).join(', ')}.`)
    }
  }

  const doc = normalisasi({
    versi: 1,
    judul,
    ...(brand ? { brand: brand.id } : {}),
    artboards
  })
  resolveLayout(doc)
  return { doc, direction: ad.direction, formats: artboards.map(a => `${a.id} "${a.nama}" (${a.w}×${a.h})`) }
}

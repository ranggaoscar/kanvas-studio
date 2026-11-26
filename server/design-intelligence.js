// Design Intelligence engine for Kanvas Studio.
// Provides adaptive art direction, structured layout blueprints, proportional canvas grids,
// 60-30-10 color budgets, element caps, and document presets (including Business / Admin Report).

const DEFAULT_BLUEPRINT = {
  marginRatio: { x: 0.07, y: 0.07 },
  columnGrid: { landscape: '12-col (60/40 split)', portrait: '6-col modular' },
  focalArea: '45–55% primary hero or evidence zone',
  whitespaceTarget: { min: 30, max: 45 },
  colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 1 },
  maxElementsPerZone: { header: 3, focal: 4, body: 6, footer: 2, total: 18 },
  zones: [
    { id: 'header', heightRatio: '10–14%', maxElements: 3, role: 'eyebrow + headline anchor' },
    { id: 'focal', heightRatio: '42–52%', maxElements: 4, role: 'primary visual, headline, or data proof' },
    { id: 'body', heightRatio: '26–36%', maxElements: 6, role: 'supporting structure or scannable points' },
    { id: 'footer', heightRatio: '6–8%', maxElements: 2, role: 'metadata, source, or CTA rail' }
  ],
  antiSlop: [
    'No decorative floating blobs or generic coral gradients on every surface',
    'Maintain ≥2.5× display-to-body scale contrast and concise copy',
    'Keep 60% canvas / 30% surface / 10% accent discipline'
  ]
}

export const DIRECTIONS = {
  'swiss-editorial': {
    id: 'swiss-editorial',
    name: 'Swiss Editorial',
    summary: 'Modular grid precision, expressive asymmetric typography, disciplined negative space, crisp hairlines, and one decisive accent ink.',
    keywords: ['swiss', 'editorial', 'magazine', 'architecture', 'museum', 'exhibition', 'type', 'typography', 'poster', 'design', 'grid', 'minimal', 'modernist', 'international', 'journal', 'book', 'conference', 'symposium'],
    marginRatio: 0.065,
    fontPairings: [
      { display: 'Syne', body: 'Inter', mono: 'IBM Plex Mono', mood: 'architectural modernist' },
      { display: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono', mood: 'crisp Swiss neo-grotesque' },
      { display: 'Instrument Serif', body: 'DM Sans', mono: 'IBM Plex Mono', mood: 'editorial contrast' }
    ],
    palettes: [
      { name: 'Newsprint & Vermilion', bg: '#F4F1EA', surface: '#EAE5DA', text: '#111111', muted: '#55524B', accent: '#E03E2D', rule: '#111111' },
      { name: 'Obsidian & Signal Yellow', bg: '#111214', surface: '#1C1E22', text: '#F5F3EE', muted: '#9A9891', accent: '#F2C94C', rule: '#353840' },
      { name: 'Chalk & Cobalt', bg: '#F8F9FA', surface: '#EBEEF2', text: '#0F172A', muted: '#475569', accent: '#1D4ED8', rule: '#CBD5E1' }
    ],
    compositions: ['editorial-grid', 'typographic-hero', 'asymmetric-split'],
    surfaceRules: 'Flat paper/ink tones, crisp 1–2px dividing rules, 0–8px corners, zero soft drop shadows.',
    typographyRules: 'Tight headline tracking (-2 to -4px), tight leading (0.94–1.05). Pair oversized headline (3.5×–5× body) with compact uppercase mono indices (01, 02).',
    blueprint: {
      marginRatio: { x: 0.065, y: 0.065 },
      columnGrid: { landscape: '12-col asymmetric (8+4 or 4+4+4)', portrait: '6-col modular (4+2 or 3+3)' },
      focalArea: '45–58% upper/left typographic anchor or editorial lead',
      whitespaceTarget: { min: 35, max: 50 },
      colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 1 },
      maxElementsPerZone: { header: 3, focal: 3, body: 6, footer: 2, total: 18 },
      zones: [
        { id: 'top-rail', heightRatio: '8–10%', maxElements: 3, role: 'index/eyebrow + date + 1px hairline' },
        { id: 'focal-hero', heightRatio: '38–48%', maxElements: 3, role: 'asymmetric display headline or hero specimen' },
        { id: 'modular-body', heightRatio: '32–42%', maxElements: 6, role: '2–3 structured columns divided by 1px rules; leave 1 band open' },
        { id: 'footer-rail', heightRatio: '6–8%', maxElements: 2, role: 'issue/page metadata' }
      ],
      antiSlop: [
        'Never center every block—lock typography to a strict left vertical rail',
        'No soft blurred drop shadows, glossy gradients, or floating circles',
        'Use 1px hairline rules instead of wrapping every paragraph in rounded cards'
      ]
    }
  },

  'luxury-minimalism': {
    id: 'luxury-minimalism',
    name: 'Luxury Minimalism',
    summary: 'Quiet authority through refined serif typography, generous margins (10–14%), warm neutral tonal surfaces, and restrained composition.',
    keywords: ['luxury', 'fashion', 'watch', 'perfume', 'fragrance', 'jewelry', 'jewellery', 'hotel', 'hospitality', 'spa', 'boutique', 'fine dining', 'wine', 'skincare', 'cosmetic', 'beauty', 'atelier', 'bespoke', 'minimalism', 'elegant', 'premium', 'real estate', 'estate'],
    marginRatio: 0.11,
    fontPairings: [
      { display: 'Cormorant Garamond', body: 'Plus Jakarta Sans', mono: 'IBM Plex Mono', mood: 'high-fashion haute editorial' },
      { display: 'Playfair Display', body: 'Montserrat', mono: 'DM Mono', mood: 'classic prestige' },
      { display: 'Cinzel', body: 'Lato', mono: 'IBM Plex Mono', mood: 'monumental heritage' }
    ],
    palettes: [
      { name: 'Alabaster & Espresso', bg: '#F7F3EC', surface: '#EFE8DC', text: '#1C1917', muted: '#6B6258', accent: '#9A7B4F', rule: '#D6CCBC' },
      { name: 'Noir & Champagne', bg: '#0E0D0C', surface: '#1A1816', text: '#F5F0E6', muted: '#A39A8C', accent: '#D4B483', rule: '#2F2B26' },
      { name: 'Warm Stone & Forest', bg: '#F2EFE9', surface: '#E5E0D5', text: '#17221B', muted: '#546158', accent: '#2D4F3E', rule: '#CFC8BA' }
    ],
    compositions: ['luxury-centered', 'asymmetric-split', 'full-bleed-frame'],
    surfaceRules: 'Ultra-generous 10–14% margins, subtle 1px hairline borders, calm tonal steps, zero loud badges or heavy shadows.',
    typographyRules: 'High-contrast serif display at light/regular/medium weight (400–600) paired with wide-tracked uppercase sans eyebrows (+3 to +6px).',
    blueprint: {
      marginRatio: { x: 0.11, y: 0.11 },
      columnGrid: { landscape: 'axial center or quiet 55/45 split', portrait: 'axial single-column gallery frame' },
      focalArea: '35–48% refined serif centerpiece or hero product imagery',
      whitespaceTarget: { min: 45, max: 65 },
      colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 1 },
      maxElementsPerZone: { header: 2, focal: 2, body: 3, footer: 2, total: 10 },
      zones: [
        { id: 'framing-top', heightRatio: '8–10%', maxElements: 2, role: 'tracked-out eyebrow or monogram' },
        { id: 'centerpiece', heightRatio: '48–58%', maxElements: 2, role: 'single refined serif statement or focal image' },
        { id: 'caption-band', heightRatio: '16–20%', maxElements: 3, role: 'concise 1–2 line editorial note' },
        { id: 'framing-bottom', heightRatio: '8–10%', maxElements: 2, role: 'quiet location/edition rail' }
      ],
      antiSlop: [
        'Never exceed 10 foreground elements—edit ruthlessly for quiet breathing room',
        'No loud neon pills, thick borders, saturated gradients, or heavy drop shadows',
        'Keep margins ≥10% on all four edges; never cram text to the border'
      ]
    }
  },

  'brutalism': {
    id: 'brutalism',
    name: 'Neo-Brutalism / Raw Poster',
    summary: 'Unapologetic scale contrast, stark geometric blocks, heavy 3–6px borders, zero-nonsense corners, and high-voltage kinetic energy.',
    keywords: ['brutalist', 'brutalism', 'punk', 'underground', 'rave', 'concert', 'gig', 'festival', 'music', 'streetwear', 'skate', 'zine', 'hackathon', 'rebel', 'bold', 'raw', 'poster', 'club', 'dj', 'indie', 'counterculture'],
    marginRatio: 0.05,
    fontPairings: [
      { display: 'Archivo Black', body: 'Space Mono', mono: 'Space Mono', mood: 'raw industrial zine' },
      { display: 'Anton', body: 'IBM Plex Mono', mono: 'IBM Plex Mono', mood: 'monumental street poster' },
      { display: 'Bebas Neue', body: 'DM Sans', mono: 'JetBrains Mono', mood: 'high-impact condensed poster' }
    ],
    palettes: [
      { name: 'Concrete, Ink & Acid Lime', bg: '#E6E4DD', surface: '#FFFFFF', text: '#0B0B0B', muted: '#333333', accent: '#CCFF00', rule: '#0B0B0B' },
      { name: 'Pitch Black & Signal Orange', bg: '#0A0A0A', surface: '#171717', text: '#FAF9F6', muted: '#B5B5B5', accent: '#FF4500', rule: '#FAF9F6' },
      { name: 'Paper & Electric Cobalt', bg: '#F5F4EF', surface: '#FFD600', text: '#0D0D0D', muted: '#2E2E2E', accent: '#0038FF', rule: '#0D0D0D' }
    ],
    compositions: ['typographic-hero', 'diagonal-tension', 'bento-modular'],
    surfaceRules: '0–6px sharp corners, solid 3–6px borders, stark high-contrast blocks, zero soft blurred shadows.',
    typographyRules: 'Monumental display scale (4×–7× body), tight leading (0.90–0.98), condensed uppercase titles juxtaposed with tabular monospace details.',
    blueprint: {
      marginRatio: { x: 0.05, y: 0.05 },
      columnGrid: { landscape: 'stark 65/35 block split inside heavy border', portrait: 'full-width stacked poster blocks (2-col base)' },
      focalArea: '50–65% monumental condensed display headline',
      whitespaceTarget: { min: 22, max: 38 },
      colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 1 },
      maxElementsPerZone: { header: 3, focal: 3, body: 5, footer: 3, total: 16 },
      zones: [
        { id: 'frame-header', heightRatio: '10–12%', maxElements: 3, role: 'issue tag + bold rule + date stamp' },
        { id: 'monumental-type', heightRatio: '46–56%', maxElements: 3, role: 'oversized 2–3 line headline block' },
        { id: 'info-blocks', heightRatio: '24–30%', maxElements: 5, role: 'hard-bordered schedule, lineup, or stark callout' },
        { id: 'stamp-footer', heightRatio: '8–10%', maxElements: 3, role: 'venue/ticket strip' }
      ],
      antiSlop: [
        'No soft blurred drop shadows, pastel gradients, or 24px+ rounded SaaS cards',
        'Keep corners crisp (0–6px) and strokes decisive (3–6px solid)',
        'Do not dilute raw impact with more than 1 high-voltage accent hue'
      ]
    }
  },

  'cinematic': {
    id: 'cinematic',
    name: 'Cinematic & Atmospheric',
    summary: 'Full-bleed visual drama, moody chiaroscuro depth, monumental title lockups paired with whisper-quiet wide-tracked captions.',
    keywords: ['cinema', 'cinematic', 'film', 'movie', 'trailer', 'documentary', 'story', 'narrative', 'game', 'gaming', 'sci-fi', 'album', 'music video', 'drama', 'noir', 'theatre', 'theater', 'keynote', 'launch', 'youtube', 'thumbnail', 'portrait'],
    marginRatio: 0.075,
    fontPairings: [
      { display: 'Oswald', body: 'Inter', mono: 'Space Mono', mood: 'widescreen theatrical' },
      { display: 'Playfair Display', body: 'DM Sans', mono: 'IBM Plex Mono', mood: 'art-house atmospheric' },
      { display: 'Syne', body: 'Plus Jakarta Sans', mono: 'JetBrains Mono', mood: 'futuristic sci-fi' }
    ],
    palettes: [
      { name: 'Midnight Velvet & Ember', bg: '#090B12', surface: '#131726', text: '#F4F1EA', muted: '#9BA3B5', accent: '#E85D3F', rule: '#283047' },
      { name: 'Deep Pine & Warm Amber', bg: '#0B1412', surface: '#14221F', text: '#F2EFE9', muted: '#91A39C', accent: '#E6A756', rule: '#243833' },
      { name: 'Noir Silver & Crimson', bg: '#0D0D10', surface: '#18181F', text: '#F5F5F7', muted: '#9999A6', accent: '#D72638', rule: '#2D2D38' }
    ],
    compositions: ['full-bleed-frame', 'typographic-hero', 'diagonal-tension'],
    surfaceRules: 'Deep dark tonal layers or full-bleed imagery, targeted dark scrims for ≥4.5:1 text contrast, restrained light hairlines.',
    typographyRules: 'Dramatic contrast between monumental hero title and wide-tracked uppercase credits (+4 to +8px); leave open dark negative space.',
    blueprint: {
      marginRatio: { x: 0.075, y: 0.075 },
      columnGrid: { landscape: 'widescreen full-bleed stage + lower-third lockup', portrait: 'poster full-bleed + bottom title stack' },
      focalArea: '55–70% atmospheric visual stage + dramatic title lockup',
      whitespaceTarget: { min: 35, max: 55 },
      colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 1 },
      maxElementsPerZone: { header: 2, focal: 3, body: 3, footer: 2, total: 12 },
      zones: [
        { id: 'credit-top', heightRatio: '8–10%', maxElements: 2, role: 'studio/presenter wide-tracked caption' },
        { id: 'visual-stage', heightRatio: '52–62%', maxElements: 3, role: 'full-bleed imagery or dark chiaroscuro space' },
        { id: 'title-lockup', heightRatio: '18–24%', maxElements: 3, role: 'monumental title + 1-line logline over protected scrim' },
        { id: 'billing-rail', heightRatio: '6–8%', maxElements: 2, role: 'release date / credits line' }
      ],
      antiSlop: [
        'Never stack bright white boxed cards over moody dark scenes',
        'Always place a dark tonal scrim behind text crossing imagery (≥4.5:1 contrast)',
        'Keep total elements ≤12 so dark atmosphere carries the frame'
      ]
    }
  },

  'corporate-premium': {
    id: 'corporate-premium',
    name: 'Corporate Premium / Executive',
    summary: 'Boardroom-grade editorial clarity: authoritative data hierarchy, calm neutral surfaces, crisp structural lines, and zero gimmicks.',
    keywords: ['corporate', 'investor', 'report', 'annual', 'finance', 'financial', 'banking', 'enterprise', 'b2b', 'strategy', 'consulting', 'board', 'quarterly', 'q1', 'q2', 'q3', 'q4', 'pitch', 'deck', 'executive', 'energy', 'industrial', 'research', 'whitepaper', 'case study', 'proposal', 'admin', 'laporan', 'operasional', 'keuangan'],
    marginRatio: 0.075,
    fontPairings: [
      { display: 'DM Serif Display', body: 'Inter', mono: 'IBM Plex Mono', mood: 'editorial institutional authority' },
      { display: 'Plus Jakarta Sans', body: 'Inter', mono: 'IBM Plex Mono', mood: 'modern enterprise clarity' },
      { display: 'Merriweather', body: 'DM Sans', mono: 'JetBrains Mono', mood: 'research & financial publication' }
    ],
    palettes: [
      { name: 'Deep Slate & Emerald Signal', bg: '#F7F8FA', surface: '#FFFFFF', text: '#0F172A', muted: '#475569', accent: '#0B5D56', rule: '#DCE2EA' },
      { name: 'Boardroom Navy & Warm Gold', bg: '#0D1B2A', surface: '#16283D', text: '#F8FAFC', muted: '#94A3B8', accent: '#D4A359', rule: '#273E59' },
      { name: 'Warm Paper & Burgundy', bg: '#F8F6F2', surface: '#EFECE6', text: '#1E1B18', muted: '#5E574F', accent: '#7F1D1D', rule: '#DBD5CB' }
    ],
    compositions: ['data-narrative', 'editorial-grid', 'report-document', 'asymmetric-split'],
    surfaceRules: 'Crisp subtle surfaces (0–12px radius, 1px hairline borders, zero heavy shadows) with consistent header/footer rails and page numbers.',
    typographyRules: 'Lead every page/slide with an insight headline (conclusion, not vague label). Pair oversized tabular KPI figures (3×–4× body) with 1-line captions.',
    blueprint: {
      marginRatio: { x: 0.075, y: 0.075 },
      columnGrid: { landscape: '12-col executive (65/35 evidence+takeaway or 3–4 KPI band)', portrait: '6-col A4 print grid (3×2 KPI / full-width table)' },
      focalArea: '48–60% primary evidence (KPI band, chart, or structured table)',
      whitespaceTarget: { min: 30, max: 45 },
      colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 1 },
      maxElementsPerZone: { header: 3, focal: 4, body: 6, footer: 2, total: 18 },
      zones: [
        { id: 'header-bar', heightRatio: '12–16%', maxElements: 3, role: 'eyebrow + insight headline + accent hairline' },
        { id: 'focal-evidence', heightRatio: '44–56%', maxElements: 4, role: 'KPI strip, chart, or right-aligned tabular data table' },
        { id: 'supporting-notes', heightRatio: '18–26%', maxElements: 4, role: '2–3 concise executive takeaways (≤2 lines each)' },
        { id: 'footer-rail', heightRatio: '6–8%', maxElements: 2, role: '1px hairline + document title + page number' }
      ],
      antiSlop: [
        'Never write vague topic-only headings ("Overview")—state the business insight',
        'No rainbow charts or >1 accent hue; use neutrals + 1 decisive signal color',
        'No walls of text (>4-line prose blocks) or heavy drop shadows on data cards'
      ]
    }
  },

  'experimental': {
    id: 'experimental',
    name: 'Experimental / Avant-Garde',
    summary: 'Expressive visual tension, sculptural vector forms, rotated typographic anchors, and unexpected chromatic collisions built with intent.',
    keywords: ['experimental', 'avant-garde', 'art', 'gallery', 'creative', 'abstract', 'psychedelic', 'kinetic', 'studio', 'agency', 'portfolio', 'culture', 'workshop', 'weird', 'playful', 'artistic', 'surreal', 'editorial art'],
    marginRatio: 0.06,
    fontPairings: [
      { display: 'Syne', body: 'Space Mono', mono: 'Space Mono', mood: 'sculptural studio avant-garde' },
      { display: 'Bricolage Grotesque', body: 'DM Sans', mono: 'JetBrains Mono', mood: 'expressive contemporary studio' },
      { display: 'Fraunces', body: 'Inter', mono: 'IBM Plex Mono', mood: 'soft-serif experimental' }
    ],
    palettes: [
      { name: 'Ultraviolet, Cream & Vermilion', bg: '#150E26', surface: '#23183D', text: '#FBF7EE', muted: '#B6A8D4', accent: '#FF5A36', rule: '#44336E' },
      { name: 'Bone, Cobalt & Chartreuse', bg: '#F3EFE6', surface: '#E6E0D2', text: '#12183B', muted: '#4C5275', accent: '#0047FF', rule: '#12183B' },
      { name: 'Moss, Blush & Ink', bg: '#1B2A22', surface: '#263B30', text: '#F7EDE2', muted: '#B5C4BA', accent: '#F4A698', rule: '#3D594A' }
    ],
    compositions: ['diagonal-tension', 'typographic-hero', 'full-bleed-frame'],
    surfaceRules: 'Bespoke vector path shapes (curves, cuts) layered with intentional opacity/rotation while keeping all text legible.',
    typographyRules: 'Break rigid centering with offset baselines, oversized single-word anchors, or rotated edge stamps—verify legibility via kanvas_view.',
    blueprint: {
      marginRatio: { x: 0.06, y: 0.06 },
      columnGrid: { landscape: 'diagonal tension (upper-left ↔ lower-right)', portrait: 'offset asymmetric 6-col with sculptural bleed' },
      focalArea: '45–60% bespoke vector sculpture or oversized offset wordmark',
      whitespaceTarget: { min: 30, max: 50 },
      colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 2 },
      maxElementsPerZone: { header: 2, focal: 4, body: 4, footer: 2, total: 14 },
      zones: [
        { id: 'edge-stamp', heightRatio: '8–10%', maxElements: 2, role: 'index code or rotated edge stamp' },
        { id: 'sculptural-focal', heightRatio: '46–56%', maxElements: 4, role: 'custom vector path + offset display typography' },
        { id: 'counter-callout', heightRatio: '24–32%', maxElements: 4, role: 'opposing corner narrative/event details' },
        { id: 'meta-anchor', heightRatio: '6–8%', maxElements: 2, role: 'edition/venue line' }
      ],
      antiSlop: [
        'Never fall back to symmetric 3-column rounded SaaS boxes',
        'Intentional asymmetry must still maintain ≥4.5:1 text contrast and zero text collisions',
        'Limit chromatic collisions to ≤2 intentional accents so chaos stays curated'
      ]
    }
  },

  'editorial-product': {
    id: 'editorial-product',
    name: 'Contemporary Product & Brand',
    summary: 'Crisp modern product storytelling with expressive neo-grotesque type, tactile modular bento layouts, sharp icons, and clean visual focus.',
    keywords: ['saas', 'app', 'product', 'startup', 'tech', 'ai', 'developer', 'tool', 'software', 'mobile', 'web', 'launch', 'promo', 'social', 'instagram', 'carousel', 'pricing', 'feature', 'coffee', 'cafe', 'food', 'bakery', 'retail', 'shop'],
    marginRatio: 0.07,
    fontPairings: [
      { display: 'Bricolage Grotesque', body: 'DM Sans', mono: 'JetBrains Mono', mood: 'warm expressive modern brand' },
      { display: 'Space Grotesk', body: 'Plus Jakarta Sans', mono: 'JetBrains Mono', mood: 'sharp technical product' },
      { display: 'Fraunces', body: 'Plus Jakarta Sans', mono: 'IBM Plex Mono', mood: 'friendly craft & hospitality' }
    ],
    palettes: [
      { name: 'Warm Cream, Ink & Terracotta', bg: '#FAF7F2', surface: '#FFFFFF', text: '#16181D', muted: '#5A5F6B', accent: '#D95D39', rule: '#E6DFD3' },
      { name: 'Carbon, Slate & Electric Mint', bg: '#0E1117', surface: '#171C26', text: '#F3F6FA', muted: '#95A0B2', accent: '#2EE59D', rule: '#273040' },
      { name: 'Crisp White, Graphite & Indigo', bg: '#FFFFFF', surface: '#F4F5F8', text: '#111827', muted: '#4B5563', accent: '#4F46E5', rule: '#E5E7EB' }
    ],
    compositions: ['bento-modular', 'asymmetric-split', 'data-narrative'],
    surfaceRules: 'Auto-layout (tata) frames, subtle 1px borders or restrained elevation, crisp Lucide icons, 1 strong focal accent.',
    typographyRules: 'Distinctive neo-grotesque display paired with readable humanist sans body; concise buttons and scannable cards (≤3–4 short lines).',
    blueprint: {
      marginRatio: { x: 0.07, y: 0.07 },
      columnGrid: { landscape: 'varied bento (2× hero + stacked tiles) or 60/40 split', portrait: 'hero stack + 2-col feature bento' },
      focalArea: '45–58% hero product statement or oversized hero bento tile',
      whitespaceTarget: { min: 28, max: 42 },
      colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 1 },
      maxElementsPerZone: { header: 3, focal: 4, body: 6, footer: 2, total: 18 },
      zones: [
        { id: 'eyebrow-header', heightRatio: '10–14%', maxElements: 3, role: 'brand mark + category eyebrow' },
        { id: 'hero-focal', heightRatio: '36–46%', maxElements: 4, role: 'headline + 1-line subhead + primary CTA/visual' },
        { id: 'bento-proof', heightRatio: '30–38%', maxElements: 6, role: 'varied-proportion feature/metric tiles in tata auto-layout' },
        { id: 'cta-footer', heightRatio: '8–10%', maxElements: 2, role: 'action rail or social proof' }
      ],
      antiSlop: [
        'Avoid identical 3-column cookie-cutter cards—vary bento proportions (e.g. 2× hero + 2 compact)',
        'Do not coat every card in gradients; reserve 1 accent color for primary CTA and key stat',
        'Cap card copy at ≤3–4 short scannable lines'
      ]
    }
  }
}

export const COMPOSITIONS = {
  'asymmetric-split': {
    name: 'Asymmetric Split (60/40)',
    gridRatio: '60/40',
    focalArea: '58–62% primary zone',
    whitespaceTarget: '30–42%',
    how: 'Divide active frame into a 58–62% primary zone (headline + narrative/hero) and a 36–40% contrast zone (visual/metric/card), separated by whitespace or a 1px rule.',
    zones: [
      { id: 'primary', span: '60% W', maxElements: 4, role: 'eyebrow + display headline + narrative' },
      { id: 'secondary', span: '38% W', maxElements: 3, role: 'hero visual, stat card, or key proof' }
    ]
  },
  'editorial-grid': {
    name: 'Editorial Column Grid',
    gridRatio: '12-col (8+4 / 4+4+4)',
    focalArea: '8–10 col display header',
    whitespaceTarget: '35–48%',
    how: 'Top metadata rail, display title spanning 8–10 columns, then 2–3 structured columns separated by 1px rules with one intentionally open negative-space band.',
    zones: [
      { id: 'meta-rail', span: '12-col × 10% H', maxElements: 3, role: 'eyebrow/index + date + rule' },
      { id: 'title-band', span: '8–10 col × 35% H', maxElements: 2, role: 'dominant display headline' },
      { id: 'columns', span: '12-col × 45% H', maxElements: 6, role: '2–3 structured columns + 1 open space' }
    ]
  },
  'typographic-hero': {
    name: 'Monumental Typographic Hero',
    gridRatio: '1-col dominant + corner rails',
    focalArea: '45–65% oversized display type',
    whitespaceTarget: '32–48%',
    how: 'Oversized display type (2–3 tight-leading lines ~0.95) anchors 45–65% of the frame, counterbalanced by compact corner or bottom-rail metadata.',
    zones: [
      { id: 'hero-type', span: '85% W × 55% H', maxElements: 2, role: 'monumental 2–3 line headline' },
      { id: 'counter-rail', span: '100% W × 18% H', maxElements: 4, role: 'structured metadata / CTA anchor' }
    ]
  },
  'bento-modular': {
    name: 'Modular Bento Grid',
    gridRatio: '2× hero tile + compact tiles',
    focalArea: '50% hero bento tile',
    whitespaceTarget: '26–38%',
    how: 'Auto-layout (tata) rows/columns with varied tile proportions (one 2× hero tile paired with compact stacked tiles) and uniform 24–32px outer gaps.',
    zones: [
      { id: 'header', span: '100% W × 18% H', maxElements: 2, role: 'eyebrow + section headline' },
      { id: 'hero-tile', span: '58% W × 68% H', maxElements: 4, role: 'primary focal feature or metric' },
      { id: 'sub-tiles', span: '40% W × 68% H', maxElements: 4, role: '2 stacked secondary proof tiles' }
    ]
  },
  'full-bleed-frame': {
    name: 'Full-Bleed Visual + Protected Type Zone',
    gridRatio: '100% bleed + 30% protected band',
    focalArea: '60–75% full-bleed stage',
    whitespaceTarget: '35–55%',
    how: 'Bleed imagery or sculptural forms to the edge; reserve a clean tonal band or dark scrim so typography clears ≥4.5:1 contrast.',
    zones: [
      { id: 'bleed-stage', span: '100% × 100%', maxElements: 2, role: 'edge-to-edge visual or dark field' },
      { id: 'type-zone', span: '75% W × 28% H', maxElements: 3, role: 'protected high-contrast title lockup' }
    ]
  },
  'luxury-centered': {
    name: 'Calm Axial Symmetry',
    gridRatio: '1-col axial (11% margins)',
    focalArea: '35–48% refined centerpiece',
    whitespaceTarget: '45–65%',
    how: '10–14% margins on all sides; center one refined centerpiece framed above/below by small tracked-out uppercase labels.',
    zones: [
      { id: 'top-frame', span: '100% W × 10% H', maxElements: 2, role: 'tracked uppercase eyebrow' },
      { id: 'centerpiece', span: '72% W × 54% H', maxElements: 2, role: 'serif statement or product visual' },
      { id: 'bottom-frame', span: '100% W × 10% H', maxElements: 2, role: 'quiet edition / caption line' }
    ]
  },
  'diagonal-tension': {
    name: 'Diagonal Counter-Balance',
    gridRatio: 'upper-left ↔ lower-right',
    focalArea: '48–58% diagonal anchor pair',
    whitespaceTarget: '32–48%',
    how: 'Anchor hero visual/title upper-left and counter-balance with a crisp callout, vector accent, or detail block lower-right across open canvas.',
    zones: [
      { id: 'anchor-a', span: '62% W × 46% H (top-left)', maxElements: 3, role: 'hero headline or vector form' },
      { id: 'anchor-b', span: '42% W × 34% H (bottom-right)', maxElements: 3, role: 'counter-callout or event metadata' }
    ]
  },
  'data-narrative': {
    name: 'Insight Headline + Hero Evidence',
    gridRatio: 'top insight + 65/35 evidence/notes',
    focalArea: '50–60% primary chart/KPI proof',
    whitespaceTarget: '30–42%',
    how: 'Top conclusion headline paired with dominant visual proof (KPI row, native chart, or clean table), concise takeaways, and bottom source rail.',
    zones: [
      { id: 'insight-head', span: '100% W × 16% H', maxElements: 3, role: 'eyebrow + conclusion headline + rule' },
      { id: 'evidence', span: '65–100% W × 56% H', maxElements: 4, role: 'chart, KPI strip, or data table' },
      { id: 'takeaways', span: '32% W or bottom 18% H', maxElements: 4, role: '2–3 bulleted implications + source' }
    ]
  },
  'report-document': {
    name: 'Structured A4 Report Page',
    gridRatio: '6-col A4 (794×1123, 56px margin)',
    focalArea: '50–62% KPI/chart/table body',
    whitespaceTarget: '28–42%',
    how: 'Consistent running header (title + section + 1px hairline), insight heading, structured KPI/chart/table evidence zone, and running footer with page number.',
    zones: [
      { id: 'running-header', span: '100% W (y 56..92)', maxElements: 3, role: 'doc title + section tag + 1px hairline' },
      { id: 'heading', span: '100% W (y 112..192)', maxElements: 2, role: 'insight heading + 1-line period/unit lead' },
      { id: 'evidence-body', span: '100% W (y 212..980)', maxElements: 6, role: 'KPI cards + chart, paginated zebra table, or findings/actions' },
      { id: 'running-footer', span: '100% W (y 1046..1072)', maxElements: 3, role: '1px hairline + confidentiality + Page XX / NN' }
    ]
  }
}

export const DOCUMENT_PRESETS = {
  'admin-report': {
    id: 'admin-report',
    name: 'Business / Admin Report',
    baseDirection: 'corporate-premium',
    secondaryDirection: 'swiss-editorial',
    dimensions: { w: 794, h: 1123, preset: 'a4', ratio: '1:1.414 (ISO A4 portrait)' },
    keywords: [
      'admin report', 'business report', 'executive report', 'monthly report', 'quarterly report',
      'operations report', 'financial report', 'management report', 'audit report', 'status report',
      'laporan', 'laporan bulanan', 'laporan keuangan', 'laporan operasional', 'laporan admin', 'rekap'
    ],
    margins: { x: 56, y: 56, contentW: 682, headerRuleY: 92, bodyTopY: 116, bodyBottomY: 1024, footerRuleY: 1046 },
    colorBudget: { canvas: 60, surface: 30, accent: 10, maxAccents: 1 },
    headerFooter: {
      header: 'Pages 2..N: doc title left (13px mono muted uppercase) + section right (13px mono accent uppercase) + 1px hairline at y=92. Skip on cover.',
      footer: 'Pages 2..N: 1px hairline at y=1046, org/classification left (13px mono muted), tabular "Page 02 / 04" right.',
      coverFooter: 'Cover bottom rail: 1px hairline + prepared-by, period, and document ID inside 56px margin.'
    },
    pagination: {
      maxTableRowsFirstPage: 10,
      maxTableRowsContinuation: 14,
      rowHeightPx: 42,
      tableHeaderHeightPx: 44,
      minSectionGapPx: 24,
      maxLinesPerParagraph: 3,
      pageBreakRule: 'Never split a KPI row, chart, or callout box across pages. If table rows exceed 10 (with intro) or 14 (continuation), auto-break to a new page, repeat the dark header row, and append "(cont.)" to the heading.'
    },
    tableStyle: {
      header: 'High-contrast dark/accent header row (≥7:1 contrast), uppercase mono labels.',
      zebra: 'Subtle alternating row fill (canvas vs tinted surface) + 1px horizontal rules.',
      alignment: 'Left-align text/category columns (body font); right-align all numeric/currency/percentage columns (tabular mono). Bold summary/total row with 2px top border.'
    },
    pagePatterns: [
      { id: 'cover', name: 'Cover Eksekutif', role: 'Org eyebrow, accent bar, monumental serif/display title, 3-metric executive snapshot strip, bottom document metadata rail.' },
      { id: 'kpi-summary', name: 'Ringkasan KPI + Chart', role: 'Running header, insight headline, 3–4 KPI cards (value/label/delta), framed bar/line/hbar chart, 2–3 concise takeaways, running footer.' },
      { id: 'data-table', name: 'Halaman Tabel Data Rapi', role: 'Running header, insight headline + unit note, contrast header + subtle zebra rows + right-aligned tabular numbers (≤10–14 rows/page), audit footnote, running footer.' },
      { id: 'notes-summary', name: 'Halaman Catatan / Kesimpulan', role: 'Running header, conclusions headline, 3–4 numbered findings (≤2 lines each), action-plan table (owner + target date), review/sign-off strip, running footer.' }
    ]
  }
}

// Compute proportional scale & grid numbers for ANY artboard dimensions (w × h)
export function scaleSystem(w = 1920, h = 1080, marginRatio = 0.07) {
  const W = Math.max(200, Number(w) || 1920), H = Math.max(200, Number(h) || 1080)
  const shortSide = Math.min(W, H), aspect = W / H
  const snap8 = v => Math.max(8, Math.round(v / 8) * 8)
  const marginX = snap8(W * marginRatio)
  const marginY = snap8(H * Math.min(marginRatio * 1.05, 0.11))
  const contentW = W - marginX * 2
  const contentH = H - marginY * 2
  const baseBody = Math.max(14, Math.round(shortSide * (aspect > 1.3 ? 0.026 : 0.023)))
  const minText = Math.max(12, Math.round(shortSide / 60))
  return {
    artboard: { w: W, h: H, orientation: aspect > 1.15 ? 'landscape' : aspect < 0.85 ? 'portrait' : 'square' },
    margins: { x: marginX, y: marginY, contentW, contentH },
    spacingScale: [8, 16, 24, 32, 48, 64, 96].filter(n => n <= Math.round(shortSide * 0.14)),
    columns: W >= 1400 ? 12 : W >= 900 ? 6 : 4,
    gutter: snap8(Math.max(16, W * 0.018)),
    typeScale: {
      heroDisplay: `${Math.round(baseBody * 3.2)}–${Math.round(baseBody * 4.6)}px`,
      sectionTitle: `${Math.round(baseBody * 2.0)}–${Math.round(baseBody * 2.7)}px`,
      statFigure: `${Math.round(baseBody * 3.4)}–${Math.round(baseBody * 4.8)}px`,
      subhead: `${Math.round(baseBody * 1.25)}–${Math.round(baseBody * 1.5)}px`,
      body: `${baseBody}–${Math.round(baseBody * 1.15)}px`,
      eyebrow: `${Math.max(minText, Math.round(baseBody * 0.72))}–${Math.max(minText + 2, Math.round(baseBody * 0.82))}px (min floor: ${minText}px)`
    }
  }
}

// Detect structured document preset (e.g. Business / Admin Report on A4 portrait)
export function inferDocumentPreset({ brief = '', style = '', format = '', w, h } = {}) {
  const s = String(style || '').trim().toLowerCase()
  const f = String(format || '').trim().toLowerCase()
  const text = `${brief} ${s} ${f}`.toLowerCase()
  if (s === 'admin-report' || s === 'business-report' || f === 'admin-report' || f === 'business-report') {
    return DOCUMENT_PRESETS['admin-report']
  }
  const isSlide = f.startsWith('slide') || /\b(deck|slides?|pitch|pptx|keynote)\b/.test(text)
  if (isSlide) return null
  const preset = DOCUMENT_PRESETS['admin-report']
  const kwMatch = preset.keywords.some(kw => text.includes(kw))
  const isA4 = f === 'a4' || (Number(w) === 794 && Number(h) === 1123)
  if (kwMatch) return preset
  if (isA4 && /\b(report|kpi|finance|financial|quarterly|monthly|summary|table|audit|budget|keuangan|operasional|penjualan|admin)\b/.test(text)) {
    return preset
  }
  return null
}

// Infer primary & secondary aesthetic direction from brief + explicit style hint
export function inferDirection({ brief = '', style = '', format = '', mood = '', extraDirections = {} } = {}) {
  const pool = { ...DIRECTIONS, ...(extraDirections || {}) }
  const s = String(style || '').trim().toLowerCase()
  if (s === 'admin-report' || s === 'business-report') {
    return { primary: DIRECTIONS['corporate-premium'], secondary: DIRECTIONS['swiss-editorial'], reason: 'Matched Business / Admin Report preset → Corporate Premium × Swiss Editorial.' }
  }
  if (s && pool[s]) {
    return { primary: pool[s], secondary: null, reason: `Explicitly requested "${pool[s].name}".` }
  }
  if (s) {
    const match = Object.values(pool).find(d => d.id.includes(s) || d.name.toLowerCase().includes(s))
    if (match) return { primary: match, secondary: null, reason: `Matched style hint "${style}" → ${match.name}.` }
  }
  const text = `${brief} ${style} ${format} ${mood}`.toLowerCase()
  const scored = Object.values(pool).map(d => {
    let score = 0
    for (const kw of d.keywords || []) {
      if (text.includes(kw)) score += kw.includes(' ') ? 4 : 2
    }
    if (d.community && score > 0) score += 2
    if (format === 'a4' || format === 'a3' || format === 'a2') {
      if (d.id === 'swiss-editorial') score += 1
    }
    if (format === 'slide' || format === 'slide-16x9') {
      if (d.id === 'corporate-premium') score += 1
    }
    if (format === 'yt-thumbnail') {
      if (d.id === 'cinematic' || d.id === 'brutalism') score += 1
    }
    return { dir: d, score }
  }).sort((a, b) => b.score - a.score)

  const top = scored[0]
  if (!top || top.score === 0) {
    const fallback = (format === 'a4' || format === 'a3' || format === 'a2') ? DIRECTIONS['swiss-editorial'] : DIRECTIONS['editorial-product']
    return { primary: fallback, secondary: DIRECTIONS['swiss-editorial'], reason: 'No specific aesthetic keyword detected — starting with clean contemporary editorial clarity.' }
  }
  const second = scored[1] && scored[1].score > 0 ? scored[1].dir : null
  return {
    primary: top.dir,
    secondary: second && second.id !== top.dir.id ? second : null,
    reason: `Matched brief context → ${top.dir.name}${second ? ` (with ${second.name} influence)` : ''}.`
  }
}

export function buildArtDirection({ brief = '', style = '', format = 'slide', w, h, mood = '', brand = null, extraDirections = {} } = {}) {
  const effectiveStyle = style || brand?.style?.direction || ''
  const docPreset = inferDocumentPreset({ brief, style: effectiveStyle, format, w, h })
  const effW = w || (docPreset ? docPreset.dimensions.w : undefined)
  const effH = h || (docPreset ? docPreset.dimensions.h : undefined)
  const { primary, secondary, reason } = inferDirection({ brief, style: effectiveStyle, format, mood, extraDirections })
  const bp = primary.blueprint || { ...DEFAULT_BLUEPRINT, marginRatio: { x: primary.marginRatio || 0.07, y: primary.marginRatio || 0.07 } }
  const grid = scaleSystem(effW, effH, primary.marginRatio)
  const palette = brand?.colors
    ? {
        name: `Brand Kit: ${brand.name}`,
        bg: brand.colors.background || '#FAF8F5',
        surface: brand.colors.surface || '#FFFFFF',
        text: brand.colors.text || '#111827',
        muted: brand.colors.muted || '#4B5563',
        accent: brand.colors.accent || brand.colors.primary || '#111827',
        primary: brand.colors.primary,
        secondary: brand.colors.secondary,
        palette: brand.colors.palette || []
      }
    : primary.palettes[0]
  const fonts = brand?.fonts && (brand.fonts.display || brand.fonts.body)
    ? [{ display: brand.fonts.display || primary.fontPairings[0].display, body: brand.fonts.body || primary.fontPairings[0].body, mono: brand.fonts.mono || 'IBM Plex Mono', mood: `Brand Kit: ${brand.name}` }]
    : primary.fontPairings

  const compIds = docPreset
    ? ['report-document', 'data-narrative']
    : [...new Set(primary.compositions || ['asymmetric-split'])].slice(0, 3)
  const compositions = compIds.filter(id => COMPOSITIONS[id]).map(id => ({ id, ...COMPOSITIONS[id] }))
  const orientKey = grid.artboard.orientation === 'portrait' ? 'portrait' : 'landscape'
  const cb = bp.colorBudget || DEFAULT_BLUEPRINT.colorBudget
  const caps = bp.maxElementsPerZone || DEFAULT_BLUEPRINT.maxElementsPerZone

  const lines = [
    `# Art Direction — ${primary.name}${secondary ? ` × ${secondary.name}` : ''}`,
    `> ${reason} Starting lens, not a rigid template—adapt intentionally to the subject.`,
    '',
    `## 1. Lens & Craft`,
    `- **Lens:** ${primary.summary}`,
    `- **Surface:** ${primary.surfaceRules}`,
    `- **Type:** ${primary.typographyRules}`,
    '',
    `## 2. Structured Layout Blueprint (${grid.artboard.w}×${grid.artboard.h}, ${grid.artboard.orientation})`,
    `- **Margins & grid:** x \`${grid.margins.x}px\` (${Math.round(bp.marginRatio.x * 100)}%) · y \`${grid.margins.y}px\` · frame \`${grid.margins.contentW}×${grid.margins.contentH}px\` · ${grid.columns}-col (${bp.columnGrid[orientKey]}) · gutter \`${grid.gutter}px\` · rhythm \`${grid.spacingScale.join('/')}\`px`,
    `- **Focal & whitespace:** focal \`${bp.focalArea}\` · whitespace target \`${bp.whitespaceTarget.min}–${bp.whitespaceTarget.max}%\``,
    `- **Color budget (60-30-10):** ${cb.canvas}% canvas (\`${palette.bg}\`) / ${cb.surface}% surface & structure (\`${palette.surface}\` + ink \`${palette.text}\`) / ${cb.accent}% accent (\`${palette.accent}\`, max ${cb.maxAccents} accent hue${cb.maxAccents > 1 ? 's' : ''})`,
    `- **Element caps:** header ≤${caps.header} · focal ≤${caps.focal} · body ≤${caps.body} · footer ≤${caps.footer} · artboard total ≤${caps.total}`,
    `- **Zones:**`,
    ...bp.zones.map(z => `  - \`${z.id}\` (${z.heightRatio}, ≤${z.maxElements} els): ${z.role}`),
    `- **Type scale:** hero ${grid.typeScale.heroDisplay} · title ${grid.typeScale.sectionTitle} · stat ${grid.typeScale.statFigure} · sub ${grid.typeScale.subhead} · body ${grid.typeScale.body} · meta ${grid.typeScale.eyebrow}`,
    '',
    `## 3. Palette & Typography`,
    ...(brand ? [
      `- **Brand Kit:** \`${brand.id}\` (${brand.name})${brand.tagline ? ` — "${brand.tagline}"` : ''}${brand.voice ? ` · voice: ${brand.voice}` : ''}`,
      ...(brand.logos?.length ? [`- **Logos (\`gambar.src\`):** ${brand.logos.map(l => `${l.variant || l.name}: \`${l.src}\``).join(' · ')}`] : []),
      ...(brand.style?.guidelines?.length ? [`- **Brand rules:** ${brand.style.guidelines.join(' | ')}`] : [])
    ] : []),
    `- **Primary (${palette.name}):** bg \`${palette.bg}\` · surface \`${palette.surface}\` · text \`${palette.text}\` · muted \`${palette.muted}\` · accent \`${palette.accent}\`${palette.rule ? ` · rule \`${palette.rule}\`` : ''}`,
    ...(!brand && primary.palettes.length > 1 ? [`- **Alts:** ${primary.palettes.slice(1).map(p => `${p.name} (${p.bg}/${p.text}/${p.accent})`).join(' | ')}`] : []),
    `- **Fonts:** ${fonts.map(f => `\`${f.display}\` + \`${f.body}\` + \`${f.mono}\``).join(' | ')}`,
    '',
    `## 4. Composition Blueprints`,
    ...compositions.map((c, i) => `${i + 1}. **${c.name}** [${c.gridRatio} · ws ${c.whitespaceTarget}] — ${c.how}`),
    '',
    `## 5. Anti-Slop Guardrails`,
    ...bp.antiSlop.map(r => `- ${r}`),
    `- Use \`tata\` auto-layout & components for cards/rails; run \`kanvas_view\` and target 0 issues + QA ≥ 85.`
  ]

  if (docPreset) {
    lines.push(
      '',
      `## 6. Document Preset — ${docPreset.name} (${docPreset.dimensions.w}×${docPreset.dimensions.h} A4)`,
      `- **Header/footer rails:** Skip cover; pages 2..N use 13px mono title+section above 1px rule (y=88) and 1px rule (y=1046) + org + "PAGE XX / NN".`,
      `- **Pagination:** ≤${docPreset.pagination.maxTableRowsFirstPage} table rows on intro page, ≤${docPreset.pagination.maxTableRowsContinuation} on continuation pages; never split KPI/chart/callout; repeat dark header + "(cont.)" on overflow.`,
      `- **Tables:** Contrast dark header, subtle zebra rows + 1px rules, left-aligned text / right-aligned tabular mono numbers, bold total row.`,
      `- **Pages:** ${docPreset.pagePatterns.map(p => `\`${p.id}\` (${p.name})`).join(' → ')}`
    )
  }

  return {
    direction: primary.id,
    secondaryDirection: secondary?.id || null,
    grid,
    blueprint: bp,
    colorBudget: cb,
    documentPreset: docPreset ? docPreset.id : null,
    palette,
    fonts,
    compositions,
    brandId: brand?.id || null,
    briefText: lines.join('\n')
  }
}

export function listDirectionsSummary() {
  return Object.values(DIRECTIONS).map(d =>
    `- **${d.id}** (${d.name}): ${d.summary}`
  ).join('\n')
}

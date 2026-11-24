// Design Intelligence engine for Kanvas Studio.
// Provides adaptive art direction, proportional canvas grids, typography craft,
// and contextual visual systems — without locking agents into rigid templates.

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
    surfaceRules: 'Prefer flat paper/ink tones, crisp 1–2px dividing rules (garis or thin path lines), 0–8px corners, and zero soft drop shadows. Let alignment and scale create hierarchy.',
    typographyRules: 'Tight headline tracking (-2 to -4px) and tight leading (0.94–1.05). Pair oversized headline (3.5×–5× body) with compact uppercase monospace metadata or index numbers (01, 02, 03).'
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
    surfaceRules: 'Use ultra-generous breathing room (10–14% margins). Avoid gradients, heavy shadows, and loud badges. Rely on subtle 1px hairline borders, calm tonal steps, and crisp imagery.',
    typographyRules: 'High-contrast serif display at light/regular/medium weight (400–600), paired with small tracked-out uppercase sans eyebrows (+3 to +6px letter-spacing). Never cram text.'
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
    surfaceRules: 'Zero or minimal border radius (0–6px), thick solid strokes (3–6px), stark color blocks, and crisp hard-edge layering (avoid soft blurred shadows).',
    typographyRules: 'Push display scale to the limit (often 4×–7× body), tight leading (0.90–0.98), uppercase condensed titles juxtaposed with crisp tabular monospace event details.'
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
    surfaceRules: 'Build depth with rich dark tonal layers or full-bleed imagery, subtle dark gradient scrims only where needed to guarantee text contrast (≥4.5:1), and restrained geometric light accents.',
    typographyRules: 'Dramatic contrast between monumental hero title and small wide-tracked credit/caption bars (+4 to +8px letter-spacing, uppercase). Leave large dark negative space for atmosphere.'
  },

  'corporate-premium': {
    id: 'corporate-premium',
    name: 'Corporate Premium / Executive',
    summary: 'Boardroom-grade editorial clarity: authoritative data hierarchy, calm neutral surfaces, crisp structural lines, and zero gimmicks.',
    keywords: ['corporate', 'investor', 'report', 'annual', 'finance', 'financial', 'banking', 'enterprise', 'b2b', 'strategy', 'consulting', 'board', 'quarterly', 'q1', 'q2', 'q3', 'q4', 'pitch', 'deck', 'executive', 'energy', 'industrial', 'research', 'whitepaper', 'case study', 'proposal'],
    marginRatio: 0.075,
    fontPairings: [
      { display: 'DM Serif Display', body: 'Inter', mono: 'IBM Plex Mono', mood: 'editorial institutional authority' },
      { display: 'Plus Jakarta Sans', body: 'Inter', mono: 'IBM Plex Mono', mood: 'modern enterprise clarity' },
      { display: 'Merriweather', body: 'DM Sans', mono: 'JetBrains Mono', mood: 'research & financial publication' }
    ],
    palettes: [
      { name: 'Deep Slate & Emerald Signal', bg: '#F7F8FA', surface: '#FFFFFF', text: '#0F172A', muted: '#475569', accent: '#047857', rule: '#DCE2EA' },
      { name: 'Boardroom Navy & Warm Gold', bg: '#0D1B2A', surface: '#16283D', text: '#F8FAFC', muted: '#94A3B8', accent: '#D4A359', rule: '#273E59' },
      { name: 'Warm Paper & Burgundy', bg: '#F8F6F2', surface: '#EFECE6', text: '#1E1B18', muted: '#5E574F', accent: '#7F1D1D', rule: '#DBD5CB' }
    ],
    compositions: ['data-narrative', 'editorial-grid', 'asymmetric-split'],
    surfaceRules: 'Keep cards subtle (0–16px radius, 1px hairline border instead of heavy drop shadows). Anchor multi-slide decks with consistent header/footer rails and slide numbers.',
    typographyRules: 'Lead every slide with a clear insight headline (not a vague topic label). Use oversized tabular KPI figures (3×–4× body) with concise 1-line captions underneath.'
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
    surfaceRules: 'Craft bespoke vector path shapes (curves, organic forms, geometric cuts) using Kanvas path/titik elements. Layer elements deliberately with controlled opacity and rotation while keeping text legible.',
    typographyRules: 'Break rigid centering with offset baselines, oversized single-word anchors, or rotated secondary labels (e.g. 90° vertical edge stamp) — always verify contrast and overlap via kanvas_view.'
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
    surfaceRules: 'Use auto-layout groups (tata) for clean card alignment, subtle borders or restrained elevation, and crisp Lucide icons. Avoid putting gradients on everything — use 1 strong focal accent.',
    typographyRules: 'Distinctive display font for headlines paired with highly readable humanist sans body. Keep buttons concise, cards scannable (max 3–4 short lines), and numbers prominent.'
  }
}

export const COMPOSITIONS = {
  'asymmetric-split': {
    name: 'Asymmetric Split (60/40)',
    how: 'Divide the active area inside margins into a dominant 58–62% zone (headline + primary narrative or hero visual) and a contrasting 36–40% zone (supporting card, photography, or key metric). Separate with whitespace or a crisp 1px rule.'
  },
  'editorial-grid': {
    name: 'Editorial Column Grid',
    how: 'Anchor top metadata bar (eyebrow/index/date), strong display title spanning 8–10 columns, then structured 2- or 3-column content below separated by subtle rules. Leave one column or band intentionally open as negative space.'
  },
  'typographic-hero': {
    name: 'Monumental Typographic Hero',
    how: 'Let oversized display typography occupy 45–65% of the visual focus (2–3 impactful lines with tight leading ~0.95). Counterbalance with small structured details anchored cleanly to opposite corners or a bottom rail.'
  },
  'bento-modular': {
    name: 'Modular Bento Grid',
    how: 'Use auto-layout rows/columns with varied tile proportions (e.g. one 2× hero tile paired with two compact stacked tiles) instead of identical repetitive boxes. Keep outer gap uniform (24–32px).'
  },
  'full-bleed-frame': {
    name: 'Full-Bleed Visual + Protected Type Zone',
    how: 'Bleed photography or large sculptural shapes right to the artboard edge (even slightly past edges for natural cropping). Reserve a clean tonal band or dark/light scrim zone so typography hits ≥4.5:1 contrast.'
  },
  'luxury-centered': {
    name: 'Calm Axial Symmetry',
    how: 'Generous 10–14% margins on all sides. Center a single refined centerpiece (product visual, emblem, or serif statement) with tracked-out small uppercase framing above and below. Remove every non-essential element.'
  },
  'diagonal-tension': {
    name: 'Diagonal Counter-Balance',
    how: 'Anchor the hero visual or title in the upper-left/mid-left and counter-balance with a crisp callout, vector accent, or metadata block in the lower-right (or reversed), guiding the eye diagonally across open canvas.'
  },
  'data-narrative': {
    name: 'Insight Headline + Hero Evidence',
    how: 'Top insight statement (what the audience should conclude), paired with a dominant visual proof area (oversized stat callout, proportional comparison bars, or structured 3-point auto-layout stack) and concise footnote source.'
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

// Infer primary & secondary aesthetic direction from brief + explicit style hint
export function inferDirection({ brief = '', style = '', format = '', mood = '', extraDirections = {} } = {}) {
  const pool = { ...DIRECTIONS, ...(extraDirections || {}) }
  const s = String(style || '').trim().toLowerCase()
  if (s && pool[s]) {
    return { primary: pool[s], secondary: null, reason: `Explicitly requested "${pool[s].name}".` }
  }
  // fuzzy match style name
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
    // format priors (light touch so brief dominates)
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
    return { primary: fallback, secondary: DIRECTIONS['swiss-editorial'], reason: 'No specific aesthetic keyword detected — starting with clean contemporary editorial clarity; adapt freely to the subject matter.' }
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
  const { primary, secondary, reason } = inferDirection({ brief, style: effectiveStyle, format, mood, extraDirections })
  const grid = scaleSystem(w, h, primary.marginRatio)
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

  const compositions = (primary.compositions || ['asymmetric-split']).filter(id => COMPOSITIONS[id]).map(id => ({ id, ...COMPOSITIONS[id] }))
  const lines = [
    `# Art Direction Brief — ${primary.name}${secondary ? ` × ${secondary.name}` : ''}`,
    `> ${reason}`,
    `> **Creative freedom:** These aesthetics are a starting lens, not a rigid template. Adapt, combine, or break rules intentionally whenever the user's subject calls for a stronger visual idea.`,
    '',
    `## 1. Visual Direction`,
    `- **Primary lens:** ${primary.name} — ${primary.summary}`,
    ...(secondary ? [`- **Secondary influence:** ${secondary.name} — ${secondary.summary}`] : []),
    `- **Surface & material:** ${primary.surfaceRules}`,
    `- **Typography craft:** ${primary.typographyRules}`,
    '',
    `## 2. Proportional Canvas & Grid (${grid.artboard.w}×${grid.artboard.h}, ${grid.artboard.orientation})`,
    `- **Safe margins:** left/right \`${grid.margins.x}px\`, top/bottom \`${grid.margins.y}px\` (active frame \`${grid.margins.contentW}×${grid.margins.contentH}px\`)`,
    `- **Grid:** ${grid.columns} columns · gutter \`${grid.gutter}px\` · spacing rhythm \`${grid.spacingScale.join(' / ')}px\``,
    `- **Recommended type hierarchy:**`,
    `  - Hero display: ${grid.typeScale.heroDisplay}`,
    `  - Section title: ${grid.typeScale.sectionTitle}`,
    `  - Stat / hero number: ${grid.typeScale.statFigure}`,
    `  - Subhead: ${grid.typeScale.subhead}`,
    `  - Body: ${grid.typeScale.body}`,
    `  - Eyebrow / caption: ${grid.typeScale.eyebrow}`,
    '',
    `## 3. Color & Typography System`,
    ...(brand ? [
      `- **Active Brand Kit:** \`${brand.id}\` (${brand.name})${brand.tagline ? ` — "${brand.tagline}"` : ''}`,
      ...(brand.voice ? [`- **Brand voice:** ${brand.voice}`] : []),
      ...(brand.logos?.length ? [`- **Brand logos (use as gambar \`src\`):** ${brand.logos.map(l => `${l.variant || l.name}: \`${l.src}\``).join(' · ')}`] : []),
      ...(brand.style?.guidelines?.length ? [`- **Brand visual guidelines (design rules only):** ${brand.style.guidelines.join(' | ')}`] : [])
    ] : []),
    `- **Color palette (${palette.name}):** bg \`${palette.bg}\` · surface \`${palette.surface}\` · text \`${palette.text}\` · muted \`${palette.muted}\` · accent \`${palette.accent}\`${palette.rule ? ` · hairline \`${palette.rule}\`` : ''}`,
    ...(!brand ? [`- **Alternate palettes in this direction:** ${primary.palettes.slice(1).map(p => `${p.name} (bg ${p.bg}, text ${p.text}, accent ${p.accent})`).join(' | ')}`] : []),
    `- **Font pairing options (any Google Font works):**`,
    ...fonts.map(f => `  - Display \`${f.display}\` + Body \`${f.body}\` + Mono \`${f.mono}\` *(${f.mood})*`),
    '',
    `## 4. Compositional Options (pick or mix; vary across multi-artboard sets)`,
    ...compositions.map((c, i) => `${i + 1}. **${c.name}** — ${c.how}`),
    '',
    `## 5. Craft Guardrails (non-monotonous quality)`,
    `- **Avoid AI-template clichés:** Do not default to generic coral-orange gradients, floating translucent circles, or identical centered 3-card grids unless the brand/brief specifically calls for them.`,
    `- **Strong hierarchy:** Maintain ≥2.5× size contrast between hero headline and body; keep body copy concise and scannable.`,
    `- **Use auto-layout (\`tata\`) & components** for cards, buttons, grids, and repeated rails so elements stay cleanly editable and never collide.`,
    `- **Multi-slide pacing:** Keep margins, type system, and color anchors consistent across slides, while varying layout structure (e.g. typographic opener → asymmetric split → data narrative → full-bleed showcase → minimal closing).`,
    `- **Self-QA loop:** Call \`kanvas_view\` after major passes. Fix every \`ISSUE\`, inspect the rendered PNG critically for balance, whitespace, contrast, and alignment, and aim for Visual QA Score ≥ 85.`
  ]

  return {
    direction: primary.id,
    secondaryDirection: secondary?.id || null,
    grid,
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

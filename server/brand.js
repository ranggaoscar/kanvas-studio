// Multi-brand Brand Kit manager (100% local-first, stored in <workspace>/brands/).
// Works identically in Hermes Desktop (plugin-files/data/kanvas-studio/brands/)
// and standalone MCP workspaces (~/KanvasStudio/brands/).
import { existsSync, readFileSync, mkdirSync, copyFileSync, rmSync, statSync } from 'node:fs'
import { extname, basename, dirname, resolve } from 'node:path'
import { jalur, tulisAtomik, kesalahan } from './ruang.js'

const INDEX_REL = 'brands/index.json'
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'])

export function slugBrand(raw) {
  const s = String(raw || '').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  if (!s || !/^[a-z0-9](?:[a-z0-9-]{0,47})$/.test(s)) {
    throw kesalahan('invalid-brand-id', 'Brand id must contain letters or numbers (e.g. "acme-labs").')
  }
  return s
}

export function normalizeHex(c, field = 'color') {
  if (c == null || c === '') return undefined
  let s = String(c).trim()
  if (!s.startsWith('#')) s = '#' + s
  const raw = s.slice(1)
  if (/^[0-9a-f]{3}$/i.test(raw)) return '#' + [...raw].map(ch => ch + ch).join('').toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(raw)) return '#' + raw.toUpperCase()
  throw kesalahan('invalid-color', `${field} must be a valid hex color (e.g. "#111827"), got "${c}"`)
}

function hexToRgb(c) {
  const h = String(c || '').replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

function luminance(rgb) {
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])
}

function contrastRatio(a, b) {
  const ra = hexToRgb(a), rb = hexToRgb(b)
  if (!ra || !rb) return 1
  const la = luminance(ra), lb = luminance(rb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function pickReadableText(bgHex, candidates, minRatio = 4.5) {
  const list = candidates.filter(Boolean)
  // Prefer the first brand color that meets WCAG AA contrast so brand ink is preserved
  for (const c of list) {
    if (contrastRatio(c, bgHex) >= minRatio) return c
  }
  let best = list[0] || '#111111', bestC = -1
  for (const c of list) {
    const r = contrastRatio(c, bgHex)
    if (r > bestC) { bestC = r; best = c }
  }
  return best
}

function readStore() {
  const p = jalur(INDEX_REL)
  if (!existsSync(p)) return { versi: 1, defaultId: null, brands: {} }
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'))
    return {
      versi: 1,
      defaultId: typeof data.defaultId === 'string' && data.brands?.[data.defaultId] ? data.defaultId : null,
      brands: data.brands && typeof data.brands === 'object' ? data.brands : {}
    }
  } catch {
    return { versi: 1, defaultId: null, brands: {} }
  }
}

function writeStore(store) {
  tulisAtomik(jalur(INDEX_REL), JSON.stringify({ versi: 1, defaultId: store.defaultId || null, brands: store.brands || {} }, null, 2))
}

function cleanColors(input, prev = {}) {
  if (input == null) return prev
  if (typeof input !== 'object' || Array.isArray(input)) throw kesalahan('invalid-colors', 'colors must be an object')
  const out = { ...prev }
  for (const key of ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted']) {
    if (key in input) {
      if (input[key] === null || input[key] === '') delete out[key]
      else out[key] = normalizeHex(input[key], `colors.${key}`)
    }
  }
  if ('palette' in input) {
    if (!Array.isArray(input.palette)) throw kesalahan('invalid-colors', 'colors.palette must be an array of hex colors')
    out.palette = input.palette.map((c, i) => normalizeHex(c, `colors.palette[${i}]`))
  }
  return out
}

function cleanFonts(input, prev = {}) {
  if (input == null) return prev
  if (typeof input !== 'object' || Array.isArray(input)) throw kesalahan('invalid-fonts', 'fonts must be an object')
  const out = { ...prev }
  for (const key of ['display', 'body', 'mono']) {
    if (key in input) {
      if (input[key] === null || input[key] === '') delete out[key]
      else out[key] = String(input[key]).replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64)
    }
  }
  return out
}

function cleanStyle(input, prev = {}) {
  if (input == null) return prev
  if (typeof input !== 'object' || Array.isArray(input)) throw kesalahan('invalid-style', 'style must be an object')
  const out = { ...prev }
  if ('direction' in input) {
    if (input.direction === null || input.direction === '') delete out.direction
    else out.direction = String(input.direction).trim().slice(0, 48)
  }
  if ('radius' in input) {
    if (input.radius === null) delete out.radius
    else if (Number.isFinite(Number(input.radius))) out.radius = Math.max(0, Math.min(999, Number(input.radius)))
    else throw kesalahan('invalid-style', 'style.radius must be a number')
  }
  if ('strokeWidth' in input) {
    if (input.strokeWidth === null) delete out.strokeWidth
    else if (Number.isFinite(Number(input.strokeWidth))) out.strokeWidth = Math.max(0, Math.min(40, Number(input.strokeWidth)))
    else throw kesalahan('invalid-style', 'style.strokeWidth must be a number')
  }
  if ('guidelines' in input) {
    if (!Array.isArray(input.guidelines)) throw kesalahan('invalid-style', 'style.guidelines must be an array of strings')
    out.guidelines = input.guidelines.map(g => String(g).trim().slice(0, 240)).filter(Boolean).slice(0, 20)
  }
  return out
}

export function listBrands() {
  const store = readStore()
  const brands = Object.values(store.brands).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  return { defaultId: store.defaultId, brands }
}

export function getBrand(idOrName) {
  const store = readStore()
  if (!idOrName) return store.defaultId ? store.brands[store.defaultId] || null : null
  const raw = String(idOrName).trim()
  if (store.brands[raw]) return store.brands[raw]
  try {
    const slug = slugBrand(raw)
    if (store.brands[slug]) return store.brands[slug]
  } catch {}
  return Object.values(store.brands).find(b => b.name.toLowerCase() === raw.toLowerCase()) || null
}

export function saveBrand(input = {}) {
  const name = String(input.name || input.id || '').trim().slice(0, 80)
  if (!name) throw kesalahan('invalid-brand', 'Brand "name" (or "id") is required.')
  const id = slugBrand(input.id || name)
  const store = readStore()
  const prev = store.brands[id] || { id, name, logos: [], assets: [], colors: {}, fonts: {}, style: {} }
  const next = {
    id,
    name: input.name ? String(input.name).trim().slice(0, 80) : prev.name,
    tagline: 'tagline' in input ? (input.tagline ? String(input.tagline).trim().slice(0, 180) : undefined) : prev.tagline,
    voice: 'voice' in input ? (input.voice ? String(input.voice).trim().slice(0, 240) : undefined) : prev.voice,
    colors: cleanColors(input.colors, prev.colors || {}),
    fonts: cleanFonts(input.fonts, prev.fonts || {}),
    style: cleanStyle(input.style, prev.style || {}),
    logos: Array.isArray(prev.logos) ? prev.logos : [],
    assets: Array.isArray(prev.assets) ? prev.assets : [],
    updatedAt: new Date().toISOString()
  }
  if (!next.tagline) delete next.tagline
  if (!next.voice) delete next.voice
  store.brands[id] = next
  if (input.setDefault === true || (!store.defaultId && Object.keys(store.brands).length === 1 && input.setDefault !== false)) {
    store.defaultId = id
  }
  writeStore(store)
  return { brand: next, isDefault: store.defaultId === id }
}

export function setDefaultBrand(id) {
  const store = readStore()
  if (id === null || id === '') {
    store.defaultId = null
    writeStore(store)
    return { defaultId: null }
  }
  const found = getBrand(id)
  if (!found) throw kesalahan('brand-not-found', `Brand "${id}" not found.`)
  store.defaultId = found.id
  writeStore(store)
  return { defaultId: found.id, brand: found }
}

export function deleteBrand(id) {
  const store = readStore()
  const found = getBrand(id)
  if (!found) throw kesalahan('brand-not-found', `Brand "${id}" not found.`)
  delete store.brands[found.id]
  if (store.defaultId === found.id) store.defaultId = Object.keys(store.brands)[0] || null
  writeStore(store)
  const dir = jalur(`brands/${found.id}`)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  return { deleted: found.id, defaultId: store.defaultId }
}

export function importBrandAsset(id, { path: filePath, kind = 'logo', name, variant = 'primary', notes } = {}) {
  const store = readStore()
  const brand = getBrand(id)
  if (!brand) throw kesalahan('brand-not-found', `Brand "${id}" not found. Save the brand first with kanvas_brand { action: "save", ... }.`)
  const abs = resolve(String(filePath || ''))
  const ext = extname(abs).toLowerCase()
  if (!IMG_EXT.has(ext) || !existsSync(abs) || !statSync(abs).isFile()) {
    throw kesalahan('invalid-asset', `Not an existing image file (${[...IMG_EXT].join(', ')}): ${abs}`)
  }
  const listKey = kind === 'asset' ? 'assets' : 'logos'
  const rawBase = (name ? String(name) : basename(abs, ext))
    .toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || listKey.slice(0, -1)
  const fileName = `${listKey === 'logos' ? 'logo-' : 'asset-'}${rawBase}${ext}`
  const relSrc = `brands/${brand.id}/${fileName}`
  const dest = jalur(relSrc)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(abs, dest)

  const entry = listKey === 'logos'
    ? { id: rawBase, name: String(name || rawBase).slice(0, 80), variant: String(variant || 'primary').slice(0, 32), src: relSrc }
    : { id: rawBase, name: String(name || rawBase).slice(0, 80), src: relSrc, ...(notes ? { notes: String(notes).slice(0, 200) } : {}) }

  const list = Array.isArray(brand[listKey]) ? brand[listKey].filter(x => x.src !== relSrc) : []
  list.push(entry)
  brand[listKey] = list
  brand.updatedAt = new Date().toISOString()
  store.brands[brand.id] = brand
  writeStore(store)
  return { brand, entry, src: relSrc }
}

// Apply a Brand Kit's typography & palette to an existing design document (pure, returns cloned doc + change log)
export function applyBrandToDoc(docInput, brand, { artboard, recolor = true, retype = true } = {}) {
  const doc = JSON.parse(JSON.stringify(docInput))
  doc.brand = brand.id
  const changes = [`attached brand "${brand.name}" (${brand.id})`]
  const c = brand.colors || {}, f = brand.fonts || {}
  const targetAbs = (doc.artboards || []).filter(ab => !artboard || ab.id === artboard)
  if (artboard && !targetAbs.length) throw kesalahan('not-found', `Artboard "${artboard}" not found.`)

  let bgChanged = 0, fontsChanged = 0, colorsChanged = 0
  const monoRe = /mono|code|courier/i

  for (const ab of targetAbs) {
    if (recolor && c.background && typeof ab.bg === 'string') {
      ab.bg = c.background
      bgChanged++
    }
    const abBg = typeof ab.bg === 'string' ? ab.bg : (Array.isArray(ab.bg?.warna) ? ab.bg.warna[0] : '#FFFFFF')
    const els = ab.elemen || []
    const byId = new Map(els.map(e => [e.id, e]))

    // Pass 1: recolor surfaces, accent shapes, and vector icons
    if (recolor) {
      for (const el of els) {
        if ((el.tipe === 'kotak' || el.tipe === 'grup') && typeof el.fill === 'string') {
          const area = (el.w || 0) * (el.h || 0), abArea = (ab.w || 1) * (ab.h || 1)
          const isSmallAccent = area > 0 && area < abArea * 0.08
          if (isSmallAccent && (c.accent || c.primary)) {
            el.fill = c.accent || c.primary
            colorsChanged++
          } else if (area >= abArea * 0.08 && area < abArea * 0.7 && c.surface) {
            el.fill = c.surface
            colorsChanged++
          }
          if (el.garis?.warna && (c.muted || c.primary)) {
            el.garis.warna = c.muted || c.primary
          }
        } else if (el.tipe === 'path' && el.ikon && el.garis?.warna && (c.accent || c.primary)) {
          el.garis.warna = c.accent || c.primary
          colorsChanged++
        }
      }
    }

    // Pass 2: retype and recolor text against final surface behind each text block
    for (let idx = 0; idx < els.length; idx++) {
      const el = els[idx]
      if (el.tipe !== 'teks') continue
      if (retype) {
        const isMono = el.font && monoRe.test(el.font)
        const isDisplay = (el.ukuran || 32) >= 36 || ((el.ukuran || 32) >= 28 && (el.tebal || 400) >= 700)
        const nextFont = isMono && f.mono ? f.mono : isDisplay && f.display ? f.display : (!isDisplay && f.body ? f.body : (f.display || f.body))
        if (nextFont && el.font !== nextFont) { el.font = nextFont; fontsChanged++ }
      }
      if (recolor && (c.text || c.accent || c.primary)) {
        let localBg = abBg
        if (el.induk) {
          const p = byId.get(el.induk)
          if (p && typeof p.fill === 'string') localBg = p.fill
        } else {
          const cx = (el.x || 0) + (el.w || 200) / 2, cy = (el.y || 0) + (el.ukuran || 32) / 2
          for (const b of els.slice(0, idx)) {
            if (!b.sembunyi && (b.tipe === 'kotak' || b.tipe === 'elips' || b.tipe === 'grup') && typeof b.fill === 'string' && (b.opacity ?? 1) >= 0.6) {
              const bx0 = b.x || 0, by0 = b.y || 0, bx1 = bx0 + (b.w || 100), by1 = by0 + (b.h || 100)
              if (bx0 <= cx && cx <= bx1 && by0 <= cy && cy <= by1) localBg = b.fill
            }
          }
        }
        const isEyebrow = Boolean(el.kapital && (el.ukuran || 32) <= 24)
        const accentCand = c.accent || c.primary
        if (isEyebrow && accentCand && contrastRatio(accentCand, localBg) >= 3.0) {
          el.warna = accentCand
          colorsChanged++
        } else {
          const nextText = pickReadableText(localBg, [c.text, c.muted, '#111111', '#FFFFFF'])
          if (el.warna !== nextText) { el.warna = nextText; colorsChanged++ }
        }
      }
    }
  }

  if (bgChanged) changes.push(`updated ${bgChanged} artboard background(s)`)
  if (fontsChanged) changes.push(`updated ${fontsChanged} text element font(s)`)
  if (colorsChanged) changes.push(`updated ${colorsChanged} element color(s)`)
  return { doc, changes }
}

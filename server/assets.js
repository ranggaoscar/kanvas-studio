// Reusable local Asset Library for Kanvas Studio (P2).
// Stores images, SVGs, illustrations, patterns, and badges locally in <workspace>/assets-library/
// so AI agents and users can search and reuse assets cleanly across all projects.
import { existsSync, readFileSync, mkdirSync, copyFileSync, rmSync, statSync } from 'node:fs'
import { extname, basename, dirname, resolve } from 'node:path'
import { jalur, tulisAtomik, kesalahan } from './ruang.js'

const INDEX_REL = 'assets-library/index.json'
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'])
const CATEGORIES = new Set(['photo', 'illustration', 'svg', 'logo', 'pattern', 'badge', 'other'])

function slugAsset(raw) {
  const s = String(raw || '').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
  if (!s) throw kesalahan('invalid-asset-id', 'Asset name must contain letters or numbers.')
  return s
}

function readStore() {
  const p = jalur(INDEX_REL)
  if (!existsSync(p)) return { versi: 1, assets: {} }
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'))
    return { versi: 1, assets: data.assets && typeof data.assets === 'object' ? data.assets : {} }
  } catch {
    return { versi: 1, assets: {} }
  }
}

function writeStore(store) {
  tulisAtomik(jalur(INDEX_REL), JSON.stringify({ versi: 1, assets: store.assets || {} }, null, 2))
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return []
  return [...new Set(tags.map(t => String(t).toLowerCase().trim().slice(0, 32)).filter(Boolean))].slice(0, 12)
}

export function listAssets({ category, tag, search } = {}) {
  const store = readStore()
  let items = Object.values(store.assets)
  if (category) items = items.filter(a => a.category === String(category).toLowerCase())
  if (tag) {
    const t = String(tag).toLowerCase().trim()
    items = items.filter(a => (a.tags || []).includes(t))
  }
  if (search) {
    const q = String(search).toLowerCase().trim().split(/\s+/).filter(Boolean)
    items = items.filter(a => {
      const hay = `${a.id} ${a.name} ${a.category} ${(a.tags || []).join(' ')} ${a.notes || ''}`.toLowerCase()
      return q.every(tok => hay.includes(tok))
    })
  }
  items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  return { assets: items }
}

export function getAsset(id) {
  const store = readStore()
  const raw = String(id || '').trim()
  if (!raw) return null
  if (store.assets[raw]) return store.assets[raw]
  try {
    const slug = slugAsset(raw)
    if (store.assets[slug]) return store.assets[slug]
  } catch {}
  return Object.values(store.assets).find(a => a.name.toLowerCase() === raw.toLowerCase()) || null
}

export function importAsset({ path: filePath, name, category = 'other', tags = [], notes } = {}) {
  const abs = resolve(String(filePath || ''))
  const ext = extname(abs).toLowerCase()
  if (!IMG_EXT.has(ext) || !existsSync(abs) || !statSync(abs).isFile()) {
    throw kesalahan('invalid-asset', `Not an existing image file (${[...IMG_EXT].join(', ')}): ${abs}`)
  }
  const cat = CATEGORIES.has(String(category).toLowerCase()) ? String(category).toLowerCase() : 'other'
  const baseName = String(name || basename(abs, ext)).trim().slice(0, 80)
  const id = slugAsset(baseName)
  const relSrc = `assets-library/${id}${ext}`
  const dest = jalur(relSrc)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(abs, dest)

  const store = readStore()
  const entry = {
    id,
    name: baseName,
    category: cat,
    src: relSrc,
    ext: ext.slice(1),
    tags: cleanTags(tags),
    ...(notes ? { notes: String(notes).trim().slice(0, 240) } : {}),
    updatedAt: new Date().toISOString()
  }
  store.assets[id] = entry
  writeStore(store)
  return entry
}

export function saveSvgAsset({ name, d, vb = [100, 100], fill = '#111111', stroke = null, category = 'svg', tags = [], notes } = {}) {
  if (!name || !String(d || '').trim()) throw kesalahan('invalid-svg', 'save_svg requires "name" and SVG path data "d".')
  const id = slugAsset(name)
  const [vw, vh] = Array.isArray(vb) && vb.length >= 2 ? [Number(vb[0]) || 100, Number(vb[1]) || 100] : [100, 100]
  const cleanD = String(d).replace(/["<>]/g, '')
  const safeFill = fill ? String(fill).replace(/["<>]/g, '') : 'none'
  const strokeAttr = stroke?.tebal ? ` stroke="${String(stroke.warna || '#111111').replace(/["<>]/g, '')}" stroke-width="${Number(stroke.tebal) || 2}" stroke-linecap="round" stroke-linejoin="round"` : ''
  const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}"><path d="${cleanD}" fill="${safeFill}"${strokeAttr}/></svg>\n`

  const relSrc = `assets-library/${id}.svg`
  tulisAtomik(jalur(relSrc), svgXml)

  const cat = CATEGORIES.has(String(category).toLowerCase()) ? String(category).toLowerCase() : 'svg'
  const store = readStore()
  const entry = {
    id,
    name: String(name).trim().slice(0, 80),
    category: cat,
    src: relSrc,
    ext: 'svg',
    vector: { d: cleanD, vb: [vw, vh], fill: fill || null, ...(stroke ? { garis: stroke } : {}) },
    tags: cleanTags(tags),
    ...(notes ? { notes: String(notes).trim().slice(0, 240) } : {}),
    updatedAt: new Date().toISOString()
  }
  store.assets[id] = entry
  writeStore(store)
  return entry
}

export function deleteAsset(id) {
  const store = readStore()
  const found = getAsset(id)
  if (!found) throw kesalahan('not-found', `Asset "${id}" not found.`)
  delete store.assets[found.id]
  writeStore(store)
  if (found.src) {
    const abs = jalur(found.src)
    if (existsSync(abs)) rmSync(abs, { force: true })
  }
  return { deleted: found.id }
}

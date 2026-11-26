// Opt-in repairs only: preserve copy, existing IDs, and intentional layout.
import { layoutTeksServer, resolveLayout } from './layout.js'

const MAX_NUDGE = 8 // px; larger excursions may be intentional
const clamp = (n, max) => Math.max(0, Math.min(n, max))
const textW = e => Number(e.w ?? 400)

// Run before tree normalization, which expects distinct IDs for its visited set.
export function backfillIds(doc) {
  const healed = [], boards = Array.isArray(doc.artboards) ? doc.artboards : []
  const elements = ab => Array.isArray(ab.elemen) ? ab.elemen : []
  const ids = new Set(boards.flatMap(ab => [ab.id, ...elements(ab).map(e => e.id)]))
  for (const [ai, ab] of boards.entries()) {
    for (const [ei, e] of elements(ab).entries()) {
      if (e.id) continue
      const base = `heal-${ai + 1}-${ei + 1}`
      let id = base, n = 1
      while (ids.has(id)) id = `${base}-${++n}`
      e.id = id; ids.add(id)
      healed.push({ artboard: ab.id, id, rule: 'missing_id' })
    }
  }
  return healed
}

export function heal(doc) {
  const healed = backfillIds(doc)
  for (const ab of doc.artboards) {
    const byId = new Map(ab.elemen.map(e => [e.id, e])), dirty = new Set()
    const W = Number(ab.w), H = Number(ab.h)
    for (const e of ab.elemen) {
      if (e.tipe !== 'teks' || e.sembunyi) continue
      const chain = [], seen = new Set([e.id])
      for (let id = e.induk; id && !seen.has(id); id = byId.get(id)?.induk) {
        seen.add(id)
        if (byId.has(id)) chain.push(byId.get(id))
      }
      const auto = chain.filter(g => g.tipe === 'grup' && g.tata)
      const report = rule => healed.push({ artboard: ab.id, id: e.id, rule })
      // Instance internals are derived from their masters. Don't repair them directly.
      if (chain.some(g => g.salinan)) continue
      const lh = Number(e.lh), width = textW(e)
      if (e.lh != null && Number.isFinite(lh) && (lh < 0.85 || lh > 2.1) && layoutTeksServer(e).lines.length >= 2) {
        e.lh = lh < 0.85 ? 1.15 : 1.6
        report('line_height')
        if (auto.length && !chain.at(-1).induk && byId.size === ab.elemen.length) dirty.add(chain.at(-1).id)
      }
      // A group's position is its own layout intent, not an artboard-local typo.
      if (e.induk || e.rotasi || e.bleed || e.dekoratif || (e.opacity ?? 1) < 0.6) continue
      const x = Number(e.x ?? 0), y = Number(e.y ?? 0)
      if (![W, H, width, x, y].every(Number.isFinite) || width <= 0 || width > W) continue
      const L = layoutTeksServer(e), height = Math.max(L.h, Number(e.h) || 0)
      if (L.lw > width || height <= 0 || height > H) continue
      const nx = clamp(x, W - width), ny = clamp(y, H - height)
      if ((nx !== x || ny !== y) && Math.abs(nx - x) <= MAX_NUDGE && Math.abs(ny - y) <= MAX_NUDGE) {
        if (nx !== x) e.x = nx
        if (ny !== y) e.y = ny
        report('position')
      }
    }
    if (dirty.size) {
      const kids = new Map()
      for (const e of ab.elemen) if (e.induk) {
        if (!kids.has(e.induk)) kids.set(e.induk, [])
        kids.get(e.induk).push(e)
      }
      const roots = [...dirty].map(id => byId.get(id)), subtree = [...roots]
      for (let i = 0; i < subtree.length; i++) subtree.push(...(kids.get(subtree[i].id) || []))
      resolveLayout({ artboards: [{ ...ab, elemen: subtree }] })
      for (const root of roots) healed.push({ artboard: ab.id, id: root.id, rule: 'reflow' })
    }
  }
  return healed
}

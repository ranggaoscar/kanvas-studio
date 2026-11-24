// Smart Resize engine for Kanvas Studio (P1).
// Resizes an artboard to any target preset or custom w×h while recomposing layout,
// preserving aspect ratios (circles/icons/logos), flipping wide horizontal stacks into
// vertical stacks when shifting landscape → portrait, scaling typography above legibility
// floors, and resolving vertical collisions automatically.
import { PRESET, normalisasi } from './ops.js'
import { resolveLayout, tinggiServer, padding4 } from './layout.js'
import { lepasInstance } from './komponen.js'

const uid = (p, used) => {
  let id
  do id = p + Math.random().toString(36).slice(2, 7)
  while (used.has(id))
  used.add(id)
  return id
}

function allIds(doc) {
  const s = new Set()
  for (const ab of doc.artboards || []) {
    s.add(ab.id)
    for (const e of ab.elemen || []) s.add(e.id)
  }
  return s
}

function scalePadding(p, factor) {
  const [t, r, b, l] = padding4(p).map(v => Math.max(4, Math.round(v * factor)))
  return (t === r && r === b && b === l) ? t : [t, r, b, l]
}

function isDecorative(el, W, H) {
  if (el.tipe === 'teks') return false
  const area = (el.w || 100) * (el.h || 100)
  return (el.opacity ?? 1) < 0.55 || area > W * H * 0.55
}

function cloneElementsWithFreshIds(els, used) {
  const map = new Map()
  for (const e of els) map.set(e.id, uid(e.tipe === 'grup' ? 'g' : 'e', used))
  return els.map(e => {
    const c = JSON.parse(JSON.stringify(e))
    c.id = map.get(e.id)
    if (c.induk && map.has(c.induk)) c.induk = map.get(c.induk)
    delete c.komponen   // copies shouldn't claim duplicate master status
    return c
  })
}

function shiftSubtree(els, rootId, dx, dy) {
  if (!dx && !dy) return
  const kids = new Map()
  for (const e of els) if (e.induk) { if (!kids.has(e.induk)) kids.set(e.induk, []); kids.get(e.induk).push(e) }
  const walk = id => {
    for (const c of kids.get(id) || []) {
      c.x = Math.round((c.x || 0) + dx)
      c.y = Math.round((c.y || 0) + dy)
      walk(c.id)
    }
  }
  walk(rootId)
}

export function smartResizeArtboard(docInput, { artboard, ukuran, w, h, nama, mode = 'copy', marginRatio = 0.065 } = {}) {
  const doc = normalisasi(JSON.parse(JSON.stringify(docInput)))
  resolveLayout(doc)
  const srcAb = artboard ? doc.artboards.find(a => a.id === artboard) : doc.artboards[0]
  if (!srcAb) throw new Error(artboard ? `Artboard "${artboard}" not found.` : 'Document has no artboards.')

  const presetKey = ukuran ? String(ukuran).toLowerCase() : null
  const [targetW, targetH] = (w && h)
    ? [Math.round(Number(w)), Math.round(Number(h))]
    : (presetKey && PRESET[presetKey])
      ? PRESET[presetKey]
      : (() => { throw new Error(`Give valid "ukuran" (${Object.keys(PRESET).join(', ')}) or numeric "w" & "h".`) })()

  if (!Number.isFinite(targetW) || !Number.isFinite(targetH) || targetW < 100 || targetH < 100) {
    throw new Error('Target dimensions must be at least 100×100 px.')
  }

  const used = allIds(doc)
  const srcW = srcAb.w || 1920, srcH = srcAb.h || 1080
  const srcAspect = srcW / srcH, dstAspect = targetW / targetH
  const landToPort = srcAspect > 1.15 && dstAspect < 0.92
  const portToLand = srcAspect < 0.88 && dstAspect > 1.15
  const sx = targetW / srcW, sy = targetH / srcH
  const areaScale = Math.sqrt((targetW * targetH) / (srcW * srcH))
  const minFont = Math.max(12, Math.round(Math.min(targetW, targetH) / 60))
  const safeM = Math.max(24, Math.round(Math.min(targetW, targetH) * marginRatio))
  const contentW = Math.max(120, targetW - safeM * 2)
  const contentH = Math.max(120, targetH - safeM * 2)

  // Prepare working artboard (copy or in-place)
  let targetAb
  if (mode === 'in_place') {
    targetAb = srcAb
    if (nama) targetAb.nama = nama
  } else {
    // Detach component copies on cloned slice so resizing doesn't break master overrides across formats
    const tempDoc = { versi: 1, judul: doc.judul, artboards: [JSON.parse(JSON.stringify(srcAb))] }
    for (const el of [...tempDoc.artboards[0].elemen]) {
      if (el.salinan) lepasInstance(tempDoc, el.id, () => uid('e', used))
    }
    const last = doc.artboards.at(-1)
    targetAb = {
      id: uid('a', used),
      nama: nama || `${srcAb.nama} (${presetKey || `${targetW}×${targetH}`})`,
      x: last ? last.x + last.w + 160 : 0,
      y: last ? last.y : 0,
      w: targetW,
      h: targetH,
      bg: JSON.parse(JSON.stringify(srcAb.bg)),
      elemen: cloneElementsWithFreshIds(tempDoc.artboards[0].elemen, used)
    }
    doc.artboards.push(targetAb)
  }

  targetAb.w = targetW
  targetAb.h = targetH
  const els = targetAb.elemen
  const byId = new Map(els.map(e => [e.id, e]))
  const childrenOf = id => els.filter(e => e.induk === id)
  const actions = []

  // 1. Scale typography, radii, strokes, auto-layout parameters across all elements
  const fontScale = Math.max(0.55, Math.min(1.8, areaScale))
  for (const el of els) {
    if (el.tipe === 'teks') {
      const nextUk = Math.max(minFont, Math.round((el.ukuran || 32) * fontScale))
      el.ukuran = nextUk
      if (typeof el.spasi === 'number') el.spasi = Math.round(el.spasi * fontScale * 10) / 10
    }
    if (typeof el.radius === 'number' && el.radius > 0 && el.radius < 900) {
      el.radius = Math.max(2, Math.round(el.radius * Math.min(sx, sy, 1.4)))
    }
    if (el.garis?.tebal) {
      el.garis.tebal = Math.max(1, Math.round(el.garis.tebal * Math.max(0.7, Math.min(1.5, areaScale)) * 10) / 10)
    }
    if (el.tipe === 'grup' && el.tata) {
      if (el.tata.jarak != null) el.tata.jarak = Math.max(6, Math.round(Number(el.tata.jarak) * Math.max(0.65, Math.min(1.4, areaScale))))
      if (el.tata.padding != null) el.tata.padding = scalePadding(el.tata.padding, Math.max(0.65, Math.min(1.35, areaScale)))
    }
  }

  // 2. Flip wide horizontal auto-layout rows into vertical stacks on landscape → portrait
  let flippedRows = 0
  if (landToPort) {
    for (const el of els) {
      if (el.tipe === 'grup' && el.tata?.arah === 'baris') {
        const kids = childrenOf(el.id)
        const isSmallPill = (el.w || 0) < srcW * 0.35 && kids.length <= 2
        if (!isSmallPill && kids.length >= 2) {
          el.tata.arah = 'kolom'
          el.tata.rata = 'regang'
          el.lebar = 'tetap'
          el.tinggi = 'peluk'
          for (const k of kids) {
            if (k.lebar === 'isi') k.lebar = 'isi'
            if (k.tinggi === 'isi') k.tinggi = 'peluk'
          }
          flippedRows++
        }
      }
    }
  }
  if (flippedRows) actions.push(`reflowed ${flippedRows} horizontal auto-layout group(s) into vertical stacks`)

  // 3. Transform top-level elements & groups
  const topLevel = els.filter(e => !e.induk)
  const decor = topLevel.filter(e => isDecorative(e, srcW, srcH))
  const foreground = topLevel.filter(e => !isDecorative(e, srcW, srcH))

  // 3a. Decorative backgrounds / edge bleeds scale cleanly to target frame
  for (const el of decor) {
    const oldX = el.x || 0, oldY = el.y || 0
    if (el.tipe === 'elips' && Math.abs((el.w || 100) - (el.h || 100)) < 10) {
      const s = Math.min(sx, sy)
      el.w = Math.round((el.w || 100) * s)
      el.h = Math.round((el.h || 100) * s)
    } else {
      el.w = Math.round((el.w || 100) * sx)
      el.h = Math.round((el.h || 100) * sy)
    }
    el.x = Math.round(oldX * sx)
    el.y = Math.round(oldY * sy)
  }

  // 3b. Foreground recomposition
  if (landToPort && foreground.length >= 2) {
    // Sort by visual reading order (top-left → bottom-right) and flow cleanly inside safe margins
    foreground.sort((a, b) => {
      const rowDiff = Math.abs((a.y || 0) - (b.y || 0))
      return rowDiff > srcH * 0.14 ? (a.y || 0) - (b.y || 0) : (a.x || 0) - (b.x || 0)
    })
    const gap = Math.max(20, Math.round(targetH * 0.025))
    let cursorY = safeM
    for (const el of foreground) {
      const oldX = el.x || 0, oldY = el.y || 0
      const aspect = (el.w || 100) / Math.max(1, el.h || 100)
      if (el.tipe === 'teks') {
        el.w = Math.min(contentW, Math.max(Math.round(contentW * 0.55), Math.round((el.w || 400) * sx * 1.35)))
        el.x = el.rata === 'tengah' ? Math.round((targetW - el.w) / 2) : safeM
      } else if (el.tipe === 'grup') {
        const isSmall = (el.w || 0) < srcW * 0.35
        el.w = isSmall ? Math.min(contentW, Math.round((el.w || 200) * Math.max(sx, areaScale))) : contentW
        if (el.tata) el.tinggi = 'peluk'
        else {
          const innerScale = el.w / Math.max(1, el.w || 1)
          el.h = Math.min(Math.round(contentH * 0.45), Math.round((el.h || 200) * areaScale))
          void innerScale
        }
        el.x = safeM
      } else if (el.tipe === 'path' || (el.tipe === 'elips' && Math.abs(aspect - 1) < 0.15)) {
        const s = Math.min(sx, sy, areaScale)
        el.w = Math.max(24, Math.round((el.w || 100) * s))
        el.h = Math.max(24, Math.round((el.h || 100) * s))
        el.x = safeM
      } else {
        // kotak / gambar: adapt cleanly to portrait width while keeping reasonable height
        el.w = Math.min(contentW, Math.max(Math.round(contentW * 0.45), Math.round((el.w || 300) * areaScale)))
        el.h = Math.min(Math.round(contentH * 0.42), Math.max(48, Math.round(el.w / Math.max(0.5, Math.min(2.5, aspect)))))
        el.x = safeM
      }
      el.y = Math.round(cursorY)
      if (el.tipe === 'grup' && !el.tata) shiftSubtree(els, el.id, el.x - oldX, el.y - oldY)
      resolveLayout({ artboards: [targetAb] })
      cursorY += tinggiServer(el) + gap
    }
    // If stacked height exceeded available height, scale down text & gaps cleanly so nothing clips bottom
    const totalUsed = cursorY - gap - safeM
    if (totalUsed > contentH) {
      const shrink = Math.max(0.68, contentH / totalUsed)
      let y2 = safeM
      const gap2 = Math.max(12, Math.round(gap * shrink))
      for (const el of foreground) {
        const oldY = el.y || 0
        if (el.tipe === 'teks') el.ukuran = Math.max(minFont, Math.round((el.ukuran || 32) * shrink))
        else if (el.tipe !== 'grup' || !el.tata) el.h = Math.max(32, Math.round((el.h || 100) * shrink))
        el.y = Math.round(y2)
        if (el.tipe === 'grup' && !el.tata) shiftSubtree(els, el.id, 0, el.y - oldY)
        resolveLayout({ artboards: [targetAb] })
        y2 += tinggiServer(el) + gap2
      }
    }
    actions.push(`recomposed ${foreground.length} foreground block(s) for portrait orientation (${targetW}×${targetH})`)
  } else {
    // Proportional safe-box mapping (same orientation or portrait → landscape)
    const srcM = Math.max(24, Math.round(Math.min(srcW, srcH) * marginRatio))
    const srcCW = Math.max(100, srcW - srcM * 2), srcCH = Math.max(100, srcH - srcM * 2)
    for (const el of foreground) {
      const oldX = el.x || 0, oldY = el.y || 0
      const rx = (oldX - srcM) / srcCW, ry = (oldY - srcM) / srcCH
      const nx = Math.round(safeM + rx * contentW)
      const ny = Math.round(safeM + ry * contentH)

      if (el.tipe === 'path' || (el.tipe === 'elips' && Math.abs((el.w || 100) - (el.h || 100)) < 10)) {
        const s = Math.min(sx, sy)
        el.w = Math.max(20, Math.round((el.w || 100) * s))
        el.h = Math.max(20, Math.round((el.h || 100) * s))
      } else if (el.tipe === 'teks') {
        el.w = Math.min(contentW, Math.max(80, Math.round((el.w || 400) * (contentW / srcCW))))
      } else if (el.tipe === 'grup') {
        el.w = Math.min(contentW, Math.max(80, Math.round((el.w || 200) * (contentW / srcCW))))
        if (!el.tata) el.h = Math.min(contentH, Math.max(40, Math.round((el.h || 100) * (contentH / srcCH))))
      } else {
        el.w = Math.min(contentW, Math.max(24, Math.round((el.w || 100) * (contentW / srcCW))))
        el.h = Math.min(contentH, Math.max(24, Math.round((el.h || 100) * (contentH / srcCH))))
      }
      el.x = Math.max(safeM, Math.min(targetW - safeM - (el.w || 40), nx))
      el.y = Math.max(safeM, Math.min(targetH - safeM - 24, ny))
      if (el.tipe === 'grup' && !el.tata) shiftSubtree(els, el.id, el.x - oldX, el.y - oldY)
    }
    resolveLayout({ artboards: [targetAb] })
    // Gentle pass to prevent top-level text/block vertical overlap and bottom clipping
    for (const el of foreground) {
      const hEl = tinggiServer(el)
      if ((el.y || 0) + hEl > targetH - safeM) {
        const shift = (targetH - safeM) - ((el.y || 0) + hEl)
        const nextY = Math.max(safeM, Math.round((el.y || 0) + shift))
        if (el.tipe === 'grup' && !el.tata) shiftSubtree(els, el.id, 0, nextY - (el.y || 0))
        el.y = nextY
      }
    }
    actions.push(`${portToLand ? 'adapted portrait → landscape' : 'proportionally scaled'} ${foreground.length} block(s) to ${targetW}×${targetH}`)
  }

  resolveLayout(doc)
  return {
    doc,
    artboard: targetAb,
    summary: `Smart Resize ${mode === 'in_place' ? 'in-place' : 'copy'}: ${srcAb.id} (${srcW}×${srcH}) → ${targetAb.id} "${targetAb.nama}" (${targetW}×${targetH}). ${actions.join('; ')}.`
  }
}

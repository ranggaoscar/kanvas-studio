// Zero-dependency editable PowerPoint (.pptx / OOXML PresentationML) exporter for Kanvas Studio (P1).
// Exports every artboard as a native editable PowerPoint slide: real text boxes, shapes,
// linear gradients, vector paths (including arcs for donut charts & Lucide icons), embedded images,
// and optional presenter speaker notes — using only Node.js built-in zlib.
import { buildZip } from './zip.js'
export { buildZip } from './zip.js'
import { existsSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { normalisasi } from './ops.js'
import { resolveLayout, tinggiServer } from './layout.js'
import { jalur } from './ruang.js'



// ---------- XML & Color Helpers ----------
const escXml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function cleanHex(c) {
  let s = String(c || '').trim().replace(/^#/, '')
  if (s.length === 3) s = [...s].map(x => x + x).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : null
}

function alphaXml(opacity) {
  if (opacity == null || opacity >= 0.999) return ''
  const v = Math.max(0, Math.min(100000, Math.round(Number(opacity) * 100000)))
  return `<a:alpha val="${v}"/>`
}

function fillXml(fill, opacity = 1) {
  if (!fill) return '<a:noFill/>'
  if (typeof fill === 'object' && Array.isArray(fill.warna) && fill.warna.length) {
    const stops = fill.warna.map(cleanHex).filter(Boolean)
    if (!stops.length) return '<a:noFill/>'
    // CSS gradient deg (0=up, 90=right) → OOXML lin ang (0=right, 90=down)
    const cssDeg = Number(fill.sudut ?? 135)
    const ang = Math.round((((cssDeg - 90) % 360) + 360) % 360 * 60000)
    const gs = stops.map((hex, i) => {
      const pos = stops.length === 1 ? 0 : Math.round((i / (stops.length - 1)) * 100000)
      return `<a:gs pos="${pos}"><a:srgbClr val="${hex}">${alphaXml(opacity)}</a:srgbClr></a:gs>`
    }).join('')
    return `<a:gradFill><a:gsLst>${gs}</a:gsLst><a:lin ang="${ang}" scaled="1"/></a:gradFill>`
  }
  const hex = cleanHex(fill)
  if (!hex) return '<a:noFill/>'
  return `<a:solidFill><a:srgbClr val="${hex}">${alphaXml(opacity)}</a:srgbClr></a:solidFill>`
}

function strokeXml(garis, emuPerPx, opacity = 1, cap = 'bulat') {
  if (!garis || !garis.tebal) return '<a:ln><a:noFill/></a:ln>'
  const hex = cleanHex(garis.warna || '#101634') || '101634'
  const wEmu = Math.max(6350, Math.round(Number(garis.tebal) * emuPerPx))
  const capAttr = cap === 'datar' ? 'flat' : cap === 'kotak' ? 'sq' : 'rnd'
  const joinXml = cap === 'datar' ? '<a:miter/>' : '<a:round/>'
  return `<a:ln w="${wEmu}" cap="${capAttr}"><a:solidFill><a:srgbClr val="${hex}">${alphaXml(opacity)}</a:srgbClr></a:solidFill>${joinXml}</a:ln>`
}

// ---------- SVG path → OOXML <a:custGeom> ----------
function arcToCubics(x1, y1, rx, ry, phiDeg, largeArc, sweep, x2, y2) {
  if (Math.abs(x1 - x2) < 1e-6 && Math.abs(y1 - y2) < 1e-6) return []
  rx = Math.abs(rx); ry = Math.abs(ry)
  if (rx < 1e-6 || ry < 1e-6) return [[x1, y1, x2, y2, x2, y2]]
  const phi = (phiDeg * Math.PI) / 180, cosP = Math.cos(phi), sinP = Math.sin(phi)
  const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2
  const x1p = cosP * dx2 + sinP * dy2, y1p = -sinP * dx2 + cosP * dy2
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s }
  const rx2 = rx * rx, ry2 = ry * ry, x1p2 = x1p * x1p, y1p2 = y1p * y1p
  const num = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2)
  const den = rx2 * y1p2 + ry2 * x1p2 || 1e-9
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(num / den)
  const cxp = coef * ((rx * y1p) / ry), cyp = coef * (-(ry * x1p) / rx)
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2
  const vecAng = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy, len = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)))
    if (ux * vy - uy * vx < 0) a = -a
    return a
  }
  const theta1 = vecAng(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dTheta = vecAng((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && dTheta > 0) dTheta -= Math.PI * 2
  if (sweep && dTheta < 0) dTheta += Math.PI * 2
  const segs = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)))
  const delta = dTheta / segs, alpha = (4 / 3) * Math.tan(delta / 4)
  const mapPt = (px, py) => [cosP * px * rx - sinP * py * ry + cx, sinP * px * rx + cosP * py * ry + cy]
  const out = []
  let t = theta1
  for (let i = 0; i < segs; i++) {
    const t2 = t + delta
    const c1 = Math.cos(t), s1 = Math.sin(t), c2 = Math.cos(t2), s2 = Math.sin(t2)
    const p1 = mapPt(c1 - alpha * s1, s1 + alpha * c1)
    const p2 = mapPt(c2 + alpha * s2, s2 - alpha * c2)
    const p3 = mapPt(c2, s2)
    out.push([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]])
    t = t2
  }
  return out
}

function svgPathToOoxml(d, vbW, vbH) {
  const scale = 100 // sub-pixel precision in OOXML integer coordinates
  const W = Math.max(1, Math.round(vbW * scale)), H = Math.max(1, Math.round(vbH * scale))
  const pt = (x, y) => `<a:pt x="${Math.round(x * scale)}" y="${Math.round(y * scale)}"/>`
  const tokens = String(d || '').match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []
  let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, lastCtrlX = 0, lastCtrlY = 0
  const cmds = []
  const nextNum = () => Number(tokens[i++]) || 0
  const isCmd = t => /^[A-Za-z]$/.test(t)

  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++]
    if (cmd === 'M' || cmd === 'm') {
      const rel = cmd === 'm'
      const x = nextNum() + (rel ? cx : 0), y = nextNum() + (rel ? cy : 0)
      cx = sx = x; cy = sy = y; lastCtrlX = cx; lastCtrlY = cy
      cmds.push(`<a:moveTo>${pt(cx, cy)}</a:moveTo>`)
      cmd = rel ? 'l' : 'L'
    } else if (cmd === 'L' || cmd === 'l') {
      const rel = cmd === 'l'
      cx = nextNum() + (rel ? cx : 0); cy = nextNum() + (rel ? cy : 0)
      lastCtrlX = cx; lastCtrlY = cy
      cmds.push(`<a:lnTo>${pt(cx, cy)}</a:lnTo>`)
    } else if (cmd === 'H' || cmd === 'h') {
      cx = nextNum() + (cmd === 'h' ? cx : 0); lastCtrlX = cx; lastCtrlY = cy
      cmds.push(`<a:lnTo>${pt(cx, cy)}</a:lnTo>`)
    } else if (cmd === 'V' || cmd === 'v') {
      cy = nextNum() + (cmd === 'v' ? cy : 0); lastCtrlX = cx; lastCtrlY = cy
      cmds.push(`<a:lnTo>${pt(cx, cy)}</a:lnTo>`)
    } else if (cmd === 'C' || cmd === 'c') {
      const rel = cmd === 'c'
      const x1 = nextNum() + (rel ? cx : 0), y1 = nextNum() + (rel ? cy : 0)
      const x2 = nextNum() + (rel ? cx : 0), y2 = nextNum() + (rel ? cy : 0)
      const x = nextNum() + (rel ? cx : 0), y = nextNum() + (rel ? cy : 0)
      cmds.push(`<a:cubicBezTo>${pt(x1, y1)}${pt(x2, y2)}${pt(x, y)}</a:cubicBezTo>`)
      lastCtrlX = x2; lastCtrlY = y2; cx = x; cy = y
    } else if (cmd === 'S' || cmd === 's') {
      const rel = cmd === 's'
      const x1 = 2 * cx - lastCtrlX, y1 = 2 * cy - lastCtrlY
      const x2 = nextNum() + (rel ? cx : 0), y2 = nextNum() + (rel ? cy : 0)
      const x = nextNum() + (rel ? cx : 0), y = nextNum() + (rel ? cy : 0)
      cmds.push(`<a:cubicBezTo>${pt(x1, y1)}${pt(x2, y2)}${pt(x, y)}</a:cubicBezTo>`)
      lastCtrlX = x2; lastCtrlY = y2; cx = x; cy = y
    } else if (cmd === 'Q' || cmd === 'q') {
      const rel = cmd === 'q'
      const x1 = nextNum() + (rel ? cx : 0), y1 = nextNum() + (rel ? cy : 0)
      const x = nextNum() + (rel ? cx : 0), y = nextNum() + (rel ? cy : 0)
      cmds.push(`<a:quadBezTo>${pt(x1, y1)}${pt(x, y)}</a:quadBezTo>`)
      lastCtrlX = x1; lastCtrlY = y1; cx = x; cy = y
    } else if (cmd === 'T' || cmd === 't') {
      const rel = cmd === 't'
      const x1 = 2 * cx - lastCtrlX, y1 = 2 * cy - lastCtrlY
      const x = nextNum() + (rel ? cx : 0), y = nextNum() + (rel ? cy : 0)
      cmds.push(`<a:quadBezTo>${pt(x1, y1)}${pt(x, y)}</a:quadBezTo>`)
      lastCtrlX = x1; lastCtrlY = y1; cx = x; cy = y
    } else if (cmd === 'A' || cmd === 'a') {
      const rel = cmd === 'a'
      const rx = nextNum(), ry = nextNum(), rot = nextNum(), large = nextNum(), sweep = nextNum()
      const x = nextNum() + (rel ? cx : 0), y = nextNum() + (rel ? cy : 0)
      for (const [c1x, c1y, c2x, c2y, ex, ey] of arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y)) {
        cmds.push(`<a:cubicBezTo>${pt(c1x, c1y)}${pt(c2x, c2y)}${pt(ex, ey)}</a:cubicBezTo>`)
      }
      lastCtrlX = x; lastCtrlY = y; cx = x; cy = y
    } else if (cmd === 'Z' || cmd === 'z') {
      cx = sx; cy = sy; lastCtrlX = cx; lastCtrlY = cy
      cmds.push('<a:close/>')
      cmd = ''
    } else {
      i++
    }
  }
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="${W}" b="${H}"/><a:pathLst><a:path w="${W}" h="${H}">${cmds.join('')}</a:path></a:pathLst></a:custGeom>`
}

// ---------- Resolve local/data-url image buffer safely ----------
function resolveImageBytes(src) {
  const s = String(src || '')
  const m = s.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/i)
  if (m) {
    const ext = m[1].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg')
    return { ext, buf: Buffer.from(m[2], 'base64') }
  }
  if (/^https?:/i.test(s) || !s) return null
  try {
    const abs = jalur(s)
    const ext = extname(abs).toLowerCase().slice(1).replace('jpeg', 'jpg')
    if (!['png', 'jpg', 'gif', 'webp', 'svg'].includes(ext) || !existsSync(abs)) return null
    return { ext, buf: readFileSync(abs) }
  } catch {
    return null
  }
}

// ---------- Build Slide XML ----------
function buildSlideXml(ab, emuPerPx, mediaCollector) {
  const spList = []
  let shapeId = 2
  const slideRels = []

  const xfrm = (x, y, w, h, rot = 0) => {
    const rotAttr = rot ? ` rot="${Math.round(((rot % 360) + 360) % 360 * 60000)}"` : ''
    return `<a:xfrm${rotAttr}><a:off x="${Math.round(x * emuPerPx)}" y="${Math.round(y * emuPerPx)}"/><a:ext cx="${Math.max(1, Math.round(w * emuPerPx))}" cy="${Math.max(1, Math.round(h * emuPerPx))}"/></a:xfrm>`
  }

  for (const el of ab.elemen || []) {
    if (el.sembunyi) continue
    const x = el.x || 0, y = el.y || 0, w = el.w || 100, h = tinggiServer(el), op = el.opacity ?? 1
    const name = escXml(el.nama || el.id || el.tipe)

    if (el.tipe === 'teks') {
      const sid = shapeId++
      const text = el.kapital ? String(el.teks ?? '').toUpperCase() : String(el.teks ?? '')
      const algn = el.rata === 'tengah' ? 'ctr' : el.rata === 'kanan' ? 'r' : 'l'
      const sz = Math.max(600, Math.round((el.ukuran || 32) * 0.75 * (emuPerPx / 6350) * 100))
      const bold = (el.tebal || 400) >= 600 ? '1' : '0'
      const ital = el.miring ? '1' : '0'
      const spc = el.spasi ? ` spc="${Math.round(Number(el.spasi) * 75)}"` : ''
      const lnPct = Math.max(80000, Math.min(250000, Math.round((el.lh || 1.2) * 100000)))
      const font = escXml(el.font || 'Plus Jakarta Sans')
      const hex = cleanHex(el.warna || '#101634') || '101634'
      const paragraphs = text.split('\n').map(line =>
        `<a:p><a:pPr algn="${algn}"><a:lnSpc><a:spcPct val="${lnPct}"/></a:lnSpc></a:pPr>` +
        (line
          ? `<a:r><a:rPr lang="en-US" sz="${sz}" b="${bold}" i="${ital}"${spc} dirty="0"><a:solidFill><a:srgbClr val="${hex}">${alphaXml(op)}</a:srgbClr></a:solidFill><a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface="${font}"/></a:rPr><a:t>${escXml(line)}</a:t></a:r>`
          : `<a:endParaRPr lang="en-US" sz="${sz}"/>`) +
        `</a:p>`
      ).join('')
      spList.push(
        `<p:sp><p:nvSpPr><p:cNvPr id="${sid}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
        `<p:spPr>${xfrm(x, y, w, Math.max(h + 8, 24), el.rotasi)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>` +
        `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
      )
    } else if (el.tipe === 'kotak' || el.tipe === 'elips' || (el.tipe === 'grup' && (el.fill || el.garis?.tebal))) {
      const sid = shapeId++
      let geom = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
      if (el.tipe === 'elips') {
        geom = '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>'
      } else if (el.radius > 0) {
        const minSide = Math.max(1, Math.min(w, h))
        const adj = Math.min(50000, Math.round((el.radius / minSide) * 100000))
        geom = `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`
      }
      spList.push(
        `<p:sp><p:nvSpPr><p:cNvPr id="${sid}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
        `<p:spPr>${xfrm(x, y, w, h, el.rotasi)}${geom}${fillXml(el.fill, op)}${strokeXml(el.garis, emuPerPx, op)}</p:spPr></p:sp>`
      )
    } else if (el.tipe === 'path' && el.d) {
      const sid = shapeId++
      const vb = Array.isArray(el.vb) && el.vb[0] > 0 && el.vb[1] > 0 ? el.vb : [w, h]
      const geom = svgPathToOoxml(el.d, vb[0], vb[1])
      spList.push(
        `<p:sp><p:nvSpPr><p:cNvPr id="${sid}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
        `<p:spPr>${xfrm(x, y, w, h, el.rotasi)}${geom}${fillXml(el.fill, op)}${strokeXml(el.garis, emuPerPx, op, el.ujung)}</p:spPr></p:sp>`
      )
    } else if (el.tipe === 'gambar' && el.src) {
      const img = resolveImageBytes(el.src)
      if (!img) continue
      const sid = shapeId++
      const media = mediaCollector(img.ext, img.buf)
      const rId = `rId${slideRels.length + 2}`
      slideRels.push({ id: rId, type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: `../media/${media.fileName}` })
      const geom = el.radius > 0
        ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.min(50000, Math.round((el.radius / Math.max(1, Math.min(w, h))) * 100000))}"/></a:avLst></a:prstGeom>`
        : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
      spList.push(
        `<p:pic><p:nvPicPr><p:cNvPr id="${sid}" name="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
        `<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
        `<p:spPr>${xfrm(x, y, w, h, el.rotasi)}${geom}</p:spPr></p:pic>`
      )
    }
  }

  const bgXml = `<p:bg><p:bgPr>${fillXml(ab.bg || '#FFFFFF', 1)}<a:effectLst/></p:bgPr></p:bg>`
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld>${bgXml}<p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    spList.join('') +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`

  return { xml, slideRels }
}

function buildNotesXml(noteText) {
  const paras = String(noteText || '').split('\n').map(ln =>
    `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escXml(ln)}</a:t></a:r></a:p>`
  ).join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`
  )
}

export function exportDocToPptx(docInput, { artboard } = {}) {
  const doc = normalisasi(JSON.parse(JSON.stringify(docInput)))
  resolveLayout(doc)
  const slides = (doc.artboards || []).filter(ab => !artboard || ab.id === artboard)
  if (!slides.length) throw new Error('No artboards to export to PPTX.')

  const baseW = slides[0].w || 1920, baseH = slides[0].h || 1080
  // Map long edge to 13.333in (12192000 EMU); 1920×1080 maps to exact standard 16:9 PowerPoint
  const emuPerPx = 12192000 / Math.max(baseW, baseH)
  const sldCx = Math.round(baseW * emuPerPx), sldCy = Math.round(baseH * emuPerPx)

  const mediaFiles = []
  const usedExts = new Set()
  const addMedia = (ext, buf) => {
    const fileName = `image${mediaFiles.length + 1}.${ext}`
    mediaFiles.push({ fileName, buf })
    usedExts.add(ext)
    return { fileName }
  }

  const entries = []
  const slideOverrides = []
  const presRels = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`
  ]
  const sldIdLst = []

  slides.forEach((ab, idx) => {
    const n = idx + 1
    const { xml, slideRels } = buildSlideXml(ab, emuPerPx, addMedia)
    const noteText = ab.catatan || ab.notes || ''
    const rels = [
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
      ...slideRels.map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
    ]
    if (noteText) {
      const noteRelId = `rId${rels.length + 1}`
      rels.push(`<Relationship Id="${noteRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`)
      entries.push({ name: `ppt/notesSlides/notesSlide${n}.xml`, data: buildNotesXml(noteText) })
      entries.push({
        name: `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${n}.xml"/></Relationships>`
      })
      slideOverrides.push(`<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`)
    }
    entries.push({ name: `ppt/slides/slide${n}.xml`, data: xml })
    entries.push({
      name: `ppt/slides/_rels/slide${n}.xml.rels`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`
    })
    slideOverrides.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    const rId = `rId${n + 1}`
    presRels.push(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`)
    sldIdLst.push(`<p:sldId id="${256 + idx}" r:id="${rId}"/>`)
  })

  for (const m of mediaFiles) entries.push({ name: `ppt/media/${m.fileName}`, data: m.buf })

  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }
  const mediaDefaults = [...usedExts].map(e => `<Default Extension="${e}" ContentType="${mimeMap[e] || 'application/octet-stream'}"/>`).join('')

  entries.push(
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${mediaDefaults}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideOverrides.join('')}</Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`
    },
    {
      name: 'ppt/presentation.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${sldIdLst.join('')}</p:sldIdLst><p:sldSz cx="${sldCx}" cy="${sldCy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
    },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels.join('')}</Relationships>`
    },
    {
      name: 'ppt/slideMasters/slideMaster1.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`
    },
    {
      name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`
    },
    {
      name: 'ppt/slideLayouts/slideLayout1.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
    },
    {
      name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`
    },
    {
      name: 'ppt/theme/theme1.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Kanvas"><a:themeElements><a:clrScheme name="Kanvas"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1E293B"/></a:dk2><a:lt2><a:srgbClr val="F4F1EA"/></a:lt2><a:accent1><a:srgbClr val="E03E2D"/></a:accent1><a:accent2><a:srgbClr val="1D4ED8"/></a:accent2><a:accent3><a:srgbClr val="047857"/></a:accent3><a:accent4><a:srgbClr val="D97706"/></a:accent4><a:accent5><a:srgbClr val="7C3AED"/></a:accent5><a:accent6><a:srgbClr val="0F766E"/></a:accent6><a:hlink><a:srgbClr val="1D4ED8"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Kanvas"><a:majorFont><a:latin typeface="Plus Jakarta Sans"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Kanvas"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="28575"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`
    }
  )

  return buildZip(entries)
}

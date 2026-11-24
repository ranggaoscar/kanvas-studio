// Design-to-Code engine for Kanvas Studio (P2).
// Converts any artboard into clean, semantic HTML/CSS, React (JSX + CSS), or Tailwind markup.
// Auto-layout groups (`tata`) map to genuine CSS Flexbox rather than flat absolute positioning.
import { normalisasi } from './ops.js'
import { resolveLayout, tinggiServer, padding4 } from './layout.js'

const SYS_FONTS = new Set(['arial', 'georgia', 'impact', 'segoe ui', 'times new roman', 'courier new', 'sans-serif', 'serif', 'monospace'])
const escHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeIdent = (s, fallback = 'KanvasDesign') => {
  const cleaned = String(s || '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join('')
  return /^[A-Za-z]/.test(cleaned) ? cleaned.slice(0, 48) : fallback
}
const safeClass = s => 'ks-' + String(s || 'el').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '')

function fillCss(fill) {
  if (!fill) return null
  if (typeof fill === 'object' && Array.isArray(fill.warna) && fill.warna.length) {
    return `linear-gradient(${fill.sudut ?? 135}deg, ${fill.warna.join(', ')})`
  }
  return String(fill)
}

function collectGoogleFontsUrl(ab) {
  const fams = new Map()
  for (const el of ab.elemen || []) {
    if (el.tipe !== 'teks' || el.sembunyi || !el.font) continue
    const f = String(el.font).replace(/[^A-Za-z0-9 ]+/g, ' ').trim()
    if (!f || SYS_FONTS.has(f.toLowerCase())) continue
    if (!fams.has(f)) fams.set(f, new Set())
    fams.get(f).add(Number(el.tebal) || 400)
  }
  if (!fams.size) return null
  const q = [...fams.entries()].map(([f, ws]) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${[...ws].sort((a, b) => a - b).join(';')}`).join('&')
  return `https://fonts.googleapis.com/css2?${q}&display=swap`
}

function buildTree(ab) {
  const els = (ab.elemen || []).filter(e => !e.sembunyi)
  const byId = new Map(els.map(e => [e.id, e]))
  const children = new Map()
  const roots = []
  for (const e of els) {
    if (e.induk && byId.has(e.induk)) {
      if (!children.has(e.induk)) children.set(e.induk, [])
      children.get(e.induk).push(e)
    } else {
      roots.push(e)
    }
  }
  return { roots, children, byId }
}

function mapFlexAlign(v) {
  return v === 'tengah' ? 'center' : v === 'akhir' ? 'flex-end' : v === 'regang' ? 'stretch' : 'flex-start'
}
function mapFlexJustify(v) {
  return v === 'tengah' ? 'center' : v === 'akhir' ? 'flex-end' : v === 'antara' ? 'space-between' : 'flex-start'
}

function elementCssRules(el, parent, isAutoChild) {
  const rules = ['box-sizing: border-box']
  const w = Math.round(el.w || 100), h = Math.round(tinggiServer(el))
  const px = parent ? Math.round((el.x || 0) - (parent.x || 0)) : Math.round(el.x || 0)
  const py = parent ? Math.round((el.y || 0) - (parent.y || 0)) : Math.round(el.y || 0)

  if (!isAutoChild) {
    rules.push('position: absolute', `left: ${px}px`, `top: ${py}px`)
  } else {
    const parentRow = parent?.tata?.arah === 'baris'
    if (parentRow && el.lebar === 'isi') rules.push('flex: 1 1 0', 'min-width: 0')
    else if (!parentRow && el.tinggi === 'isi') rules.push('flex: 1 1 0', 'min-height: 0')
    else if (el.lebar === 'peluk') rules.push('width: fit-content')
    else if (el.lebar === 'isi' && !parentRow) rules.push('width: 100%')
  }

  if (el.tipe !== 'teks') {
    if (!(isAutoChild && el.lebar === 'isi') && el.lebar !== 'peluk') rules.push(`width: ${w}px`)
    if (!(el.tipe === 'grup' && el.tata && el.tinggi === 'peluk') && !(isAutoChild && el.tinggi === 'isi')) rules.push(`height: ${h}px`)
  } else if (!(isAutoChild && el.lebar === 'isi') && el.lebar !== 'peluk') {
    rules.push(`width: ${w}px`)
  }

  if (el.opacity != null && el.opacity < 1) rules.push(`opacity: ${el.opacity}`)
  if (el.rotasi) rules.push(`transform: rotate(${el.rotasi}deg)`)

  if (el.tipe === 'grup' && el.tata) {
    const [pt, pr, pb, pl] = padding4(el.tata.padding)
    rules.push(
      'display: flex',
      `flex-direction: ${el.tata.arah === 'baris' ? 'row' : 'column'}`,
      `gap: ${Number(el.tata.jarak) || 0}px`,
      `padding: ${pt}px ${pr}px ${pb}px ${pl}px`,
      `align-items: ${mapFlexAlign(el.tata.rata)}`,
      `justify-content: ${mapFlexJustify(el.tata.sebar)}`
    )
  } else if (el.tipe === 'grup') {
    rules.push('position: relative')
  }

  if (el.tipe === 'kotak' || el.tipe === 'elips' || el.tipe === 'grup') {
    const bg = fillCss(el.fill)
    if (bg) rules.push(`background: ${bg}`)
    if (el.tipe === 'elips') rules.push('border-radius: 9999px')
    else if (el.radius) rules.push(`border-radius: ${el.radius}px`)
    if (el.garis?.tebal) rules.push(`border: ${el.garis.tebal}px solid ${el.garis.warna || '#101634'}`)
    if (el.bayangan) rules.push('box-shadow: 0 18px 48px rgba(16, 22, 52, 0.22)')
  }

  if (el.tipe === 'gambar') {
    rules.push(`object-fit: ${el.fit === 'contain' ? 'contain' : 'cover'}`, 'display: block')
    if (el.radius) rules.push(`border-radius: ${el.radius}px`)
  }

  if (el.tipe === 'teks') {
    const align = el.rata === 'tengah' ? 'center' : el.rata === 'kanan' ? 'right' : 'left'
    rules.push(
      'margin: 0',
      `font-family: "${el.font || 'Plus Jakarta Sans'}", sans-serif`,
      `font-size: ${el.ukuran || 32}px`,
      `font-weight: ${el.tebal || 400}`,
      `line-height: ${el.lh || 1.2}`,
      `color: ${el.warna || '#101634'}`,
      `text-align: ${align}`,
      'white-space: pre-wrap'
    )
    if (el.spasi) rules.push(`letter-spacing: ${el.spasi}px`)
    if (el.kapital) rules.push('text-transform: uppercase')
    if (el.miring) rules.push('font-style: italic')
  }
  return rules
}

function tailwindClasses(el, parent, isAutoChild) {
  const cls = ['box-border']
  const w = Math.round(el.w || 100), h = Math.round(tinggiServer(el))
  const px = parent ? Math.round((el.x || 0) - (parent.x || 0)) : Math.round(el.x || 0)
  const py = parent ? Math.round((el.y || 0) - (parent.y || 0)) : Math.round(el.y || 0)

  if (!isAutoChild) {
    cls.push('absolute', `left-[${px}px]`, `top-[${py}px]`)
  } else {
    const parentRow = parent?.tata?.arah === 'baris'
    if (parentRow && el.lebar === 'isi') cls.push('flex-1', 'min-w-0')
    else if (el.lebar === 'peluk') cls.push('w-fit')
    else if (el.lebar === 'isi' && !parentRow) cls.push('w-full')
  }

  if (el.tipe !== 'teks') {
    if (!(isAutoChild && el.lebar === 'isi') && el.lebar !== 'peluk') cls.push(`w-[${w}px]`)
    if (!(el.tipe === 'grup' && el.tata && el.tinggi === 'peluk')) cls.push(`h-[${h}px]`)
  } else if (!(isAutoChild && el.lebar === 'isi') && el.lebar !== 'peluk') {
    cls.push(`w-[${w}px]`)
  }

  if (el.tipe === 'grup' && el.tata) {
    const [pt, pr, pb, pl] = padding4(el.tata.padding)
    cls.push('flex', el.tata.arah === 'baris' ? 'flex-row' : 'flex-col', `gap-[${Number(el.tata.jarak) || 0}px]`)
    cls.push(`pt-[${pt}px]`, `pr-[${pr}px]`, `pb-[${pb}px]`, `pl-[${pl}px]`)
    const al = { awal: 'items-start', tengah: 'items-center', akhir: 'items-end', regang: 'items-stretch' }
    const js = { awal: 'justify-start', tengah: 'justify-center', akhir: 'justify-end', antara: 'justify-between' }
    cls.push(al[el.tata.rata] || 'items-start', js[el.tata.sebar] || 'justify-start')
  }
  if (el.tipe === 'kotak' || el.tipe === 'elips' || el.tipe === 'grup') {
    if (typeof el.fill === 'string') cls.push(`bg-[${el.fill}]`)
    if (el.tipe === 'elips') cls.push('rounded-full')
    else if (el.radius >= 900) cls.push('rounded-full')
    else if (el.radius) cls.push(`rounded-[${el.radius}px]`)
    if (el.garis?.tebal) cls.push(`border-[${el.garis.tebal}px]`, `border-[${el.garis.warna || '#101634'}]`)
    if (el.bayangan) cls.push('shadow-xl')
  }
  if (el.tipe === 'gambar') {
    cls.push(el.fit === 'contain' ? 'object-contain' : 'object-cover', 'block')
    if (el.radius) cls.push(`rounded-[${el.radius}px]`)
  }
  if (el.tipe === 'teks') {
    cls.push('m-0', 'whitespace-pre-wrap', `text-[${el.ukuran || 32}px]`, `font-[${el.tebal || 400}]`, `leading-[${el.lh || 1.2}]`, `text-[${el.warna || '#101634'}]`)
    cls.push(el.rata === 'tengah' ? 'text-center' : el.rata === 'kanan' ? 'text-right' : 'text-left')
    if (el.spasi) cls.push(`tracking-[${el.spasi}px]`)
    if (el.kapital) cls.push('uppercase')
    if (el.miring) cls.push('italic')
  }
  if (el.opacity != null && el.opacity < 1) cls.push(`opacity-[${el.opacity}]`)
  if (el.rotasi) cls.push(`rotate-[${el.rotasi}deg]`)
  return cls.join(' ')
}

function semanticTextTag(el) {
  const uk = el.ukuran || 32
  if (uk >= 52) return 'h1'
  if (uk >= 32) return 'h2'
  return 'p'
}

export function exportArtboardToCode(docInput, { artboard, target = 'html', componentName } = {}) {
  const doc = normalisasi(JSON.parse(JSON.stringify(docInput)))
  resolveLayout(doc)
  const ab = artboard ? doc.artboards.find(a => a.id === artboard) : doc.artboards[0]
  if (!ab) throw new Error(artboard ? `Artboard "${artboard}" not found.` : 'Document has no artboards.')

  const mode = String(target || 'html').toLowerCase()
  if (!['html', 'react', 'tailwind'].includes(mode)) throw new Error(`Unknown target "${target}". Use: html, react, tailwind.`)

  const compName = safeIdent(componentName || ab.nama || doc.judul, 'KanvasDesign')
  const { roots, children } = buildTree(ab)
  const fontsUrl = collectGoogleFontsUrl(ab)
  const cssBlocks = []
  const bgCss = fillCss(ab.bg || '#FFFFFF') || '#FFFFFF'

  const renderNode = (el, parent, indent = '  ') => {
    const isAutoChild = Boolean(parent?.tata)
    const cls = safeClass(el.id)
    const isReact = mode === 'react' || mode === 'tailwind'
    const attrName = isReact ? 'className' : 'class'
    const classVal = mode === 'tailwind' ? tailwindClasses(el, parent, isAutoChild) : cls

    if (mode !== 'tailwind') {
      cssBlocks.push(`.${cls} {\n  ${elementCssRules(el, parent, isAutoChild).join(';\n  ')};\n}`)
    }

    if (el.tipe === 'teks') {
      const tag = semanticTextTag(el)
      const body = isReact ? `{${JSON.stringify(String(el.teks ?? ''))}}` : escHtml(el.teks ?? '')
      const fontStyle = mode === 'tailwind' && el.font ? ` style={{ fontFamily: ${JSON.stringify(`"${el.font}", sans-serif`)} }}` : ''
      return `${indent}<${tag} ${attrName}="${classVal}"${fontStyle}>${body}</${tag}>`
    }
    if (el.tipe === 'gambar') {
      const alt = escHtml(el.nama || 'Design image')
      return `${indent}<img ${attrName}="${classVal}" src="${escHtml(el.src || '')}" alt="${alt}" />`
    }
    if (el.tipe === 'path') {
      const vb = Array.isArray(el.vb) && el.vb[0] > 0 && el.vb[1] > 0 ? el.vb : [el.w || 100, el.h || 100]
      const fillAttr = typeof el.fill === 'string' ? el.fill : 'none'
      const strokeAttr = el.garis?.tebal ? ` stroke="${escHtml(el.garis.warna || '#101634')}" strokeWidth="${el.garis.tebal}" strokeLinecap="${el.ujung === 'datar' ? 'butt' : el.ujung === 'kotak' ? 'square' : 'round'}"` : ''
      const svgStroke = isReact ? strokeAttr : strokeAttr.replace(/strokeWidth/g, 'stroke-width').replace(/strokeLinecap/g, 'stroke-linecap')
      const ruleAttr = el.aturan === 'evenodd' ? (isReact ? ' fillRule="evenodd"' : ' fill-rule="evenodd"') : ''
      return `${indent}<svg ${attrName}="${classVal}" viewBox="0 0 ${vb[0]} ${vb[1]}" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${escHtml(el.d || '')}" fill="${escHtml(fillAttr)}"${svgStroke}${ruleAttr} /></svg>`
    }
    if (el.tipe === 'grup') {
      const kids = children.get(el.id) || []
      const inner = kids.map(k => renderNode(k, el, indent + '  ')).join('\n')
      const isBtn = el.radius >= 900 && kids.length <= 2 && kids.every(k => k.tipe === 'teks' || k.tipe === 'path')
      const tag = isBtn ? 'button' : 'div'
      const extra = isBtn ? ' type="button"' : ''
      return inner ? `${indent}<${tag}${extra} ${attrName}="${classVal}">\n${inner}\n${indent}</${tag}>` : `${indent}<${tag}${extra} ${attrName}="${classVal}" />`
    }
    return `${indent}<div ${attrName}="${classVal}" />`
  }

  const bodyMarkup = roots.map(r => renderNode(r, null, '    ')).join('\n')
  const rootCss = [
    `.ks-artboard {\n  position: relative;\n  width: ${ab.w}px;\n  height: ${ab.h}px;\n  background: ${bgCss};\n  overflow: hidden;\n  margin: 0 auto;\n}`,
    ...cssBlocks
  ].join('\n\n')

  if (mode === 'html') {
    const code = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `  <title>${escHtml(ab.nama || doc.judul || 'Kanvas Studio Export')}</title>`,
      ...(fontsUrl ? [`  <link rel="stylesheet" href="${fontsUrl}" />`] : []),
      '  <style>',
      '    body { margin: 0; background: #0f1117; display: grid; place-items: center; min-height: 100vh; }',
      rootCss.split('\n').map(l => '    ' + l).join('\n'),
      '  </style>',
      '</head>',
      '<body>',
      '  <main class="ks-artboard">',
      bodyMarkup,
      '  </main>',
      '</body>',
      '</html>'
    ].join('\n')
    return { target: 'html', fileName: `${safeClass(ab.nama || ab.id).slice(3) || 'design'}.html`, code, css: rootCss, fontsUrl }
  }

  if (mode === 'react') {
    const cssFile = `${compName}.css`
    const code = [
      `import React from 'react'`,
      `import './${cssFile}'`,
      ...(fontsUrl ? [`// Load fonts in your index.html: ${fontsUrl}`] : []),
      '',
      `export default function ${compName}() {`,
      '  return (',
      '    <section className="ks-artboard">',
      bodyMarkup,
      '    </section>',
      '  )',
      '}'
    ].join('\n')
    return { target: 'react', fileName: `${compName}.jsx`, cssFileName: cssFile, code, css: rootCss, fontsUrl }
  }

  // tailwind React component
  const bgStyle = typeof ab.bg === 'string' ? `bg-[${ab.bg}]` : ''
  const inlineBg = typeof ab.bg === 'object' ? ` style={{ background: ${JSON.stringify(bgCss)} }}` : ''
  const code = [
    `import React from 'react'`,
    ...(fontsUrl ? [`// Load fonts in your index.html: ${fontsUrl}`] : []),
    '',
    `export default function ${compName}() {`,
    '  return (',
    `    <section className="relative overflow-hidden mx-auto w-[${ab.w}px] h-[${ab.h}px] ${bgStyle}"${inlineBg}>`,
    bodyMarkup,
    '    </section>',
    '  )',
    '}'
  ].join('\n')
  return { target: 'tailwind', fileName: `${compName}.jsx`, code, fontsUrl }
}

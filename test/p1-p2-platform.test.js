// P1 & P2 regression tests: Layout Resolver, Smart Resize, Marketing Automation,
// Data Visualization, Presentation Engine + Editable PPTX, Design-to-Code,
// Asset Library, and Community Ecosystem.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ruangTes = mkdtempSync(join(tmpdir(), 'kanvas-p1p2-tes-'))
process.env.KANVAS_HOME = ruangTes

const { resolveLayout } = await import('../server/layout.js')
const { smartResizeArtboard } = await import('../server/resize.js')
const { buildCampaignDoc } = await import('../server/campaign.js')
const { buildDataVizElement } = await import('../server/dataviz.js')
const { buildPresentationDoc } = await import('../server/presentation.js')
const { exportDocToPptx } = await import('../server/pptx.js')
const { exportArtboardToCode } = await import('../server/codegen.js')
const { importAsset, saveSvgAsset, listAssets, getAsset, deleteAsset } = await import('../server/assets.js')
const { saveCommunityTemplate, saveCommunityDirection, saveCommunityWorkflow, getCommunityWorkflow, listCommunity, loadCommunityDirections, loadCommunityTemplates, deleteCommunityItem } = await import('../server/community.js')
const { buildArtDirection } = await import('../server/design-intelligence.js')

// Helper: parse ZIP entries & inflate to inspect generated .pptx XML directly
function unzipEntries(buf) {
  const map = new Map()
  let off = 0
  while (off + 30 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const method = buf.readUInt16LE(off + 8)
    const compSize = buf.readUInt32LE(off + 18)
    const nameLen = buf.readUInt16LE(off + 26)
    const extraLen = buf.readUInt16LE(off + 28)
    const name = buf.subarray(off + 30, off + 30 + nameLen).toString('utf8')
    const dataStart = off + 30 + nameLen + extraLen
    const body = buf.subarray(dataStart, dataStart + compSize)
    map.set(name, method === 8 ? inflateRawSync(body) : body)
    off = dataStart + compSize
  }
  return map
}

test('P1 Smart Resize: reflows horizontal row to portrait stack, keeps circles circular, preserves original on copy', () => {
  const doc = {
    versi: 1, judul: 'Slide Deck',
    artboards: [{
      id: 'a1', nama: 'Hero', x: 0, y: 0, w: 1920, h: 1080, bg: '#F4F1EA',
      elemen: [
        { id: 'h1', tipe: 'teks', x: 140, y: 120, w: 1200, teks: 'Modular Design', font: 'Syne', ukuran: 88, tebal: 800, warna: '#111111' },
        { id: 'dot', tipe: 'elips', x: 1620, y: 120, w: 140, h: 140, fill: '#E03E2D' },
        { id: 'row', tipe: 'grup', x: 140, y: 360, w: 1640, tinggi: 'peluk', fill: null, tata: { arah: 'baris', jarak: 32, padding: 0, rata: 'regang' } },
        { id: 'c1', tipe: 'grup', induk: 'row', lebar: 'isi', tinggi: 'peluk', fill: '#FFFFFF', radius: 16, tata: { arah: 'kolom', jarak: 12, padding: 24 } },
        { id: 'c1t', tipe: 'teks', induk: 'c1', teks: 'Card One', ukuran: 32, tebal: 700, warna: '#111111' },
        { id: 'c2', tipe: 'grup', induk: 'row', lebar: 'isi', tinggi: 'peluk', fill: '#FFFFFF', radius: 16, tata: { arah: 'kolom', jarak: 12, padding: 24 } },
        { id: 'c2t', tipe: 'teks', induk: 'c2', teks: 'Card Two', ukuran: 32, tebal: 700, warna: '#111111' }
      ]
    }]
  }
  const { doc: resized, artboard } = smartResizeArtboard(doc, { artboard: 'a1', ukuran: 'ig-story', mode: 'copy' })
  assert.equal(resized.artboards.length, 2)
  assert.equal(resized.artboards[0].w, 1920, 'source artboard must remain untouched in copy mode')
  assert.equal(artboard.w, 1080); assert.equal(artboard.h, 1920)
  const reflowedRow = artboard.elemen.find(e => e.tipe === 'grup' && e.tata && !e.induk)
  assert.equal(reflowedRow.tata.arah, 'kolom', 'wide baris group must flip to kolom in portrait mode')
  const circle = artboard.elemen.find(e => e.tipe === 'elips')
  assert.equal(circle.w, circle.h, 'circle must stay 1:1 circular')
  const texts = artboard.elemen.filter(e => e.tipe === 'teks')
  for (const t of texts) assert.ok(t.ukuran >= 18, `text ${t.id} stayed legible (${t.ukuran}px)`)

  const { doc: inPlace } = smartResizeArtboard(doc, { artboard: 'a1', ukuran: 'banner-web', mode: 'in_place' })
  assert.equal(inPlace.artboards.length, 1)
  assert.equal(inPlace.artboards[0].w, 1440); assert.equal(inPlace.artboards[0].h, 600)
})

test('P1 Marketing Automation: generates coordinated multi-format pack + swipeable carousel with Brand Kit', () => {
  const brand = {
    id: 'kinetik', name: 'Kinetik',
    colors: { background: '#0A0A0A', surface: '#171717', text: '#FAF9F6', muted: '#B5B5B5', accent: '#FF4500' },
    fonts: { display: 'Archivo Black', body: 'Space Mono', mono: 'Space Mono' },
    style: { direction: 'brutalism', radius: 0, strokeWidth: 4 }
  }
  const { doc, direction } = buildCampaignDoc({
    judul: 'Kinetik Live 2026',
    headline: 'RAW SOUND IN BERLIN',
    subhead: 'Two nights of modular synthesis and live visual coding.',
    cta: 'GET TICKETS',
    eyebrow: 'KINETIK LIVE',
    details: 'OCT 18–19 · KRAFTWERK',
    points: ['14 live hardware sets', 'Open-source AV visuals', 'Zero phone policy'],
    formats: ['ig-feed', 'ig-story', 'banner-web', 'yt-thumbnail', 'carousel'],
    brand
  })
  assert.equal(direction, 'brutalism')
  assert.equal(doc.brand, 'kinetik')
  // 4 single formats + 5 carousel slides (cover + 3 points + cta) = 9 artboards
  assert.equal(doc.artboards.length, 9)
  assert.ok(doc.artboards.some(a => a.w === 1080 && a.h === 1920))
  assert.ok(doc.artboards.some(a => a.w === 1440 && a.h === 600))
  assert.ok(doc.artboards.some(a => a.w === 1280 && a.h === 720))
  assert.ok(doc.artboards.every(a => a.bg === '#0A0A0A'))
})

test('P1 Data Visualization: builds native editable bar, hbar, line, donut, table, and diagram primitives', () => {
  const bar = buildDataVizElement({ type: 'bar', title: 'Revenue', unit: 'M', data: [{ label: 'Q1', value: 12 }, { label: 'Q2', value: 19 }, { label: 'Q3', value: 28 }], highlightIndex: 2 }, { abBg: '#FFFFFF' })
  assert.equal(bar.tipe, 'grup')
  assert.ok(bar.anak.filter(e => e.tipe === 'kotak').length === 3)

  const hbar = buildDataVizElement({ type: 'hbar', data: [{ label: 'Direct', value: 64 }, { label: 'Partner', value: 36 }], unit: '%' }, { abBg: '#0E1117' })
  assert.ok(hbar.anak.some(e => e.tipe === 'teks' && e.warna === '#F8FAFC'), 'dark artboard must auto-select light ink')

  const line = buildDataVizElement({ type: 'line', labels: ['Jan', 'Feb', 'Mar'], series: [{ name: '2025', values: [10, 22, 35] }, { name: '2026', values: [18, 30, 52] }] })
  assert.ok(line.anak.some(e => e.tipe === 'path' && /M[\d.]+ [\d.]+ L/.test(e.d)))

  const donut = buildDataVizElement({ type: 'donut', data: [{ label: 'Core', value: 55 }, { label: 'Cloud', value: 30 }, { label: 'Services', value: 15 }], unit: '%' })
  assert.ok(donut.anak.filter(e => e.tipe === 'path' && /A\d+ \d+/.test(e.d)).length === 3)

  const tbl = buildDataVizElement({ type: 'table', columns: ['Plan', 'Users', 'ARR'], rows: [['Free', '12k', '$0'], ['Team', '2.4k', '$420k']] })
  assert.equal(tbl.tata.arah, 'kolom')
  assert.equal(tbl.anak.length, 3)

  const diag = buildDataVizElement({ type: 'diagram', nodes: [{ title: 'Brief' }, { title: 'Art Direct', highlight: true }, { title: 'Visual QA' }] })
  assert.equal(diag.anak.filter(e => e.tipe === 'path').length, 2, '3 steps should have 2 arrow connectors')
})

test('P1 Presentation Engine + Editable PPTX Export: produces valid multi-slide OOXML ZIP with editable text, vectors, media, and notes', () => {
  const logoRel = 'brands/demo/logo.svg'
  writeFileSync(join(ruangTes, 'demo-logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#E03E2D"/></svg>')
  const { doc, slideCount } = buildPresentationDoc({
    judul: 'Q4 Product Review',
    subtitle: 'Open-source growth & engineering milestones',
    author: 'Kanvas Team',
    date: 'Nov 2026',
    style: 'corporate-premium',
    slides: [
      { type: 'cover', eyebrow: 'QUARTERLY REVIEW', heading: 'Q4 Product Review', notes: 'Welcome everyone to our Q4 review.' },
      { type: 'agenda', eyebrow: 'AGENDA', heading: 'What we will cover', bullets: ['Growth metrics', 'Revenue mix', '2027 roadmap'] },
      { type: 'stats', eyebrow: 'TRACTION', heading: 'Strong community adoption', metrics: [{ value: '48k', label: 'Active workspaces' }, { value: '99.4%', label: 'QA pass rate' }, { value: '0', label: 'Runtime deps' }] },
      { type: 'chart', eyebrow: 'GROWTH', heading: 'Quarterly active installs', body: 'Consistent quarter-over-quarter momentum.', chart: { type: 'bar', data: [{ label: 'Q1', value: 12 }, { label: 'Q2', value: 24 }, { label: 'Q3', value: 36 }, { label: 'Q4', value: 48 }], unit: 'k' } },
      { type: 'table', eyebrow: 'BENCHMARKS', heading: 'Format comparison', table: { columns: ['Format', 'Editable', 'Offline'], rows: [['PNG', 'No', 'Yes'], ['SVG', 'Yes', 'Yes'], ['PPTX', 'Yes', 'Yes']] } },
      { type: 'timeline', eyebrow: 'WORKFLOW', heading: 'Agent loop', nodes: [{ title: 'Art Direct' }, { title: 'Build Live' }, { title: 'Visual QA' }, { title: 'Export PPTX' }] },
      { type: 'closing', heading: 'Thank you', body: 'Questions & feedback welcome.', contact: 'github.com/ranggaoscar/kanvas-studio' }
    ]
  })
  assert.equal(slideCount, 7)
  // Attach a data-URL image to slide 1 so PPTX media embedding is exercised too
  doc.artboards[0].elemen.push({ id: 'img_embed', tipe: 'gambar', x: 1600, y: 80, w: 120, h: 120, src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' })
  void logoRel

  const pptxBuf = exportDocToPptx(doc)
  assert.equal(pptxBuf.readUInt32LE(0), 0x04034b50, 'must start with ZIP local header signature')
  const entries = unzipEntries(pptxBuf)
  assert.ok(entries.has('[Content_Types].xml'))
  assert.ok(entries.has('_rels/.rels'))
  assert.ok(entries.has('ppt/presentation.xml'))
  assert.ok(entries.has('ppt/slides/slide1.xml'))
  assert.ok(entries.has('ppt/slides/slide7.xml'))
  assert.ok(entries.has('ppt/notesSlides/notesSlide1.xml'), 'slide 1 speaker notes must export')
  assert.ok(entries.has('ppt/media/image1.png'), 'embedded image must export into ppt/media/')

  const slide1Xml = entries.get('ppt/slides/slide1.xml').toString('utf8')
  assert.match(slide1Xml, /<a:t>Q4 Product Review<\/a:t>/, 'editable PowerPoint text run must contain headline')
  assert.match(slide1Xml, /<p:pic>/, 'embedded picture node must exist')
  const notes1Xml = entries.get('ppt/notesSlides/notesSlide1.xml').toString('utf8')
  assert.match(notes1Xml, /Welcome everyone to our Q4 review\./)
  const slide6Xml = entries.get('ppt/slides/slide6.xml').toString('utf8')
  assert.match(slide6Xml, /<a:custGeom>/, 'diagram arrows must export as custom vector geometry')
})

test('P2 Design-to-Code: exports semantic Flexbox HTML, React JSX+CSS, and Tailwind safely', () => {
  const doc = {
    versi: 1, judul: 'Hero',
    artboards: [{
      id: 'a1', nama: 'Landing Hero', x: 0, y: 0, w: 1440, h: 600, bg: '#FAF7F2',
      elemen: [
        { id: 'box', tipe: 'grup', x: 100, y: 120, w: 640, tinggi: 'peluk', fill: '#FFFFFF', radius: 16, tata: { arah: 'kolom', jarak: 16, padding: 32, rata: 'awal' } },
        { id: 'h1', tipe: 'teks', induk: 'box', teks: 'Build <Fast> & Free', font: 'Space Grotesk', ukuran: 56, tebal: 800, warna: '#111111' },
        { id: 'cta', tipe: 'grup', induk: 'box', lebar: 'peluk', tinggi: 'peluk', fill: '#E03E2D', radius: 999, tata: { arah: 'baris', padding: [14, 28, 14, 28], rata: 'tengah' } },
        { id: 'ctat', tipe: 'teks', induk: 'cta', teks: 'Start', lebar: 'peluk', font: 'Inter', ukuran: 20, tebal: 700, warna: '#FFFFFF' },
        { id: 'vec', tipe: 'path', x: 900, y: 150, w: 120, h: 120, vb: [24, 24], d: 'M12 2L22 20H2Z', fill: '#E03E2D' }
      ]
    }]
  }
  resolveLayout(doc)

  const html = exportArtboardToCode(doc, { target: 'html' })
  assert.match(html.code, /<!DOCTYPE html>/)
  assert.match(html.code, /fonts\.googleapis\.com\/css2\?family=Space\+Grotesk/)
  assert.match(html.code, /display: flex;\s*flex-direction: column/)
  assert.match(html.code, /&lt;Fast&gt; &amp; Free/, 'HTML must escape special chars')
  assert.match(html.code, /<button type="button"/)
  assert.match(html.code, /<svg .*viewBox="0 0 24 24"/)

  const react = exportArtboardToCode(doc, { target: 'react', componentName: 'LandingHero' })
  assert.equal(react.fileName, 'LandingHero.jsx')
  assert.equal(react.cssFileName, 'LandingHero.css')
  assert.match(react.code, /export default function LandingHero\(\)/)
  assert.match(react.css, /display: flex/)

  const tw = exportArtboardToCode(doc, { target: 'tailwind', componentName: 'HeroTw' })
  assert.match(tw.code, /flex flex-col/)
  assert.match(tw.code, /rounded-full/)
})

test('P2 Asset Library & Community Ecosystem: CRUD, search, pure-JSON direction injection, and cleanup', () => {
  try {
    // Asset Library
    const imgPath = join(ruangTes, 'badge.png')
    const badPath = join(ruangTes, 'notes.txt')
    writeFileSync(imgPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'))
    writeFileSync(badPath, 'not an image')

    const imp = importAsset({ path: imgPath, name: 'Launch Badge', category: 'badge', tags: ['promo', 'dark'] })
    assert.equal(imp.src, 'assets-library/launch-badge.png')
    assert.ok(existsSync(join(ruangTes, imp.src)))
    assert.throws(() => importAsset({ path: badPath }), /Not an existing image file/)

    const svg = saveSvgAsset({ name: 'Starburst Mark', d: 'M50 0L61 38H100L68 59L79 100L50 75L21 100L32 59L0 38H39Z', vb: [100, 100], fill: '#E03E2D', tags: ['accent', 'vector'] })
    assert.equal(svg.src, 'assets-library/starburst-mark.svg')
    assert.ok(existsSync(join(ruangTes, svg.src)))
    assert.equal(listAssets({ search: 'starburst' }).assets.length, 1)
    assert.equal(listAssets({ tag: 'promo' }).assets.length, 1)
    assert.equal(getAsset('starburst-mark').vector.vb[0], 100)
    deleteAsset('launch-badge')
    assert.equal(getAsset('launch-badge'), null)

    // Community Ecosystem
    const dirRes = saveCommunityDirection({
      id: 'risograph-zine',
      name: 'Risograph Zine',
      summary: 'Duotone print texture and bold editorial overprint contrast.',
      keywords: ['riso', 'risograph', 'zine'],
      fontPairings: [{ display: 'Bricolage Grotesque', body: 'DM Sans', mono: 'Space Mono', mood: 'indie print' }],
      palettes: [{ name: 'Fluoro Pink & Indigo', bg: '#F7F3EA', surface: '#EFE9DC', text: '#1D2469', muted: '#4B5288', accent: '#FF3E81' }],
      author: 'ranggaoscar'
    })
    assert.equal(dirRes.id, 'risograph-zine')
    const ad = buildArtDirection({ brief: 'Indie risograph bookshop zine poster', w: 794, h: 1123, extraDirections: loadCommunityDirections() })
    assert.equal(ad.direction, 'risograph-zine', 'community aesthetic direction must plug seamlessly into Design Intelligence')

    const tplRes = saveCommunityTemplate({
      id: 'zine-starter', name: 'Zine Cover', category: 'poster', description: 'Starter cover', author: 'ranggaoscar',
      doc: { versi: 1, judul: 'Zine', artboards: [{ id: 'a1', nama: 'Cover', x: 0, y: 0, w: 794, h: 1123, bg: '#F7F3EA', elemen: [] }] }
    })
    assert.equal(tplRes.id, 'zine-starter')
    assert.ok(loadCommunityTemplates().some(t => t.meta.id === 'zine-starter'))

    const wfRes = saveCommunityWorkflow({
      id: 'launch-pack', name: 'Launch Pack', description: 'End-to-end launch workflow',
      steps: [{ tool: 'kanvas_brand', action: 'Load brand' }, { tool: 'kanvas_campaign', action: 'Build campaign' }]
    })
    assert.equal(wfRes.id, 'launch-pack')
    assert.equal(getCommunityWorkflow('launch-pack').steps.length, 2)
    assert.equal(listCommunity().workflows.length, 1)

    deleteCommunityItem('workflow', 'launch-pack')
    assert.equal(getCommunityWorkflow('launch-pack'), null)
  } finally {
    rmSync(ruangTes, { recursive: true, force: true })
  }
})

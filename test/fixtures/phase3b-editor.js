import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import plugin, { engine } from '../../desktop/plugin.js'

const seed = { versi: 1, judul: 'Lock test', artboards: [
  { id: 'page', w: 794, h: 200, x: 0, y: 0, elemen: [
    { id: 'locked', nama: 'Locked shape', tipe: 'kotak', x: 30, y: 20, w: 80, h: 40, fill: '#ffeeaa', kunci: true },
    { id: 'open', tipe: 'kotak', x: 160, y: 20, w: 50, h: 30 }
  ] }
] }
const path = 'sample.kanvas.json'
let pane
plugin.register({
  storage: { get: (k, fallback) => k === 'file' ? path : fallback, set() {}, remove() {} },
  files: {
    folders: async () => [], list: async () => ({ ok: true, entries: [{ name: path }] }),
    stat: async () => ({ ok: true, exists: true, mtimeMs: 1 }),
    readText: async (_, name) => name === path ? { ok: true, text: JSON.stringify(seed) } : { ok: false },
    writeText: async () => ({ ok: true })
  },
  onDispose() {}, setInterval() {},
  registerMany: list => { pane = list.find(c => c.id === 'pane') }
})
createRoot(document.getElementById('app')).render(createElement(pane.render))

const wait = () => new Promise(resolve => setTimeout(resolve, 20))
async function find(selector) {
  for (let i = 0; i < 100; i++) {
    const el = document.querySelector(selector)
    if (el) return el
    await wait()
  }
  throw Error('Missing control ' + selector)
}
function assert(ok, msg) { if (!ok) throw Error(msg) }
function drag(el) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 90, altKey: true }))
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: 145, clientY: 105, altKey: true }))
  window.dispatchEvent(new PointerEvent('pointerup'))
}
const key = (el, key) => el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
async function check() {
  const view = await find('.kv-view')
  const locked = await find('.kv-ab [data-id="locked"]')
  const items = engine.S.doc.artboards[0].elemen
  drag(locked)
  assert(engine.S.sel.length === 0, 'ordinary drag selected the locked shape')
  assert(items[0].x === 30 && items[0].y === 20, 'ordinary drag moved the locked shape')
  // A layer can acquire its lock while it is selected (undo or agent update).
  engine.S.sel = ['locked']; engine.emit()
  await wait()
  const corner = document.querySelector('[data-h="se"]')
  if (corner) drag(corner)
  key(view, 'ArrowRight'); key(view, 'Delete'); key(view, 'Backspace')
  assert(engine.S.doc.artboards[0].elemen.some(e => e.id === 'locked'), 'keyboard deleted a locked layer')
  assert(items[0].x === 30 && items[0].w === 80 && items[0].h === 40, 'resized or nudged a locked shape')
  const free = await find('.kv-ab [data-id="open"]')
  drag(free); assert(items[1].x !== 160, 'unlocked shape could not move')
  key(view, 'Delete'); assert(engine.S.doc.artboards[0].elemen.length === 1, 'unlocked shape could not be deleted')
  ;(await find('button[title="Layers"]')).click()
  ;(await find('button[aria-label="Buka kunci Locked shape"]')).click()
  assert(!engine.S.doc.artboards[0].elemen[0].kunci, 'explicit layer unlock failed')

  // PDF export remains re-openable even when Hermes offers no document endpoint.
  window.showSaveFilePicker = async () => ({
    name: 'fixture.pdf',
    createWritable: async () => ({
      write: async blob => {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        document.getElementById('pdf').textContent = btoa(String.fromCharCode(...bytes))
      },
      close() {}
    })
  })
  Array.from(document.querySelectorAll('.kv-top button')).find(b => b.textContent.includes('Export')).click()
  await find('.kv-menu')
  Array.from(document.querySelectorAll('.kv-menu button')).find(b => b.textContent.includes('all artboards (deck)')).click()
  for (let i = 0; i < 100 && !document.getElementById('pdf').textContent; i++) await wait()
  assert(document.getElementById('pdf').textContent, 'missing Hybrid PDF download')

  const page = document.createElement('canvas'); page.width = 794; page.height = 200
  const paint = page.getContext('2d'); paint.fillStyle = '#fff'; paint.fillRect(0, 0, 794, 200)
  paint.fillStyle = '#172033'; paint.font = '16px Arial'; paint.fillText('26 November 2026', 20, 116)
  paint.fillText('Baris berikutnya tetap utuh.', 20, 152)
  engine.S.doc.artboards[0].elemen.unshift({ id: 'pdf-bg', tipe: 'gambar', nama: 'PDF background', kunci: true, x: 0, y: 0, w: 794, h: 200, src: page.toDataURL() })
  engine.emit()
  const bg = await find('.kv-ab [data-id="pdf-bg"]'), bounds = bg.getBoundingClientRect(), z = engine.S.zoom
  const x = bounds.x + 20 * z, y = bounds.y + 100 * z
  bg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }))
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: x + 140 * z, clientY: y + 39 * z }))
  window.dispatchEvent(new PointerEvent('pointerup'))
  // DOM pointers are floating point at non-integer zoom; set the precise regression dimensions.
  assert(Math.abs(engine.S.patchArea.w - 140) < 2 && Math.abs(engine.S.patchArea.h - 39) < 2, 'PDF area drag did not mark the expected box')
  Object.assign(engine.S.patchArea, { x: 20, y: 100, w: 140, h: 39 })
  await wait()
  const patch = [...document.querySelectorAll('.kv-top button')].find(b => b.textContent === 'Tutup & Ubah Teks')
  assert(patch, 'missing patch toolbar action')
  patch.click()
  const inputPatch = await find('.kv-teksedit')
  const setPatch = text => { inputPatch.value = text; inputPatch.dispatchEvent(new Event('input', { bubbles: true })) }
  setPatch('27 November 2026'); await wait()
  const text = engine.S.doc.artboards[0].elemen.find(e => e.nama === 'Teks pengganti')
  let layout = engine.layoutTeks(text)
  assert(layout.lines.length === 1 && layout.lines[0] === '27 November 2026' && layout.h <= 39, 'date patch wraps or overflows')
  assert(text.w === 140 && text.ukuran >= 8, 'patch exceeded width or readability floor')
  const meas = document.createElement('canvas').getContext('2d'); meas.font = engine.fontStr(text)
  assert(meas.measureText(text.teks).width <= 140, 'date ink exceeds patch')
  setPatch('W'.repeat(200)); await wait()
  assert(inputPatch.value === '27 November 2026' && text.teks === '27 November 2026', 'unfit input must not replace a valid patch')
  inputPatch.focus(); inputPatch.blur(); await wait()
  const ink = await find('.kv-ab [data-id="' + text.id + '"]')
  assert(ink.children.length === 1 && ink.textContent === text.teks, 'committed date did not render as one canvas line')
  const box = ink.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(ink.firstElementChild)
  const glyph = range.getBoundingClientRect()
  assert(!bg.querySelector('.kv-ph'), 'PDF background did not load')
  assert(glyph.width > 0 && glyph.right <= box.right + 0.5 && glyph.bottom <= box.top + 39 * engine.S.zoom + 0.5, 'visible date ink exceeds the patch')
  if (location.hash === '#patch-preview') return
  ;(await find('button[title="Home"]')).click()
  await find('.kv-start')
  assert(!document.querySelector('.kv-mode, .kv-ahome'), 'Home must not have separate modes')
  assert([...document.querySelectorAll('button')].some(b => b.textContent === 'Impor PDF / Excel'), 'missing unified import')
  const input = await find('input[aria-label="Impor PDF / Excel"]')
  const files = new DataTransfer()
  files.items.add(new File(['%PDF-'], 'sample.pdf'))
  input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true }))
  const alert = await find('[role="alert"]')
  assert(alert.textContent.includes('Kanvas Studio lokal'), 'missing host capability must be actionable')
}
check().then(() => document.getElementById('result').textContent = 'PASS',
  err => document.getElementById('result').textContent = err.message)

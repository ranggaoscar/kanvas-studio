import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { cariBrowser } from '../server/render.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

async function withMcp(fn, extraEnv = {}) {
  const home = mkdtempSync(join(tmpdir(), 'kanvas-efficiency-'))
  const p = spawn(process.execPath, [fileURLToPath(new URL('../bin/kanvas.js', import.meta.url)), 'mcp'], {
    env: { ...process.env, KANVAS_HOME: home, KANVAS_PORT: '0', KANVAS_NO_OPEN: '1', ...extraEnv }, stdio: ['pipe', 'pipe', 'inherit']
  })
  const done = once(p, 'close'), lines = createInterface({ input: p.stdout })[Symbol.asyncIterator]()
  let id = 0
  async function request(method, params) {
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) + '\n')
    const { value } = await lines.next()
    assert.ok(value, 'MCP response expected')
    const m = JSON.parse(value)
    assert.equal(m.id, id)
    assert.ok(m.result, value)
    return m.result
  }
  const call = (name, args = {}) => request('tools/call', { name: 'kanvas_' + name, arguments: args })
  try { await fn({ home, request, call }) }
  finally { p.stdin.end(); await done; rmSync(home, { recursive: true, force: true }) }
}

test('MCP guide topics are opt-in; the advertised quick start and tool definitions are compact', { timeout: 15000 }, async () => {
  await withMcp(async ({ request, call }) => {
    const init = await request('initialize')
    assert.match(init.instructions, /topic.*quick/)
    const list = await request('tools/list')
    const legacy = list.tools.filter(t => t.name !== 'kanvas_document')
    assert.equal(legacy.length, 22)
    assert.ok([...JSON.stringify({tools:legacy})].length < 9500)
    const text = async args => (await call('guide', args)).content[0].text
    const quick = await text({ topic: 'quick' })
    assert.ok(quick.length >= 2500 && quick.length <= 3500, String(quick.length))
    assert.match(quick, /lepas_salinan/)
    const full = readFileSync(new URL('../docs/FORMAT.md', import.meta.url), 'utf8')
    assert.equal(await text({ topic: 'full' }), full)
    assert.equal(await text({}), full)
    for (const [topic, heading] of [['schema', 'Document Schema'], ['ops', 'Operations'], ['design', 'Adaptive Art Direction'], ['brand', 'Brand Kit']]) {
      const section = await text({ topic })
      assert.ok(section.includes(heading) && section.length < full.length)
    }
    assert.equal((await call('guide', { topic: 'typo' })).isError, true)
    const art = async args => (await call('art_direction', { style: 'swiss-editorial', brand: 'none', ...args })).content[0].text
    assert.match(await art({}), /Other lens IDs:.*cinematic/)
    assert.doesNotMatch(await art({}), /Full-bleed visual drama/)
    assert.match(await art({ include_all_lenses: true }), /Full-bleed visual drama/)
  })
})

const baca = res => {
  assert.ok(!res.isError, res.content[0].text)
  return JSON.parse(res.content[0].text.split('\n').slice(1).join('\n'))
}
const file = 'efficiency.kanvas.json'
const doc = { judul: 'Efficiency', versi: 1, brand: 'demo', artboards: [
  { id: 'a1', nama: 'One', w: 600, h: 400, elemen: [
    { id: 't', tipe: 'teks', x: 20, y: 20, w: 300, teks: 'Headline '.repeat(12), ukuran: 30, warna: '#000000' },
    { id: 'i', tipe: 'gambar', x: 20, y: 240, w: 20, h: 20, src: 'data:image/png;base64,' + 'A'.repeat(16000) }
  ] },
  { id: 'a2', nama: 'Two', w: 600, h: 400, elemen: [{ id: 'o', tipe: 'kotak', x: 20, y: 20, w: 40, h: 40 }] }
] }

test('MCP read projects summaries, selected artboards and selected elements without altering the original', { timeout: 15000 }, async () => {
  await withMcp(async ({ home, call }) => {
    writeFileSync(join(home, file), JSON.stringify(doc))
    const read = args => call('read', { file, ...args })
    const summary = baca(await read({ mode: 'summary' }))
    assert.equal(summary.brand, 'demo')
    assert.deepEqual(summary.artboards.map(x => x.jumlah_elemen), [2, 1])
    assert.deepEqual(summary.artboards[0].elemen[0], { id: 't', tipe: 'teks', x: 20, y: 20, w: 300, teks: doc.artboards[0].elemen[0].teks.slice(0, 40) })
    assert.match(summary.artboards[0].elemen[1].src, /^\[data-url: ~/)
    assert.equal(baca(await read({ mode: 'summary', strip_data_urls: false })).artboards[0].elemen[1].src, doc.artboards[0].elemen[1].src)
    assert.deepEqual(baca(await read({ mode: 'artboard', artboard_ids: ['a2'] })).artboards, [doc.artboards[1]])
    const els = baca(await read({ mode: 'element', element_ids: ['i', 'o'], strip_data_urls: true })).artboards
    assert.deepEqual(els.map(ab => ab.elemen.map(e => e.id)), [['i'], ['o']])
    assert.match(els[0].elemen[0].src, /^\[data-url: ~/)
    assert.match(baca(await read({ mode: 'full', strip_data_urls: true })).artboards[0].elemen[1].src, /^\[data-url: ~/)
    assert.equal((await read({ mode: 'artboard' })).isError, true)
    assert.equal((await read({ mode: 'element', element_ids: ['missing'] })).isError, true)
    assert.deepEqual(baca(await read({})), doc)
    assert.deepEqual(JSON.parse(readFileSync(join(home, file), 'utf8')), doc)
  })
})

const viewDoc = { judul: 'View', versi: 1, artboards: Array.from({ length: 8 }, (_, i) => ({
  id: `b${i}`, nama: `Board ${i}`, w: 320, h: 240, elemen: i === 7 ? [{ id: 'bad-path', tipe: 'path' }] : []
})) }

test('MCP fast QA is filtered, diagnoses structural errors, and does not call render', { timeout: 15000 }, async () => {
  await withMcp(async ({ home, call }) => {
    writeFileSync(join(home, file), JSON.stringify(viewDoc))
    const r = await call('view', { file, mode: 'fast_qa', artboard_ids: ['b7'] })
    assert.ok(!r.isError, r.content[0].text)
    assert.ok(r.content.every(c => c.type === 'text'))
    assert.match(r.content[0].text, /Fast QA.*QA SCORE/s)
    assert.match(r.content[0].text, /bad-path.*without.*d/)
    assert.doesNotMatch(r.content[0].text, /Board 0/)
    assert.equal((await call('view', { file, mode: 'fast_qa', artboard: 'no-board' })).isError, true)
  }, { KANVAS_BROWSER: process.execPath }) // Node cannot satisfy Chrome's flags; a browser launch would fail.
})

test('MCP browser QA and PNGs are restricted before rendering; QA-only emits no images', { skip: !cariBrowser(), timeout: 60000 }, async () => {
  await withMcp(async ({ home, call }) => {
    writeFileSync(join(home, file), JSON.stringify(viewDoc))
    const full = await call('view', { file })
    assert.equal(full.content.filter(c => c.type === 'image').length, 6, full.content[0].text)
    assert.doesNotMatch(full.content[0].text, /Board [67]|bad-path/)
    assert.match(full.content.at(-1).text, /2 more artboards/)
    const filtered = await call('view', { file, artboard_ids: ['b1', 'b3'], max_images: 1 })
    assert.equal(filtered.content.filter(c => c.type === 'image').length, 1, filtered.content[0].text)
    assert.match(filtered.content[0].text, /Board 1/)
    assert.doesNotMatch(filtered.content[0].text, /Board 3/)
    const qa = await call('view', { file, mode: 'qa_only', artboard: 'b7' })
    assert.equal(qa.content.length, 1)
    assert.match(qa.content[0].text, /QA SCORE.*bad-path/s)
    assert.doesNotMatch(qa.content[0].text, /Board 0/)
  })
})

test('MCP edit heals only when opted in and persists the repair report targets', { timeout: 15000 }, async () => {
  await withMcp(async ({ home, call }) => {
    const original = { artboards: [{ id: 'a1', w: 400, h: 300, elemen: [{ tipe: 'teks', teks: 'A\nB', w: 100, x: -3, y: 5, lh: 0.7 }] }] }
    writeFileSync(join(home, file), JSON.stringify(original))
    const edit = opts => call('edit', { file, ops: [{ op: 'judul', judul: 'Edited' }], ...opts })
    assert.ok(!(await edit({})).isError)
    assert.equal(JSON.parse(readFileSync(join(home, file), 'utf8')).artboards[0].elemen[0].id, undefined)
    const edited = await edit({ auto_heal: true })
    assert.ok(!edited.isError, edited.content[0].text)
    assert.deepEqual(edited.structuredContent.healed.map(x => x.rule), ['missing_id', 'line_height', 'position'])
    const e = JSON.parse(readFileSync(join(home, file), 'utf8')).artboards[0].elemen[0]
    assert.deepEqual([e.id, e.lh, e.x], [edited.structuredContent.healed[0].id, 1.15, 0])
    const add = () => call('edit', { file, auto_heal: true, ops: [{ op: 'tambah', elemen: { tipe: 'kotak' } }] })
    const added = await add()
    assert.ok(added.structuredContent.healed.some(x => x.rule === 'missing_id' && /^heal-/.test(x.id)))
  })
})

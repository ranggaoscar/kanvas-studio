import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { buildPresentationDoc, chooseVisualType } from '../server/presentation.js'
import { choosePdfRenderer, inspectPdf, quickEditPdf } from '../server/pdf-bridge.js'
import { envMinimal } from '../server/render.js'

const data = [{ label: 'North', value: 12 }, { label: 'South', value: 9 }]
const trend = { chart: { labels: ['Jan', 'Feb'], series: [{ name: 'Sales', values: [12, 9] }] } }
const processSlide = { steps: ['Intake', 'Review', 'Publish'] }
const comparison = { table: { columns: ['Plan', 'Support'], rows: [['Basic', 'Email'], ['Pro', 'Phone']] } }
const narrative = { heading: 'Strategy for 2026', body: 'Focus on retention before expanding.' }

test('Smart Presentation chooses editable visuals from structured content and respects overrides', () => {
  assert.deepEqual([trend, processSlide, comparison, narrative].map(chooseVisualType), ['line', 'diagram', 'table', 'narrative'])
  assert.equal(chooseVisualType({ chart: { data } }), 'bar')
  assert.equal(chooseVisualType({ chart: { data, intent: 'share' } }), 'donut')
  assert.equal(chooseVisualType({ chart: { data: [{ label: 'Very long category label', value: 12 }, data[1]] } }), 'hbar')
  assert.equal(chooseVisualType({ chart: { data: [{ label: 'Fake', value: '$12' }, data[1]] } }), 'narrative')
  assert.equal(chooseVisualType({ ...trend, type: 'split' }), 'split')
  assert.equal(chooseVisualType({ chart: { data, type: 'hbar' } }), 'hbar')
  assert.equal(chooseVisualType({ metrics: [{ label: 'Availability', value: 'In stock' }] }), 'stats')
  const { doc } = buildPresentationDoc({ slides: [trend, processSlide, comparison, narrative] })
  assert.ok(doc.artboards[0].elemen.some(e => e.tipe === 'path'))
  assert.ok(doc.artboards[1].elemen.some(e => e.teks === 'Review'))
  assert.ok(doc.artboards[2].elemen.some(e => e.nama === 'Header Row'))
  assert.ok(doc.artboards[3].elemen.some(e => e.teks === narrative.body))
  assert.ok(!doc.artboards[3].elemen.some(e => e.tipe === 'path'))
})

test('PDF renderer capability order and actionable missing-renderer error', async () => {
  for (const [os, available, expected, order] of [
    ['win32', ['winrt', 'poppler'], 'winrt', ['winrt']],
    ['win32', ['poppler'], 'poppler', ['winrt', 'poppler']],
    ['linux', ['poppler'], 'poppler', ['poppler']],
    ['darwin', ['poppler'], 'poppler', ['poppler']]
  ]) {
    const checked = []
    assert.equal(await choosePdfRenderer(os, async kind => { checked.push(kind); return available.includes(kind) }), expected)
    assert.deepEqual(checked, order)
  }
  await assert.rejects(choosePdfRenderer('linux', async () => false), /No local PDF renderer.*poppler-utils/)
})

const hasPoppler = () => ['pdfinfo', 'pdftoppm'].every(cmd => {
  try { execFileSync(cmd, ['-v'], { env: envMinimal(), stdio: 'ignore', timeout: 2000 }); return true } catch { return false }
})
function pdfFixture() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count 2 /Kids [3 0 R 4 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 180 90] /Resources << >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 220] /CropBox [0 0 150 75] /Rotate 90 /Resources << >> /Contents 5 0 R >>',
    '<< /Length 0 >>\nstream\nendstream']
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((o, i) => { const offset = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return offset })
  return Buffer.from(pdf + `xref\n0 6\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${pdf.length}\n%%EOF\n`)
}

test('real Poppler rasterizes a rotated mixed-size PDF into locked PNG backgrounds', { skip: process.platform === 'win32' || !hasPoppler(), timeout: 30000 }, async () => {
  const pdf = pdfFixture(), doc = await quickEditPdf(pdf)
  assert.deepEqual(doc.artboards.map(a => [a.w, a.h]), [[240, 120], [100, 200]])
  for (const ab of doc.artboards) {
    const el = ab.elemen[0]
    assert.ok(el.kunci && el.src.startsWith('data:image/png;base64,'))
    const img = Buffer.from(el.src.split(',')[1], 'base64')
    assert.deepEqual([img.readUInt32BE(16), img.readUInt32BE(20)], [ab.w * 2, ab.h * 2])
  }
  const meta = await inspectPdf(pdf)
  assert.equal(meta.pageCount, 2)
  assert.equal(meta.needsVisionFallback, true)
})

test('v0.4.0 manifests, MCP version and schema, and skill budgets', t => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  for (const path of ['package.json', 'plugin.json']) assert.equal(JSON.parse(read(path)).version, '0.4.0')
  const skillChars = [...read('skills/kanvas-studio/SKILL.md')].length
  assert.ok(skillChars < 3500)
  const call = (id, method) => JSON.stringify({ jsonrpc: '2.0', id, method })
  const home = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'kanvas-release-'))
  try {
    const out = execFileSync(process.execPath, [fileURLToPath(new URL('../bin/kanvas.js', import.meta.url)), 'mcp'], {
      encoding: 'utf8', env: { ...envMinimal(), KANVAS_HOME: home, KANVAS_NO_OPEN: '1' }, timeout: 15000,
      input: call(1, 'initialize') + '\n' + call(2, 'tools/list') + '\n'
    }).trim().split('\n').map(line => JSON.parse(line).result)
    assert.equal(out[0].serverInfo.version, '0.4.0')
    assert.equal(out[1].tools.length, 23)
    const chars = [...JSON.stringify(out[1])].length
    assert.ok(chars < 10000)
    t.diagnostic(`tools/list: ${chars} characters; SKILL.md: ${skillChars} characters`)
  } finally { rmSync(home, { recursive: true, force: true }) }
})

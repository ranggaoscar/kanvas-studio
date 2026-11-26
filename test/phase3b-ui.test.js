import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { cariBrowser, envMinimal } from '../server/render.js'
import { embedHybridKanvas, extractHybridKanvas } from '../server/pdf-bridge.js'
import { readTabularFile } from '../server/xlsx.js'

test('editor protects locked layers from pointer and keyboard edits and handles a host without document support', { skip: !cariBrowser(), timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kanvas-lock-'))
  try {
    await build({
      entryPoints: [fileURLToPath(new URL('./fixtures/phase3b-editor.js', import.meta.url))],
      outfile: join(dir, 'editor.js'), bundle: true, format: 'iife',
      alias: { '@hermes/plugin-sdk': fileURLToPath(new URL('../app/host.js', import.meta.url)) },
      define: { 'process.env.NODE_ENV': '"production"' }
    })
    const html = join(dir, 'editor.html')
    writeFileSync(html, '<!doctype html><meta charset="utf-8"><div id="app"></div><pre id="result">pending</pre><pre id="pdf"></pre><script src="editor.js"></script>')
    const out = execFileSync(cariBrowser(), ['--headless=new', '--disable-gpu', '--no-first-run', '--virtual-time-budget=12000',
      '--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND', '--user-data-dir=' + join(dir, 'profile'), '--dump-dom', pathToFileURL(html).href],
      { encoding: 'utf8', windowsHide: true, env: envMinimal(), timeout: 50000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(out.match(/<pre id="result">([^<]*)<\/pre>/)?.[1], 'PASS')
    const pdf = Buffer.from(out.match(/<pre id="pdf">([^<]+)<\/pre>/)[1], 'base64')
    assert.deepEqual(extractHybridKanvas(pdf).artboards[0].elemen.map(e => e.id), ['locked'])
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5 }) }
})

test('local document bytes preserve Hybrid designs and export full extracted cells', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kanvas-bridge-'))
  process.env.KANVAS_HOME = dir
  const { documentAction } = await import('../server/studio.js')
  try {
    const upload = (name, bytes) => ({ name, base64: Buffer.from(bytes).toString('base64') })
    const csv = { action: 'import_xlsx', create_report: true, upload: upload('Recap.csv', 'Item,Quantity\nNorth,15\nSouth,22') }
    const first = await documentAction(csv), again = await documentAction(csv)
    assert.notEqual(first.file, again.file)
    const report = JSON.parse(readFileSync(join(dir, first.file)))
    const pdf = Buffer.from('%PDF-1.4\nstartxref\n0\n%%EOF')
    const encoded = await documentAction({ action: 'export_pdf', upload: upload('result.pdf', pdf), doc: report })
    const bytes = Buffer.from(encoded.base64, 'base64')
    assert.deepEqual(extractHybridKanvas(bytes), report)
    const args = { action: 'import_pdf', upload: upload('result.pdf', bytes) }
    const editable = await documentAction({ ...args, mode: 'quick_edit' })
    assert.deepEqual(JSON.parse(readFileSync(join(dir, editable.file))), report)
    const extracted = await documentAction({ ...args, mode: 'extract' })
    assert.deepEqual(extracted.sheets[0].headers, ['Item', 'Quantity'])
    const xlsx = await documentAction({ action: 'export_xlsx', sheets: extracted.sheets, returnBytes: true })
    assert.deepEqual(readTabularFile(Buffer.from(xlsx.base64, 'base64')).sheets[0].rows, [['North','15'], ['South','22']])
    const longText = 'data '.repeat(50).trim()
    const textDoc = { artboards: [{ id: 'a', elemen: [{ tipe: 'teks', teks: longText }] }] }
    const full = await documentAction({ ...args, mode: 'extract', upload: upload('text.pdf', embedHybridKanvas(pdf, textDoc)) })
    assert.equal(full.sheets[0].rows[0][1], longText)
    await assert.rejects(() => documentAction({ ...csv, upload: upload('../Recap.csv', 'a,b') }))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

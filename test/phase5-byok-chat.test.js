import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { cariBrowser, envMinimal } from '../server/render.js'

const TEST_HOME = mkdtempSync(join(tmpdir(), 'kanvas-phase5-'))
process.env.KANVAS_HOME = TEST_HOME
process.env.KANVAS_NO_OPEN = '1'

const { mulaiStudio } = await import('../server/studio.js')

const H = { 'X-Kanvas': '1', 'Content-Type': 'application/json' }

const httpReq = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((ok, gagal) => {
  const req = request(url, { method, headers }, res => {
    let raw = ''
    res.on('data', d => { raw += d })
    res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body: raw }))
  })
  req.on('error', gagal)
  if (body) req.write(body)
  req.end()
})

function parseSseEvents(raw) {
  const events = []
  for (const block of raw.split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue
    let event = 'message'
    const dataLines = []
    for (const ln of block.split(/\r?\n/)) {
      if (ln.startsWith('event:')) event = ln.slice(6).trim()
      else if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trim())
    }
    if (!dataLines.length) continue
    events.push({ event, data: JSON.parse(dataLines.join('\n')) })
  }
  return events
}

test('BYOK config persists locally in _llm.json, respects security guards, and never leaks raw apiKey', async () => {
  const { server, url } = await mulaiStudio({ port: 0, diam: true })
  try {
    // Security guards apply to /api/chat and /api/chat/config
    assert.equal((await httpReq(url + '/api/chat/config')).status, 403)
    assert.equal((await httpReq(url + '/api/chat/config', { headers: { ...H, Origin: 'https://evil.example' } })).status, 403)
    assert.equal((await httpReq(url + '/api/chat/config', { headers: { ...H, Host: 'evil.example' } })).status, 403)
    assert.equal((await httpReq(url + '/api/chat', { method: 'POST', body: '{}' })).status, 403)

    const initial = JSON.parse((await httpReq(url + '/api/chat/config', { headers: H })).body)
    assert.equal(initial.ok, true)
    assert.equal(initial.configured, false)
    assert.equal(initial.hasApiKey, false)
    assert.ok(Array.isArray(initial.presets) && initial.presets.some(p => p.id === 'ollama'))

    const secret = 'sk-proj-super-secret-value-987654321'
    const saved = JSON.parse((await httpReq(url + '/api/chat/config', {
      method: 'POST', headers: H,
      body: JSON.stringify({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', apiKey: secret })
    })).body)
    assert.equal(saved.ok, true)
    assert.equal(saved.configured, true)
    assert.equal(saved.hasApiKey, true)
    assert.equal('apiKey' in saved, false)
    assert.ok(saved.apiKeyPreview && !saved.apiKeyPreview.includes('super-secret'))
    assert.ok(!JSON.stringify(saved).includes(secret))

    const fetched = JSON.parse((await httpReq(url + '/api/chat/config', { headers: H })).body)
    assert.equal(fetched.hasApiKey, true)
    assert.equal('apiKey' in fetched, false)
    assert.ok(!JSON.stringify(fetched).includes(secret))

    // _llm.json exists on disk but is blocked from generic file APIs
    assert.ok(existsSync(join(TEST_HOME, '_llm.json')))
    const readSecret = JSON.parse((await httpReq(url + '/api/read?path=_llm.json', { headers: H })).body)
    assert.equal(readSecret.ok, false)
    assert.equal(readSecret.error, 'forbidden')
    const writeSecret = JSON.parse((await httpReq(url + '/api/write', { method: 'POST', headers: H, body: JSON.stringify({ path: '_llm.json', text: '{}' }) })).body)
    assert.equal(writeSecret.ok, false)
    const listRes = JSON.parse((await httpReq(url + '/api/list', { headers: H })).body)
    assert.ok(!listRes.entries.some(e => e.name === '_llm.json'))

    // Updating model preserves stored key; clearApiKey clears it
    const updated = JSON.parse((await httpReq(url + '/api/chat/config', {
      method: 'POST', headers: H,
      body: JSON.stringify({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' })
    })).body)
    assert.equal(updated.model, 'gpt-4o-mini')
    assert.equal(updated.hasApiKey, true)

    const cleared = JSON.parse((await httpReq(url + '/api/chat/config', {
      method: 'POST', headers: H,
      body: JSON.stringify({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', clearApiKey: true })
    })).body)
    assert.equal(cleared.hasApiKey, false)
    assert.equal(cleared.configured, false)
  } finally { server.close() }
})

test('POST /api/chat calls kanvas_create, kanvas_edit, and fast_qa via mock OpenAI server and produces valid .kanvas.json', async () => {
  let turn = 0
  let capturedToolsCount = 0
  let capturedUserContext = ''
  const mockLlm = createServer((req, res) => {
    assert.equal(req.url, '/v1/chat/completions')
    assert.equal(req.headers.authorization, 'Bearer sk-mock-local-key-1234')
    let raw = ''
    req.on('data', d => { raw += d })
    req.on('end', () => {
      const body = JSON.parse(raw)
      turn++
      if (turn === 1) {
        capturedToolsCount = body.tools?.length || 0
        capturedUserContext = body.messages.find(m => m.role === 'user')?.content || ''
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        res.write('data: ' + JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'kanvas_create', arguments: '{"judul":"Laporan ' } }] } }]
        }) + '\n\n')
        res.write('data: ' + JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'Q4","ukuran":"a4"}' } }] } }]
        }) + '\n\n')
        res.write('data: [DONE]\n\n')
        res.end()
      } else if (turn === 2) {
        const lastToolMsg = [...body.messages].reverse().find(m => m.role === 'tool')
        const createdFile = lastToolMsg.content.match(/Created:\s+(\S+\.kanvas\.json)/)[1]
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_2',
                  type: 'function',
                  function: {
                    name: 'kanvas_edit',
                    arguments: JSON.stringify({
                      file: createdFile,
                      ops: [{
                        op: 'tambah',
                        elemen: [
                          { id: 'hdr1', tipe: 'kotak', x: 56, y: 56, w: 682, h: 120, radius: 16, fill: '#101634' },
                          { id: 'ttl1', tipe: 'teks', x: 84, y: 88, w: 620, teks: 'Laporan Penjualan Q4', font: 'Plus Jakarta Sans', ukuran: 40, tebal: 800, warna: '#FFFFFF' }
                        ]
                      }]
                    })
                  }
                },
                {
                  id: 'call_3',
                  type: 'function',
                  function: {
                    name: 'kanvas_view',
                    arguments: JSON.stringify({ file: createdFile, mode: 'fast_qa' })
                  }
                }
              ]
            }
          }]
        }))
      } else {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Laporan A4 berhasil dibuat ' } }] }) + '\n\n')
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'dan lulus pemeriksaan cepat.' } }] }) + '\n\n')
        res.write('data: [DONE]\n\n')
        res.end()
      }
    })
  })

  await new Promise(ok => mockLlm.listen(0, '127.0.0.1', ok))
  const mockUrl = `http://127.0.0.1:${mockLlm.address().port}/v1`
  const { server, url } = await mulaiStudio({ port: 0, diam: true })
  try {
    const cfg = JSON.parse((await httpReq(url + '/api/chat/config', {
      method: 'POST', headers: H,
      body: JSON.stringify({ provider: 'custom', baseUrl: mockUrl, model: 'mock-designer-1', apiKey: 'sk-mock-local-key-1234' })
    })).body)
    assert.equal(cfg.configured, true)

    const csvAttachment = { name: 'penjualan.csv', base64: Buffer.from('Bulan,Omzet\nOkt,120\nNov,180\nDes,240').toString('base64') }
    const chatRes = await httpReq(url + '/api/chat', {
      method: 'POST', headers: H,
      body: JSON.stringify({ prompt: 'Buat laporan A4 dari data penjualan ini', attachments: [csvAttachment] })
    })
    assert.equal(chatRes.status, 200)
    assert.match(String(chatRes.headers['content-type']), /text\/event-stream/)
    assert.equal(capturedToolsCount, 23)
    assert.match(capturedUserContext, /uploads\/penjualan-[a-f0-9]+\.csv/)

    const events = parseSseEvents(chatRes.body)
    const types = events.map(e => e.event)
    assert.ok(types.includes('thinking'))
    assert.ok(types.includes('tool_call'))
    assert.ok(types.includes('tool_result'))
    assert.ok(types.includes('canvas_updated'))
    assert.equal(types.at(-1), 'done')

    const toolCalls = events.filter(e => e.event === 'tool_call').map(e => e.data.name)
    assert.deepEqual(toolCalls, ['kanvas_create', 'kanvas_edit', 'kanvas_view'])

    const done = events.at(-1).data
    assert.match(done.text, /Laporan A4 berhasil dibuat/)
    assert.ok(done.file && /\.kanvas\.json$/i.test(done.file))

    const savedDoc = JSON.parse(readFileSync(join(TEST_HOME, done.file), 'utf8'))
    assert.equal(savedDoc.versi, 1)
    assert.equal(savedDoc.judul, 'Laporan Q4')
    assert.equal(savedDoc.artboards[0].elemen.length, 2)
    assert.equal(savedDoc.artboards[0].elemen[1].teks, 'Laporan Penjualan Q4')
    assert.ok(done.attachments.length === 1 && existsSync(join(TEST_HOME, done.attachments[0].path)))
  } finally {
    server.close()
    mockLlm.close()
  }
})

test('Floating Prompt Bar is hidden on Hermes Desktop host and visible with BYOK modal & cloud slot in Standalone host', { skip: !cariBrowser(), timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kanvas-ui-phase5-'))
  try {
    const hermesSdk = join(dir, 'hermes-sdk.js')
    writeFileSync(hermesSdk, `
      import { createElement, useSyncExternalStore } from 'react'
      const atom = v => ({ get: () => v, set() {}, subscribe: () => () => {} })
      export const useValue = a => useSyncExternalStore(a.subscribe, a.get)
      export const Button = ({ children, ...p }) => createElement('button', p, children)
      export const PANES_AREA = 'panes', ROUTES_AREA = 'routes', SIDEBAR_NAV_AREA = 'nav', PALETTE_AREA = 'palette'
      export const STATUSBAR_AREAS = { right: 'right' }, KEYBINDS_AREA = 'keys'
      // Authentic Hermes Desktop host: has openWorkspace and composer, NO host.chat
      export const host = {
        notify() {}, notifyError() {}, navigate() {},
        openWorkspace: () => () => {},
        paneVisibility: () => atom(true),
        composer: { insertText: async () => true, focus() {}, submit() {} },
        state: { busyBySession: atom({}), focusedSessionId: atom('s1'), busy: atom(false) }
      }
    `)

    const entryHermes = join(dir, 'entry-hermes.js')
    writeFileSync(entryHermes, `
      import { createElement } from 'react'
      import { createRoot } from 'react-dom/client'
      import plugin from ${JSON.stringify(fileURLToPath(new URL('../desktop/plugin.js', import.meta.url)))}
      const seed = { versi: 1, judul: 'Hermes Deck', artboards: [{ id: 'a1', nama: 'Slide 1', x: 0, y: 0, w: 1280, h: 720, bg: '#FFFFFF', elemen: [] }] }
      let page
      plugin.register({
        storage: { get: (k, d) => k === 'file' ? 'deck.kanvas.json' : d, set() {}, remove() {} },
        files: {
          folders: async () => [],
          list: async () => ({ ok: true, entries: [{ name: 'deck.kanvas.json' }] }),
          stat: async () => ({ ok: true, exists: true, mtimeMs: 1 }),
          readText: async (_, p) => p === 'deck.kanvas.json' ? { ok: true, text: JSON.stringify(seed) } : { ok: false },
          writeText: async () => ({ ok: true })
        },
        os: { writeClipboard: async () => true, revealPath: async () => true },
        onDispose() {}, setInterval() {},
        registerMany: list => { page = list.find(c => c.id === 'page') }
      })
      createRoot(document.getElementById('app')).render(createElement(page.render))
      setTimeout(() => {
        const hasCanvas = !!document.querySelector('.kv-view')
        const hasPromptBar = !!document.querySelector('[data-testid="floating-prompt-bar"]')
        const hasDrawer = !!document.querySelector('.kv-drawer')
        document.getElementById('result').textContent = JSON.stringify({ hasCanvas, hasPromptBar, hasDrawer })
      }, 300)
    `)

    const entryStandalone = join(dir, 'entry-standalone.js')
    writeFileSync(entryStandalone, `
      import { createElement } from 'react'
      import { createRoot } from 'react-dom/client'
      import { host } from '@hermes/plugin-sdk'
      import plugin from ${JSON.stringify(fileURLToPath(new URL('../desktop/plugin.js', import.meta.url)))}
      const seed = { versi: 1, judul: 'Standalone Deck', artboards: [{ id: 'a1', nama: 'Slide 1', x: 0, y: 0, w: 1280, h: 720, bg: '#FFFFFF', elemen: [] }] }
      const chatFn = async () => ({ ok: true, text: 'ok' })
      chatFn.getConfig = async () => ({ ok: true, configured: false, provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: '', hasApiKey: false, apiKeyPreview: '' })
      chatFn.saveConfig = async cfg => ({ ok: true, configured: true, ...cfg, hasApiKey: false, apiKeyPreview: '' })
      chatFn.renderSlot = () => createElement('span', { className: 'test-credit-slot' }, '100 kredit')
      host.chat = chatFn
      let pane
      plugin.register({
        storage: { get: (k, d) => k === 'file' ? 'deck.kanvas.json' : d, set() {}, remove() {} },
        files: {
          folders: async () => [],
          list: async () => ({ ok: true, entries: [{ name: 'deck.kanvas.json' }] }),
          stat: async () => ({ ok: true, exists: true, mtimeMs: 1 }),
          readText: async (_, p) => p === 'deck.kanvas.json' ? { ok: true, text: JSON.stringify(seed) } : { ok: false },
          writeText: async () => ({ ok: true })
        },
        os: { writeClipboard: async () => true, revealPath: async () => true },
        onDispose() {}, setInterval() {},
        registerMany: list => { pane = list.find(c => c.id === 'pane') }
      })
      createRoot(document.getElementById('app')).render(createElement(pane.render))
      setTimeout(() => {
        const bar = document.querySelector('[data-testid="floating-prompt-bar"]')
        const chips = [...document.querySelectorAll('.kv-pb-chip')].map(b => b.textContent)
        const slot = document.querySelector('.test-credit-slot')?.textContent || ''
        const cfgBtn = document.querySelector('button[aria-label="Pengaturan AI"]')
        cfgBtn?.click()
        setTimeout(() => {
          const modalTitle = document.querySelector('.kv-mbox > b')?.textContent || ''
          const presets = [...document.querySelectorAll('.kv-byok-preset b')].map(b => b.textContent)
          const mcpHint = document.querySelector('.kv-byok-mcp code')?.textContent || ''
          document.getElementById('result').textContent = JSON.stringify({ hasBar: !!bar, chips, slot, modalTitle, presets, mcpHint })
        }, 120)
      }, 300)
    `)

    const nodePaths = [fileURLToPath(new URL('../node_modules', import.meta.url))]
    await build({
      entryPoints: [entryHermes], outfile: join(dir, 'hermes.js'), bundle: true, format: 'iife',
      nodePaths, alias: { '@hermes/plugin-sdk': hermesSdk }, define: { 'process.env.NODE_ENV': '"production"' }
    })
    await build({
      entryPoints: [entryStandalone], outfile: join(dir, 'standalone.js'), bundle: true, format: 'iife',
      nodePaths, alias: { '@hermes/plugin-sdk': fileURLToPath(new URL('../app/host.js', import.meta.url)) }, define: { 'process.env.NODE_ENV': '"production"' }
    })

    const runPage = (jsName) => {
      const html = join(dir, jsName + '.html')
      writeFileSync(html, `<!doctype html><meta charset="utf-8"><div id="app"></div><pre id="result">pending</pre><script src="${jsName}"></script>`)
      const out = execFileSync(cariBrowser(), [
        '--headless=new', '--disable-gpu', '--no-first-run', '--virtual-time-budget=8000',
        '--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND',
        '--user-data-dir=' + join(dir, 'prof-' + jsName), '--dump-dom', pathToFileURL(html).href
      ], { encoding: 'utf8', windowsHide: true, env: envMinimal(), timeout: 40000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
      return JSON.parse(out.match(/<pre id="result">([^<]*)<\/pre>/)[1])
    }

    const hermesRes = runPage('hermes.js')
    assert.equal(hermesRes.hasCanvas, true, 'Hermes canvas must render')
    assert.equal(hermesRes.hasPromptBar, false, 'Floating Prompt Bar MUST be hidden in Hermes Desktop')
    assert.equal(hermesRes.hasDrawer, false, 'Progress Drawer MUST be hidden in Hermes Desktop')

    const standaloneRes = runPage('standalone.js')
    assert.equal(standaloneRes.hasBar, true, 'Floating Prompt Bar MUST appear in Standalone')
    assert.equal(standaloneRes.chips.length, 3, 'Must show 3 contextual starter prompt chips')
    assert.equal(standaloneRes.slot, '100 kredit', 'Cloud-ready renderSlot() must mount inside prompt bar')
    assert.match(standaloneRes.modalTitle, /Pengaturan AI Lokal/)
    assert.deepEqual(standaloneRes.presets, ['Ollama Lokal', 'OpenRouter', 'OpenAI', 'Custom URL'])
    assert.equal(standaloneRes.mcpHint, 'npx -y kanvas-studio mcp')
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 })
  }
})

test.after(() => {
  rmSync(TEST_HOME, { recursive: true, force: true, maxRetries: 5 })
})

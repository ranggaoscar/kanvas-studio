#!/usr/bin/env node
// Kanvas Studio CLI (cross-platform: Windows, macOS, Linux)
//   kanvas [start] [--port 4848] [--no-open]
//   kanvas mcp
//   kanvas render <file.kanvas.json> [--artboard a1] [--format png|svg|pdf|pptx] [--skala 2]
//   kanvas doctor
//   kanvas init-mcp [claude|codex|cursor|hermes]
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, relative, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mulaiStudio, bukaDiOS } from '../server/studio.js'
import { RUANG, FOLDER_HERMES, bacaDesain, siapkanRuang } from '../server/ruang.js'
import { cariBrowser } from '../server/render.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = JSON.parse(readFileSync(join(AKAR, 'package.json'), 'utf8'))
const BIN_PATH = resolve(AKAR, 'bin/kanvas.js')

const [perintah, ...arg] = process.argv.slice(2)
const opsi = n => { const i = arg.indexOf('--' + n); return i >= 0 ? arg[i + 1] : undefined }

function printHelp() {
  console.log(`Kanvas Studio v${PKG.version} — Free, open-source, local-first visual design engine for AI agents.

Usage:
  kanvas [start] [--port 4848] [--no-open]   Start local design studio UI
  kanvas mcp                                 Run stdio MCP server for AI agents
  kanvas render <file> [options]             Render & run Visual QA (--artboard id --format png|svg|pdf|pptx --skala 2)
  kanvas doctor                              Check Node.js, Chrome/Edge, workspace, and plugin readiness
  kanvas init-mcp [client]                   Print ready-to-paste MCP config (claude | codex | cursor | hermes)
  kanvas --version                           Print version`)
}

function printInitMcp(client = 'all') {
  const target = String(client || 'all').toLowerCase()
  const p = BIN_PATH.replace(/\\/g, '/')
  if (target === 'claude' || target === 'all') {
    console.log('# Claude Code')
    console.log(`claude mcp add kanvas -- node "${p}" mcp\n`)
  }
  if (target === 'codex' || target === 'all') {
    console.log('# Codex (~/.codex/config.toml)')
    console.log(`[mcp_servers.kanvas]\ncommand = "node"\nargs = ["${p}", "mcp"]\n`)
  }
  if (target === 'cursor' || target === 'all') {
    console.log('# Cursor / Windsurf / generic stdio MCP JSON')
    console.log(JSON.stringify({ mcpServers: { kanvas: { command: 'node', args: [p, 'mcp'] } } }, null, 2) + '\n')
  }
  if (target === 'hermes' || target === 'all') {
    console.log('# Hermes Desktop (recommended: hermes plugins install kanvas-studio)')
    console.log(`# Or manual ~/.hermes/config.yaml:\nmcp_servers:\n  kanvas:\n    command: node\n    args: ["${p}", "mcp"]\n    timeout: 180\n    env:\n      KANVAS_NO_OPEN: "1"\n`)
  }
}

if (perintah === '--version' || perintah === '-v' || perintah === 'version') {
  console.log(PKG.version)
} else if (perintah === '--help' || perintah === '-h' || perintah === 'help') {
  printHelp()
} else if (perintah === 'mcp') {
  const { jalankanMcp } = await import('../server/mcp.js')
  await jalankanMcp()
} else if (perintah === 'doctor') {
  siapkanRuang()
  const { listBrands } = await import('../server/brand.js')
  const { listAssets } = await import('../server/assets.js')
  const { listCommunity } = await import('../server/community.js')
  const major = Number(process.versions.node.split('.')[0])
  const browser = cariBrowser()
  const hasDist = existsSync(join(AKAR, 'app/dist/kanvas.js')) && existsSync(join(AKAR, 'app/dist/ikon.json'))
  const brands = listBrands().brands.length
  const assets = listAssets().assets.length
  const comm = listCommunity()
  console.log(`Kanvas Studio v${PKG.version} — Environment Doctor\n`)
  console.log(`${major >= 18 ? '✓' : '✗'} Node.js: ${process.version} (requires >=18)`)
  console.log(`${browser ? '✓' : '!'} Browser (Chrome/Edge for PNG/PDF/QA): ${browser || 'NOT FOUND (set KANVAS_BROWSER or install Chrome/Edge)'}`)
  console.log(`${hasDist ? '✓' : '✗'} Prebuilt UI & icon bundle: ${hasDist ? 'ready (app/dist/)' : 'missing (run npm run build)'}`)
  console.log(`✓ Active workspace: ${RUANG}`)
  console.log(`• Hermes Desktop data dir: ${FOLDER_HERMES} (${existsSync(FOLDER_HERMES) ? 'detected' : 'not detected'})`)
  console.log(`• Local state: ${brands} Brand Kit(s) · ${assets} Asset(s) · ${comm.templates.length} community template(s) · ${comm.directions.length} community direction(s) · ${comm.workflows.length} workflow(s)`)
  console.log(`\nRun \`kanvas init-mcp\` to print copy-paste MCP config for Claude Code, Codex, Cursor, or Hermes.`)
  process.exit(major >= 18 && hasDist ? 0 : 1)
} else if (perintah === 'init-mcp') {
  printInitMcp(arg[0] || 'all')
} else if (perintah === 'render') {
  const format = String(opsi('format') || 'png').toLowerCase()
  const file = relative(RUANG, resolve(RUANG, arg[0] || ''))
  if (format === 'pptx') {
    const { exportDocToPptx } = await import('../server/pptx.js')
    const dir = join(RUANG, 'preview'); mkdirSync(dir, { recursive: true })
    const p = join(dir, `${basename(file).replace(/\.kanvas\.json$/i, '')}.pptx`)
    writeFileSync(p, exportDocToPptx(bacaDesain(file), { artboard: opsi('artboard') }))
    console.log(p)
    process.exit(0)
  }
  const { render } = await import('../server/render.js')
  const studio = await mulaiStudio({ port: 0, diam: true })
  const r = await render(studio, { file, artboard: opsi('artboard'), format, skala: Number(opsi('skala')) || 1 })
  studio.server.close()
  if (!r.ok) { console.error('Failed:', r.error); process.exit(2) }
  const dir = join(RUANG, 'preview'); mkdirSync(dir, { recursive: true })
  for (const x of r.hasil) {
    const p = join(dir, `${basename(file).replace(/\.kanvas\.json$/i, '')}-${x.id}.${format}`)
    writeFileSync(p, format === 'svg' ? x.data : Buffer.from(x.data.split(',')[1], 'base64')); console.log(p)
  }
  if (typeof r.skor === 'number') console.log(`\nQA SCORE: ${r.skor}/100`)
  if (Array.isArray(r.metrik) && r.metrik.length) {
    for (const m of r.metrik) {
      const parts = [`score ${m.skor}/100`, `${m.elemen} elements`, `whitespace ~${m.whitespacePct}%`]
      if (m.minMarginPx != null) parts.push(`min margin ${m.minMarginPx}px`)
      if (m.fontFamilies?.length) parts.push(`fonts: ${m.fontFamilies.join(', ')}`)
      console.log(`  [${m.nama}] ${parts.join(' · ')}`)
    }
  }
  console.log(r.masalah.length ? `\nISSUES (${r.masalah.length}):\n  ✗ ` + r.masalah.join('\n  ✗ ') : '\nISSUES: none ✓')
  if (r.saran.length) console.log(`SUGGESTIONS (${r.saran.length}):\n  • ` + r.saran.join('\n  • '))
  process.exit(r.masalah.length ? 1 : 0)
} else if (!perintah || perintah === 'start') {
  const port = Number(opsi('port')) || undefined
  const { url } = await mulaiStudio({ port })
  if (!arg.includes('--no-open')) bukaDiOS(url)
  console.error('Open in your browser: ' + url + '   ·   Ctrl+C to stop')
} else {
  printHelp()
  process.exit(1)
}

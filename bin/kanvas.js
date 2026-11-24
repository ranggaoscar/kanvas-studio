#!/usr/bin/env node
// kanvas            → jalankan Kanvas Studio lokal & buka di browser
// kanvas mcp        → server MCP (stdio) untuk agent: Claude Code, Codex, Hermes, Cursor, dll.
// kanvas render <file.kanvas.json> [--artboard a1] [--format png|svg|pdf]  → render + cek dari terminal
import { mulaiStudio, bukaDiOS } from '../server/studio.js'
import { RUANG } from '../server/ruang.js'

const [perintah, ...arg] = process.argv.slice(2)
const opsi = n => { const i = arg.indexOf('--' + n); return i >= 0 ? arg[i + 1] : undefined }

if (perintah === 'mcp') {
  const { jalankanMcp } = await import('../server/mcp.js')
  await jalankanMcp()
} else if (perintah === 'render') {
  const { render } = await import('../server/render.js')
  const { writeFileSync, mkdirSync } = await import('node:fs')
  const { join, relative, resolve, basename } = await import('node:path')
  const file = relative(RUANG, resolve(RUANG, arg[0] || ''))
  const studio = await mulaiStudio({ port: 0, diam: true })
  const r = await render(studio, { file, artboard: opsi('artboard'), format: opsi('format') || 'png', skala: Number(opsi('skala')) || 1 })
  studio.server.close()
  if (!r.ok) { console.error('Failed:', r.error); process.exit(2) }
  const dir = join(RUANG, 'preview'); mkdirSync(dir, { recursive: true })
  for (const x of r.hasil) {
    const ext = (opsi('format') || 'png'), p = join(dir, `${basename(file).replace(/\.kanvas\.json$/i, '')}-${x.id}.${ext}`)
    writeFileSync(p, ext === 'svg' ? x.data : Buffer.from(x.data.split(',')[1], 'base64')); console.log(p)
  }
  console.log(r.masalah.length ? `\nISSUES (${r.masalah.length}):\n  ✗ ` + r.masalah.join('\n  ✗ ') : '\nISSUES: none ✓')
  if (r.saran.length) console.log(`SUGGESTIONS (${r.saran.length}):\n  • ` + r.saran.join('\n  • '))
  process.exit(r.masalah.length ? 1 : 0)
} else if (!perintah || perintah === 'start') {
  const { url } = await mulaiStudio()
  if (!arg.includes('--no-open')) bukaDiOS(url)
  console.error('Open in your browser: ' + url + '   ·   Ctrl+C to stop')
} else {
  console.log('Usage: kanvas [start] | kanvas mcp | kanvas render <file> [--artboard id] [--format png|svg|pdf]')
}

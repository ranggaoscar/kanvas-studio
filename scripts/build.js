// Bangun app lokal: app/main.js (+ UI dari desktop/plugin.js) → app/dist/kanvas.js
import { build } from 'esbuild'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bangunIkon } from './ikon.js'
import { readdirSync } from 'node:fs'

const akar = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(akar, 'app/dist'), { recursive: true })
// salin mesin komponen (server/komponen.js) ke plugin.js, supaya kanvas & agent memakai logika yang sama
export function sisipKomponen(akar) { for (const [tanda, sumber] of [['komponen', 'server/komponen.js'], ['pena', 'server/pena.js']]) sisipModul(akar, tanda, sumber) }
function sisipModul(akar, tanda, sumber) {
  const p = join(akar, 'desktop/plugin.js'), plugin = readFileSync(p, 'utf8')
  const isi = readFileSync(join(akar, sumber), 'utf8').replace(/^export /gm, '').trim()
  const awal = plugin.indexOf(`/* <${tanda}>`), akhir = plugin.indexOf(`/* </${tanda}> */`)
  if (awal < 0 || akhir < 0) throw new Error(`penanda <${tanda}> tidak ada di plugin.js`)
  const kepala = plugin.slice(awal, plugin.indexOf('*/', awal) + 2)
  const baru = plugin.slice(0, awal) + kepala + '\n' + isi + '\n' + plugin.slice(akhir)
  if (baru !== plugin) writeFileSync(p, baru)
}
sisipKomponen(akar)
const BUILD = Date.now().toString(36)
writeFileSync(join(akar, 'app/dist/build.txt'), BUILD)
await build({
  entryPoints: [join(akar, 'app/main.js')],
  outfile: join(akar, 'app/dist/kanvas.js'),
  bundle: true, format: 'esm', target: 'es2022', minify: true, legalComments: 'none',
  alias: { '@hermes/plugin-sdk': join(akar, 'app/host.js') },
  define: { 'process.env.NODE_ENV': '"production"', __BUILD__: JSON.stringify(BUILD) }
})
// ikon tab = logo
const plugin = readFileSync(join(akar, 'desktop/plugin.js'), 'utf8')
const logo = plugin.match(/const LOGO_SVG = `([^`]+)`/)[1].replace('width="100%" height="100%"', 'width="64" height="64"')
writeFileSync(join(akar, 'app/dist/logo.svg'), logo)
// template bawaan (templates/*.kanvas.json, dibuat scripts/template.js) → satu berkas untuk galeri
const tpl = readdirSync(join(akar, 'templates')).filter(f => f.endsWith('.kanvas.json')).sort().map(f => JSON.parse(readFileSync(join(akar, 'templates', f), 'utf8')))
writeFileSync(join(akar, 'app/dist/template.json'), JSON.stringify(tpl))
console.log(`app/dist/kanvas.js siap · ${bangunIkon(akar)} ikon · ${tpl.length} template`)

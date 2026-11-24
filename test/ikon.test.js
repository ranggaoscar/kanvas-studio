// Setiap ikon hasil konversi harus tampak sama dengan SVG asli Lucide (dibandingkan per piksel di Chrome headless).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { cariBrowser } from '../server/render.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(AKAR, 'node_modules/lucide-static/icons')

test('2000+ ikon Lucide terkonversi sama persis dengan aslinya', { skip: !cariBrowser() || !existsSync(DIR), timeout: 300000 }, () => {
  const data = JSON.parse(readFileSync(join(AKAR, 'app/dist/ikon.json'), 'utf8'))
  const nama = Object.keys(data.ikon)
  assert.ok(nama.length > 2000, 'jumlah ikon ' + nama.length)
  const asli = Object.fromEntries(nama.filter(n => existsSync(join(DIR, n + '.svg'))).map(n => [n, readFileSync(join(DIR, n + '.svg'), 'utf8').replace(/<!--.*?-->/s, '')]))
  const tmp = mkdtempSync(join(tmpdir(), 'kanvas-ikon-'))
  try {
    const html = `<!doctype html><pre id="out"></pre><script>
const ASLI = ${JSON.stringify(asli).replace(/</g, '\\u003c')}, KITA = ${JSON.stringify(data.ikon).replace(/</g, '\\u003c')}, S = 48
const kanvas = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c.getContext('2d', { willReadFrequently: true }) }
const gambarAsli = async svg => { const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('currentColor', '#000').replace(/currentColor/g, '#000')); await im.decode(); const g = kanvas(); g.drawImage(im, 0, 0, S, S); return g.getImageData(0, 0, S, S).data }
const gambarKita = d => { const g = kanvas(); g.scale(S / 24, S / 24); g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#000'; g.stroke(new Path2D(d)); return g.getImageData(0, 0, S, S).data }
;(async () => {
  const beda = []
  for (const [n, svg] of Object.entries(ASLI)) {
    const a = await gambarAsli(svg), b = gambarKita(KITA[n]); let x = 0, tinta = 0
    for (let i = 3; i < a.length; i += 4) { if (a[i] > 40) tinta++; if (Math.abs(a[i] - b[i]) > 96) x++ }
    // toleransi 5%: tepi anti-alias, dan 13 ikon punya titik kecil ber-fill yang kita gambar sebagai garis (tampak sama)
    if (x > Math.max(6, tinta * 0.05)) beda.push(n + ':' + x + '/' + tinta)
  }
  document.getElementById('out').textContent = JSON.stringify({ total: Object.keys(ASLI).length, beda })
})()
</script>`
    writeFileSync(join(tmp, 'ikon.html'), html)
    const out = execFileSync(cariBrowser(), ['--headless=new', '--disable-gpu', '--virtual-time-budget=120000', `--user-data-dir=${join(tmp, 'p')}`, '--dump-dom', 'file:///' + join(tmp, 'ikon.html').replace(/\\/g, '/')],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240000 })
    const r = JSON.parse(out.match(/<pre id="out">([\s\S]*?)<\/pre>/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
    assert.ok(r.total > 2000)
    assert.deepEqual(r.beda, [], `${r.beda.length} ikon berbeda dari aslinya: ${r.beda.slice(0, 20).join(', ')}`)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

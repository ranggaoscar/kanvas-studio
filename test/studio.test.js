// Pengaman API lokal: Host localhost, Origin asing ditolak, header X-Kanvas wajib (memaksa preflight CORS),
// API hanya menyentuh ruang kerja, "buka folder" hanya ruang kerja, tidak ada API tulis ke folder bebas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request } from 'node:http'

import { envMinimal } from '../server/render.js'

process.env.KANVAS_HOME = mkdtempSync(join(tmpdir(), 'kanvas-studio-tes-'))
const { mulaiStudio, gambarLokal } = await import('../server/studio.js')

const minta = (url, { headers = {}, method = 'GET', body } = {}) => new Promise((ok, gagal) => {
  const r = request(url, { method, headers }, res => { let s = ''; res.on('data', d => s += d); res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body: s })) })
  r.on('error', gagal); if (body) r.write(body); r.end()
})

test('studio cukup dibuka lewat URL biasa; situs lain tidak bisa memakai API', async () => {
  const { server, url } = await mulaiStudio({ port: 0, diam: true })
  try {
    assert.equal((await minta(url + '/')).status, 200)                                         // tanpa token / login
    const H = { 'X-Kanvas': '1', 'Content-Type': 'application/json' }
    const api = (p, body) => minta(url + '/api/' + p, { headers: H, method: body ? 'POST' : 'GET', body: body && JSON.stringify(body) }).then(r => JSON.parse(r.body))
    const info = await api('info')
    assert.equal(info.ok, true); assert.ok(info.build)

    assert.equal((await minta(url + '/api/info')).status, 403)                                  // tanpa header khusus
    assert.equal((await minta(url + '/api/info', { headers: { ...H, Origin: 'https://evil.example' } })).status, 403)
    assert.equal((await minta(url + '/api/info', { headers: { ...H, Host: 'evil.example' } })).status, 403)   // DNS rebinding

    // hanya ruang kerja
    assert.equal((await api('read?path=' + encodeURIComponent('../x.txt'))).ok, false)
    assert.equal((await api('write', { path: 'C:/Windows/x.txt', text: 'x' })).ok, false)
    assert.equal((await minta(url + '/api/simpan-ke', { headers: H, method: 'POST', body: '{}' })).status, 404, 'tidak ada API tulis ke folder bebas')
    writeFileSync(join(process.env.KANVAS_HOME, 'catatan.txt'), 'x')
    assert.equal((await api('dataurl?path=catatan.txt')).ok, false, 'dataurl hanya untuk gambar')
  } finally { server.close() }
})

test('salinan desain hanya membawa file gambar, tanpa file tersembunyi', () => {
  const doc = { artboards: [{ elemen: [
    { tipe: 'gambar', src: 'gambar/a.png' }, { tipe: 'gambar', src: 'rahasia.txt' }, { tipe: 'gambar', src: '.env' },
    { tipe: 'gambar', src: '.git/x.png' }, { tipe: 'gambar', src: 'https://x/y.png' }, { tipe: 'gambar', src: 'gambar/a.png' }] }] }
  assert.deepEqual(gambarLokal(doc), ['gambar/a.png'])
  rmSync(process.env.KANVAS_HOME, { recursive: true, force: true })
  assert.ok(!existsSync(process.env.KANVAS_HOME))
})

test('envMinimal strips host tokens and keeps only minimal runtime vars', () => {
  const e = envMinimal({ PATH: '/usr/bin', HOME: '/home/u', GH_TOKEN: 'secret', GITHUB_TOKEN: 'secret', OPENAI_API_KEY: 'sk-test', HERMES_CUSTOM_KEY: 'x' })
  assert.equal(e.PATH, '/usr/bin'); assert.equal(e.HOME, '/home/u')
  assert.equal(e.GH_TOKEN, undefined); assert.equal(e.GITHUB_TOKEN, undefined); assert.equal(e.OPENAI_API_KEY, undefined); assert.equal(e.HERMES_CUSTOM_KEY, undefined)
})

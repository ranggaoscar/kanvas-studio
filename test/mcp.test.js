// Tes MCP lewat stdio, persis seperti agent sungguhan menyambung.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cariBrowser } from '../server/render.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')

function mcp() {
  const ruang = mkdtempSync(join(tmpdir(), 'kanvas-tes-'))
  const p = spawn(process.execPath, [join(AKAR, 'bin/kanvas.js'), 'mcp'], { env: { ...process.env, KANVAS_HOME: ruang, KANVAS_PORT: '0', KANVAS_NO_OPEN: '1' } })
  let buf = '', id = 0; const tunggu = new Map()
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); tunggu.get(m.id)?.(m); tunggu.delete(m.id) } })
  const minta = (method, params) => new Promise(ok => { const n = ++id; tunggu.set(n, ok); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n') })
  const alat = async (name, args) => (await minta('tools/call', { name, arguments: args })).result
  return { ruang, minta, alat, tutup: () => { p.kill(); rmSync(ruang, { recursive: true, force: true }) } }
}

test('MCP: handshake, daftar alat, buat → edit → lihat → ekspor', { timeout: 180000 }, async () => {
  const k = mcp()
  try {
    const init = await k.minta('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tes', version: '1' } })
    assert.equal(init.result.serverInfo.name, 'kanvas-studio')
    const daftar = (await k.minta('tools/list', {})).result.tools.map(t => t.name)
    for (const n of ['kanvas_guide', 'kanvas_status', 'kanvas_create', 'kanvas_read', 'kanvas_edit', 'kanvas_view', 'kanvas_export', 'kanvas_import_image', 'kanvas_open', 'kanvas_icons', 'kanvas_templates', 'kanvas_comments', 'kanvas_resolve_comment']) assert.ok(daftar.includes(n), n)

    const buat = await k.alat('kanvas_create', { judul: 'Poster Tes', ukuran: 'a4' })
    const file = buat.content[0].text.match(/Created: (\S+)/)[1]
    assert.equal(file, 'poster-tes.kanvas.json')

    const ed = await k.alat('kanvas_edit', { file, ops: [{ op: 'tambah', elemen: [
      { tipe: 'teks', x: 56, y: 400, w: 680, teks: 'Halo dunia', ukuran: 64, tebal: 800, warna: '#101634' },
      { tipe: 'path', x: 300, y: 120, w: 200, h: 200, vb: [10, 10], d: 'M5 0L10 10H0Z', fill: '#FF4D3D' }] }] })
    assert.ok(!ed.isError, ed.content[0].text)
    const gagal = await k.alat('kanvas_edit', { file, ops: [{ op: 'ubah', id: 'tidak-ada', set: {} }] })
    assert.equal(gagal.isError, true)

    const baca = await k.alat('kanvas_read', { file })
    assert.equal(JSON.parse(baca.content[0].text.split('\n').slice(1).join('\n')).artboards[0].elemen.length, 2)

    if (!cariBrowser()) return   // render butuh Chrome/Edge
    const lihat = await k.alat('kanvas_view', { file })
    assert.ok(!lihat.isError, lihat.content[0].text)
    assert.match(lihat.content[0].text, /ISSUES: none/)
    assert.ok(lihat.content.some(c => c.type === 'image' && c.data.length > 1000))

    // auto-layout: tanpa x/y untuk anggota; kalau tata letak gagal, teks bertumpuk → MASALAH "menabrak"
    const kartu = await k.alat('kanvas_edit', { file, ops: [{ op: 'tambah', elemen: [{ tipe: 'grup', x: 56, y: 640, w: 680, tinggi: 'peluk', fill: '#FFFFFF', radius: 24,
      tata: { arah: 'kolom', jarak: 16, padding: 32, rata: 'regang' }, anak: [
        { tipe: 'teks', teks: 'Satu', ukuran: 40, tebal: 800, warna: '#101634' },
        { tipe: 'teks', teks: 'Dua baris teks yang cukup panjang untuk membungkus ke baris berikutnya di dalam kartu', ukuran: 28, warna: '#101634' },
        { tipe: 'grup', lebar: 'peluk', tinggi: 'peluk', fill: '#101634', radius: 999, tata: { arah: 'baris', padding: [14, 28, 14, 28] },
          anak: [{ tipe: 'teks', teks: 'Tombol', w: 120, ukuran: 22, tebal: 700, warna: '#FFFFFF' }] }] }] }] })
    assert.ok(!kartu.isError, kartu.content[0].text)
    const lihat2 = await k.alat('kanvas_view', { file })
    assert.match(lihat2.content[0].text, /ISSUES: none/, lihat2.content[0].text)

    // ikon + Google Font bebas; font salah ketik → SARAN
    const cari = await k.alat('kanvas_icons', { cari: 'coffee' })
    assert.match(cari.content[0].text, /^coffee/)
    const ik = await k.alat('kanvas_edit', { file, ops: [{ op: 'tambah', elemen: [
      { tipe: 'ikon', ikon: 'coffee', x: 56, y: 120, w: 96, warna: '#FF4D3D' },
      { tipe: 'teks', x: 56, y: 240, w: 680, teks: 'Fraunces dari Google Fonts', font: 'Fraunces', ukuran: 40, tebal: 700, warna: '#101634' },
      { tipe: 'teks', x: 56, y: 320, w: 680, teks: 'Font salah ketik', font: 'Frauncez Pro Max', ukuran: 28, warna: '#101634' }] }] })
    assert.ok(!ik.isError, ik.content[0].text)
    assert.equal((await k.alat('kanvas_edit', { file, ops: [{ op: 'tambah', elemen: { tipe: 'ikon', ikon: 'kopi-tidak-ada' } }] })).isError, true)
    const lihat3 = await k.alat('kanvas_view', { file })
    assert.match(lihat3.content[0].text, /ISSUES: none/, lihat3.content[0].text)
    assert.match(lihat3.content[0].text, /Frauncez Pro Max.*was not found/)
    assert.doesNotMatch(lihat3.content[0].text, /"Fraunces" was not found/)

    // template: daftar → buat dari template → lihat (harus bersih)
    assert.match((await k.alat('kanvas_templates', {})).content[0].text, /pitch-deck/)
    const dariTpl = await k.alat('kanvas_create', { judul: 'Harga Kami', template: 'harga' })
    assert.ok(!dariTpl.isError, dariTpl.content[0].text)
    const fTpl = dariTpl.content[0].text.match(/Created: (\S+)/)[1]
    const lihatTpl = await k.alat('kanvas_view', { file: fTpl })
    assert.match(lihatTpl.content[0].text, /ISSUES: none/, lihatTpl.content[0].text)
    assert.equal((await k.alat('kanvas_create', { judul: 'x', template: 'tidak-ada' })).isError, true)

    // komentar dari user → agent membaca & menyelesaikan
    const { writeFileSync: tulis, readFileSync: bacaFs } = await import('node:fs')
    const pf = join(k.ruang, file), d = JSON.parse(bacaFs(pf, 'utf8')), target = d.artboards[0].elemen[0]
    d.komentar = [{ id: 'c1', artboard: 'a1', x: 100, y: 420, elemen: target.id, teks: 'Make this headline bigger', waktu: '2026-01-01', selesai: false }]
    tulis(pf, JSON.stringify(d))
    assert.match((await k.alat('kanvas_status', {})).content[0].text, /"komentarTerbuka": 0|komentarTerbuka/)
    const kom = await k.alat('kanvas_comments', { file })
    assert.match(kom.content[0].text, /c1 .* element .*Make this headline bigger/s)
    assert.ok(!(await k.alat('kanvas_resolve_comment', { file, id: 'c1', balasan: 'Headline is now 80 px' })).isError)
    assert.match((await k.alat('kanvas_comments', { file })).content[0].text, /no open comments/)
    assert.equal(JSON.parse(bacaFs(pf, 'utf8')).komentar[0].balasan, 'Headline is now 80 px')
    assert.equal((await k.alat('kanvas_resolve_comment', { file, id: 'tidak-ada', balasan: 'x' })).isError, true)
    assert.equal((await k.alat('kanvas_resolve_comment', { file, ids: [], balasan: 'x' })).isError, true)

    // dua kanvas_edit dikirim paralel tidak boleh saling menimpa
    const [p1, p2] = await Promise.all([
      k.alat('kanvas_edit', { file, ops: [{ op: 'tambah', elemen: { id: 'par1', tipe: 'kotak', x: 10, y: 10, w: 20, h: 20, fill: '#000' } }] }),
      k.alat('kanvas_edit', { file, ops: [{ op: 'tambah', elemen: { id: 'par2', tipe: 'kotak', x: 40, y: 10, w: 20, h: 20, fill: '#000' } }] })
    ])
    assert.ok(!p1.isError && !p2.isError)
    const idsPar = JSON.parse((await k.alat('kanvas_read', { file })).content[0].text.split('\n').slice(1).join('\n')).artboards[0].elemen.map(e => e.id)
    assert.ok(idsPar.includes('par1') && idsPar.includes('par2'), 'both parallel edits must persist')

    // dua artboard bernama sama tidak boleh saling menimpa saat ekspor
    const dupAb = await k.alat('kanvas_edit', { file, ops: [{ op: 'artboard', nama: 'Artboard 1', ukuran: 'a4' }] })
    assert.ok(!dupAb.isError)
    const out = join(k.ruang, 'ekspor')
    const eks = await k.alat('kanvas_export', { file, folder: out, format: 'png', skala: 1 })
    assert.ok(!eks.isError, eks.content[0].text)
    assert.equal(readdirSync(out).filter(f => f.endsWith('.png')).length, 2, 'duplicate artboard names must produce 2 PNGs')
    const pdf = await k.alat('kanvas_export', { file, folder: out, format: 'pdf' })
    assert.ok(existsSync(join(out, 'poster-tes.pdf')), pdf.content[0].text)
  } finally { k.tutup() }
})

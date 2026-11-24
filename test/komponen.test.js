// Komponen: master → salinan ikut berubah, timpaan bertahan, edit salinan = timpaan, lepas salinan;
// lewat operasi agent; dan plugin.js memakai mesin yang sama persis dengan server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sinkronKomponen, catatTimpaan, lepasInstance } from '../server/komponen.js'
import { terapkanOps, desainBaru, dataIkon } from '../server/ops.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')

test('sinkron: master berubah → salinan ikut, kecuali bagian yang ditimpa', () => {
  const doc = { artboards: [{ id: 'a', elemen: [
    { id: 'btn', tipe: 'grup', komponen: true, nama: 'Tombol', x: 0, y: 0, w: 200, h: 60, fill: '#000' },
    { id: 'lbl', tipe: 'teks', induk: 'btn', x: 10, y: 10, teks: 'Klik', warna: '#fff' },
    { id: 'i1', tipe: 'grup', salinan: 'btn', x: 500, y: 300 },
    { id: 'i2', tipe: 'grup', salinan: 'btn', x: 500, y: 400, timpa: { lbl: { teks: 'Beli' } } }] }] }
  sinkronKomponen(doc)
  const el = id => doc.artboards[0].elemen.find(e => e.id === id)
  assert.equal(el('i1.lbl').teks, 'Klik'); assert.equal(el('i2.lbl').teks, 'Beli'); assert.equal(el('i1.lbl').x, 510)
  el('lbl').warna = '#f00'; el('lbl').teks = 'Pesan'; el('btn').fill = '#00f'; sinkronKomponen(doc)
  assert.equal(el('i1.lbl').teks, 'Pesan'); assert.equal(el('i1').fill, '#00f'); assert.equal(el('i2.lbl').teks, 'Beli'); assert.equal(el('i2.lbl').warna, '#f00')
  const sebelum = JSON.parse(JSON.stringify(doc)); el('i1.lbl').teks = 'Daftar'; catatTimpaan(doc, sebelum); sinkronKomponen(doc)
  assert.deepEqual(el('i1').timpa, { lbl: { teks: 'Daftar' } })
  el('lbl').teks = 'Lagi'; sinkronKomponen(doc); assert.equal(el('i1.lbl').teks, 'Daftar')
  let n = 0; lepasInstance(doc, 'i1', () => 'x' + n++)
  assert.equal(el('i1').salinan, undefined); assert.equal(el('x0').teks, 'Daftar'); assert.equal(el('x0').induk, 'i1')
  // master dihapus → salinan jadi grup biasa
  doc.artboards[0].elemen = doc.artboards[0].elemen.filter(e => e.id !== 'btn' && e.induk !== 'btn'); sinkronKomponen(doc)
  assert.equal(el('i2').salinan, undefined)
})

test('operasi agent: jadikan_komponen, salinan dengan timpaan per nama bagian, ganti ikon', () => {
  let { doc } = terapkanOps(desainBaru({ judul: 'x' }), [
    { op: 'tambah', elemen: { id: 'kartu', tipe: 'grup', nama: 'Kartu', x: 0, y: 0, w: 400, tata: { arah: 'kolom' }, anak: [
      { tipe: 'ikon', ikon: 'zap', nama: 'Ikon', w: 40 }, { tipe: 'teks', nama: 'Judul', teks: 'A' }] } },
    { op: 'make_component', id: 'kartu' },
    { op: 'tambah', elemen: [{ tipe: 'salinan', dari: 'Kartu', id: 's1', x: 500, y: 0, timpa: { Judul: { teks: 'B' }, Ikon: { ikon: 'rocket' } } }] }])
  const els = () => doc.artboards[0].elemen, cari = f => els().find(f)
  assert.equal(cari(e => e.induk === 's1' && e.nama === 'Judul').teks, 'B')
  assert.equal(cari(e => e.induk === 's1' && e.nama === 'Ikon').d, dataIkon().ikon.rocket)
  const judulMaster = cari(e => e.induk === 'kartu' && e.nama === 'Judul').id
  ;({ doc } = terapkanOps(doc, [{ op: 'ubah', id: judulMaster, set: { warna: '#f00' } }, { op: 'ubah', id: 's1.' + judulMaster, set: { ukuran: 50 } }]))
  const s1j = cari(e => e.id === 's1.' + judulMaster)
  assert.equal(s1j.warna, '#f00'); assert.equal(s1j.teks, 'B'); assert.equal(s1j.ukuran, 50)
  assert.throws(() => terapkanOps(doc, [{ op: 'tambah', elemen: { tipe: 'salinan', dari: 'Tidak Ada' } }]), /component "Tidak Ada" does not exist/)
  assert.throws(() => terapkanOps(doc, [{ op: 'tambah', elemen: { tipe: 'salinan', dari: 'Kartu', timpa: { Harga: {} } } }]), /part "Harga" is not in component/)
  ;({ doc } = terapkanOps(doc, [{ op: 'detach', id: 's1' }]))
  assert.equal(cari(e => e.id === 's1').salinan, undefined)
})

test('plugin.js memakai mesin komponen yang sama dengan server (hasil build)', () => {
  const plugin = readFileSync(join(AKAR, 'desktop/plugin.js'), 'utf8'), src = readFileSync(join(AKAR, 'server/komponen.js'), 'utf8').replace(/^export /gm, '').trim()
  assert.ok(plugin.includes(src), 'jalankan npm run build supaya plugin.js tersinkron')
})

test('template bawaan valid dan bisa dipakai', () => {
  const tpl = JSON.parse(readFileSync(join(AKAR, 'app/dist/template.json'), 'utf8'))
  assert.ok(tpl.length >= 6)
  for (const t of tpl) {
    assert.ok(t.meta?.id && t.meta.nama && t.meta.deskripsi, 'meta lengkap')
    const { doc } = terapkanOps(t, [{ op: 'judul', judul: 'coba' }])   // bisa diedit tanpa error
    assert.equal(doc.artboards.length, t.artboards.length)
  }
  assert.ok(tpl.some(t => t.artboards.some(ab => ab.elemen.some(e => e.salinan))), 'ada template yang memakai komponen')
})

test('pena: titik → path (garis & kurva), skala ulang, dan lewat operasi agent', async () => {
  const { dariTitik, bidangDariTitik, titikKeAb } = await import('../server/pena.js')
  assert.equal(dariTitik([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], true), 'M0 0L100 0L100 100L0 0Z')
  assert.equal(dariTitik([{ x: 0, y: 50, ox: 40, oy: 0 }, { x: 100, y: 50, ix: 60, iy: 100 }]), 'M0 50C40 0 60 100 100 50')
  const b = bidangDariTitik([{ x: 200, y: 300 }, { x: 300, y: 250, ix: 260, iy: 250, ox: 340, oy: 250 }, { x: 400, y: 300 }])
  assert.deepEqual([b.x, b.y, b.w, b.h], [200, 250, 200, 50])
  assert.deepEqual(titikKeAb({ ...b, w: 400 })[2], { x: 600, y: 300 })   // elemen dilebarkan 2× → titik ikut
  const { doc } = terapkanOps(desainBaru({ judul: 'x' }), [{ op: 'tambah', elemen: { tipe: 'path', titik: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 60, y: 90 }], tutup: true, fill: '#f00' } }])
  const el = doc.artboards[0].elemen[0]
  assert.equal(el.d, 'M0 0L100 0L50 80L0 0Z'); assert.deepEqual([el.x, el.y, el.w, el.h], [10, 10, 100, 80])
  assert.throws(() => terapkanOps(desainBaru({ judul: 'x' }), [{ op: 'tambah', elemen: { tipe: 'path', titik: [{ x: 1, y: 1 }] } }]), /at least 2 points/)
  const plugin = readFileSync(join(AKAR, 'desktop/plugin.js'), 'utf8')
  assert.ok(plugin.includes(readFileSync(join(AKAR, 'server/pena.js'), 'utf8').replace(/^export /gm, '').trim()), 'plugin.js tersinkron dengan server/pena.js')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { terapkanOps, desainBaru } from '../server/ops.js'

test('desain baru dari preset', () => {
  const d = desainBaru({ judul: 'X', ukuran: 'a4' })
  assert.equal(d.artboards[0].w, 794); assert.equal(d.artboards[0].h, 1123)
  assert.throws(() => desainBaru({ ukuran: 'tidak-ada' }), /unknown/)
})

test('tambah, ubah, urut, hapus elemen', () => {
  let { doc, hasil } = terapkanOps(desainBaru({ judul: 'X' }), [
    { op: 'tambah', elemen: [{ tipe: 'kotak', w: 100, h: 50, fill: '#000' }, { id: 'judul', tipe: 'teks', teks: 'Halo', ukuran: 80 }] },
    { op: 'path' === 'x' ? 'x' : 'add', elemen: { tipe: 'path', d: 'M0 0L10 10', garis: { tebal: 2 } } }
  ])
  const ab = doc.artboards[0]
  assert.equal(ab.elemen.length, 3); assert.equal(ab.elemen[1].id, 'judul'); assert.ok(hasil.length === 2)
  ;({ doc } = terapkanOps(doc, [{ op: 'ubah', id: 'judul', set: { warna: '#fff', ukuran: null } }, { op: 'urut', id: 'judul', ke: 'belakang' }]))
  assert.equal(doc.artboards[0].elemen[0].id, 'judul'); assert.equal(doc.artboards[0].elemen[0].ukuran, undefined)
  ;({ doc } = terapkanOps(doc, [{ op: 'hapus', id: 'judul' }]))
  assert.equal(doc.artboards[0].elemen.length, 2)
})

test('atomik: satu op gagal → tidak ada perubahan', () => {
  const awal = desainBaru({ judul: 'X' })
  assert.throws(() => terapkanOps(awal, [{ op: 'tambah', elemen: { tipe: 'kotak' } }, { op: 'ubah', id: 'tidak-ada', set: {} }]), /ops\[1\].*does not exist/)
  assert.equal(awal.artboards[0].elemen.length, 0)
})

test('validasi: tipe salah, path tanpa d, angka bukan angka', () => {
  const d = desainBaru({ judul: 'X' })
  assert.throws(() => terapkanOps(d, [{ op: 'tambah', elemen: { tipe: 'segitiga' } }]), /unknown/)
  assert.throws(() => terapkanOps(d, [{ op: 'tambah', elemen: { tipe: 'path' } }]), /needs "d" or "titik"/)
  assert.throws(() => terapkanOps(d, [{ op: 'tambah', elemen: { tipe: 'kotak', x: 'kiri' } }]), /must be a number/)
  const { doc: dIkon } = terapkanOps(d, [{ op: 'tambah', elemen: { id: 'ic1', tipe: 'ikon', ikon: 'coffee' } }])
  assert.throws(() => terapkanOps(dIkon, [{ op: 'ubah', id: 'ic1', set: { ikon: 'tidak-ada-xyz' } }]), /icon "tidak-ada-xyz" does not exist/)
})

test('artboard baru diletakkan di kanan artboard terakhir', () => {
  const { doc } = terapkanOps(desainBaru({ judul: 'X' }), [{ op: 'add_artboard', nama: 'Dua', elemen: [{ tipe: 'teks', teks: 'a' }] }])
  assert.equal(doc.artboards[1].x, 1920 + 160); assert.equal(doc.artboards[1].elemen.length, 1)
})

test('grup bersarang ("anak") jadi daftar datar ber-induk, urutan grup → keturunan', () => {
  const { doc, hasil } = terapkanOps(desainBaru({ judul: 'X' }), [
    { op: 'tambah', elemen: [{ tipe: 'kotak', id: 'latar' }, { id: 'kartu', tipe: 'grup', x: 100, y: 100, w: 400, tinggi: 'peluk', tata: { arah: 'kolom', jarak: 16, padding: 24 },
      anak: [{ tipe: 'teks', teks: 'Judul' }, { id: 'tombol', tipe: 'grup', lebar: 'peluk', tata: { arah: 'baris' }, anak: [{ id: 'label', tipe: 'teks', teks: 'OK' }] }] }] }])
  const els = doc.artboards[0].elemen
  assert.deepEqual(els.map(e => e.id).slice(0, 2), ['latar', 'kartu'])
  assert.equal(els.find(e => e.id === 'tombol').induk, 'kartu'); assert.equal(els.find(e => e.id === 'label').induk, 'tombol')
  assert.ok(els.indexOf(els.find(e => e.id === 'label')) > els.indexOf(els.find(e => e.id === 'tombol')))
  assert.match(hasil[0], /label \(teks ⊂ tombol\)/)
  // hapus grup = hapus seluruh isinya
  const { doc: d2 } = terapkanOps(doc, [{ op: 'hapus', id: 'kartu' }])
  assert.deepEqual(d2.artboards[0].elemen.map(e => e.id), ['latar'])
})

test('tambah ke grup, grupkan, lepas grup, validasi tata', () => {
  let { doc } = terapkanOps(desainBaru({ judul: 'X' }), [{ op: 'tambah', elemen: [{ id: 'a', tipe: 'kotak', x: 10, y: 10, w: 50, h: 50 }, { id: 'b', tipe: 'kotak', x: 100, y: 40, w: 50, h: 50 }] }])
  ;({ doc } = terapkanOps(doc, [{ op: 'group', id: 'g', ids: ['a', 'b'], set: { tata: { arah: 'baris', jarak: 8 } } }]))
  const g = doc.artboards[0].elemen.find(e => e.id === 'g')
  assert.deepEqual([g.x, g.y, g.w, g.h], [10, 10, 140, 80]); assert.equal(doc.artboards[0].elemen[0].id, 'g')
  ;({ doc } = terapkanOps(doc, [{ op: 'tambah', ke_grup: 'g', elemen: { id: 'c', tipe: 'elips' } }]))
  assert.equal(doc.artboards[0].elemen.find(e => e.id === 'c').induk, 'g')
  ;({ doc } = terapkanOps(doc, [{ op: 'ungroup', id: 'g' }]))
  assert.ok(doc.artboards[0].elemen.every(e => !e.induk)); assert.ok(!doc.artboards[0].elemen.some(e => e.id === 'g'))
  assert.throws(() => terapkanOps(doc, [{ op: 'tambah', elemen: { tipe: 'grup', tata: { arah: 'diagonal' } } }]), /baris \(horizontal\) \| kolom/)
  assert.throws(() => terapkanOps(doc, [{ op: 'tambah', elemen: { tipe: 'kotak', anak: [] } }]), /only a grup/)
  assert.throws(() => terapkanOps(doc, [{ op: 'tambah', ke_grup: 'a', elemen: { tipe: 'kotak' } }]), /group a does not exist/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heal } from '../server/heal.js'

const fixture = () => ({ artboards: [{ id: 'a1', w: 400, h: 300, elemen: [
  { tipe: 'teks', x: -4, y: -3, w: 100, teks: 'A\nB', ukuran: 20, lh: 0.7 },
  { id: 'heal-1-1', tipe: 'teks', x: 50, y: 45, w: 100, teks: 'Safe', lh: 0.7 },
  { id: 'stack', tipe: 'grup', x: 30, y: 70, w: 150, tinggi: 'peluk', tata: { arah: 'kolom', padding: 10, jarak: 5 } },
  { id: 'loose', tipe: 'teks', induk: 'stack', x: 40, y: 80, w: 100, ukuran: 20, lh: 2.5, teks: 'C\nD' },
  { id: 'next', tipe: 'teks', induk: 'stack', x: 40, y: 185, w: 100, ukuran: 20, teks: 'Next' },
  { id: 'bleed', tipe: 'kotak', x: -7, y: 0, w: 200, h: 25 },
  { id: 'rotated', tipe: 'teks', x: -4, y: 5, w: 100, rotasi: 30, teks: 'Tilt' },
  { id: 'major', tipe: 'teks', x: -60, y: -3, w: 100, teks: 'Major' },
  { id: 'wide', tipe: 'teks', x: -2, y: 5, w: 480, teks: 'Too wide' },
  { id: 'nowrap', tipe: 'teks', x: 0, y: 5, w: 20, teks: 'OneVeryLongWord' }
] }] })

test('heal backfills unique IDs, clamps safe text, and reflows only impacted tata groups', () => {
  const a = fixture(), b = fixture(), normal = structuredClone(a.artboards[0].elemen)
  const changes = heal(a)
  assert.deepEqual(changes, heal(b))
  assert.deepEqual(a, b)
  const el = a.artboards[0].elemen
  assert.notEqual(el[0].id, 'heal-1-1')
  assert.ok(el[0].id)
  assert.deepEqual([el[0].x, el[0].y, el[0].lh, el[0].teks], [0, 0, 1.15, 'A\nB'])
  assert.equal(el[3].lh, 1.6)
  assert.equal(el[4].y, 149)
  assert.deepEqual(el[1], normal[1])
  assert.deepEqual(el.slice(5), normal.slice(5))
  assert.deepEqual(heal(a), [])
})

test('a later op can target a generated instance child in the same batch', async () => {
  const { terapkanOps, desainBaru } = await import('../server/ops.js')
  const { doc } = terapkanOps(desainBaru({}), [
    { op: 'tambah', elemen: { id: 'master', tipe: 'grup', anak: [{ id: 'label', tipe: 'teks', teks: 'Master' }] } },
    { op: 'jadikan_komponen', id: 'master' },
    { op: 'tambah', elemen: { id: 'card', tipe: 'salinan', dari: 'master' } },
    { op: 'ubah', id: 'card.label', set: { teks: 'Override' } },
    { op: 'tambah', elemen: { id: 'rect', tipe: 'kotak' } }
  ])
  const elements = doc.artboards[0].elemen
  assert.equal(elements.find(e => e.id === 'card.label').teks, 'Override')
  assert.equal(elements.find(e => e.id === 'card').timpa.label.teks, 'Override')
})

test('deleting a master after adding an instance preserves the detached copy', async () => {
  const { terapkanOps, desainBaru } = await import('../server/ops.js')
  const { doc } = terapkanOps(desainBaru({}), [
    { op: 'tambah', elemen: { id: 'master', tipe: 'grup', anak: [{ id: 'label', tipe: 'teks', teks: 'Keep' }] } },
    { op: 'jadikan_komponen', id: 'master' },
    { op: 'tambah', elemen: { id: 'card', tipe: 'salinan', dari: 'master' } },
    { op: 'hapus', id: 'master' }
  ])
  assert.equal(doc.artboards[0].elemen.find(e => e.id === 'card').salinan, undefined)
  assert.equal(doc.artboards[0].elemen.find(e => e.id === 'card.label').teks, 'Keep')
})

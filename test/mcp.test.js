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
    for (const n of ['kanvas_guide', 'kanvas_art_direction', 'kanvas_brand', 'kanvas_status', 'kanvas_create', 'kanvas_read', 'kanvas_edit', 'kanvas_resize', 'kanvas_campaign', 'kanvas_dataviz', 'kanvas_presentation', 'kanvas_to_code', 'kanvas_assets', 'kanvas_community', 'kanvas_view', 'kanvas_export', 'kanvas_import_image', 'kanvas_open', 'kanvas_icons', 'kanvas_templates', 'kanvas_comments', 'kanvas_resolve_comment']) assert.ok(daftar.includes(n), n)

    // P0: Brand Kit + Design Intelligence (kanvas_brand + kanvas_art_direction)
    const saveBr = await k.alat('kanvas_brand', {
      action: 'save', name: 'Nord Studio', tagline: 'Editorial objects',
      colors: { primary: '#E03E2D', background: '#F4F1EA', surface: '#EAE5DA', text: '#111111', accent: '#E03E2D' },
      fonts: { display: 'Syne', body: 'Inter', mono: 'IBM Plex Mono' },
      style: { direction: 'swiss-editorial', guidelines: ['Sharp 1px rules'] }
    })
    assert.ok(!saveBr.isError, saveBr.content[0].text)
    const { writeFileSync: tulisLogo } = await import('node:fs')
    const logoTmp = join(k.ruang, 'nord-mark.svg')
    tulisLogo(logoTmp, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#111111"/><circle cx="32" cy="32" r="16" fill="#E03E2D"/></svg>')
    const impLogo = await k.alat('kanvas_brand', { action: 'import_asset', id: 'nord-studio', path: logoTmp, kind: 'logo', name: 'Mark', variant: 'primary' })
    assert.ok(!impLogo.isError, impLogo.content[0].text)
    assert.match(impLogo.content[0].text, /brands\/nord-studio\/logo-mark\.svg/)
    const adBrief = await k.alat('kanvas_art_direction', { brief: 'Architecture exhibition poster', ukuran: 'a4', brand: 'nord-studio' })
    assert.ok(!adBrief.isError, adBrief.content[0].text)
    assert.match(adBrief.content[0].text, /Swiss Editorial/)
    assert.match(adBrief.content[0].text, /Nord Studio/)
    assert.match(adBrief.content[0].text, /brands\/nord-studio\/logo-mark\.svg/)
    const statusWithBrand = JSON.parse((await k.alat('kanvas_status', {})).content[0].text)
    assert.equal(statusWithBrand.defaultBrand, 'nord-studio')
    assert.equal(statusWithBrand.brands.length, 1)

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
    assert.match(lihat.content[0].text, /QA SCORE: \d+\/100/)
    assert.match(lihat.content[0].text, /ISSUES: none/)
    assert.ok(lihat.content.some(c => c.type === 'image' && c.data.length > 1000))

    // Brand Kit attached design + logo asset render & portable export
    const brDoc = await k.alat('kanvas_create', { judul: 'Nord Poster', ukuran: 'a4', brand: 'nord-studio' })
    assert.ok(!brDoc.isError, brDoc.content[0].text)
    const brFile = brDoc.content[0].text.match(/Created: (\S+)/)[1]
    const brEd = await k.alat('kanvas_edit', { file: brFile, ops: [{ op: 'tambah', elemen: [
      { tipe: 'gambar', x: 56, y: 56, w: 72, h: 72, src: 'brands/nord-studio/logo-mark.svg', fit: 'contain' },
      { tipe: 'teks', x: 56, y: 180, w: 680, teks: 'FORM & SIGNAL', font: 'Syne', ukuran: 72, tebal: 800, warna: '#111111' }
    ] }] })
    assert.ok(!brEd.isError, brEd.content[0].text)
    const brView = await k.alat('kanvas_view', { file: brFile })
    assert.match(brView.content[0].text, /ISSUES: none/, brView.content[0].text)
    const brOut = join(k.ruang, 'ekspor-brand')
    const brExp = await k.alat('kanvas_export', { file: brFile, folder: brOut, format: 'kanvas' })
    assert.ok(!brExp.isError, brExp.content[0].text)
    assert.ok(existsSync(join(brOut, 'brands/nord-studio/logo-mark.svg')), 'kanvas export must bundle Brand Kit logo')

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

    // P1 & P2 end-to-end MCP: campaign, smart resize, presentation + dataviz + pptx export, to_code, assets, community
    const camp = await k.alat('kanvas_campaign', {
      judul: 'Nord Autumn Campaign', headline: 'FORM FOLLOWS SIGNAL', subhead: 'Limited modular editions.', cta: 'Explore',
      points: ['Swiss precision', '100% local', 'Open source'], formats: ['ig-feed', 'banner-web'], brand: 'nord-studio'
    })
    assert.ok(!camp.isError, camp.content[0].text)
    const campFile = camp.content[0].text.match(/Created campaign pack: (\S+)/)[1]
    const campView = await k.alat('kanvas_view', { file: campFile })
    assert.match(campView.content[0].text, /ISSUES: none/, campView.content[0].text)

    const rsz = await k.alat('kanvas_resize', { file: campFile, artboard: 'a2', ukuran: 'ig-square', mode: 'copy' })
    assert.ok(!rsz.isError, rsz.content[0].text)

    const pres = await k.alat('kanvas_presentation', {
      judul: 'Nord Deck', style: 'swiss-editorial', brand: 'nord-studio',
      slides: [
        { type: 'cover', eyebrow: 'OVERVIEW', heading: 'Nord Systems', body: 'Annual visual report', notes: 'Intro speaker note' },
        { type: 'chart', heading: 'Quarterly Growth', chart: { type: 'bar', data: [{ label: 'Q1', value: 10 }, { label: 'Q2', value: 25 }, { label: 'Q3', value: 42 }], unit: 'k' } }
      ]
    })
    assert.ok(!pres.isError, pres.content[0].text)
    const presFile = pres.content[0].text.match(/Created presentation: (\S+)/)[1]
    const dv = await k.alat('kanvas_dataviz', { file: presFile, artboard: 'a1', type: 'donut', x: 1120, y: 360, w: 660, h: 360, data: [{ label: 'A', value: 60 }, { label: 'B', value: 40 }], unit: '%' })
    assert.ok(!dv.isError, dv.content[0].text)
    const presView = await k.alat('kanvas_view', { file: presFile })
    assert.match(presView.content[0].text, /ISSUES: none/, presView.content[0].text)
    const pptxExp = await k.alat('kanvas_export', { file: presFile, folder: out, format: 'pptx' })
    assert.ok(!pptxExp.isError, pptxExp.content[0].text)
    assert.ok(existsSync(join(out, 'nord-deck.pptx')), 'editable PPTX must be written')

    const codeDir = join(k.ruang, 'code-out')
    const codeRes = await k.alat('kanvas_to_code', { file: campFile, artboard: 'a1', target: 'react', componentName: 'NordFeed', folder: codeDir })
    assert.ok(!codeRes.isError, codeRes.content[0].text)
    assert.ok(existsSync(join(codeDir, 'NordFeed.jsx')) && existsSync(join(codeDir, 'NordFeed.css')))

    const asSave = await k.alat('kanvas_assets', { action: 'save_svg', name: 'Nord Star', d: 'M12 2L15 10H23L17 15L19 23L12 18L5 23L7 15L1 10H9Z', vb: [24, 24], fill: '#E03E2D', tags: ['brand'] })
    assert.ok(!asSave.isError, asSave.content[0].text)
    assert.match((await k.alat('kanvas_assets', { action: 'list', tag: 'brand' })).content[0].text, /nord-star/)

    const cDir = await k.alat('kanvas_community', {
      action: 'save_direction', id: 'bauhaus-lab', name: 'Bauhaus Lab', summary: 'Primary geometric balance.',
      keywords: ['bauhaus'], fontPairings: [{ display: 'Syne', body: 'Inter' }], palettes: [{ name: 'Primary', bg: '#F7F5EE', surface: '#ECE8DB', text: '#111111', muted: '#555555', accent: '#E03E2D' }]
    })
    assert.ok(!cDir.isError, cDir.content[0].text)
    const adComm = await k.alat('kanvas_art_direction', { brief: 'Bauhaus poster', ukuran: 'a4', brand: 'none' })
    assert.match(adComm.content[0].text, /Bauhaus Lab/)
    const cTpl = await k.alat('kanvas_community', { action: 'save_template', file: campFile, id: 'nord-pack', name: 'Nord Pack', description: 'Community pack' })
    assert.ok(!cTpl.isError, cTpl.content[0].text)
    assert.match((await k.alat('kanvas_templates', {})).content[0].text, /nord-pack \[community\]/)
  } finally { k.tutup() }
})

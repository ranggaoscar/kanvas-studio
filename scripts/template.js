// Template bawaan, dibangun dengan operasi yang sama dengan agent (auto-layout + komponen) → templates/*.kanvas.json
// Jalankan: node scripts/template.js  (build menyatukannya ke app/dist/template.json)
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { terapkanOps, desainBaru } from '../server/ops.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const N = '#101634', K = '#FF4D3D', KG = '#C2341F', KR = '#F7F4EE', AB = '#4B5274'   // KG = coral gelap untuk teks di latar terang (kontras ≥ 4.5)
const JUDUL = 'Space Grotesk', TEKS = 'DM Sans'
const t = (teks, o = {}) => ({ tipe: 'teks', teks, font: TEKS, ukuran: 28, warna: N, lh: 1.45, ...o })
const judul = (teks, o = {}) => t(teks, { font: JUDUL, ukuran: 72, tebal: 700, lh: 1.05, spasi: -2, ...o })
const label = (teks, o = {}) => t(teks, { ukuran: 22, tebal: 700, kapital: true, spasi: 3, lh: 1.2, warna: KG, ...o })
const kolom = (anak, o = {}) => ({ tipe: 'grup', tata: { arah: 'kolom', jarak: 24, ...(o.tata || {}) }, ...o, anak, ...(o.tata ? { tata: { arah: 'kolom', jarak: 24, ...o.tata } } : {}) })
const baris = (anak, o = {}) => ({ tipe: 'grup', ...o, tata: { arah: 'baris', jarak: 24, ...(o.tata || {}) }, anak })
const pil = (teks, o = {}) => baris([t(teks, { ukuran: 20, tebal: 700, kapital: true, spasi: 3, lh: 1.2, warna: o.warnaTeks || '#FFFFFF' })],
  { lebar: 'peluk', tinggi: 'peluk', fill: o.fill || K, radius: 999, tata: { padding: [12, 22, 12, 22], rata: 'tengah' } })
const tombol = (teks, o = {}) => baris([t(teks, { ukuran: o.ukuran || 28, tebal: 700, lh: 1.2, warna: o.warnaTeks || '#FFFFFF' })],
  { nama: o.nama || 'Button', lebar: 'peluk', tinggi: 'peluk', fill: o.fill || N, radius: 999, tata: { padding: o.padding || [24, 44, 24, 44], rata: 'tengah' } })

function bangun(meta, awal, langkah) {
  let doc = desainBaru(awal)
  for (const ops of langkah) doc = terapkanOps(doc, ops).doc
  doc.judul = meta.nama
  doc.meta = meta
  return doc
}

const TEMPLATE = []

// 1. Pitch deck startup — 5 slide, komponen "Kartu Fitur" & "Angka"
TEMPLATE.push(bangun(
  { id: 'pitch-deck', nama: 'Startup pitch deck', kategori: 'Presentation', deskripsi: '5 slides, 16:9: cover, problem, solution (feature card component), traction (stat component), closing.' },
  { judul: 'Pitch deck', ukuran: 'slide', nama: 'Cover', bg: { warna: ['#161C42', '#0B0E24'], sudut: 150 } },
  [
    [{ op: 'tambah', artboard: 'a1', elemen: [
      { tipe: 'elips', x: 1240, y: -320, w: 1000, h: 1000, fill: K, opacity: 0.14 },
      { tipe: 'elips', x: 1500, y: 640, w: 520, h: 520, fill: '#7B61FF', opacity: 0.18 },
      kolom([
        pil('Pitch deck 2026', { fill: '#2A2F5C', warnaTeks: '#FFB59E' }),
        judul('Startup Name\nmakes teamwork\nfeel light.', { ukuran: 112, warna: '#FFFFFF', spasi: -3, lh: 1.02 }),
        t('One sentence on what you build and for whom: clear, specific, no jargon.', { ukuran: 34, warna: '#C9CCE8' })
      ], { x: 140, y: 230, w: 1180, tata: { jarak: 36 } }),
      t('Founder Name, Series A, founder@startup.com', { x: 140, y: 940, w: 1200, ukuran: 24, warna: '#9DA2C8' })
    ] }],
    [{ op: 'artboard', nama: 'Problem', ukuran: 'slide', bg: KR, elemen: [
      kolom([label('Problem'), judul('Small teams lose 6 hours a week to work that could run itself.', { ukuran: 62 }),
        t('Three different tools, scattered data, and a report rebuilt by hand every Friday.', { ukuran: 32, warna: AB })],
        { x: 140, y: 200, w: 820, tata: { jarak: 32 } }),
      kolom([t('6 hours', { font: JUDUL, ukuran: 200, tebal: 700, warna: '#FF8A6B', lh: 1, spasi: -6 }), t('lost every week, per person', { ukuran: 36, warna: '#FFFFFF' }),
        t('Source: survey of 120 teams, 2026', { ukuran: 22, warna: '#9DA2C8' })],
        { x: 1080, y: 200, w: 700, h: 680, fill: N, radius: 40, tata: { padding: 72, jarak: 20, sebar: 'akhir' } })
    ] }],
    [{ op: 'artboard', nama: 'Solution', ukuran: 'slide', bg: '#FFFFFF', elemen: [
      kolom([label('Solution'), judul('One place for all your routine work.')], { x: 140, y: 190, w: 1400, tata: { jarak: 20 } }),
      baris([
        kolom([baris([{ tipe: 'ikon', ikon: 'zap', nama: 'Icon', w: 44, warna: K }], { nama: 'Badge', lebar: 'peluk', tinggi: 'peluk', fill: '#FFE6DF', radius: 20, tata: { padding: 18 } }),
          judul('Automatic', { nama: 'Title', ukuran: 46 }), t('Reports, reminders and recaps that put themselves together every day.', { nama: 'Body', ukuran: 29, warna: AB })],
          { id: 'kartu-fitur', nama: 'Feature Card', lebar: 'isi', fill: KR, radius: 36, tata: { padding: 56, jarak: 24 } })
      ], { id: 'deret-fitur', x: 140, y: 440, w: 1640, tata: { jarak: 40, rata: 'regang' } })
    ] }, { op: 'jadikan_komponen', id: 'kartu-fitur' },
    { op: 'tambah', ke_grup: 'deret-fitur', elemen: [
      { tipe: 'salinan', dari: 'Feature Card', timpa: { Icon: { ikon: 'link' }, Title: { teks: 'Connected' }, Body: { teks: 'One click to the tools your team already uses: email, chat and calendar.' } } },
      { tipe: 'salinan', dari: 'Feature Card', timpa: { Icon: { ikon: 'shield-check' }, Title: { teks: 'Secure' }, Body: { teks: 'Your data stays yours, with access rights per person.' } } }] }],
    [{ op: 'artboard', nama: 'Traction', ukuran: 'slide', bg: { warna: ['#161C42', '#0B0E24'], sudut: 150 }, elemen: [
      kolom([label('Traction', { warna: '#FF8A6B' }), judul('Growing without paid ads.', { warna: '#FFFFFF' })], { x: 140, y: 190, w: 1400, tata: { jarak: 20 } }),
      baris([
        kolom([t('1,200', { nama: 'Number', font: JUDUL, ukuran: 120, tebal: 700, warna: '#FF8A6B', lh: 1, spasi: -4 }), t('weekly active teams', { nama: 'Label', ukuran: 30, warna: '#FFFFFF' })],
          { id: 'stat', nama: 'Stat', lebar: 'isi', fill: '#1E2450', radius: 32, tata: { padding: 56, jarak: 12 } })
      ], { id: 'deret-stat', x: 140, y: 440, w: 1640, tata: { jarak: 40, rata: 'regang' } })
    ] }, { op: 'jadikan_komponen', id: 'stat' },
    { op: 'tambah', ke_grup: 'deret-stat', elemen: [
      { tipe: 'salinan', dari: 'Stat', timpa: { Number: { teks: '38%' }, Label: { teks: 'monthly growth' } } },
      { tipe: 'salinan', dari: 'Stat', timpa: { Number: { teks: '4.8/5' }, Label: { teks: 'user satisfaction' } } }] }],
    [{ op: 'artboard', nama: 'Closing', ukuran: 'slide', bg: { warna: [K, '#FFA23C'], sudut: 135 }, elemen: [
      { tipe: 'elips', x: -260, y: 620, w: 760, h: 760, fill: '#FFFFFF', opacity: 0.12 },
      kolom([judul('Let’s build this together.', { ukuran: 112, warna: N, rata: 'tengah', spasi: -3 }),
        t('founder@startup.com  ·  startup.com', { ukuran: 34, warna: N, rata: 'tengah' }),
        tombol('Book a demo', { fill: N })],
        { x: 260, y: 360, w: 1400, tata: { jarak: 40, rata: 'tengah' } }),
      { tipe: 'elips', x: 1560, y: -180, w: 520, h: 520, fill: '#FFFFFF', opacity: 0.12 }
    ] }]
  ]))

// 2. Poster acara A4
TEMPLATE.push(bangun(
  { id: 'poster-acara', nama: 'Event poster A4', kategori: 'Poster', deskripsi: 'A4 poster for a talk, workshop or meetup: big headline, date, time and venue with icons, sign-up button.' },
  { judul: 'Poster', ukuran: 'a4', nama: 'Poster', bg: '#0F1330' },
  [[{ op: 'tambah', artboard: 'a1', elemen: [
    { tipe: 'elips', x: 330, y: -260, w: 700, h: 700, fill: { warna: [K, '#FFA23C'], sudut: 150 } },
    { tipe: 'elips', x: -220, y: 760, w: 420, h: 420, fill: '#7B61FF', opacity: 0.35 },
    { tipe: 'ikon', ikon: 'wand-sparkles', x: 520, y: 70, w: 210, warna: '#FFFFFF', tebal: 1.5 },
    kolom([
      pil('Free workshop', { fill: '#FFFFFF', warnaTeks: N }),
      judul('Design faster\nwith AI.', { ukuran: 76, warna: '#FFFFFF', lh: 1.0, spasi: -2 }),
      t('Two hands-on hours: from a brief to a finished poster, with a design agent.', { ukuran: 18, warna: '#C9CCE8', lh: 1.5 }),
      kolom([
        baris([{ tipe: 'ikon', ikon: 'calendar', w: 24, warna: '#FF8A6B' }, t('Saturday, March 14, 2026', { ukuran: 17, tebal: 700, warna: '#FFFFFF', lh: 1.3 })], { lebar: 'peluk', tinggi: 'peluk', tata: { jarak: 12, rata: 'tengah' } }),
        baris([{ tipe: 'ikon', ikon: 'clock', w: 24, warna: '#FF8A6B' }, t('9:00 – 11:00 AM', { ukuran: 17, tebal: 700, warna: '#FFFFFF', lh: 1.3 })], { lebar: 'peluk', tinggi: 'peluk', tata: { jarak: 12, rata: 'tengah' } }),
        baris([{ tipe: 'ikon', ikon: 'map-pin', w: 24, warna: '#FF8A6B' }, t('Creative Hall, Jakarta', { ukuran: 17, tebal: 700, warna: '#FFFFFF', lh: 1.3 })], { lebar: 'peluk', tinggi: 'peluk', tata: { jarak: 12, rata: 'tengah' } })
      ], { tata: { jarak: 14 } }),
      tombol('Sign up now', { fill: '#E5392A', ukuran: 20, padding: [16, 28, 16, 28] })
    ], { x: 60, y: 430, w: 674, tata: { jarak: 26 } }),
    t('40 seats only  ·  events.example/design-ai', { x: 60, y: 1050, w: 674, ukuran: 13, warna: '#8A90B8' })
  ] }]]))

// 3. Promo Instagram 4:5
TEMPLATE.push(bangun(
  { id: 'ig-promo', nama: 'Instagram promo 4:5', kategori: 'Social media', deskripsi: 'Feed post 1080×1350: discount badge, product name, struck-through price, button.' },
  { judul: 'Promo', ukuran: 'ig-feed', nama: 'Feed', bg: '#FFF4EC' },
  [[{ op: 'tambah', artboard: 'a1', elemen: [
    { tipe: 'kotak', x: 80, y: 120, w: 920, h: 700, radius: 48, fill: { warna: ['#FFB38A', K], sudut: 150 } },
    { tipe: 'ikon', ikon: 'shopping-bag', x: 380, y: 300, w: 320, warna: '#FFFFFF', tebal: 1.5 },
    kolom([t('-30%', { font: JUDUL, ukuran: 64, tebal: 700, warna: K, rata: 'tengah', lh: 1 }), t('this week', { ukuran: 22, tebal: 700, warna: N, rata: 'tengah', lh: 1.2 })],
      { x: 780, y: 70, w: 260, h: 260, fill: '#FFFFFF', radius: 999, bayangan: true, tata: { jarak: 4, rata: 'tengah', sebar: 'tengah', padding: 24 } }),
    kolom([
      judul('Everyday Canvas Tote', { ukuran: 76 }),
      baris([t('$39', { font: JUDUL, ukuran: 48, tebal: 700, lh: 1.1 }), t('$56', { ukuran: 30, warna: '#6F655D', lh: 1.1 })], { lebar: 'peluk', tinggi: 'peluk', tata: { jarak: 20, rata: 'akhir' } }),
      tombol('Shop now', { fill: N }),
      baris([{ tipe: 'ikon', ikon: 'truck', w: 30, warna: '#6F655D' }, t('Free shipping until March 31', { ukuran: 24, warna: '#6F655D', lh: 1.2 })], { lebar: 'peluk', tinggi: 'peluk', tata: { jarak: 12, rata: 'tengah' } })
    ], { x: 80, y: 880, w: 920, tata: { jarak: 28 } })
  ] }]]))

// 4. Story Instagram 9:16
TEMPLATE.push(bangun(
  { id: 'ig-story', nama: 'Announcement story', kategori: 'Social media', deskripsi: 'Story 1080×1920 for an announcement or launch: big icon, headline, swipe-up prompt.' },
  { judul: 'Story', ukuran: 'ig-story', nama: 'Story', bg: { warna: ['#7B61FF', '#EF476F'], sudut: 165 } },
  [[{ op: 'tambah', artboard: 'a1', elemen: [
    { tipe: 'elips', x: -200, y: -160, w: 800, h: 800, fill: '#FFFFFF', opacity: 0.1 },
    kolom([
      baris([{ tipe: 'ikon', ikon: 'rocket', w: 120, warna: '#FFFFFF', tebal: 1.75 }], { lebar: 'peluk', tinggi: 'peluk', fill: '#FFFFFF', opacity: 0.18, radius: 56, tata: { padding: 44 } }),
      pil('Just launched', { fill: '#FFFFFF', warnaTeks: '#5B3FE0' }),
      judul('The new\nfeature is\nhere.', { ukuran: 120, warna: '#FFFFFF', rata: 'tengah', lh: 1.0, spasi: -3 }),
      t('Tap the link below to try it free for 14 days.', { ukuran: 38, warna: '#FFFFFF', rata: 'tengah', lh: 1.4 })
    ], { x: 90, y: 520, w: 900, tata: { jarak: 40, rata: 'tengah' } }),
    kolom([{ tipe: 'ikon', ikon: 'chevrons-up', w: 64, warna: '#FFFFFF' }, t('Swipe up', { ukuran: 30, tebal: 700, warna: '#FFFFFF', rata: 'tengah' })],
      { x: 340, y: 1620, w: 400, tata: { jarak: 8, rata: 'tengah' } })
  ] }]]))

// 5. Thumbnail YouTube
TEMPLATE.push(bangun(
  { id: 'yt-thumbnail', nama: 'YouTube thumbnail', kategori: 'Social media', deskripsi: '1280×720 with a 2–3 word ultra-bold title, a label and an icon accent.' },
  { judul: 'Thumbnail', ukuran: 'yt-thumbnail', nama: 'Thumbnail', bg: '#FFD166' },
  [[{ op: 'tambah', artboard: 'a1', elemen: [
    { tipe: 'kotak', x: 720, y: 0, w: 560, h: 720, fill: N },
    { tipe: 'ikon', ikon: 'trending-up', x: 820, y: 170, w: 380, warna: '#FFD166', tebal: 2.5 },
    kolom([
      pil('Tutorial', { fill: N, warnaTeks: '#FFD166' }),
      t('DESIGNER\nIN 5\nMINUTES', { font: 'Anton', ukuran: 132, warna: N, lh: 0.95, spasi: 1 }),
    ], { x: 64, y: 110, w: 640, tata: { jarak: 24 } })
  ] }]]))

// 6. Slide harga — komponen "Paket"
TEMPLATE.push(bangun(
  { id: 'harga', nama: 'Pricing slide, 3 plans', kategori: 'Presentation', deskripsi: '16:9 with a "Plan" card component: edit the main card and all three follow.' },
  { judul: 'Pricing', ukuran: 'slide', nama: 'Pricing', bg: KR },
  [[{ op: 'tambah', artboard: 'a1', elemen: [
    kolom([label('Pricing', { rata: 'tengah' }), judul('Pick the right plan', { rata: 'tengah' })], { x: 140, y: 110, w: 1640, tata: { jarak: 16, rata: 'tengah' } }),
    baris([
      kolom([t('Free', { nama: 'Name', ukuran: 24, tebal: 700, kapital: true, spasi: 3, warna: KG, lh: 1.2 }), t('$0', { nama: 'Price', font: JUDUL, ukuran: 72, tebal: 700, lh: 1.1, spasi: -2 }),
        t('To try it out', { nama: 'For', ukuran: 26, warna: AB }), { tipe: 'kotak', h: 2, fill: '#E6E1D6' },
        t('✓  3 designs\n✓  PNG export\n✓  Community', { nama: 'Features', ukuran: 26, warna: N, lh: 1.7 }),
        tombol('Choose plan', { nama: 'Button', fill: N, ukuran: 24, padding: [20, 32, 20, 32] })],
        { id: 'paket', nama: 'Plan', lebar: 'isi', fill: '#FFFFFF', radius: 32, bayangan: true, tata: { padding: 48, jarak: 22 } })
    ], { id: 'deret-paket', x: 140, y: 360, w: 1640, tata: { jarak: 40, rata: 'regang' } })
  ] }, { op: 'jadikan_komponen', id: 'paket' },
  { op: 'tambah', ke_grup: 'deret-paket', elemen: [
    { tipe: 'salinan', dari: 'Plan', timpa: { '@': { fill: N }, Name: { teks: 'Pro', warna: '#FF8A6B' }, Price: { teks: '$9', warna: '#FFFFFF' }, For: { teks: 'For creators', warna: '#C9CCE8' }, Features: { teks: '✓  Unlimited designs\n✓  PDF & SVG export\n✓  AI agent', warna: '#FFFFFF' }, Button: { fill: '#FFFFFF' }, 'Choose plan': { warna: N } } },
    { tipe: 'salinan', dari: 'Plan', timpa: { Name: { teks: 'Team' }, Price: { teks: '$29' }, For: { teks: 'For 5 people' }, Features: { teks: '✓  Everything in Pro\n✓  Shared brand kit\n✓  Comments' } } }] }]]))

mkdirSync(join(AKAR, 'templates'), { recursive: true })
for (const d of TEMPLATE) writeFileSync(join(AKAR, 'templates', d.meta.id + '.kanvas.json'), JSON.stringify(d, null, 1))
console.log(TEMPLATE.map(d => `${d.meta.id}: ${d.artboards.length} artboard, ${d.artboards.reduce((n, a) => n + a.elemen.length, 0)} elemen`).join('\n'))

// P0 regression tests: Design Intelligence, Multi-Brand Brand Kit, and Upgraded Visual QA.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DIRECTIONS, scaleSystem, inferDirection, buildArtDirection } from '../server/design-intelligence.js'
import { periksa } from '../app/lint.js'

const ruangTes = mkdtempSync(join(tmpdir(), 'kanvas-p0-tes-'))
process.env.KANVAS_HOME = ruangTes
const { saveBrand, listBrands, getBrand, setDefaultBrand, deleteBrand, importBrandAsset, applyBrandToDoc } = await import('../server/brand.js')

const mockLayout = el => {
  const uk = el.ukuran || 32, lh = uk * (el.lh || 1.2)
  const raw = String(el.teks || '').split('\n')
  const lines = []
  const maxChars = Math.max(8, Math.floor((el.w || 400) / (uk * 0.55)))
  for (const p of raw) {
    if (p.length <= maxChars) lines.push(p)
    else for (let i = 0; i < p.length; i += maxChars) lines.push(p.slice(i, i + maxChars))
  }
  return { lines, lh, h: Math.max(lh, lines.length * lh) }
}
const mockFontStr = el => `${el.tebal || 400} ${el.ukuran || 32}px "${el.font || 'Inter'}", sans-serif`

test('Design Intelligence: infers contextual directions and supports explicit overrides', () => {
  assert.equal(inferDirection({ brief: 'Swiss typography exhibition poster for museum', format: 'a4' }).primary.id, 'swiss-editorial')
  assert.equal(inferDirection({ brief: 'Luxury Swiss watch boutique fragrance campaign' }).primary.id, 'luxury-minimalism')
  assert.equal(inferDirection({ brief: 'Underground punk rave concert poster' }).primary.id, 'brutalism')
  assert.equal(inferDirection({ brief: 'Sci-fi documentary film theatrical key art' }).primary.id, 'cinematic')
  assert.equal(inferDirection({ brief: 'Q4 investor financial annual report deck', format: 'slide' }).primary.id, 'corporate-premium')
  assert.equal(inferDirection({ brief: 'Avant-garde abstract art gallery studio zine' }).primary.id, 'experimental')
  assert.equal(inferDirection({ brief: 'SaaS developer app feature launch carousel' }).primary.id, 'editorial-product')
  assert.equal(inferDirection({ brief: 'Coffee shop menu', style: 'brutalism' }).primary.id, 'brutalism')
  assert.ok(Object.keys(DIRECTIONS).length >= 7)
})

test('Design Intelligence: proportional scaleSystem adapts across canvas sizes and integrates Brand Kit', () => {
  const slide = scaleSystem(1920, 1080, 0.07)
  const a4 = scaleSystem(794, 1123, 0.065)
  const story = scaleSystem(1080, 1920, 0.07)
  assert.equal(slide.artboard.orientation, 'landscape')
  assert.equal(a4.artboard.orientation, 'portrait')
  assert.equal(story.artboard.orientation, 'portrait')
  assert.ok(slide.margins.x > a4.margins.x, 'larger canvas must scale margins proportionally')
  assert.ok(a4.margins.contentW === 794 - a4.margins.x * 2)

  const brand = {
    id: 'atelier-nord',
    name: 'Atelier Nord',
    tagline: 'Quiet architectural objects',
    voice: 'calm, editorial',
    colors: { background: '#F7F3EC', surface: '#EFE8DC', text: '#1C1917', muted: '#6B6258', accent: '#9A7B4F' },
    fonts: { display: 'Cormorant Garamond', body: 'Plus Jakarta Sans', mono: 'IBM Plex Mono' },
    logos: [{ variant: 'primary', src: 'brands/atelier-nord/logo-mark.svg' }],
    style: { direction: 'luxury-minimalism', guidelines: ['Keep margins generous'] }
  }
  const ad = buildArtDirection({ brief: 'Product lookbook', w: 794, h: 1123, brand })
  assert.equal(ad.direction, 'luxury-minimalism')
  assert.equal(ad.brandId, 'atelier-nord')
  assert.match(ad.briefText, /Atelier Nord/)
  assert.match(ad.briefText, /Cormorant Garamond/)
  assert.match(ad.briefText, /#9A7B4F/)
  assert.match(ad.briefText, /brands\/atelier-nord\/logo-mark\.svg/)
  assert.match(ad.briefText, /not a rigid template/i)
})

test('Brand Kit: multi-brand CRUD, validation, asset import, contrast-safe apply, and cleanup', () => {
  try {
    const b1 = saveBrand({
      name: 'Vektor Studio',
      tagline: 'Modular systems',
      voice: 'precise, crisp',
      colors: { primary: '#e03e2d', background: '#f4f1ea', surface: '#eae5da', text: '#111111', muted: '#55524b', accent: '#e03e2d' },
      fonts: { display: 'Syne', body: 'Inter', mono: 'IBM Plex Mono' },
      style: { direction: 'swiss-editorial', radius: 4, guidelines: ['Use sharp 1px rules'] }
    })
    assert.equal(b1.brand.id, 'vektor-studio')
    assert.equal(b1.brand.colors.primary, '#E03E2D')
    assert.equal(b1.isDefault, true)

    const b2 = saveBrand({
      name: 'Noir Atelier',
      colors: { background: '#0e0d0c', surface: '#1a1816', text: '#f5f0e6', accent: '#d4b483' },
      fonts: { display: 'Cormorant Garamond', body: 'Montserrat' }
    })
    assert.equal(b2.brand.id, 'noir-atelier')
    assert.equal(listBrands().brands.length, 2)
    assert.equal(listBrands().defaultId, 'vektor-studio')

    // Validation guards
    assert.throws(() => saveBrand({ name: 'Bad', colors: { primary: 'not-a-hex' } }), /valid hex/)
    assert.throws(() => saveBrand({ name: '!!!' }), /letters or numbers/)

    // Import logo asset into brands/vektor-studio/
    const fakeSvg = join(ruangTes, 'temp-mark.svg')
    const fakeTxt = join(ruangTes, 'secret.txt')
    writeFileSync(fakeSvg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>')
    writeFileSync(fakeTxt, 'nope')
    const imp = importBrandAsset('vektor-studio', { path: fakeSvg, kind: 'logo', name: 'Primary Mark', variant: 'primary' })
    assert.equal(imp.src, 'brands/vektor-studio/logo-primary-mark.svg')
    assert.ok(existsSync(join(ruangTes, imp.src)))
    assert.throws(() => importBrandAsset('vektor-studio', { path: fakeTxt }), /Not an existing image file/)

    // Switch default brand
    setDefaultBrand('noir-atelier')
    assert.equal(getBrand()?.id, 'noir-atelier')

    // Apply dark Brand Kit onto a light doc — ensures readable text contrast & font updates
    const sampleDoc = {
      versi: 1, judul: 'Test Deck',
      artboards: [{
        id: 'a1', nama: 'Slide 1', x: 0, y: 0, w: 1920, h: 1080, bg: '#FFFFFF',
        elemen: [
          { id: 'c1', tipe: 'kotak', x: 140, y: 360, w: 600, h: 420, fill: '#F5F5F5' },
          { id: 'e1', tipe: 'teks', x: 140, y: 140, w: 900, teks: 'AUTUMN COLLECTION', kapital: true, ukuran: 20, tebal: 700, font: 'Arial', warna: '#111111' },
          { id: 't1', tipe: 'teks', x: 140, y: 200, w: 1100, teks: 'Quiet Authority', ukuran: 84, tebal: 700, font: 'Arial', warna: '#111111' },
          { id: 't2', tipe: 'teks', x: 180, y: 420, w: 500, teks: 'Body copy on card', ukuran: 26, font: 'Arial', warna: '#111111' }
        ]
      }]
    }
    const { doc: themed, changes } = applyBrandToDoc(sampleDoc, getBrand('noir-atelier'))
    assert.equal(themed.brand, 'noir-atelier')
    assert.equal(themed.artboards[0].bg, '#0E0D0C')
    assert.equal(themed.artboards[0].elemen.find(e => e.id === 'c1').fill, '#1A1816')
    assert.equal(themed.artboards[0].elemen.find(e => e.id === 't1').font, 'Cormorant Garamond')
    assert.equal(themed.artboards[0].elemen.find(e => e.id === 't2').font, 'Montserrat')
    assert.equal(themed.artboards[0].elemen.find(e => e.id === 't1').warna, '#F5F0E6')
    assert.equal(themed.artboards[0].elemen.find(e => e.id === 'e1').warna, '#D4B483')
    assert.ok(changes.length >= 3)

    // Delete brand cleans up folder and re-selects remaining default
    deleteBrand('vektor-studio')
    assert.equal(getBrand('vektor-studio'), null)
    assert.ok(!existsSync(join(ruangTes, 'brands/vektor-studio')))
    setDefaultBrand(null)
    assert.equal(getBrand(), null)
  } finally {
    rmSync(ruangTes, { recursive: true, force: true })
  }
})

test('Visual QA (lint.js): scores clean design high and catches gradient contrast, lh, icon overlap, margins, hierarchy, alignment, and brand fonts', () => {
  // 1. Clean Swiss Editorial artboard → 0 issues, high score
  const cleanDoc = {
    versi: 1, judul: 'Swiss Poster', brand: 'vektor',
    artboards: [{
      id: 'a1', nama: 'Poster', x: 0, y: 0, w: 794, h: 1123, bg: '#F4F1EA',
      elemen: [
        { id: 'ey', tipe: 'teks', x: 56, y: 64, w: 400, teks: '01 / SYMPOSIUM 2026', font: 'IBM Plex Mono', ukuran: 16, tebal: 600, warna: '#E03E2D', kapital: true },
        { id: 'h1', tipe: 'teks', x: 56, y: 160, w: 680, teks: 'FORM &\nSIGNAL', font: 'Syne', ukuran: 92, tebal: 800, warna: '#111111', lh: 0.96 },
        { id: 'bd', tipe: 'teks', x: 56, y: 420, w: 540, teks: 'Annual architecture and graphic systems exhibition in Zurich.', font: 'Inter', ukuran: 22, tebal: 400, warna: '#111111', lh: 1.45 }
      ]
    }]
  }
  const brand = { name: 'Vektor', fonts: { display: 'Syne', body: 'Inter', mono: 'IBM Plex Mono' } }
  const rClean = periksa(cleanDoc, { layoutTeks: mockLayout, fontStr: mockFontStr, brand })
  assert.equal(rClean.masalah.length, 0, rClean.masalah.join('; '))
  assert.ok(rClean.skor >= 92, `expected high QA score, got ${rClean.skor}`)
  assert.equal(rClean.metrik.length, 1)
  assert.ok(rClean.metrik[0].minMarginPx >= 56)
  assert.ok(rClean.metrik[0].typeRatio >= 4)

  // 2. Deliberately flawed design → catches every new P0 QA rule
  const badDoc = {
    versi: 1, judul: 'Flawed', brand: 'vektor',
    artboards: [{
      id: 'a1', nama: 'Flawed Slide', x: 0, y: 0, w: 1920, h: 1080,
      bg: { warna: ['#FFFFFF', '#111111'], sudut: 90 },   // white text on white→black gradient fails worst-case!
      elemen: [
        { id: 'ic', tipe: 'path', ikon: 'zap', x: 140, y: 120, w: 64, h: 64, vb: [24, 24], d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
        { id: 't1', tipe: 'teks', x: 145, y: 125, w: 600, teks: 'Overlaps icon\nTight lh collision', font: 'Syne', ukuran: 32, warna: '#FFFFFF', lh: 0.72 },
        { id: 't2', tipe: 'teks', x: 12, y: 300, w: 400, teks: 'Tight edge margin', font: 'Lato', ukuran: 28, warna: '#111111' },
        { id: 't3', tipe: 'teks', x: 140, y: 420, w: 400, teks: 'Third font', font: 'Merriweather', ukuran: 28, warna: '#111111' },
        { id: 't4', tipe: 'teks', x: 140, y: 520, w: 400, teks: 'Fourth font', font: 'Oswald', ukuran: 28, warna: '#111111' }
      ]
    }]
  }
  const rBad = periksa(badDoc, { layoutTeks: mockLayout, fontStr: mockFontStr, brand })
  assert.ok(rBad.masalah.some(m => /contrast/i.test(m)), 'must catch worst-case gradient contrast')
  assert.ok(rBad.masalah.some(m => /line-height/i.test(m)), 'must catch colliding line-height')
  assert.ok(rBad.masalah.some(m => /overlaps icon/i.test(m)), 'must catch text overlapping icon')
  assert.ok(rBad.saran.some(s => /tight edge margin/i.test(s)), 'must catch cramped edge margin')
  assert.ok(rBad.saran.some(s => /font families/i.test(s)), 'must catch >3 font families')
  assert.ok(rBad.saran.some(s => /flat typographic hierarchy/i.test(s)), 'must catch flat hierarchy')
  assert.ok(rBad.saran.some(s => /near-miss left alignment/i.test(s)), 'must catch near-miss left alignment')
  assert.ok(rBad.saran.some(s => /off-brand font/i.test(s)), 'must catch off-brand fonts')
  assert.ok(rBad.skor < 60, `expected low QA score on flawed design, got ${rBad.skor}`)
})

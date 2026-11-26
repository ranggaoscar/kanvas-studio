// Phase 2 regression tests: Structured Layout Blueprints (7 lenses),
// Business / Admin Report preset + pagination + starter template,
// and upgraded Visual QA Taste Evaluator (app/lint.js & server/fast-qa.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DIRECTIONS, COMPOSITIONS, DOCUMENT_PRESETS, inferDocumentPreset, buildArtDirection } from '../server/design-intelligence.js'
import { REPORT_RULES, paginateTableRows, buildAdminReportDoc, buildPresentationDoc } from '../server/presentation.js'
import { layoutTeksServer, resolveLayout } from '../server/layout.js'
import { fastQa } from '../server/fast-qa.js'
import { periksa } from '../app/lint.js'
import { cariBrowser } from '../server/render.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const fontStr = e => `${e.tebal || 400} ${e.ukuran || 32}px "${e.font || 'Inter'}", sans-serif`

test('Phase 2 Design Intelligence: all 7 lenses define structured blueprints, 60-30-10 budget, element caps, and compact output', () => {
  const lensIds = ['swiss-editorial', 'luxury-minimalism', 'brutalism', 'cinematic', 'corporate-premium', 'experimental', 'editorial-product']
  for (const id of lensIds) {
    const d = DIRECTIONS[id]
    assert.ok(d && d.blueprint, `${id} must define a structured blueprint`)
    const bp = d.blueprint
    assert.ok(bp.marginRatio?.x > 0 && bp.marginRatio?.y > 0, `${id} marginRatio`)
    assert.ok(bp.columnGrid?.landscape && bp.columnGrid?.portrait, `${id} columnGrid`)
    assert.ok(bp.focalArea, `${id} focalArea`)
    assert.ok(bp.whitespaceTarget?.min >= 20 && bp.whitespaceTarget?.max > bp.whitespaceTarget.min, `${id} whitespaceTarget`)
    assert.equal(bp.colorBudget.canvas, 60, `${id} 60% canvas rule`)
    assert.equal(bp.colorBudget.surface, 30, `${id} 30% surface rule`)
    assert.equal(bp.colorBudget.accent, 10, `${id} 10% accent rule`)
    assert.ok(bp.maxElementsPerZone.total > 0 && bp.maxElementsPerZone.total <= 20, `${id} artboard element cap`)
    assert.ok(Array.isArray(bp.zones) && bp.zones.length >= 3, `${id} structured zones`)
    assert.ok(Array.isArray(bp.antiSlop) && bp.antiSlop.length >= 3, `${id} lens-specific anti-slop guardrails`)

    const ad = buildArtDirection({ style: id, w: 1920, h: 1080 })
    assert.equal(ad.direction, id)
    assert.deepEqual(ad.colorBudget, bp.colorBudget)
    assert.ok(ad.briefText.length < 3600, `${id} briefText should stay compact (<3600 chars, got ${ad.briefText.length})`)
    assert.match(ad.briefText, /60-30-10/)
    assert.match(ad.briefText, /Element caps:/)
    assert.match(ad.briefText, /Anti-Slop Guardrails/)
    // Must not dump unrelated lens summaries
    for (const other of lensIds) {
      if (other !== id) assert.ok(!ad.briefText.includes(DIRECTIONS[other].summary), `${id} should not leak ${other} summary`)
    }
  }

  for (const [cid, c] of Object.entries(COMPOSITIONS)) {
    assert.ok(c.gridRatio && c.focalArea && c.whitespaceTarget && Array.isArray(c.zones) && c.zones.length >= 2, `composition ${cid} must be structured`)
  }
})

test('Phase 2 Business / Admin Report preset: detection, compact brief, auto-pagination, and 4 page patterns', () => {
  const preset = DOCUMENT_PRESETS['admin-report']
  assert.deepEqual([preset.dimensions.w, preset.dimensions.h], [794, 1123])
  assert.equal(preset.pagePatterns.length, 4)
  assert.deepEqual(preset.pagePatterns.map(p => p.id), ['cover', 'kpi-summary', 'data-table', 'notes-summary'])

  assert.equal(inferDocumentPreset({ brief: 'Laporan keuangan bulanan operasional', format: 'a4' })?.id, 'admin-report')
  assert.equal(inferDocumentPreset({ brief: 'Monthly executive admin report', format: 'a4' })?.id, 'admin-report')
  assert.equal(inferDocumentPreset({ brief: 'Q4 investor deck', format: 'slide' }), null, 'landscape slide decks must not trigger A4 report preset')

  const ad = buildArtDirection({ brief: 'Monthly business admin report for finance', format: 'a4' })
  assert.equal(ad.direction, 'corporate-premium')
  assert.equal(ad.documentPreset, 'admin-report')
  assert.equal(ad.grid.artboard.w, 794)
  assert.equal(ad.grid.artboard.h, 1123)
  assert.ok(ad.briefText.length < 4000, `admin-report briefText must stay compact (<4000 chars, got ${ad.briefText.length})`)
  assert.match(ad.briefText, /Document Preset — Business \/ Admin Report/)
  assert.match(ad.briefText, /Pagination:/)

  // Pagination utility splits long datasets cleanly for multi-page reports
  const manyRows = Array.from({ length: 26 }, (_, i) => [`Unit ${i + 1}`, `${100 + i * 5}`, `${95 + i * 5}`, '+5.0%'])
  const chunks = paginateTableRows(manyRows)
  assert.deepEqual(chunks.map(c => c.length), [REPORT_RULES.maxRowsFirstPage, REPORT_RULES.maxRowsContinuation, 2])

  // Programmatic report builder + buildPresentationDoc delegation with automatic table pagination
  const { doc, pageCount, preset: usedPreset } = buildPresentationDoc({
    judul: 'Monthly Finance & Operations Report',
    subtitle: 'Executive summary, regional performance, and Q4 actions.',
    organization: 'Northstar Ops',
    period: 'OCT 2026',
    author: 'Finance Office',
    docId: 'FIN-2026-10',
    preset: 'admin-report',
    slides: [
      { type: 'cover', highlights: [{ label: 'Revenue', value: '$1.62M', detail: '+14% MoM' }, { label: 'Margin', value: '25.1%', detail: '+120 bps' }, { label: 'SLA', value: '98.9%', detail: 'On target' }] },
      { type: 'kpi-summary', heading: 'Revenue grew 14% while fulfillment costs fell', metrics: [{ label: 'Revenue', value: '$1.62M', detail: '+14% MoM' }, { label: 'Margin', value: '25.1%', detail: '+120 bps' }, { label: 'Unit Cost', value: '$13.80', detail: '-5% MoM' }], chart: { type: 'bar', title: 'Monthly Revenue', data: [{ label: 'Jul', value: 1.2 }, { label: 'Aug', value: 1.35 }, { label: 'Sep', value: 1.42 }, { label: 'Oct', value: 1.62 }], unit: 'M', highlightIndex: 3 }, bullets: ['Enterprise renewals hit 97%.', 'Automated dispatch cut cost per order by 5%.'] },
      { type: 'data-table', heading: 'Department budget execution', subtitle: 'USD thousands · 15 active departments', table: { columns: ['Department', 'Actual', 'Budget', 'Variance'], rows: manyRows.slice(0, 15), totalRow: ['Total', '2,025', '1,950', '+3.8%'] }, footnote: 'Audited through Oct 31, 2026.' },
      { type: 'notes-summary', heading: 'Priorities for next cycle', findings: [{ title: 'Scale APAC onboarding', detail: 'Highest operating margin at 28%.' }, { title: 'Close NA West renewals', detail: 'Recovers $42K timing variance.' }], actions: [{ action: 'Expand APAC pod', owner: 'VP Delivery', due: 'Nov 15', status: 'Active' }, { action: 'Roll out EMEA routing', owner: 'Head of Ops', due: 'Dec 01', status: 'Planned' }] }
    ]
  })
  assert.equal(usedPreset, 'admin-report')
  // 15 rows exceed 10-row first-page cap → splits into 2 table pages → 5 total pages
  assert.equal(pageCount, 5)
  assert.ok(doc.artboards.every(ab => ab.w === 794 && ab.h === 1123))
  assert.match(doc.artboards[3].nama, /\(cont\.\)/)
  assert.ok(doc.artboards[1].elemen.some(e => e.tipe === 'teks' && /PAGE 02 \/ 05/.test(e.teks)))
  assert.ok(doc.artboards[4].elemen.some(e => e.tipe === 'teks' && /PAGE 05 \/ 05/.test(e.teks)))

  const fq = fastQa(doc)
  const lq = periksa(doc, { layoutTeks: layoutTeksServer, fontStr })
  assert.equal(fq.masalah.length, 0, fq.masalah.join('; '))
  assert.equal(lq.masalah.length, 0, lq.masalah.join('; '))
  assert.ok(lq.skor >= 90, `generated admin report should score ≥90, got ${lq.skor}: ${lq.saran.join(' | ')}`)
  assert.ok(typeof buildAdminReportDoc === 'function')
})

test('Phase 2 Visual QA Taste Evaluator: catches wall-of-text, off-balance/weak focal, noisy palette, and erratic spacing in both lint.js and fast-qa.js', () => {
  const longProse = 'Quarterly operational performance across every single regional office continued to expand steadily throughout the fiscal reporting window without any meaningful slowdown in enterprise customer onboarding or channel partner activation, demonstrating durable margin expansion across logistics, warehousing, and customer support teams while maintaining strict cost controls and service quality benchmarks.'
  const tasteFailDoc = {
    versi: 1, judul: 'Sloppy Taste',
    artboards: [{
      id: 'a1', nama: 'Sloppy Page', x: 0, y: 0, w: 1200, h: 800, bg: '#FFFFFF',
      elemen: [
        // All crammed left + erratic vertical gaps (7px, 23px, 11px, 39px) + 5 unrelated accent hues + weak focal scale (18..24px)
        { id: 't1', tipe: 'teks', x: 40, y: 40, w: 320, teks: 'Weak Title Here', font: 'Inter', ukuran: 24, tebal: 700, warna: '#EF4444', lh: 1.2 },
        { id: 'b1', tipe: 'kotak', x: 40, y: 76, w: 280, h: 30, fill: '#2563EB' },
        { id: 't2', tipe: 'teks', x: 40, y: 129, w: 320, teks: 'Another Label', font: 'Inter', ukuran: 20, warna: '#16A34A', lh: 1.2 },
        { id: 'b2', tipe: 'kotak', x: 40, y: 164, w: 280, h: 30, fill: '#9333EA' },
        { id: 'b3', tipe: 'kotak', x: 40, y: 233, w: 280, h: 30, fill: '#EAB308' },
        { id: 'p1', tipe: 'teks', x: 40, y: 274, w: 360, teks: longProse, font: 'Inter', ukuran: 18, warna: '#111111', lh: 1.35 }
      ]
    }]
  }
  const fq = fastQa(tasteFailDoc)
  const lq = periksa(tasteFailDoc, { layoutTeks: layoutTeksServer, fontStr })
  for (const [name, res] of [['fastQa', fq], ['lint.js', lq]]) {
    assert.ok(res.saran.some(s => /wall-of-text/i.test(s)), `${name} must detect wall-of-text: ${res.saran.join(' | ')}`)
    assert.ok(res.saran.some(s => /off-balance/i.test(s)), `${name} must detect off-balance layout: ${res.saran.join(' | ')}`)
    assert.ok(res.saran.some(s => /weak focal point|flat typographic/i.test(s)), `${name} must detect weak focal hierarchy: ${res.saran.join(' | ')}`)
    assert.ok(res.saran.some(s => /noisy color palette/i.test(s)), `${name} must detect >3 accent hues (60-30-10): ${res.saran.join(' | ')}`)
    assert.ok(res.saran.some(s => /inconsistent spacing rhythm/i.test(s)), `${name} must detect erratic spacing: ${res.saran.join(' | ')}`)
    // Suggestions must stay concise (token-efficient)
    for (const s of res.saran) assert.ok(s.length <= 180, `${name} suggestion too verbose (${s.length} chars): ${s}`)
  }
})

test('Phase 2 Starter Template admin-report.kanvas.json: bundled in dist, valid A4 studio layout, scores ≥ 90 on QA', { timeout: 60000 }, async () => {
  const tplPath = join(AKAR, 'templates/admin-report.kanvas.json')
  assert.ok(existsSync(tplPath), 'templates/admin-report.kanvas.json must exist')
  const tpl = JSON.parse(readFileSync(tplPath, 'utf8'))
  assert.equal(tpl.meta.id, 'admin-report')
  assert.equal(tpl.artboards.length, 4)
  assert.ok(tpl.artboards.every(ab => ab.w === 794 && ab.h === 1123))
  assert.ok(tpl.artboards.some(ab => ab.elemen.some(e => e.salinan)), 'admin-report should demonstrate reusable component instances')

  const distTemplates = JSON.parse(readFileSync(join(AKAR, 'app/dist/template.json'), 'utf8'))
  assert.ok(distTemplates.some(t => t.meta?.id === 'admin-report'), 'admin-report must be bundled into app/dist/template.json')

  const copy = JSON.parse(JSON.stringify(tpl))
  resolveLayout(copy)
  const fq = fastQa(copy)
  const lq = periksa(copy, { layoutTeks: layoutTeksServer, fontStr })
  assert.equal(fq.masalah.length, 0, fq.masalah.join('; '))
  assert.equal(lq.masalah.length, 0, lq.masalah.join('; '))
  assert.ok(fq.skor >= 90, `admin-report fastQa score must be ≥90, got ${fq.skor}: ${fq.saran.join(' | ')}`)
  assert.ok(lq.skor >= 90, `admin-report lint score must be ≥90, got ${lq.skor}: ${lq.saran.join(' | ')}`)

  // Full Canvas 2D headless browser QA verification when browser is available
  if (cariBrowser()) {
    const home = mkdtempSync(join(tmpdir(), 'kanvas-admin-qa-'))
    const prevHome = process.env.KANVAS_HOME
    process.env.KANVAS_HOME = home
    try {
      copyFileSync(tplPath, join(home, 'admin-report.kanvas.json'))
      const { mulaiStudio } = await import('../server/studio.js')
      const { render } = await import('../server/render.js')
      const s = await mulaiStudio({ port: 0, diam: true })
      try {
        const r = await render(s, { file: 'admin-report.kanvas.json', mode: 'qa_only' })
        assert.equal(r.ok, true, r.error)
        assert.equal(r.masalah.length, 0, r.masalah.join('; '))
        assert.ok(r.skor >= 90, `admin-report browser Visual QA must be ≥90, got ${r.skor}: ${r.saran.join(' | ')}`)
      } finally {
        s.server?.close?.()
      }
    } finally {
      if (prevHome === undefined) delete process.env.KANVAS_HOME; else process.env.KANVAS_HOME = prevHome
      rmSync(home, { recursive: true, force: true })
    }
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { analyzeTabularData, writeXlsx } from '../server/xlsx.js'
import { buildAdminReportDoc, buildReportFromSheets } from '../server/presentation.js'
import { buildDataVizElement } from '../server/dataviz.js'
import { fastQa } from '../server/fast-qa.js'
import { layoutTeksServer } from '../server/layout.js'
import { periksa } from '../app/lint.js'
import { cariBrowser } from '../server/render.js'

const fontStr = e => `${e.tebal || 400} ${e.ukuran || 32}px "${e.font || 'Inter'}", sans-serif`

function collectAllTypes(el, out = []) {
  if (!el) return out
  out.push(el.tipe)
  if (Array.isArray(el.anak)) for (const c of el.anak) collectAllTypes(c, out)
  return out
}

test('analyzeTabularData profiles monthly trend, branch/product comparison, and percentage composition into native editable charts', () => {
  // 1. Monthly trend with Target vs Actual (Rupiah) → line or bar chart + growth/variance KPIs
  const monthlySheet = {
    name: 'Tren Penjualan H1',
    headers: ['Bulan', 'Omzet Aktual', 'Target', 'Varians'],
    rows: [
      ['Jan', 'Rp 120.000.000', 'Rp 115.000.000', '+4.3%'],
      ['Feb', 'Rp 138.000.000', 'Rp 125.000.000', '+10.4%'],
      ['Mar', 'Rp 152.000.000', 'Rp 145.000.000', '+4.8%'],
      ['Apr', 'Rp 146.000.000', 'Rp 150.000.000', '-2.7%'],
      ['Mei', 'Rp 175.000.000', 'Rp 160.000.000', '+9.4%'],
      ['Jun', 'Rp 198.000.000', 'Rp 175.000.000', '+13.1%']
    ]
  }
  const trendProfile = analyzeTabularData(monthlySheet)
  assert.equal(trendProfile.dimension.kind, 'time')
  assert.equal(trendProfile.primaryMetric.kind, 'currency')
  assert.equal(trendProfile.primaryMetric.currency, 'Rp')
  assert.equal(trendProfile.targetMetric.header, 'Target')
  assert.equal(trendProfile.stats.top.label, 'Jun')
  assert.ok(trendProfile.stats.growthPct > 0)
  assert.ok(['bar', 'line'].includes(trendProfile.chart.type), `expected bar/line for time series, got ${trendProfile.chart.type}`)
  assert.equal(trendProfile.kpis.length, 3)
  assert.ok(trendProfile.insights.length >= 2)

  // Single-series monthly trend → bar chart with highlightIndex on latest/peak period
  const simpleMonthly = analyzeTabularData({
    name: 'Omzet Kuartalan',
    headers: ['Kuartal', 'Pendapatan'],
    rows: [['Q1', 120], ['Q2', 145], ['Q3', 162], ['Q4', 198]]
  })
  assert.equal(simpleMonthly.dimension.kind, 'time')
  assert.equal(simpleMonthly.chart.type, 'bar')
  assert.equal(simpleMonthly.chart.highlightIndex, 3)

  // 2. Branch / product comparison → sorted hbar chart (Top Performer first)
  const branchSheet = {
    name: 'Kinerja Cabang',
    headers: ['No', 'Cabang', 'Penjualan', 'Pertumbuhan'],
    rows: [
      [1, 'Bandung', 142000000, '+8.2%'],
      [2, 'Jakarta Selatan', 268000000, '+16.4%'],
      [3, 'Surabaya', 195000000, '+11.0%'],
      [4, 'Medan', 88000000, '-4.5%'],
      [5, 'Semarang', 118000000, '+3.1%']
    ]
  }
  const branchProfile = analyzeTabularData(branchSheet)
  assert.equal(branchProfile.dimension.header, 'Cabang', 'must skip ID column "No" and pick "Cabang"')
  assert.equal(branchProfile.primaryMetric.header, 'Penjualan')
  assert.equal(branchProfile.chart.type, 'hbar')
  assert.equal(branchProfile.chart.data[0].label, 'Jakarta Selatan', 'hbar must be sorted descending with Top Performer first')
  assert.equal(branchProfile.chart.highlightIndex, 0)

  // 3. Percentage / proportion composition (<= 6 categories) → donut chart
  const shareSheet = {
    name: 'Komposisi Kanal',
    headers: ['Kanal Penjualan', 'Porsi'],
    rows: [
      ['Enterprise B2B', '42%'],
      ['Direct Web', '28%'],
      ['Partner Reseller', '18%'],
      ['Marketplace', '12%']
    ]
  }
  const shareProfile = analyzeTabularData(shareSheet)
  assert.equal(shareProfile.primaryMetric.kind, 'percent')
  assert.equal(shareProfile.chart.type, 'donut')
  assert.equal(shareProfile.chart.data.length, 4)
  assert.equal(shareProfile.chart.centerValue, '100%')

  // Every generated chart MUST compile into 100% native editable vector/shape/text elements (never raster gambar)
  for (const prof of [trendProfile, simpleMonthly, branchProfile, shareProfile]) {
    const el = buildDataVizElement({ showCard: true, ...prof.chart, x: 56, y: 360, w: 424, h: 420 })
    const types = collectAllTypes(el)
    assert.ok(types.includes('grup') && types.includes('teks'), `${prof.name} chart must be native grup + teks`)
    assert.ok(types.includes('kotak') || types.includes('path'), `${prof.name} chart must contain native vector/shape bars or paths`)
    assert.ok(!types.includes('gambar'), `${prof.name} chart MUST NOT be a raster image`)
  }
})

test('Creative editorial report layouts support multiple lenses, Brand Kits, split visual insights, and variance cues cleanly', () => {
  const sheets = [
    {
      name: 'Penjualan Regional',
      headers: ['Cabang', 'Aktual', 'Target', 'Varians'],
      rows: [
        ['Jakarta', 'Rp 245.000.000', 'Rp 220.000.000', '+11.4%'],
        ['Surabaya', 'Rp 188.000.000', 'Rp 180.000.000', '+4.4%'],
        ['Bandung', 'Rp 154.000.000', 'Rp 160.000.000', '-3.8%'],
        ['Semarang', 'Rp 112.000.000', 'Rp 105.000.000', '+6.7%'],
        ['Medan', 'Rp 94.000.000', 'Rp 100.000.000', '-6.0%']
      ]
    },
    {
      name: 'Porsi Produk',
      headers: ['Kategori', 'Kontribusi'],
      rows: [['Kopi Arabika', '46%'], ['Cold Brew', '29%'], ['Pastry', '15%'], ['Merchandise', '10%']]
    }
  ]

  for (const style of ['corporate-premium', 'swiss-editorial', 'editorial-product']) {
    const { doc, pageCount } = buildAdminReportDoc({
      judul: 'Laporan Kinerja Komersial Q4',
      organization: 'Nusantara Coffee Group',
      style,
      sheets
    })
    // Cover + (Insight + Table) x 2 sheets = 5 pages
    assert.equal(pageCount, 5, `${style} report must generate Cover + Insight + Table per sheet`)
    assert.ok(doc.artboards.every(ab => ab.w === 794 && ab.h === 1123))

    // Cover has editorial signal stripes and Hero KPI block
    assert.ok(doc.artboards[0].elemen.some(e => e.id.endsWith('_topband') && e.w === 794))
    assert.ok(doc.artboards[0].elemen.some(e => e.nama === 'Hero KPI Block'))

    // Visual Insight pages have native charts (no raster gambar) + Insight Highlights cards
    const insight1 = doc.artboards[1]
    assert.ok(insight1.elemen.some(e => e.nama === 'Insight Highlights'))
    assert.ok(!insight1.elemen.some(e => e.tipe === 'gambar'))
    assert.ok(insight1.elemen.some(e => e.tipe === 'kotak' && /^Bar /.test(e.nama || '')))

    const insight2 = doc.artboards[3]
    assert.ok(insight2.elemen.some(e => e.tipe === 'path' && /^Slice /.test(e.nama || '')), 'donut slice paths must be editable vectors')

    // Data table has semantic positive/negative variance colors and prominent summary row
    const table1 = doc.artboards[2]
    assert.ok(table1.elemen.some(e => e.nama === 'Summary Total'))
    assert.ok(table1.elemen.some(e => e.tipe === 'teks' && e.teks === '+11.4%' && e.warna === '#047857'))
    assert.ok(table1.elemen.some(e => e.tipe === 'teks' && e.teks === '-3.8%' && e.warna === '#B91C1C'))

    const fq = fastQa(doc)
    const lq = periksa(doc, { layoutTeks: layoutTeksServer, fontStr })
    assert.equal(fq.masalah.length, 0, `${style} fastQa issues: ${fq.masalah.join('; ')}`)
    assert.equal(lq.masalah.length, 0, `${style} lint issues: ${lq.masalah.join('; ')}`)
    assert.ok(lq.skor >= 95, `${style} lint score must be ≥95, got ${lq.skor}: ${lq.saran.join(' | ')}`)
  }
})

test('kanvas_document import_xlsx create_report produces multi-page KPI + Chart + Table report with Browser Visual QA >= 95', { skip: !cariBrowser(), timeout: 90000 }, async () => {
  const home = mkdtempSync(join(tmpdir(), 'kanvas-phase6-qa-'))
  const prevHome = process.env.KANVAS_HOME
  process.env.KANVAS_HOME = home
  try {
    // Realistic multi-sheet Excel workbook (monthly revenue trend + regional performance + channel mix)
    const xlsxBuf = writeXlsx({
      sheets: [
        {
          name: 'Tren Bulanan',
          headers: ['Bulan', 'Omzet', 'Target', 'Varians'],
          rows: [
            ['Jan', 120000000, 115000000, '+4.3%'],
            ['Feb', 136000000, 125000000, '+8.8%'],
            ['Mar', 148000000, 140000000, '+5.7%'],
            ['Apr', 142000000, 145000000, '-2.1%'],
            ['Mei', 169000000, 155000000, '+9.0%'],
            ['Jun', 194000000, 175000000, '+10.9%']
          ],
          formats: ['', 'currency', 'currency', '']
        },
        {
          name: 'Performa Cabang',
          headers: ['Cabang', 'Penjualan', 'Varians'],
          rows: [
            ['Jakarta', 248000000, '+14.2%'],
            ['Surabaya', 192000000, '+9.1%'],
            ['Bandung', 156000000, '+5.4%'],
            ['Semarang', 114000000, '-3.2%'],
            ['Medan', 96000000, '-6.8%']
          ],
          formats: ['', 'currency', '']
        },
        {
          name: 'Komposisi Kanal',
          headers: ['Kanal', 'Porsi'],
          rows: [['Enterprise', 44], ['Direct Web', 28], ['Partner', 18], ['Marketplace', 10]],
          formats: ['', 'percent']
        }
      ]
    })
    writeFileSync(join(home, 'kinerja-semester.xlsx'), xlsxBuf)

    const { documentAction, mulaiStudio } = await import('../server/studio.js')
    const { render } = await import('../server/render.js')

    // Re-import via dynamic query-less path? Note RUANG is bound at module load time;
    // write the xlsx inside the active workspace or spawn a subprocess if RUANG differs!
    const { RUANG } = await import('../server/ruang.js')
    const targetFile = `phase6-kinerja-${Date.now().toString(36)}.xlsx`
    const targetPath = join(RUANG, targetFile)
    writeFileSync(targetPath, xlsxBuf)

    const res = await documentAction({ action: 'import_xlsx', file: targetFile, create_report: true })
    assert.equal(res.ok, true)
    assert.ok(res.file && /\.kanvas\.json$/i.test(res.file))
    const reportPath = join(RUANG, res.file)
    try {
      const doc = JSON.parse(readFileSync(reportPath, 'utf8'))
      // Cover + (Insight + Table) * 3 sheets = 7 pages
      assert.equal(doc.artboards.length, 7, `expected 7 pages, got ${doc.artboards.length}`)
      // Verify all 3 chart families appear natively: line (trend w/ target), hbar (branches), donut (channel mix)
      const allEls = doc.artboards.flatMap(ab => ab.elemen)
      assert.ok(allEls.some(e => e.tipe === 'path' && /Line$/.test(e.nama || '')), 'must include editable Line chart')
      assert.ok(allEls.some(e => e.tipe === 'kotak' && /^Track /.test(e.nama || '')), 'must include editable Horizontal Bar chart')
      assert.ok(allEls.some(e => e.tipe === 'path' && /^Slice /.test(e.nama || '')), 'must include editable Donut chart')
      assert.ok(!allEls.some(e => e.tipe === 'gambar'), 'report must be 100% native editable elements, zero raster charts')

      const studio = await mulaiStudio({ port: 0, diam: true })
      try {
        const qa = await render(studio, { file: res.file, mode: 'qa_only' })
        assert.equal(qa.ok, true, qa.error)
        assert.equal(qa.masalah.length, 0, `Browser QA issues: ${qa.masalah.join('; ')}`)
        assert.ok(qa.skor >= 95, `Browser Visual QA score must be >= 95, got ${qa.skor}: ${qa.saran.join(' | ')}`)
      } finally {
        studio.server.close()
      }
    } finally {
      rmSync(targetPath, { force: true })
      rmSync(reportPath, { force: true })
    }
  } finally {
    if (prevHome === undefined) delete process.env.KANVAS_HOME; else process.env.KANVAS_HOME = prevHome
    rmSync(home, { recursive: true, force: true })
  }
})

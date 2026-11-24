// Server MCP Kanvas Studio (stdio, JSON-RPC 2.0, satu pesan per baris).
// Agent mana pun yang bisa MCP (Claude Code, Codex, Hermes, Cursor, …) bisa membuat & mengedit desain,
// melihat hasilnya sebagai gambar, lalu mengekspor ke folder pilihan user. Studio (UI) ikut jalan otomatis.
import { readFileSync, existsSync, readdirSync, statSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve, extname, basename, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync as daftarFile } from 'node:fs'
import { RUANG, siapkanRuang, jalur, bacaDesain, tulisDesain, tandaiAgen, aktif } from './ruang.js'
import { mulaiStudio, bukaDiOS, salinKeFolder } from './studio.js'
import { terapkanOps, desainBaru, normalisasi, PRESET, cariIkon, dataIkon } from './ops.js'
import { render } from './render.js'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSI = JSON.parse(readFileSync(join(AKAR, 'package.json'), 'utf8')).version
const PANDUAN = readFileSync(join(AKAR, 'docs/FORMAT.md'), 'utf8')
let STUDIO = null, STUDIO_JANJI = null, sudahBuka = false

async function studio() {
  if (STUDIO) return STUDIO
  if (STUDIO_JANJI) return STUDIO_JANJI
  const port = Number(process.env.KANVAS_PORT) || 4848
  // port dipakai (mis. studio lain sedang terbuka): jalankan studio sendiri di port acak.
  // Keduanya membaca file ruang kerja yang sama, jadi UI yang sudah terbuka tetap ikut berubah.
  STUDIO_JANJI = (async () => {
    try { STUDIO = await mulaiStudio({ port, diam: true }) }
    catch { STUDIO = await mulaiStudio({ port: 0, diam: true }) }
    return STUDIO
  })().finally(() => { STUDIO_JANJI = null })
  return STUDIO_JANJI
}
async function bukaStudio(paksa, file) {
  const s = await studio()
  if ((paksa || !sudahBuka) && process.env.KANVAS_NO_OPEN !== '1') { bukaDiOS(s.url + (file ? '/?buka=' + encodeURIComponent(file) : '/')); sudahBuka = true }
  return s.url
}


// template bawaan (templates/*.kanvas.json)
const TEMPLATE = (() => { try { return daftarFile(join(AKAR, 'templates')).filter(f => f.endsWith('.kanvas.json')).map(f => JSON.parse(readFileSync(join(AKAR, 'templates', f), 'utf8'))) } catch { return [] } })()
const daftarDesain = () => {
  const out = []
  const jelajah = (dir, d = 0) => { if (d > 3) return; for (const x of readdirSync(dir, { withFileTypes: true })) {
    if (x.name.startsWith('.') || x.name === 'preview' || x.name === 'node_modules') continue
    const p = join(dir, x.name)
    if (x.isDirectory()) jelajah(p, d + 1)
    else if (/\.kanvas\.json$/i.test(x.name)) out.push({ file: relative(RUANG, p).split(sep).join('/'), diubah: new Date(statSync(p).mtimeMs).toISOString() })
  } }
  jelajah(RUANG); return out.sort((a, b) => b.diubah.localeCompare(a.diubah))
}
const namaFile = judul => {
  const dasar = String(judul || 'design').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'design'
  let f = dasar + '.kanvas.json', n = 2
  while (existsSync(join(RUANG, f))) f = `${dasar}-${n++}.kanvas.json`
  return f
}
const fileDari = a => { const f = String(a.file || aktif()?.file || ''); if (!f) throw new Error('Give a "file" (see kanvas_status).'); return f }
const ringkas = doc => doc.artboards.map(ab => `${ab.id} "${ab.nama}" ${ab.w}×${ab.h} · ${ab.elemen.length} elements`).join('\n')
const teks = t => ({ type: 'text', text: t })

const ALAT = [
  { name: 'kanvas_guide', description: 'Read FIRST. Document format, element types (text, shapes, images, vector paths), edit operations, design system (spacing, type scale) and layout recipes.', inputSchema: { type: 'object', properties: {} },
    run: () => [teks(PANDUAN)] },
  { name: 'kanvas_status', description: 'Workspace, studio URL, the design open on the user\'s canvas, the elements the user selected ("this one"), and all designs.', inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const url = await studio().then(s => s.url), buka = aktif()
      let komentarTerbuka = 0; try { komentarTerbuka = (bacaDesain(buka?.file).komentar || []).filter(k => !k.selesai).length } catch {}
      return [teks(JSON.stringify({ ruangKerja: RUANG, studio: url, terbuka: buka, komentarTerbuka, ...(komentarTerbuka ? { petunjuk: 'The user left comments on this design: read them with kanvas_comments.' } : {}), desain: daftarDesain().slice(0, 50) }, null, 1))]
    } },
  { name: 'kanvas_create', description: 'Create a new design; it opens on the user\'s canvas automatically. Choose `ukuran` from the brief (A4 poster → a4, deck → slide, Instagram feed → ig-feed, story → ig-story, YouTube thumbnail → yt-thumbnail, logo → logo) or pass `template`. Returns the file name to use in other tools.',
    inputSchema: { type: 'object', required: ['judul'], properties: {
      judul: { type: 'string', description: 'Title, e.g. "Promo Poster March"' },
      ukuran: { type: 'string', enum: Object.keys(PRESET), description: 'Preset size of the first artboard' },
      template: { type: 'string', description: 'Start from a built-in template id (see kanvas_templates) instead of a blank artboard' },
      w: { type: 'number' }, h: { type: 'number' }, nama: { type: 'string', description: 'First artboard name' }, bg: { description: 'Background color or gradient' } } },
    run: async a => {
      let doc
      if (a.template) {
        const t = TEMPLATE.find(x => x.meta?.id === a.template) || (() => { throw new Error(`template "${a.template}" does not exist. Options: ${TEMPLATE.map(x => x.meta.id).join(', ')}`) })()
        doc = JSON.parse(JSON.stringify(t)); doc.judul = a.judul; doc.dariTemplate = t.meta.id; delete doc.meta
      } else doc = desainBaru(a)
      const file = namaFile(a.judul)
      tulisDesain(file, doc); tandaiAgen('kanvas_create', file); const url = await bukaStudio(false, file)
      return [teks(`Created: ${file}\n${ringkas(doc)}\nThe user watches live at ${url} (tell them this link if they don't see it).\nNext: kanvas_edit with file "${file}".`)]
    } },
  { name: 'kanvas_read', description: 'Read a design document (JSON). Default = the design open on the canvas.', inputSchema: { type: 'object', properties: { file: { type: 'string' } } },
    run: a => { const f = fileDari(a); return [teks(`file: ${f}\n` + JSON.stringify(bacaDesain(f)))] } },
  { name: 'kanvas_edit', description: 'Apply edit operations to a design (atomic). The user sees a cursor move to each element you change. Ops: artboard, ubah_artboard, hapus_artboard, tambah (groups may nest "anak"), ubah, hapus, urut, judul, grupkan, lepas_grup — see kanvas_guide. Prefer auto-layout groups for cards, buttons, lists and grids.',
    inputSchema: { type: 'object', required: ['ops'], properties: { file: { type: 'string', description: 'Design file (default: the one open on the canvas)' }, ops: { type: 'array', items: { type: 'object' } } } },
    run: async a => {
      const f = fileDari(a), { doc, hasil } = terapkanOps(bacaDesain(f), a.ops)
      tulisDesain(f, doc); tandaiAgen('kanvas_edit', f); await bukaStudio(false, f)
      return [teks(`OK ${f}\n- ${hasil.join('\n- ')}\n\nArtboards:\n${ringkas(doc)}\nTip: kanvas_view to check the result.`)]
    } },
  { name: 'kanvas_view', description: 'Render artboards to PNG so you can SEE the design, plus an automatic check: ISSUES (must fix) and SUGGESTIONS. Use after each big pass and before finishing.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, artboard: { type: 'string', description: 'Artboard id; default all (max 6)' } } },
    run: async a => {
      const f = fileDari(a), s = await studio()
      const doc = normalisasi(bacaDesain(f)), maks = Math.max(...doc.artboards.map(x => Math.max(x.w, x.h)), 1)
      const r = await render(s, { file: f, artboard: a.artboard, format: 'png', skala: Math.min(1, 1400 / maks) })
      if (!r.ok) return [teks('Render failed: ' + r.error)]
      const isi = [teks(`${f} · ${r.masalah.length ? `ISSUES (${r.masalah.length}), fix these:\n✗ ${r.masalah.join('\n✗ ')}` : 'ISSUES: none ✓'}${r.saran.length ? `\nSUGGESTIONS (${r.saran.length}):\n• ${r.saran.join('\n• ')}` : ''}`)]
      for (const x of r.hasil.slice(0, 6)) isi.push(teks(`Artboard ${x.id} "${x.nama}" ${x.w}×${x.h}:`), { type: 'image', data: x.data.split(',')[1], mimeType: 'image/png' })
      if (r.hasil.length > 6) isi.push(teks(`(${r.hasil.length - 6} more artboards — pass "artboard" to view them)`))
      return isi
    } },
  { name: 'kanvas_export', description: 'Save the finished design to a folder the user chooses: png / jpg / svg (one file per artboard), pdf (all artboards), or kanvas (editable .kanvas.json + its images).',
    inputSchema: { type: 'object', required: ['folder', 'format'], properties: {
      file: { type: 'string' }, folder: { type: 'string', description: 'Absolute destination folder' },
      format: { type: 'string', enum: ['png', 'jpg', 'svg', 'pdf', 'kanvas'] }, artboard: { type: 'string' },
      skala: { type: 'number', description: 'Resolution multiplier for png/jpg/pdf, 1–4 (default 2)' } } },
    run: async a => {
      const f = fileDari(a), dest = resolve(String(a.folder))
      if (a.format === 'kanvas') { const r = salinKeFolder(f, dest); return [teks(`Saved: ${r.path}${r.gambar ? ` (+${r.gambar} image(s))` : ''}`)] }
      const s = await studio(), r = await render(s, { file: f, artboard: a.artboard, format: a.format, skala: a.skala || 2 })
      if (!r.ok) return [teks('Export failed: ' + r.error)]
      mkdirSync(dest, { recursive: true })
      const dasar = basename(f).replace(/\.kanvas\.json$/i, ''), ditulis = [], dipakai = new Set()
      for (const x of r.hasil) {
        let nama = a.format === 'pdf' ? `${dasar}.pdf` : `${dasar}-${String(x.nama || x.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || x.id}.${a.format}`
        if (dipakai.has(nama)) nama = `${dasar}-${String(x.nama || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artboard'}-${x.id}.${a.format}`
        dipakai.add(nama)
        const p = join(dest, nama)
        writeFileSync(p, a.format === 'svg' ? x.data : Buffer.from(x.data.split(',')[1], 'base64')); ditulis.push(p)
      }
      return [teks('Saved:\n' + ditulis.join('\n'))]
    } },
  { name: 'kanvas_templates', description: 'List built-in templates (pitch deck, poster, Instagram, YouTube thumbnail, pricing…). Start one with kanvas_create { judul, template }, then kanvas_read to see its parts and kanvas_edit to replace the text, colors, icons. Templates use auto-layout and components, so editing a component master updates every copy.',
    inputSchema: { type: 'object', properties: {} },
    run: () => [teks(TEMPLATE.map(t => `${t.meta.id} — ${t.meta.nama} (${t.meta.kategori}, ${t.artboards.length} artboard ${t.artboards[0].w}×${t.artboards[0].h}): ${t.meta.deskripsi}`).join('\n'))] },
  { name: 'kanvas_comments', description: 'Read the comments the user pinned on the design: what they want changed, on which artboard, at which position and on which element (id, type, text). Address each with kanvas_edit, then kanvas_resolve_comment.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, semua: { type: 'boolean', description: 'Also list resolved comments' } } },
    run: a => {
      const f = fileDari(a), doc = normalisasi(bacaDesain(f)), daftar = (doc.komentar || []).filter(k => a.semua || !k.selesai)
      if (!daftar.length) return [teks(`${f}: no ${a.semua ? '' : 'open '}comments.`)]
      const cari = id => { for (const ab of doc.artboards) { const e = ab.elemen.find(x => x.id === id); if (e) return e } return null }
      return [teks(`${f} · ${daftar.length} comment(s):\n` + daftar.map(k => {
        const ab = doc.artboards.find(x => x.id === k.artboard), e = k.elemen && cari(k.elemen)
        const el = e ? ` · element ${e.id} (${e.tipe}${e.nama ? ' "' + e.nama + '"' : ''}${e.teks ? ': "' + String(e.teks).slice(0, 60) + '"' : ''}, x ${e.x} y ${e.y} w ${e.w}${e.h ? ' h ' + e.h : ''})` : ' · no element (a spot on the artboard)'
        return `- ${k.id}${k.selesai ? ' [resolved]' : ''} · artboard ${k.artboard} "${ab?.nama || '?'}" at x ${k.x} y ${k.y}${el}\n  "${k.teks}"${k.balasan ? `\n  reply: ${k.balasan}` : ''}`
      }).join('\n'))]
    } },
  { name: 'kanvas_resolve_comment', description: 'Mark comment(s) as resolved after you changed the design, with a short reply the user sees on the pin (e.g. "Logo reduced to 120 px and centered").',
    inputSchema: { type: 'object', required: ['balasan'], properties: { file: { type: 'string' }, id: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } }, balasan: { type: 'string', description: 'Short reply to the user' } } },
    run: a => {
      const f = fileDari(a), doc = bacaDesain(f), ids = (Array.isArray(a.ids) ? a.ids : a.id ? [a.id] : []).filter(Boolean)
      if (!ids.length) throw new Error('Give "id" or "ids" (see kanvas_comments)')
      const ada = new Map((doc.komentar || []).map(k => [k.id, k]))
      const hilang = ids.filter(i => !ada.has(i)); if (hilang.length) throw new Error('Comment not found: ' + hilang.join(', ') + ' (see kanvas_comments)')
      for (const i of ids) Object.assign(ada.get(i), { selesai: true, balasan: String(a.balasan).slice(0, 500), waktuSelesai: new Date().toISOString() })
      tulisDesain(f, doc); tandaiAgen('kanvas_resolve_comment', f)
      const sisa = (doc.komentar || []).filter(k => !k.selesai).length
      return [teks(`Resolved ${ids.join(', ')}. ${sisa} open comment(s) left.`)]
    } },
  { name: 'kanvas_icons', description: 'Search 2000+ open-source line icons (Lucide). Use the name in kanvas_edit as { "tipe": "ikon", "ikon": "<name>", "w": 64, "warna": "#101634" }. Search in English: coffee, arrow-right, check, shield, chart, user…',
    inputSchema: { type: 'object', properties: { cari: { type: 'string', description: 'Keywords, e.g. "coffee cup" or "arrow right"' }, maks: { type: 'number' } } },
    run: a => { const d = dataIkon(), n = cariIkon(a.cari, Math.min(80, a.maks || 30)); return [teks(n.length ? n.map(x => `${x}${d.tag[x] ? ' — ' + d.tag[x].split(' ').slice(0, 6).join(' ') : ''}`).join('\n') : 'No icons found. Try other English keywords.')] } },
  { name: 'kanvas_import_image', description: 'Copy an image file (png/jpg/webp/svg/gif) from the computer into the workspace so it can be used as "src" of a gambar element. Returns the src to use.',
    inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string', description: 'Absolute path of the image' }, nama: { type: 'string' } } },
    run: a => {
      const asal = resolve(String(a.path)), ext = extname(asal).toLowerCase()
      if (!['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext) || !existsSync(asal)) throw new Error('Not an existing image file: ' + asal)
      const nama = (a.nama ? String(a.nama).replace(/[^a-z0-9._-]+/gi, '-') : basename(asal, ext)).slice(0, 60) + ext
      const src = 'gambar/' + nama, tujuan = jalur(src)
      mkdirSync(dirname(tujuan), { recursive: true }); copyFileSync(asal, tujuan)
      return [teks(`src: "${src}"`)]
    } },
  { name: 'kanvas_open', description: 'Open Kanvas Studio in the user\'s browser so they can watch and edit.', inputSchema: { type: 'object', properties: {} },
    run: async () => { const url = await bukaStudio(true); return [teks(`Studio opened in the user's browser: ${url}\nIf nothing appeared, tell the user to open ${url} themselves (it can be bookmarked).`)] } }
]

export async function jalankanMcp() {
  siapkanRuang()
  const kirim = o => process.stdout.write(JSON.stringify(o) + '\n')
  let sisa = '', antre = Promise.resolve()
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', potong => {
    sisa += potong
    let i
    while ((i = sisa.indexOf('\n')) >= 0) {
      const baris = sisa.slice(0, i).trim(); sisa = sisa.slice(i + 1)
      if (!baris) continue
      let m; try { m = JSON.parse(baris) } catch { kirim({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue }
      // antrekan secara berurutan agar dua tool call paralel tidak saling menimpa file desain
      antre = antre.then(() => tangani(m)
        .then(hasil => { if (m.id !== undefined && hasil !== undefined) kirim({ jsonrpc: '2.0', id: m.id, result: hasil }) })
        .catch(e => { if (m.id !== undefined) kirim({ jsonrpc: '2.0', id: m.id, error: { code: e.code || -32603, message: e.message } }) }))
    }
  })
  process.stdin.on('end', () => antre.finally(() => process.exit(0)))
}

async function tangani(m) {
  if (m.method === 'initialize') return {
    protocolVersion: m.params?.protocolVersion || '2025-06-18',
    capabilities: { tools: {} },
    serverInfo: { name: 'kanvas-studio', version: VERSI },
    instructions: 'Kanvas Studio: a live design canvas the user is watching. Call kanvas_guide once, then kanvas_status. For a new design pick the size from the brief yourself (A4/poster/flyer → a4, A3/A2 → a3/a2, deck/slides/presentation → slide, Instagram feed → ig-feed, square post → ig-square, story → ig-story, YouTube thumbnail → yt-thumbnail, logo → logo, web banner → banner-web) or start from a matching kanvas_templates entry, then kanvas_create: the user\'s canvas switches to it automatically. Edit with kanvas_edit in small passes so the user can watch, check with kanvas_view before finishing, save with kanvas_export.'
  }
  if (m.method === 'ping') return {}
  if (m.method === 'tools/list') return { tools: ALAT.map(({ run, ...t }) => t) }
  if (m.method === 'tools/call') {
    const alat = ALAT.find(t => t.name === m.params?.name)
    if (!alat) return { content: [teks('Unknown tool: ' + m.params?.name)], isError: true }
    const f = m.params.arguments?.file
    tandaiAgen(alat.name, f)
    try { const content = await alat.run(m.params.arguments || {}); if (!['kanvas_create', 'kanvas_edit', 'kanvas_resolve_comment'].includes(alat.name)) tandaiAgen(alat.name, f); return { content } }
    catch (e) { return { content: [teks('Error: ' + e.message)], isError: true } }
  }
  if (m.method?.startsWith('notifications/')) return undefined
  if (m.id !== undefined) throw Object.assign(new Error('Method not found: ' + m.method), { code: -32601 })
}

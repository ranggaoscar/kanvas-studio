// App lokal Kanvas Studio: UI kanvas yang sama dengan plugin Hermes, dijalankan di browser biasa,
// dengan file di "ruang kerja" yang dikelola server lokal (bin/kanvas.js).
// Mode render (render.html): tidak menampilkan UI, hanya menggambar desain jadi PNG/SVG/PDF + memeriksa, untuk agent.
import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import plugin, { engine } from '../desktop/plugin.js'
import { host } from './host.js'
import { periksa } from './lint.js'

const api = (jalur, body) => fetch('/api/' + jalur, {
  method: body ? 'POST' : 'GET',
  headers: { 'X-Kanvas': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined
}).then(r => r.json()).catch(e => ({ ok: false, error: 'io-error', message: e.message }))
const q = encodeURIComponent

const INFO = await api('info')
// server yang jalan harus versi yang sama dengan halaman ini (setelah update, server lama perlu di-restart)
if (!INFO.ok || INFO.build !== __BUILD__) {
  const pesan = !INFO.ok ? 'The Kanvas Studio server did not answer correctly.' : 'Kanvas Studio was just updated, but the running server is an older version. Restart it (stop and run `kanvas` again, or restart the agent that uses the Kanvas MCP).'
  if (window.KANVAS_RENDER) document.getElementById('out').textContent = JSON.stringify({ ok: false, error: pesan })
  else document.getElementById('app').innerHTML = `<div style="display:grid;place-items:center;height:100%;background:#101634;color:#F3F0E9;font:15px system-ui"><div style="max-width:480px;line-height:1.6"><h2>Restart needed</h2><p>${pesan.replace(/`([^`]+)`/g, '<code>$1</code>')}</p></div></div>`
  document.title = window.KANVAS_RENDER ? 'DONE' : 'Kanvas Studio · restart needed'
  throw new Error(pesan)
}
const kunci = k => 'kanvas:' + INFO.ruangKerja + ':' + k

// ruang kerja = folder 'data' bagi UI (sama seperti folder data plugin di Hermes)
const files = {
  dataPath: INFO.ruangKerja,
  folders: async () => [],
  list: (f, dir) => api('list?dir=' + q(dir || '')),
  readText: (f, p) => api('read?path=' + q(p)),
  writeText: (f, p, text) => api('write', { path: p, text }),
  stat: (f, p) => api('stat?path=' + q(p)),
  readDataUrl: (f, p) => api('dataurl?path=' + q(p))
}
const ctx = {
  files,
  storage: {
    get: (k, d) => { const v = localStorage.getItem(kunci(k)); return v == null ? d : JSON.parse(v) },
    set: (k, v) => localStorage.setItem(kunci(k), JSON.stringify(v)),
    remove: k => localStorage.removeItem(kunci(k))
  },
  os: {
    writeClipboard: async t => { try { await navigator.clipboard.writeText(t); return true } catch { return false } },
    revealPath: p => api('reveal', { path: p }).then(r => !!r.ok)
  },
  // simpan ke folder pilihan user lewat dialog pilih-folder bawaan browser (Chrome/Edge)
  simpanKe: async (folder, file) => {
    if (!window.showDirectoryPicker) { host.notify({ message: 'This browser cannot pick folders. Use Chrome or Edge, or Export → Design file.' }); return { ok: false } }
    let dir; try { dir = await showDirectoryPicker({ id: 'kanvas-simpan', mode: 'readwrite' }) } catch { return { ok: false } }
    const tulis = async (d, path, isi) => {
      const bag = path.replace(/\\/g, '/').split('/'); for (const x of bag.slice(0, -1)) d = await d.getDirectoryHandle(x, { create: true })
      const w = await (await d.getFileHandle(bag.at(-1), { create: true })).createWritable(); await w.write(isi); await w.close()
    }
    const r = await files.readText('data', file); if (!r.ok) return { ok: false }
    await tulis(dir, file.replace(/\\/g, '/').split('/').pop(), r.text)
    let n = 0
    for (const src of gambarDipakai(JSON.parse(r.text))) {
      const g = await files.readDataUrl('data', src)
      if (g.ok) { await tulis(dir, src, await (await fetch(g.url)).blob()); n++ }
    }
    return { ok: true, path: dir.name + '/' + file.replace(/\\/g, '/').split('/').pop() + (n ? ` (+${n} image${n > 1 ? 's' : ''})` : '') }
  },
  muatIkon: () => fetch('/dist/ikon.json').then(r => r.json()),
  muatTemplate: () => fetch('/dist/template.json').then(r => r.json()),
  onDispose: () => {}, setInterval: (f, ms) => setInterval(f, ms),
  registerMany: list => KONTRIB.push(...list), register: c => KONTRIB.push(c)
}
const KONTRIB = []
const gambarDipakai = doc => [...new Set((doc.artboards || []).flatMap(ab => (ab.elemen || []).filter(e => e.tipe === 'gambar' && e.src && !/^(data:|https?:)/.test(e.src)).map(e => String(e.src))))]
  .filter(s => /\.(png|jpe?g|webp|gif|svg)$/i.test(s) && !s.split(/[\\/]/).some(x => x.startsWith('.') || x === '..'))

if (window.KANVAS_RENDER) {
  // ---------------- mode render untuk agent ----------------
  const out = document.getElementById('out')
  try { out.textContent = JSON.stringify(await render(new URLSearchParams(location.search))) }
  catch (e) { out.textContent = JSON.stringify({ ok: false, error: String(e?.message || e) }) }
  document.title = 'DONE'
} else {
  // ---------------- mode studio ----------------
  const buka = new URLSearchParams(location.search).get('buka')
  if (buka) { ctx.storage.set('file', buka); history.replaceState(null, '', '/') }
  ctx.storage.set('sesiAgent', 'agent')   // bar agent menyala saat agent (lewat MCP) sedang bekerja
  plugin.register(ctx)
  const pane = KONTRIB.find(c => c.id === 'pane')
  createRoot(document.getElementById('app')).render(h(pane.render))
  const cekAgen = async () => {
    const r = await api('agen')
    const lama = host.state.busyBySession.get().agent
    if (!!r.sibuk !== !!lama) host.state.busyBySession.set({ agent: !!r.sibuk })
    // pindah ke desain yang dikerjakan agent ditangani plugin (cekAgen), sama dengan panel Hermes
  }
  setInterval(cekAgen, 900)
}

async function render(p) {
  const file = p.get('file'), target = p.get('artboard'), format = p.get('format') || 'png'
  const skala = Math.max(0.1, Math.min(4, Number(p.get('skala')) || 1))
  const r = await files.readText('data', file)
  if (!r.ok) return { ok: false, error: r.message || r.error }
  engine.S.ctx = ctx; engine.S.folder = { id: 'data', path: INFO.ruangKerja, data: true }
  const doc = engine.normalisasi(JSON.parse(r.text))
  // muat semua font yang dipakai sebelum mengukur/menggambar
  await engine.muatFontDoc(doc)   // Google Fonts apa pun yang dipakai desain
  await document.fonts.ready
  engine.terapkanTata(doc)   // auto-layout dihitung setelah font siap (ukuran teks akurat)
  const gambarAda = new Set()
  for (const ab of doc.artboards) for (const e of ab.elemen) if (e.tipe === 'gambar' && e.src) {
    if (/^data:/i.test(e.src) || (/^https?:/i.test(e.src) && engine.urlGambarAman(e.src))) gambarAda.add(e.src)
    else if (!/^https?:/i.test(e.src) && (await files.stat('data', e.src)).exists) gambarAda.add(e.src)
  }
  const cek = periksa(doc, { layoutTeks: engine.layoutTeks, fontStr: engine.fontStr, adaGambar: s => gambarAda.has(s), fontGagal: engine.fontGagal })
  const pilih = doc.artboards.filter(ab => !target || ab.id === target)
  const hasil = []
  if (format === 'pdf') {
    const hal = []
    for (const ab of pilih) {
      const c = await engine.gambarAb(ab, skala)
      hal.push({ w: ab.w, h: ab.h, pw: c.width, ph: c.height, jpg: new Uint8Array(await (await engine.keBlob(c, 'image/jpeg', 0.92)).arrayBuffer()) })
    }
    const buf = new Uint8Array(await engine.buatPdf(hal).arrayBuffer())
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    hasil.push({ id: 'semua', data: 'data:application/pdf;base64,' + btoa(bin) })
  } else for (const ab of pilih) {
    if (format === 'svg') hasil.push({ id: ab.id, nama: ab.nama, data: await engine.svgAb(ab) })
    else hasil.push({ id: ab.id, nama: ab.nama, w: ab.w, h: ab.h, data: (await engine.gambarAb(ab, skala)).toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92) })
  }
  return { ok: true, judul: doc.judul, hasil, ...cek }
}

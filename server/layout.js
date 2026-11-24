// Deterministic server-side text metrics & auto-layout resolver (mirrors desktop/plugin.js terapkanTata).
// Enables instant, zero-browser layout resolution for Smart Resize, editable PPTX export, and Design-to-Code.

const FONT_FACTOR = {
  'bebas neue': 0.40, 'anton': 0.44, 'oswald': 0.44, 'impact': 0.47,
  'cormorant garamond': 0.46, 'playfair display': 0.51, 'instrument serif': 0.47, 'dm serif display': 0.52,
  'inter': 0.53, 'dm sans': 0.53, 'plus jakarta sans': 0.54, 'lato': 0.51, 'ibm plex sans': 0.53,
  'poppins': 0.57, 'montserrat': 0.58, 'space grotesk': 0.55, 'bricolage grotesque': 0.55,
  'syne': 0.62, 'archivo black': 0.61, 'fraunces': 0.54, 'cinzel': 0.60,
  'ibm plex mono': 0.60, 'space mono': 0.60, 'jetbrains mono': 0.60, 'dm mono': 0.60,
  'arial': 0.52, 'georgia': 0.54, 'segoe ui': 0.51
}

export function padding4(p) {
  if (Array.isArray(p)) {
    const a = p.map(v => Number(v) || 0)
    return a.length === 2 ? [a[0], a[1], a[0], a[1]] : a.length >= 4 ? a.slice(0, 4) : [a[0] || 0, a[0] || 0, a[0] || 0, a[0] || 0]
  }
  const n = Number(p) || 0
  return [n, n, n, n]
}

export function charWidth(el) {
  const f = FONT_FACTOR[String(el.font || 'Plus Jakarta Sans').toLowerCase().trim()] ?? 0.55
  const weightBoost = 1 + Math.max(0, (Number(el.tebal) || 400) - 400) / 3600
  const capBoost = el.kapital ? 1.12 : 1
  return (Number(el.ukuran) || 32) * f * weightBoost * capBoost
}

export function measureLine(str, el) {
  const s = String(str || '')
  if (!s.length) return 0
  const sp = Number(el.spasi) || 0
  return s.length * charWidth(el) + sp * Math.max(0, s.length - 1)
}

export function lebarAlamiServer(el) {
  const isi = el.kapital ? String(el.teks ?? '').toUpperCase() : String(el.teks ?? '')
  return Math.ceil(Math.max(1, ...isi.split('\n').map(s => measureLine(s, el)))) + 4
}

export function layoutTeksServer(el) {
  const W = Math.max(1, Number(el.w) || 400)
  const isi = el.kapital ? String(el.teks ?? '').toUpperCase() : String(el.teks ?? '')
  const lines = []
  for (const par of isi.split('\n')) {
    let line = ''
    for (const tok of par.split(/(\s+)/)) {
      const next = line + tok
      if (measureLine(next.trimEnd(), el) > W && line.trim()) {
        lines.push(line.trimEnd())
        line = tok.trimStart()
      } else {
        line = next
      }
    }
    lines.push(line.trimEnd())
  }
  const lh = (Number(el.ukuran) || 32) * (Number(el.lh) || 1.2)
  const lw = Math.max(0, ...lines.map(s => measureLine(s, el)))
  return { lines, lh, lw, h: Math.max(lh, lines.length * lh) }
}

export function tinggiServer(el) {
  return el.tipe === 'teks' ? layoutTeksServer(el).h : (Number(el.h) || 100)
}

const isGrup = e => e?.tipe === 'grup'

function anakDari(ab) {
  const m = new Map()
  for (const e of ab.elemen || []) {
    if (e.induk) {
      if (!m.has(e.induk)) m.set(e.induk, [])
      m.get(e.induk).push(e)
    }
  }
  return m
}

function keturunan(ab, id, m) {
  const out = []
  const jalan = x => {
    for (const c of m.get(x) || []) { out.push(c); jalan(c.id) }
  }
  jalan(id)
  return out
}

// Compute auto-layout positions & sizes in-place on a document (mutates doc, returns doc)
export function resolveLayout(doc) {
  for (const ab of doc?.artboards || []) {
    const els = ab.elemen || []
    for (const e of els) if (e.tipe === 'teks' && e.lebar === 'peluk') e.w = lebarAlamiServer(e)
    if (!els.some(isGrup)) continue
    const m = anakDari(ab), byId = new Map(els.map(e => [e.id, e]))
    const geserTurunan = (g, dx, dy) => {
      if (!dx && !dy) return
      for (const d of keturunan(ab, g.id, m)) { d.x = (d.x || 0) + dx; d.y = (d.y || 0) + dy }
    }
    const ukuranEl = e => ({ w: e.w || 100, h: tinggiServer(e) })
    const paksa = new Set()
    for (const g of els) if (isGrup(g) && g.tata) {
      if (g.lebar == null && g.w == null) g.lebar = 'peluk'
      if (g.tinggi == null && g.h == null) g.tinggi = 'peluk'
    }
    const peluk = (g, k) => g[k === 'w' ? 'lebar' : 'tinggi'] === 'peluk'
    const ukur = g => {
      const kids = (m.get(g.id) || []).filter(c => !c.sembunyi)
      kids.filter(isGrup).forEach(ukur)
      if (!g.tata || !kids.length) return
      const [pt, pr, pb, pl] = padding4(g.tata.padding), baris = g.tata.arah === 'baris', jarak = Number(g.tata.jarak) || 0
      const uk = kids.map(ukuranEl)
      const utama = uk.reduce((a, u) => a + (baris ? u.w : u.h), 0) + jarak * (kids.length - 1)
      const silang = Math.max(0, ...uk.map(u => baris ? u.h : u.w))
      if (peluk(g, 'w') && !paksa.has(g.id + ':w')) g.w = Math.round((baris ? utama : silang) + pl + pr)
      if (peluk(g, 'h') && !paksa.has(g.id + ':h')) g.h = Math.round((baris ? silang : utama) + pt + pb)
    }
    const tempatkan = g => {
      const kids = (m.get(g.id) || []).filter(c => !c.sembunyi)
      if (g.tata && kids.length) {
        const [pt, pr, pb, pl] = padding4(g.tata.padding), baris = g.tata.arah === 'baris', jarak = Number(g.tata.jarak) || 0
        const x0 = (g.x || 0) + pl, y0 = (g.y || 0) + pt, iw = Math.max(0, (g.w || 0) - pl - pr), ih = Math.max(0, (g.h || 0) - pt - pb)
        const dalamUtama = baris ? iw : ih, dalamSilang = baris ? ih : iw, rata = g.tata.rata || 'awal'
        for (const c of kids) {
          const silangSendiri = baris ? c.tinggi : c.lebar
          const isiSilang = silangSendiri === 'isi' || (rata === 'regang' && silangSendiri !== 'peluk' && silangSendiri !== 'tetap')
          if (!isiSilang) continue
          if (baris) { if (c.tipe !== 'teks') { c.h = Math.round(dalamSilang); paksa.add(c.id + ':h') } }
          else { c.w = Math.round(dalamSilang); paksa.add(c.id + ':w') }
        }
        kids.filter(isGrup).forEach(ukur)
        const isiUtama = c => (baris ? c.lebar : c.tinggi) === 'isi'
        const tetap = kids.filter(c => !isiUtama(c)).reduce((a, c) => a + (baris ? (c.w || 100) : tinggiServer(c)), 0)
        const nIsi = kids.filter(isiUtama).length, sisa = dalamUtama - tetap - jarak * (kids.length - 1)
        for (const c of kids) if (isiUtama(c)) {
          const v = Math.max(1, Math.round(sisa / nIsi))
          if (baris) { c.w = v; paksa.add(c.id + ':w') }
          else if (c.tipe !== 'teks') { c.h = v; paksa.add(c.id + ':h') }
        }
        kids.filter(isGrup).forEach(ukur)
        const ukurUtama = c => baris ? (c.w || 100) : tinggiServer(c), ukurSilang = c => baris ? tinggiServer(c) : (c.w || 100)
        const total = kids.reduce((a, c) => a + ukurUtama(c), 0) + jarak * (kids.length - 1)
        const sebar = g.tata.sebar || 'awal', longgar = Math.max(0, dalamUtama - total)
        let pos = sebar === 'tengah' ? longgar / 2 : sebar === 'akhir' ? longgar : 0
        const antara = sebar === 'antara' && kids.length > 1 ? jarak + longgar / (kids.length - 1) : jarak
        for (const c of kids) {
          const s = ukurSilang(c), off = rata === 'tengah' ? (dalamSilang - s) / 2 : rata === 'akhir' ? dalamSilang - s : 0
          const nx = Math.round(baris ? x0 + pos : x0 + off), ny = Math.round(baris ? y0 + off : y0 + pos)
          if (isGrup(c) && !c.tata) geserTurunan(c, nx - (c.x || 0), ny - (c.y || 0))
          c.x = nx; c.y = ny
          pos += ukurUtama(c) + antara
        }
      }
      kids.filter(isGrup).forEach(tempatkan)
    }
    for (const g of els) if (isGrup(g) && !byId.get(g.induk)) {
      for (let i = 0; i < 3; i++) {
        const jejak = () => keturunan(ab, g.id, m).map(e => `${e.x},${e.y},${e.w},${e.h}`).join('|') + `|${g.w},${g.h}`
        const sebelum = jejak(); paksa.clear(); ukur(g); tempatkan(g)
        if (jejak() === sebelum) break
      }
    }
  }
  return doc
}

// Ubah ikon Lucide (ISC) jadi satu data path SVG per ikon → app/dist/ikon.json
// Format: { lisensi, ikon: { nama: "d" }, tag: { nama: "kata kunci …" } }. Semua ikon: kotak 24×24, garis 2, tanpa isi.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const n = v => Number(v) || 0
function keD([tipe, a]) {
  switch (tipe) {
    // `m` di awal path = mutlak; setelah digabung dengan bentuk lain ia jadi relatif → jadikan `M`.
    // Angka lanjutan setelah `m` berarti garis RELATIF, jadi sisipkan `l` supaya maknanya tetap sama.
    case 'path': {
      const N = '-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?'
      const m = String(a.d).trim().match(new RegExp(`^m\\s*(${N})[\\s,]*(${N})\\s*,?\\s*(.*)$`, 's'))   // hanya `m` kecil
      if (!m) return String(a.d).trim()
      const sisa = m[3]
      return `M${m[1]} ${m[2]}` + (/^[-.\d]/.test(sisa) ? 'l' + sisa : sisa)
    }
    case 'line': return `M${n(a.x1)} ${n(a.y1)}L${n(a.x2)} ${n(a.y2)}`
    case 'polyline': case 'polygon': {
      const t = String(a.points).trim().split(/[\s,]+/).map(Number), out = []
      for (let i = 0; i + 1 < t.length; i += 2) out.push(`${i ? 'L' : 'M'}${t[i]} ${t[i + 1]}`)
      return out.join('') + (tipe === 'polygon' ? 'Z' : '')
    }
    case 'circle': case 'ellipse': {
      const cx = n(a.cx), cy = n(a.cy), rx = n(a.rx ?? a.r), ry = n(a.ry ?? a.r)
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`
    }
    case 'rect': {
      const x = n(a.x), y = n(a.y), w = n(a.width), h = n(a.height), r = Math.min(n(a.rx ?? a.ry), w / 2, h / 2)
      if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`
      return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
    }
    default: throw new Error('bentuk tidak dikenal: ' + tipe)
  }
}

export function bangunIkon(akar) {
  const dir = join(akar, 'node_modules/lucide-static')
  const nodes = JSON.parse(readFileSync(join(dir, 'icon-nodes.json'), 'utf8'))
  const tags = JSON.parse(readFileSync(join(dir, 'tags.json'), 'utf8'))
  const versi = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version
  const ikon = {}, tag = {}
  for (const [nama, bentuk] of Object.entries(nodes)) {
    ikon[nama] = bentuk.map(keD).join('')
    if (tags[nama]?.length) {
      // bersihkan emoji / karakter tak terlihat (mis. ZWJ pada emoji) agar tag pencarian bersih
      const t = tags[nama].join(' ').replace(/[^\x20-\x7e]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (t) tag[nama] = t
    }
  }
  const out = { lisensi: `Lucide v${versi} — ISC License, Copyright (c) Lucide Icons and Contributors (https://lucide.dev)`, kotak: 24, ikon, tag }
  // satu entri per baris agar file mudah di-diff dan tidak jadi satu baris 650 KB
  writeFileSync(join(akar, 'app/dist/ikon.json'), JSON.stringify(out, null, 1))
  return Object.keys(ikon).length
}

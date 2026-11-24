#!/usr/bin/env python3
"""
kanvas_cek.py — Kanvas Studio design checker & preview (for agents).

Usage:
  python kanvas_cek.py "C:\\Desain\\poster.kanvas.json"            # check only
  python kanvas_cek.py "C:\\Desain\\poster.kanvas.json" --preview                  # check + a PNG per artboard
  python kanvas_cek.py "C:\\Desain\\poster.kanvas.json" --preview --artboard a2    # preview one artboard

Output: a list of ISSUES (must fix) and SUGGESTIONS, then the preview PNG paths
(`preview/` folder next to the file). Previews are drawn by the same engine as
the plugin, so they match what the user sees.
No extra libraries; previews need Google Chrome or Microsoft Edge.
"""
import base64, json, math, os, re, shutil, subprocess, sys, tempfile

# ---------- ukuran teks (perkiraan; preview PNG adalah kebenaran akhirnya) ----------
LEBAR_HURUF = {"Bebas Neue": 0.38, "Impact": 0.46, "Playfair Display": 0.5, "Montserrat": 0.57,
               "Poppins": 0.56, "Inter": 0.52, "Plus Jakarta Sans": 0.52, "Segoe UI": 0.5, "Arial": 0.5, "Georgia": 0.52}
TINGGI_NYATA = {}   # id elemen teks -> (tinggi, jumlah baris) hasil ukur browser (diisi saat --preview)

def lebar_teks(s, el):
    f = LEBAR_HURUF.get(el.get("font") or "Plus Jakarta Sans", 0.58)
    tebal = el.get("tebal") or 400
    f *= 1 + max(0, tebal - 400) / 4000          # huruf tebal sedikit lebih lebar
    if el.get("kapital"): s = s.upper(); f *= 1.12
    return len(s) * (el.get("ukuran") or 32) * f + (el.get("spasi") or 0) * max(0, len(s) - 1)

def baris_teks(el):
    W, out = el.get("w") or 400, []
    for par in str(el.get("teks") or "").split("\n"):
        line = ""
        for w in re.split(r"(\s+)", par):
            t = line + w
            if lebar_teks(t.rstrip(), el) > W and line.strip():
                out.append(line.rstrip()); line = w.lstrip()
            else:
                line = t
        out.append(line.rstrip())
    return out

def tinggi(el):
    if el.get("tipe") == "teks" and el.get("id") in TINGGI_NYATA: return TINGGI_NYATA[el["id"]][0]
    if el.get("tipe") == "teks":
        return max(1, len(baris_teks(el))) * (el.get("ukuran") or 32) * (el.get("lh") or 1.2)
    return el.get("h") or 100

# ---------- warna & kontras ----------
def hex_rgb(c):
    c = str(c or "").strip().lstrip("#")
    if len(c) == 3: c = "".join(x * 2 for x in c)
    try: return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
    except Exception: return None

def warna_rata(fill):
    if isinstance(fill, dict) and fill.get("warna"):
        cs = [hex_rgb(x) for x in fill["warna"] if hex_rgb(x)]
        return tuple(sum(c[i] for c in cs) / len(cs) for i in range(3)) if cs else None
    return hex_rgb(fill)

def luminans(rgb):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])

def kontras(a, b):
    la, lb = luminans(a), luminans(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def potong(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])

def kotak(el):
    if el.get("tipe") == "teks" and el.get("id") in TINGGI_NYATA:
        lw, W, x = TINGGI_NYATA[el["id"]][2], (el.get("w") or 400), el.get("x", 0)
        x0 = x + (W - lw) / 2 if el.get("rata") == "tengah" else x + W - lw if el.get("rata") == "kanan" else x
        return (x0, el.get("y", 0), x0 + lw, el.get("y", 0) + tinggi(el))
    return (el.get("x", 0), el.get("y", 0), el.get("x", 0) + (el.get("w") or 100), el.get("y", 0) + tinggi(el))

# ---------- pemeriksaan ----------
def periksa(doc, folder):
    masalah, saran, ids = [], [], set()
    abs_ = doc.get("artboards") or []
    if not abs_: masalah.append("No artboards.")
    for ab in abs_:
        nm = f'[{ab.get("nama", ab.get("id"))}]'
        W, H = ab.get("w") or 0, ab.get("h") or 0
        els = ab.get("elemen") or []
        if not ab.get("id"): masalah.append(f"{nm} artboard has no id.")
        kecil = []
        for i, el in enumerate(els):
            eid = el.get("id")
            lab = f'{nm} {eid or "#" + str(i)} ({el.get("tipe")})'
            if not eid: masalah.append(f"{lab}: has no id.")
            elif eid in ids: masalah.append(f"{lab}: duplicate id.")
            ids.add(eid)
            if el.get("tipe") not in ("teks", "kotak", "elips", "gambar", "path", "grup"): masalah.append(f"{lab}: unknown type.")
            if el.get("sembunyi"): continue
            x0, y0, x1, y1 = kotak(el)
            dekor = el.get("tipe") in ("kotak", "elips", "gambar", "path") and ((el.get("opacity", 1) < 0.6) or (x1 - x0) * (y1 - y0) > W * H * 0.6)
            if not dekor and (x0 < -2 or y0 < -2 or x1 > W + 2 or y1 > H + 2):
                (masalah if el.get("tipe") == "teks" else saran).append(f"{lab}: outside the artboard (x {x0:.0f}..{x1:.0f}, y {y0:.0f}..{y1:.0f} of {W}×{H}).")
            if el.get("tipe") == "gambar":
                src = el.get("src") or ""
                if not src: masalah.append(f"{lab}: empty src.")
                elif not src.startswith(("data:", "http")) and not os.path.isfile(os.path.join(folder, src)):
                    masalah.append(f"{lab}: image file not found: {src}")
            if el.get("tipe") == "teks":
                uk = el.get("ukuran") or 32
                n = TINGGI_NYATA[eid][1] if eid in TINGGI_NYATA else len(baris_teks(el))
                minimal = max(12, round(min(W, H) / 60))
                if uk < minimal: kecil.append((uk, eid))
                if uk >= 60 and n > 3: saran.append(f"{lab}: headline wraps to {n} lines; widen w or reduce ukuran.")
                # kontras dengan latar di bawah titik tengah teks
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                latar = warna_rata(ab.get("bg") or "#FFFFFF")
                for b in els[:i]:
                    if b.get("tipe") in ("kotak", "elips") and not b.get("sembunyi") and b.get("fill") and (b.get("opacity", 1) >= 0.6):
                        bx = kotak(b)
                        if bx[0] <= cx <= bx[2] and bx[1] <= cy <= bx[3]: latar = warna_rata(b["fill"]) or latar
                    if b.get("tipe") == "gambar" and not b.get("sembunyi"):
                        bx = kotak(b)
                        if bx[0] <= cx <= bx[2] and bx[1] <= cy <= bx[3]: latar = None
                tw = hex_rgb(el.get("warna") or "#101634")
                if latar and tw:
                    k = kontras(tw, latar)
                    keras, lunak = (2.2, 3.0) if uk >= 60 else (2.6, 3.0) if uk >= 36 else (3.5, 4.5)
                    pesan_k = f"{lab}: contrast {k:.1f}:1 (aim for ≥{lunak}:1), text {el.get('warna')} on background ≈#{''.join(f'{int(c):02X}' for c in latar)}."
                    if k < keras: masalah.append(pesan_k)
                    elif k < lunak: saran.append(pesan_k)
                # tabrakan antar teks
                for b in els[:i]:
                    if b.get("tipe") == "teks" and not b.get("sembunyi") and potong(kotak(el), kotak(b)):
                        masalah.append(f"{lab}: overlaps text {b.get('id')} (\"{str(b.get('teks', ''))[:24]}\").")
                # teks keluar dari kartu tempat ia berada
                for b in els[:i]:
                    if b.get("tipe") == "kotak" and not b.get("sembunyi") and (b.get("w") or 0) * (b.get("h") or 0) < W * H * 0.6:
                        bx = kotak(b)
                        if bx[0] <= x0 <= bx[2] and bx[1] <= y0 <= bx[3] and (x1 > bx[2] + 2 or y1 > bx[3] + 2):
                            masalah.append(f"{lab}: overflows card {b.get('id')} (text ends at y {y1:.0f}, card at {bx[3]:.0f}).")
        if kecil:
            minimal = max(12, round(min(W, H) / 60))
            kecil.sort()
            saran.append(f"{nm} {len(kecil)} texts under ≈{minimal}px (smallest {kecil[0][0]}px: {', '.join(i for _, i in kecil[:6])}{'…' if len(kecil) > 6 else ''}), hard to read when presented or printed.")
    return masalah, saran

# ---------- preview PNG (mesin gambar sama dengan plugin) ----------
RENDER_JS = r"""
const fontStr = el => `${el.miring ? 'italic ' : ''}${el.tebal || 400} ${el.ukuran || 32}px "${el.font || 'Plus Jakarta Sans'}", sans-serif`
const isGrad = f => !!f && typeof f === 'object' && Array.isArray(f.warna)
const mc = document.createElement('canvas').getContext('2d')
function layoutTeks(el) {
  mc.font = fontStr(el); const sp = el.spasi || 0, W = el.w || 400
  const lebar = s => mc.measureText(s).width + sp * Math.max(0, s.length - 1)
  const isi = el.kapital ? String(el.teks ?? '').toUpperCase() : String(el.teks ?? ''), lines = []
  for (const par of isi.split('\n')) { let line = ''
    for (const w of par.split(/(\s+)/)) { const t = line + w; if (lebar(t.trimEnd()) > W && line.trim()) { lines.push(line.trimEnd()); line = w.trimStart() } else line = t }
    lines.push(line.trimEnd()) }
  const lh = (el.ukuran || 32) * (el.lh || 1.2); return { lines, lh, h: Math.max(lh, lines.length * lh) }
}
const tinggi = el => el.tipe === 'teks' ? layoutTeks(el).h : (el.h || 100)
function grad(g, f, x, y, w, h) { const a = (f.sudut ?? 135) * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), L = Math.abs(w * dx) + Math.abs(h * dy), cx = x + w / 2, cy = y + h / 2
  const gr = g.createLinearGradient(cx - dx * L / 2, cy - dy * L / 2, cx + dx * L / 2, cy + dy * L / 2); f.warna.forEach((c, i) => gr.addColorStop(f.warna.length === 1 ? 0 : i / (f.warna.length - 1), c)); return gr }
function bentuk(g, el, x, y, w, h) { g.beginPath(); if (el.tipe === 'elips') g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else g.roundRect(x, y, w, h, Math.min(el.radius || 0, w / 2, h / 2)) }
async function gambarAb(ab, sk) {
  const c = document.createElement('canvas'); c.width = Math.round(ab.w * sk); c.height = Math.round(ab.h * sk)
  const g = c.getContext('2d'); g.scale(sk, sk); g.fillStyle = isGrad(ab.bg) ? grad(g, ab.bg, 0, 0, ab.w, ab.h) : (ab.bg || '#FFFFFF'); g.fillRect(0, 0, ab.w, ab.h)
  for (const el of ab.elemen || []) { if (el.sembunyi) continue
    const w = el.w || 100, hh = tinggi(el); g.save(); g.globalAlpha = el.opacity ?? 1
    if (el.rotasi) { g.translate(el.x + w / 2, el.y + hh / 2); g.rotate(el.rotasi * Math.PI / 180); g.translate(-(el.x + w / 2), -(el.y + hh / 2)) }
    if (el.tipe === 'kotak' || el.tipe === 'elips' || el.tipe === 'grup') {
      if (el.bayangan) { g.shadowColor = 'rgba(16,22,52,.28)'; g.shadowBlur = 48; g.shadowOffsetY = 18 }
      bentuk(g, el, el.x, el.y, w, hh); if (el.fill) { g.fillStyle = isGrad(el.fill) ? grad(g, el.fill, el.x, el.y, w, hh) : el.fill; g.fill() }
      g.shadowColor = 'transparent'
      if (el.garis?.tebal) { g.lineWidth = el.garis.tebal; g.strokeStyle = el.garis.warna || '#000'; bentuk(g, el, el.x + el.garis.tebal / 2, el.y + el.garis.tebal / 2, w - el.garis.tebal, hh - el.garis.tebal); g.stroke() }
    } else if (el.tipe === 'teks') {
      const L = layoutTeks(el); g.font = fontStr(el); g.fillStyle = el.warna || '#101634'; g.textBaseline = 'middle'
      if ('letterSpacing' in g) g.letterSpacing = (el.spasi || 0) + 'px'
      g.textAlign = el.rata === 'tengah' ? 'center' : el.rata === 'kanan' ? 'right' : 'left'
      const tx = el.rata === 'tengah' ? el.x + w / 2 : el.rata === 'kanan' ? el.x + w : el.x
      L.lines.forEach((ln, i) => g.fillText(ln, tx, el.y + L.lh * i + L.lh / 2))
    } else if (el.tipe === 'path') {
      const vb = Array.isArray(el.vb) && el.vb[0] > 0 && el.vb[1] > 0 ? el.vb : [w, hh], sx = w / vb[0], sy = hh / vb[1], p2 = new Path2D(String(el.d || ''))
      g.translate(el.x, el.y); g.scale(sx, sy)
      if (el.bayangan) { g.shadowColor = 'rgba(16,22,52,.28)'; g.shadowBlur = 48 / sx; g.shadowOffsetY = 18 / sy }
      if (el.fill) { g.fillStyle = isGrad(el.fill) ? grad(g, el.fill, 0, 0, vb[0], vb[1]) : el.fill; g.fill(p2, el.aturan === 'evenodd' ? 'evenodd' : 'nonzero') }
      g.shadowColor = 'transparent'
      if (el.garis?.tebal) { const cap = { bulat: 'round', datar: 'butt', kotak: 'square' }; g.lineWidth = el.garis.tebal / Math.min(sx, sy); g.strokeStyle = el.garis.warna || '#101634'; g.lineCap = cap[el.ujung] || 'round'; g.lineJoin = el.ujung === 'datar' ? 'miter' : 'round'; g.stroke(p2) }
    } else if (el.tipe === 'gambar' && IMG[el.src]) {
      const im = IMG[el.src]; g.save(); bentuk(g, { radius: el.radius }, el.x, el.y, w, hh); g.clip()
      const s = el.fit === 'contain' ? Math.min(w / im.naturalWidth, hh / im.naturalHeight) : Math.max(w / im.naturalWidth, hh / im.naturalHeight)
      g.drawImage(im, el.x + (w - im.naturalWidth * s) / 2, el.y + (hh - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); g.restore()
    }
    g.restore() }
  return c.toDataURL('image/png')
}
const IMG = {}
;(async () => {
  for (const [k, v] of Object.entries(SRC)) { const im = new Image(); im.src = v; try { await im.decode(); IMG[k] = im } catch (e) {} }
  await document.fonts.ready; await new Promise(r => setTimeout(r, 300))
  const out = []
  for (const ab of DOC.artboards) for (const el of ab.elemen || []) if (el.tipe === 'teks') { const L = layoutTeks(el); mc.font = fontStr(el); const lw = Math.max(0, ...L.lines.map(s => mc.measureText(s).width + (el.spasi || 0) * Math.max(0, s.length - 1))); out.push('H|' + el.id + '|' + L.h + '|' + L.lines.length + '|' + lw) }
  for (const ab of DOC.artboards) if (!TARGET || ab.id === TARGET) out.push(ab.id + '|' + await gambarAb(ab, Math.min(1, 1600 / Math.max(ab.w, ab.h))))
  document.getElementById('out').textContent = out.join('\n'); document.title = 'DONE'
})()
"""

def js_aman(o):
    """JSON yang aman disisipkan di dalam <script> (tidak bisa menutup tag / menyisipkan HTML)."""
    # json.dumps sudah meng-escape U+2028/U+2029 (ensure_ascii); tinggal < > & yang bisa memutus tag <script>
    return json.dumps(o).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")

def cari_browser():
    for p in [r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"]:
        if os.path.isfile(p): return p
    return shutil.which("chrome") or shutil.which("msedge") or shutil.which("google-chrome")

def preview(doc, path, target):
    folder = os.path.dirname(os.path.abspath(path))
    src = {}
    for ab in doc.get("artboards", []):
        for el in ab.get("elemen", []):
            s = el.get("src") or ""
            if el.get("tipe") == "gambar" and s and not s.startswith(("data:", "http")):
                fp = os.path.realpath(os.path.join(folder, s))
                if fp.startswith(os.path.realpath(folder) + os.sep) and os.path.isfile(fp):
                    ext = os.path.splitext(fp)[1].lower().lstrip(".").replace("jpg", "jpeg").replace("svg", "svg+xml")
                    src[s] = f"data:image/{ext};base64," + base64.b64encode(open(fp, "rb").read()).decode()
            elif s.startswith("data:"):
                src[s] = s
    html = ('<!DOCTYPE html><html><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&family=Inter:wght@400;600;800&family=Poppins:wght@300;400;600;800&family=Montserrat:wght@400;700;900&family=Playfair+Display:wght@400;700;900&family=Bebas+Neue&display=swap">'
            '<style>body{font-family:"Plus Jakarta Sans","Inter","Poppins","Montserrat","Playfair Display","Bebas Neue"}</style></head><body>'
            '<span style="font-family:\'Plus Jakarta Sans\';font-weight:800">a</span><span style="font-family:Inter">a</span><span style="font-family:Poppins">a</span>'
            '<span style="font-family:Montserrat">a</span><span style="font-family:\'Playfair Display\'">a</span><span style="font-family:\'Bebas Neue\'">a</span>'
            '<pre id="out"></pre><script>const DOC = ' + js_aman(doc) + '; const SRC = ' + js_aman(src) + '; const TARGET = ' + js_aman(target) + ';' + RENDER_JS + '</script></body></html>')
    browser = cari_browser()
    if not browser: return None, "Chrome/Edge not found, preview skipped."
    tmpd = tempfile.mkdtemp(prefix="kanvas_")
    hp = os.path.join(tmpd, "render.html"); open(hp, "w", encoding="utf-8").write(html)
    r = subprocess.run([browser, "--headless=new", "--disable-gpu", "--virtual-time-budget=15000",
                        f"--user-data-dir={os.path.join(tmpd, 'prof')}", "--dump-dom", "file:///" + hp.replace("\\", "/")],
                       capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=120)
    m = re.search(r'<pre id="out">(.*?)</pre>', r.stdout, re.S)
    if not m or not m.group(1).strip(): return None, "Render failed (empty DOM)."
    outdir = os.path.join(folder, "preview"); os.makedirs(outdir, exist_ok=True)
    nama = re.sub(r"[^A-Za-z0-9_.-]", "_", os.path.basename(path).replace(".kanvas.json", ""))
    files = []
    for line in m.group(1).strip().splitlines():
        if line.startswith("H|"):
            _, eid, hh, n, lw = line.split("|"); TINGGI_NYATA[eid] = (float(hh), int(n), float(lw)); continue
        abid, data = line.split("|", 1)
        abid = re.sub(r"[^A-Za-z0-9_-]", "_", abid)[:60] or "artboard"
        fp = os.path.realpath(os.path.join(outdir, f"{nama}-{abid}.png"))
        if not fp.startswith(os.path.realpath(outdir) + os.sep): continue
        open(fp, "wb").write(base64.b64decode(data.split(",", 1)[1])); files.append(fp)
    shutil.rmtree(tmpd, ignore_errors=True)
    return files, None

def main():
    try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    path = sys.argv[1]
    try: doc = json.load(open(path, encoding="utf-8"))
    except Exception as e: print(f"ISSUES: invalid JSON: {e}"); sys.exit(2)
    files, err = None, None
    if "--preview" in sys.argv:   # preview dulu: browser sekaligus mengukur teks dengan akurat
        t = sys.argv[sys.argv.index("--artboard") + 1] if "--artboard" in sys.argv else None
        files, err = preview(doc, path, t)
    masalah, saran = periksa(doc, os.path.dirname(os.path.abspath(path)))
    n_el = sum(len(a.get("elemen") or []) for a in doc.get("artboards", []))
    print("Text size: measured in the browser (accurate)" if TINGGI_NYATA else "Text size: estimated; run with --preview for accurate results")
    print(f"File: {path}\nArtboards: {len(doc.get('artboards', []))} · elements: {n_el}\n")
    print(f"ISSUES ({len(masalah)}), fix these:" if masalah else "ISSUES: none ✓")
    for x in masalah: print("  ✗ " + x)
    print(f"\nSUGGESTIONS ({len(saran)}):" if saran else "\nSUGGESTIONS: none ✓")
    for x in saran: print("  • " + x)
    if "--preview" in sys.argv:
        print("\nPREVIEW: " + (err or "\n".join("  " + f for f in files)))
        if files: print("Open the PNGs above to check the result visually (overlaps, balance, spacing).")
    sys.exit(1 if masalah else 0)

if __name__ == "__main__":
    main()

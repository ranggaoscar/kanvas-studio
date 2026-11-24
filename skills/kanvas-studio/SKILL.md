---
name: kanvas-studio
description: Design presentations, pitch decks, posters (A4/A2/custom), logos, and social graphics in Kanvas Studio using the kanvas_* MCP tools or .kanvas.json files. Use when the user asks to create or change a design, slide, deck, poster, flyer, logo, or mentions "kanvas".
license: MIT
metadata:
  author: kanvas-studio
  version: "1.2.0"
  tags: "design, presentation, poster, canvas, mcp"
---

# Kanvas Studio: designing with AI agents

The **Kanvas Studio** plugin (Hermes Desktop) shows `*.kanvas.json` files as a live canvas. You design through the
`kanvas_*` MCP tools (or by writing `.kanvas.json` files directly); the canvas re-reads changes about once a second, so
the user **sees the design evolve live** while chatting and can jump in to edit anything by hand.

> **Preferred workflow:** When the `kanvas_*` MCP tools are available, **always use them instead of writing raw files**:
> `kanvas_status` → `kanvas_guide` → `kanvas_create` (or `kanvas_read`) → `kanvas_edit` → `kanvas_view` → `kanvas_export`.
> They compute auto-layout, keep components in sync, render PNGs and check layout/contrast automatically.

## 1. Find the file and the context first

1. **With MCP:** call `kanvas_status` to get the open design, selected elements (`terpilih`), open comments, and workspace path.
2. **Without MCP (direct file fallback):** read `_aktif.json` in the plugin data folder:
   - Windows: `%APPDATA%\Hermes\plugin-files\data\kanvas-studio\_aktif.json`
   - macOS: `~/Library/Application Support/Hermes/plugin-files/data/kanvas-studio/_aktif.json`
   - Linux: `~/.config/Hermes/plugin-files/data/kanvas-studio/_aktif.json`
   It contains:
   - `folder` = **the design folder the canvas has open**. Every design file (new or existing) MUST be written there,
     otherwise the user won't see it. **`folder: null`** (default workspace) = designs live in **the same folder as
     `_aktif.json` itself**.
   - `pathLengkap` = the file that's open (`null` if none), `artboardAktif`, and `terpilih` (the elements the user
     selected → that's "this one").
   - No pointer (the plugin was never opened)? Ask the user to open Kanvas Studio first. **Don't guess the folder.**
3. **Always read the latest file before writing.** The user may have just edited it. Never overwrite their changes with an old version.
4. New design → create `<name-with-dashes>.kanvas.json` **in the active workspace**. The canvas opens it as soon as it appears. Images and previews go in that folder too (`gambar/`, `preview/`).
5. When you're done, tell the user the full path of the file you wrote.

The user can also pin **comments** on the canvas (stored in the file's `komentar` list: `{ id, artboard, x, y, elemen, teks, selesai }`).
Do what each open comment asks, then set `selesai: true` and a short `balasan` (reply) on it.

## 2. Work in steps (so the user can watch)

Write the file **several times**, not once at the end:
1. All artboards + backgrounds (colors/gradients) → save.
2. Headline and main text → save.
3. Shapes, accents, images → save.
4. Polish (alignment, sizes, spacing) → save.

Every write = **a complete, valid JSON file** (never half a file). Keep existing element `id`s; delete the user's elements
only when asked. When finished, briefly explain what you made and offer revisions.

## 3. File format

Field names are Indonesian (that's the format): `teks` text, `ukuran` size, `tebal` weight, `warna` color, `rata` align,
`kotak` rectangle, `elips` ellipse, `gambar` image, `grup` group, `induk` parent.

```json
{
  "versi": 1,
  "judul": "Pitch Deck Q1",
  "artboards": [
    {
      "id": "a1", "nama": "Slide 1", "x": 0, "y": 0, "w": 1920, "h": 1080,
      "bg": "#FFFFFF",
      "elemen": [
        { "id": "e1", "tipe": "kotak", "x": 0, "y": 0, "w": 1920, "h": 1080,
          "fill": { "warna": ["#FF4D3D", "#FFA23C"], "sudut": 135 }, "radius": 0 },
        { "id": "e2", "tipe": "teks", "x": 140, "y": 380, "w": 1100,
          "teks": "Big headline\nsecond line", "font": "Plus Jakarta Sans", "ukuran": 110, "tebal": 800,
          "warna": "#FFFFFF", "rata": "kiri", "lh": 1.05, "spasi": -1 },
        { "id": "e3", "tipe": "gambar", "x": 1200, "y": 200, "w": 600, "h": 680,
          "src": "gambar/product.jpg", "fit": "cover", "radius": 32 },
        { "id": "e4", "tipe": "elips", "x": 1500, "y": -200, "w": 600, "h": 600,
          "fill": "#FFFFFF", "opacity": 0.12 }
      ]
    }
  ]
}
```

**Artboard**: `x`,`y` = position on the canvas (place them side by side: next x = x + w + 160, same y). `w`,`h` in px. `bg` = color or gradient.

**Elements** (coordinates relative to the artboard's top-left; array order = stacking order, last = front):

| Field | For | Notes |
|---|---|---|
| `id` | all | unique, e.g. `"e7k2"` |
| `tipe` | all | `"teks"`, `"kotak"`, `"elips"`, `"gambar"`, `"path"` (free vector), `"grup"` |
| `x`,`y`,`w` | all | px |
| `h` | kotak, elips, gambar, path | text: height is computed from its content |
| `fill` | kotak, elips, path | `"#HEX"`, gradient `{ "warna": ["#A","#B",...], "sudut": 135 }` (CSS degrees), or `null` |
| `radius` | kotak, gambar | corner radius px |
| `garis` | kotak, elips, path | stroke `{ "tebal": 4, "warna": "#101634" }` |
| `bayangan` | kotak, elips, path | `true` = soft shadow |
| `d`, `vb` | path | SVG path data (`M L H V C Q A Z`) in a `vb: [width, height]` box stretched to `w`×`h`. For logos, icons, arrows, lines, curves, stars |
| `ujung`, `aturan` | path | line caps `"bulat"`/`"datar"`/`"kotak"` (round/butt/square) · `"evenodd"` for shapes with holes |
| `grup` | — | a frame holding members (`induk: "<group id>"` on each member). `tata` = auto-layout (`arah`, `jarak`, `padding`, `rata`, `sebar`). **Auto-layout is computed by the Kanvas engine, not by `kanvas_cek.py`**; for groups with `tata`, use the MCP tool `kanvas_view` to see the result |
| `opacity` | all | 0–1 |
| `rotasi` | all | degrees |
| `sembunyi` | all | `true` = hidden |
| `teks` | teks | `\n` = new line; text wraps automatically to `w` |
| `font` | teks | any Google Font, e.g. `Plus Jakarta Sans`, `Inter`, `Poppins`, `Montserrat`, `Playfair Display`, `Bebas Neue` |
| `ukuran`,`tebal` | teks | size px; weight 300–900 |
| `warna` | teks | `"#HEX"` |
| `rata` | teks | `"kiri"`, `"tengah"`, `"kanan"` (left, center, right) |
| `lh`,`spasi` | teks | line height (1.0–1.6), letter spacing px (may be negative) |
| `kapital`,`miring` | teks | uppercase / italic, `true/false` |
| `src`,`fit` | gambar | path **relative to the design folder** (put files in `gambar/`), `"cover"` or `"contain"` |

## 4. Common sizes

| Format | w × h |
|---|---|
| Slide 16:9 | 1920 × 1080 |
| A4 portrait / landscape | 794 × 1123 / 1123 × 794 |
| A3 portrait | 1123 × 1587 |
| A2 portrait | 1587 × 2245 |
| A1 portrait | 2245 × 3179 |
| IG feed 4:5 / square / story | 1080 × 1350 / 1080 × 1080 / 1080 × 1920 |

Custom sizes are fine. PNG/PDF export offers 1–4× resolution, so the A-series sizes above stay sharp in print.

## 5. Design guidance

- **One idea per slide.** Big headlines (1920 deck: headline 90–140 px, body 34–44 px; A4 poster: headline 60–90 px, body 16–22 px).
- **Strong contrast**: dark `#101634` text on light backgrounds, white text on gradients/dark. Never light grey text on white.
- **Bright but focused color**: 1 main gradient + 1–2 accents. Defaults: coral `#FF4D3D`→orange `#FFA23C`, purple `#7B61FF`→pink `#EF476F`, green `#06D6A0`→blue `#118AB2`, yellow `#FFD166`; navy `#101634` for text.
- **Depth**: big semi-transparent circles/ellipses (`opacity` 0.08–0.2) at the edges, white cards with `radius` 24–40 + `bayangan: true` on gradient backgrounds.
- **Generous margins**: at least 6–8% of the artboard width from the edges. Align elements to shared lines.
- **Big numbers** for stats (2–3× the body size) with a small label underneath.
- Stay consistent across slides: same headline position, size and color.
- The user's brand assets (logo, colors): ask where they are, copy them into `gambar/` in the workspace, then use them as `src`.

## 6. Size system (use these numbers, don't invent)

**Spacing (multiples of 8):** 8 · 16 · 24 · 32 · 48 · 64 · 96 · 128. Edge margins: slide 1920 → **120–140**; A4 794 → **56–64**; A2 1587 → **110**; IG 1080 → **80**.

**Type scale** (size px · weight):

| Role | Slide 1920×1080 | A4 794×1123 | A2 1587×2245 | IG 1080×1350 |
|---|---|---|---|---|
| Hero headline | 96–128 · 800 | 56–72 · 800 | 120–160 · 800 | 84–110 · 800 |
| Slide title | 64–80 · 800 | 36–44 · 800 | 80–96 · 800 | 56–64 · 800 |
| Stat number | 110–140 · 800 | 48–64 · 800 | 120–150 · 800 | 96–120 · 800 |
| Subtitle | 36–44 · 600 | 20–24 · 600 | 40–48 · 600 | 34–40 · 600 |
| Body | 28–34 · 400–500 | 14–17 · 400 | 28–32 · 400 | 28–32 · 400 |
| Small label / eyebrow | **at least 20** · 700 | min 11 · 700 | min 22 · 700 | min 20 · 700 |

Text below the minimums can't be read when presented or printed. Don't.

## 7. Layout recipes (ready-made coordinates, slide 1920×1080)

Use these as a starting point, then adjust. For other sizes, scale proportionally.

1. **Cover, text left / visual right**: gradient bg; eyebrow (x140,y160); 2–3 line headline (x140,y280,w1000,size 104); subtitle (x140,y~600,w820,size 32); visual card (x1180,y180,w600,h720, radius 40, shadow) holding an image; 1–2 big white ellipses at opacity 0.1 bleeding off the right edge.
2. **Title + 3 stat cards**: title (x140,y130,w1300,size 80) + accent bar (x140,y260,w120,h10); 3 cards (y400, w520, h480, gap 40 → x140/700/1260), number (size 120) at +50,+80, label at +50,+250. Middle card uses the gradient as the highlight.
3. **Catalog grid**: title on top; column width = (1920 − 2×140 − (n−1)×24) / n; cards radius 20; item name size ≥ 22 under the image.
4. **Timeline / steps**: 4–5 numbered circles (ellipse 88×88) in a row at y≈460, joined by a thin rectangle (h4) through their centers; step title size 30 · 700 and body size 24 under each number, w ≤ 300.
5. **Comparison / pricing**: 3 equal-height cards; the featured one 40 px taller + gradient + a "Most popular" label; price size 72 · 800.
6. **A4 poster**: dark or light gradient bg; a big graphic at the top (ellipse/rectangle bleeding off the edge); 2-line headline at 40–55% of the height; 2–3 lines of body; button (fully rounded rectangle, h 64) underneath with high contrast; logo/contact at the bottom.

## 8. Required loop: check → look → fix

After each big step (and **always** before saying you're done), run:

```
python "%LOCALAPPDATA%\hermes\skills\kanvas-studio\kanvas_cek.py" "<path to .kanvas.json>" --preview
```

- It measures text with the same engine as the plugin and reports **ISSUES** (overlapping text, text overflowing a card,
  outside the artboard, contrast too low, missing image, duplicate id) and **SUGGESTIONS**.
- It writes a preview PNG per artboard to `preview/` next to the file. **Look at the PNGs** (if you can see images) to judge
  balance, spacing and hierarchy.
- Fix **every issue** and re-run until `ISSUES: none ✓`. Suggestions may be ignored when intentional (tell the user).
- Exit code 0 = clean, 1 = issues remain.

Questions to ask of each PNG, plus pitfalls hit before: see `references/qa-render-headless.md` (add new lessons there).

If you're a smaller or cheaper model: **don't improvise layouts**. Take the recipes in section 7 and the scale in section 6
as they are, change only the content, then run the checker.

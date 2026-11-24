# Kanvas Studio — guide for AI agents

You design by editing a **design document** with the `kanvas_*` tools. The user watches the canvas live:
a cursor + label follows every element you touch. Work in **small visible steps**, then **look** at your result.

## Fastest start: templates

`kanvas_templates` lists ready-made designs (pitch deck, A4 poster, Instagram feed & story, YouTube thumbnail, pricing slide).
`kanvas_create { judul, template }` copies one; then `kanvas_read` to see its parts and replace text/colors/icons with
`kanvas_edit`. Templates already use auto-layout and components, so they stay tidy while you edit.

## Workflow (always)

1. `kanvas_status` → open design, selected elements ("this one" = `terpilih`), open comments, list of designs.
2. New design → `kanvas_create` (pick `ukuran` or `w`+`h`). Existing → `kanvas_read` first; never overwrite user edits blindly.
3. Build in passes with `kanvas_edit`, one call per pass: (a) artboards + backgrounds, (b) headline & main text,
   (c) shapes / vectors / images, (d) polish alignment & spacing.
4. `kanvas_view` after each big pass and **always before saying you are done**. It returns a PNG of each artboard plus
   **ISSUES** (must fix: overlapping text, text overflowing cards or the artboard, low contrast, missing image, duplicate ids)
   and **SUGGESTIONS**. Fix every issue and view again.
5. When the user is happy: `kanvas_export` to the folder they want (`png`, `jpg`, `svg`, `pdf`, or `kanvas` = editable file + images).

## Comments from the user

The user can pin comments on the canvas (comment tool, `C`) and send them to you. `kanvas_comments { file }` lists the
open ones with their artboard, position and the element they point at. Do what each one asks with `kanvas_edit`, check
with `kanvas_view`, then `kanvas_resolve_comment { file, id, balasan }` with a one-line reply ("Headline is now 80 px").
Resolve only what you actually changed; if a comment is unclear, ask the user instead.

## Document

```json
{ "versi": 1, "judul": "Pitch Deck",
  "artboards": [ { "id": "a1", "nama": "Cover", "x": 0, "y": 0, "w": 1920, "h": 1080, "bg": "#FFFFFF", "elemen": [ … ] } ] }
```

Artboards sit side by side on the canvas (the tools place new ones automatically). Element coordinates are **relative to the
artboard's top-left**. Array order = stacking order (last = front).

## Elements

| field | for | notes |
|---|---|---|
| `id` | all | unique; omit when adding — the tool generates one and returns it |
| `tipe` | all | `teks` (text), `kotak` (rectangle), `elips` (ellipse), `gambar` (image), `path` (vector), `grup` (group / auto-layout frame) |
| `x` `y` `w` | all | px |
| `h` | not text | text height is computed from the content and `w` |
| `fill` | kotak, elips, path | `"#HEX"`, gradient `{ "warna": ["#A", "#B"], "sudut": 135 }` (CSS degrees), or `null` |
| `radius` | kotak, gambar | corner radius px |
| `garis` | kotak, elips, path | stroke `{ "tebal": 4, "warna": "#101634" }` |
| `bayangan` | kotak, elips, path | `true` = soft shadow |
| `opacity` `rotasi` `sembunyi` | all | 0–1 · degrees · hidden |
| `teks` | teks | `\n` = new line; wraps to `w` |
| `font` | teks | **any Google Fonts family** by its exact name (`Inter`, `DM Sans`, `Fraunces`, `Space Grotesk`, `Bebas Neue`, …) or a system font (`Arial`, `Georgia`). Loaded automatically; a misspelled name falls back and `kanvas_view` warns you |
| `ukuran` `tebal` | teks | font size px · weight 300–900 |
| `warna` | teks | `"#HEX"` |
| `rata` | teks | `kiri` / `tengah` / `kanan` (left / center / right) |
| `lh` `spasi` | teks | line height (1.0–1.6) · letter spacing px (may be negative) |
| `kapital` `miring` | teks | uppercase · italic |
| `src` `fit` | gambar | path relative to the workspace (use `kanvas_import_image`), data URL or https URL · `cover` / `contain` |
| `d` | path | SVG path data (M L H V C S Q T A Z), in a coordinate box `vb` |
| `vb` | path | `[width, height]` of the coordinate box of `d`; it is stretched to `w`×`h`. Default = `[w, h]` |
| `ujung` | path | line caps: `bulat` (round, default) / `datar` (butt) / `kotak` (square) |
| `aturan` | path | `evenodd` for shapes with holes |

`path` = logos, icons, arrows, lines, curves, blobs, stars — anything. Lines are just paths with `garis` and no `fill`.

Instead of writing `d`, you can give **points in artboard coordinates** and the box/`d` are computed for you
(the user can then edit those points with the pen tool):

```json
{ "tipe": "path", "titik": [ { "x": 200, "y": 600 }, { "x": 400, "y": 300, "ix": 300, "iy": 300, "ox": 500, "oy": 300 }, { "x": 600, "y": 600 } ],
  "tutup": true, "fill": "#FFD166", "garis": { "tebal": 4, "warna": "#101634" } }
```

Each point: `x`, `y`, optional curve handles `ix`/`iy` (incoming) and `ox`/`oy` (outgoing). `tutup: true` closes the shape.
Example (logo mark drawn in a 64×64 box, shown at 300×300):

```json
{ "tipe": "path", "x": 100, "y": 100, "w": 300, "h": 300, "vb": [64, 64],
  "d": "M15 0H49A15 15 0 0 1 64 15V49A15 15 0 0 1 49 64H15A15 15 0 0 1 0 49V15A15 15 0 0 1 15 0Z", "fill": "#101634" }
{ "tipe": "path", "x": 100, "y": 100, "w": 300, "h": 300, "vb": [64, 64], "d": "M30 32L45 17", "garis": { "tebal": 40, "warna": "#FF4D3D" } }
```

## Icons (2000+, open source)

`kanvas_icons` searches the Lucide icon set (English keywords). Add one with the `ikon` shorthand — it becomes a normal
vector `path` (stroke icon in a 24×24 box) that you can recolor, resize and export:

```json
{ "tipe": "ikon", "ikon": "coffee", "x": 120, "y": 120, "w": 64, "warna": "#FF4D3D" }
```

Optional: `tebal` (line weight in icon units, default 2; 1.5 = lighter, 2.5 = bolder). Icons work inside auto-layout groups
too (e.g. an icon + text row). A wrong name returns similar names.

## Typography tips

Pair one display font for headlines with one text font for body (e.g. `Fraunces` + `Inter`, `Space Grotesk` + `DM Sans`,
`Bebas Neue` + `Montserrat`, `Playfair Display` + `Lato`). Max two families per design.

## Groups & auto-layout (use these for cards, buttons, lists, grids)

A `grup` is a frame (it can have `fill`, `radius`, `garis`, `bayangan`) that holds children. Give it `tata` and it
**positions its children automatically** like CSS flexbox / Figma auto-layout — no more computing x/y by hand, and text
that grows pushes everything below it down instead of overlapping.

| field | on | values |
|---|---|---|
| `tata.arah` | grup | `kolom` (stack down, default) · `baris` (side by side) |
| `tata.jarak` | grup | gap between children, px |
| `tata.padding` | grup | px, or `[top, right, bottom, left]` |
| `tata.rata` | grup | cross-axis alignment: `awal` · `tengah` · `akhir` · `regang` (stretch) |
| `tata.sebar` | grup | main-axis distribution: `awal` · `tengah` · `akhir` · `antara` (space between) |
| `lebar` / `tinggi` | grup | `tetap` (use `w`/`h`) · `peluk` (hug the content) |
| `lebar` / `tinggi` | child of an auto-layout grup | `isi` = fill the group's remaining space |

In `kanvas_edit` → `tambah`, write groups **nested** with `anak: [...]` (children need no x/y inside an auto-layout group;
the group's own `x`/`y` places it on the artboard). Text inside a `kolom` group with `rata: "regang"` wraps to the group width.

```json
{ "op": "tambah", "elemen": [
  { "tipe": "grup", "nama": "Pricing card", "x": 140, "y": 300, "w": 520, "tinggi": "peluk",
    "fill": "#FFFFFF", "radius": 32, "bayangan": true,
    "tata": { "arah": "kolom", "jarak": 20, "padding": 48, "rata": "regang" },
    "anak": [
      { "tipe": "teks", "teks": "PRO", "ukuran": 20, "tebal": 800, "kapital": true, "spasi": 3, "warna": "#FF4D3D" },
      { "tipe": "teks", "teks": "$19 / month", "ukuran": 56, "tebal": 800, "warna": "#101634" },
      { "tipe": "teks", "teks": "All features, unlimited designs.", "ukuran": 26, "warna": "#4B5274", "lh": 1.4 },
      { "tipe": "grup", "nama": "Button", "lebar": "peluk", "tinggi": "peluk", "fill": "#101634", "radius": 999,
        "tata": { "arah": "baris", "padding": [18, 36, 18, 36], "rata": "tengah" },
        "anak": [ { "tipe": "teks", "teks": "Get started", "w": 220, "ukuran": 24, "tebal": 700, "warna": "#FFFFFF", "rata": "tengah" } ] }
    ] }
] }
```

Row of equal cards: a `baris` group with fixed `w`, `jarak: 40`, `rata: "regang"`, and each card `"lebar": "isi"`.
Other ops: `{ "op": "tambah", "ke_grup": "<grup id>", "elemen": [...] }` adds into an existing group;
`grupkan` (`ids`, optional `set`) wraps existing elements in a group; `lepas_grup` (`id`) ungroups.
Deleting a group deletes its children. In the editor: Ctrl+G / Ctrl+Shift+G, click once = group, click again = child.

## Components (repeat a design element, keep every copy in sync)

Make a group a **component** (`jadikan_komponen`), then place **copies** of it. Editing the master updates every copy;
each copy may override parts (text, colors, icon) without breaking the link — like Figma components.

```json
{ "op": "tambah", "elemen": { "id": "kartu", "tipe": "grup", "nama": "Feature Card", "x": 140, "y": 400, "w": 520,
  "fill": "#F7F4EE", "radius": 32, "tata": { "arah": "kolom", "jarak": 20, "padding": 48 }, "anak": [
    { "tipe": "ikon", "ikon": "zap", "nama": "Icon", "w": 44, "warna": "#FF4D3D" },
    { "tipe": "teks", "nama": "Title", "teks": "Fast", "ukuran": 40, "tebal": 700 },
    { "tipe": "teks", "nama": "Body", "teks": "…", "ukuran": 26 } ] } }
{ "op": "jadikan_komponen", "id": "kartu" }
{ "op": "tambah", "elemen": { "tipe": "salinan", "dari": "Feature Card", "x": 700, "y": 400,
  "timpa": { "Title": { "teks": "Secure" }, "Icon": { "ikon": "shield-check" }, "@": { "fill": "#101634" } } } }
```

- Give the parts a `nama` so copies can override them by name (`timpa` keys = part name, part id, or `"@"` for the copy's own frame).
- A copy's parts have ids `<copy id>.<master part id>`; `ubah` on them is stored as an override automatically.
- `lepas_salinan` (`id`) turns a copy into a normal group. Deleting the master turns its copies into normal groups.
- Copies work inside auto-layout groups (e.g. `ke_grup` a row of 3 cards: 1 master + 2 copies).

## kanvas_edit operations

Send an array `ops`; all of them apply together or none do.

| op | fields |
|---|---|
| `artboard` | `nama`, `ukuran` or `w`+`h`, `bg`, optional `elemen: [...]` |
| `ubah_artboard` | `id`, `set: { nama, w, h, bg, x, y }` |
| `hapus_artboard` | `id` |
| `tambah` | `artboard` (id; default = last), `elemen` (object or array, groups may nest `anak`), optional `ke_grup` (add into a group), `sebelum` (id to insert behind) |
| `ubah` | `id` or `ids`, `set: { … }` (a field set to `null` is removed) |
| `hapus` | `id` or `ids` |
| `urut` | `id`, `ke`: `depan` / `belakang` / `naik` / `turun` / index |
| `judul` | `judul` |
| `grupkan` | `ids`, optional `id`, `set` (e.g. `tata`, `fill`) |
| `lepas_grup` | `id` |
| `jadikan_komponen` | `id` (a grup), optional `nama` |
| `lepas_salinan` | `id` (a copy) |

English aliases also work: `add_artboard`, `update_artboard`, `delete_artboard`, `add`, `update`, `delete`, `order`, `title`, `group`, `ungroup`, `make_component`, `detach`.

## Sizes (`ukuran`)

`slide` 1920×1080 · `slide-4x3` 1600×1200 · `a4` 794×1123 · `a4-landscape` · `a3` 1123×1587 · `a2` 1587×2245 · `a1` 2245×3179 ·
`ig-feed` 1080×1350 · `ig-square` 1080×1080 · `ig-story` 1080×1920 · `logo` 1200×1200 · `og-image` 1200×630 ·
`yt-thumbnail` 1280×720 · `banner-web` 1440×600. Any `w`×`h` works.

## Design system (use these numbers, don't improvise)

- **Spacing** multiples of 8: 8 16 24 32 48 64 96 128. Edge margin: slide 120–140 · A4 56–64 · A2 110 · IG 80.
- **Type scale** (px · weight):

| role | slide 1920 | A4 794 | A2 1587 | IG 1080 |
|---|---|---|---|---|
| hero headline | 96–128 · 800 | 56–72 · 800 | 120–160 · 800 | 84–110 · 800 |
| slide title | 64–80 · 800 | 36–44 · 800 | 80–96 · 800 | 56–64 · 800 |
| big number | 110–140 · 800 | 48–64 · 800 | 120–150 · 800 | 96–120 · 800 |
| subtitle | 36–44 · 600 | 20–24 · 600 | 40–48 · 600 | 34–40 · 600 |
| body | 28–34 · 400 | 14–17 · 400 | 28–32 · 400 | 28–32 · 400 |
| eyebrow/label | ≥20 · 700 caps, spacing 2–3 | ≥11 | ≥22 | ≥20 |

- One idea per slide. Strong contrast (dark `#101634` on light, white on gradients/dark).
- One main gradient + 1–2 accents. Depth: big semi-transparent ellipses (opacity 0.08–0.2) bleeding off the edges,
  white cards radius 24–40 with `bayangan`.
- Align to shared edges; keep repeated elements at the same position across slides.
- Smaller / cheaper models: use the recipes below as-is and only change the content.

## Layout recipes (slide 1920×1080; scale proportionally)

1. **Cover**: gradient bg; eyebrow (x140 y160); 2–3 line headline (x140 y280 w1000 size 104); subtitle (x140 y≈600 w820 size 32);
   visual card (x1180 y180 w600 h720 radius 40 shadow) with an image or vector; 1–2 white ellipses opacity 0.1 off the right edge.
2. **Title + 3 stat cards**: title (x140 y130 w1300 size 80) + accent bar (x140 y260 w120 h10); cards y400 w520 h480 gap 40 →
   x140/700/1260; number size 120 at +50,+80; label at +50,+250; middle card uses the gradient.
3. **Catalog grid**: title on top; column width = (1920 − 2×140 − (n−1)×24) / n; cards radius 20; item name ≥ 22 under the image.
4. **Timeline**: 4–5 numbered circles (88×88) at y≈460 joined by a thin line (h4); step title 30·700 and body 24 under each, w ≤ 300.
5. **Pricing / comparison**: 3 equal cards; featured one 40px taller + gradient + "Most popular" label; price 72·800.
6. **A4 poster**: gradient bg; big graphic on top bleeding off the edge; 2-line headline at 40–55% height; 2–3 lines of body;
   pill button (h64) with high contrast; logo/contact at the bottom.
7. **Logo sheet** (`logo` size): mark built from `path` in a 64×64 `vb`, centered; wordmark text beside or under it;
   variations on later artboards (dark / light / mono, small sizes 64·32·16).

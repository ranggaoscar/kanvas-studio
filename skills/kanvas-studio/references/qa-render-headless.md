# Visual QA of the canvas with headless Chrome

> **There's an official tool now:** `python kanvas_cek.py "<file>.kanvas.json" --preview` (in this skill's folder) renders a PNG per artboard with exactly the same engine as the plugin, plus an automatic issue list. Use that first. The manual steps below are only a fallback if it fails.

## Manual steps (fallback)

1. Copy `layoutTeks()` + `fontStr()` + `fillCss()` exactly from the plugin's `plugin.js` into one HTML template. If it's not exact, the QA lies (different line widths → false overflows).
2. **Put `<script id="data" type="application/json">` BEFORE `<div id="root">`.** At the end of the body, the renderer runs before the JSON exists → identical empty 8 KB screenshots.
3. Render one artboard per HTML file, not all at once: `--window-size` only captures the first viewport.
4. Chrome binary: `/c/Program Files/Google/Chrome/Application/chrome.exe`.

```bash
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --virtual-time-budget=20000 \
  --window-size=1920,1080 \
  --screenshot="C:\\folder\\_s1.png" "file:///C:/folder/_s1.html"
```

- `virtual-time-budget` < 10000 = race, Google Fonts aren't ready yet. Use 20000.
- Spaces in the file URL must be `%20` (`file:///C:/test%20folder/...`).
- A screenshot under 100 KB for complex visuals = probably a failed render; check it.

## What to check per slide

Send each PNG to `vision_analyze` with specific numbered questions, not "is it good?":

1. Does any text overlap another element? (give coordinates)
2. Do all images show, or is there an empty box?
3. Does text leave the artboard or get cut at an edge?
4. Do the visual proportions match the numbers claimed? (e.g. a 55% bar must really be 55:100, not 40:100)
5. Do callouts touch the object they describe, or float?

## Pitfalls already hit

- **Static text on top of shapes whose position is computed** easily overlaps when the shape's height changes. When you change the number or height of decorative elements, recompute every text offset around them.
- **A paragraph's last line can fall below the footer line.** Check the end y of every text block, not just the start.
- **Framed images read as boxes** unless they bleed. Position the image past the artboard edge (negative x/y, bigger w/h) instead of stacking gradient fades; fades only darken, the edge still shows.
- **Manually hard-wrapped text** (`\n` mid-sentence) is safer than relying on auto-wrap for narrow right-aligned blocks.

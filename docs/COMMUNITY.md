# Kanvas Studio — Community Ecosystem Guide

Kanvas Studio supports **pure-JSON community extensions** stored locally in `<workspace>/community/` — zero arbitrary code execution, 100% portable across Hermes Desktop and standalone MCP.

You can contribute **Starter Templates**, **Aesthetic Design Directions**, and **Reusable Workflows** locally via `kanvas_community` or upstream via pull request.

---

## Directory Layout (`<workspace>/community/`)

```text
<workspace>/community/
  templates/     *.kanvas.json   # Auto-discovered by kanvas_templates & kanvas_create
  directions/    *.json          # Auto-merged into kanvas_art_direction
  workflows/     *.json          # Reusable step-by-step design playbooks
```

---

## 1. Community Templates (`community/templates/<slug>.kanvas.json`)

Save any polished `.kanvas.json` design via MCP:

```json
kanvas_community {
  "action": "save_template",
  "file": "my-editorial-poster.kanvas.json",
  "id": "swiss-poster",
  "name": "Swiss Exhibition Poster",
  "category": "poster",
  "description": "Asymmetric A4 editorial layout with 1px hairlines and bold Syne typography",
  "author": "your-github-handle"
}
```

Once saved, it immediately appears in `kanvas_templates` and can be started with `kanvas_create { judul: "...", template: "swiss-poster" }`.

---

## 2. Community Aesthetic Directions (`community/directions/<slug>.json`)

Extend Kanvas Studio's Design Intelligence with your own art-direction lens (pure JSON):

```json
{
  "id": "risograph-zine",
  "name": "Risograph Zine",
  "summary": "Duotone print texture energy, bold ink overprint contrast, tactile editorial grids.",
  "keywords": ["riso", "risograph", "zine", "print", "indie", "bookshop"],
  "marginRatio": 0.065,
  "fontPairings": [
    { "display": "Bricolage Grotesque", "body": "DM Sans", "mono": "Space Mono", "mood": "indie print zine" }
  ],
  "palettes": [
    { "name": "Fluoro Pink & Indigo", "bg": "#F7F3EA", "surface": "#EFE9DC", "text": "#1D2469", "muted": "#4B5288", "accent": "#FF3E81", "rule": "#1D2469" }
  ],
  "compositions": ["editorial-grid", "diagonal-tension"],
  "surfaceRules": "Flat paper tones, sharp 2px borders, zero drop shadows.",
  "typographyRules": "Oversized display headlines with tracked monospace captions.",
  "author": "your-github-handle"
}
```

Save via `kanvas_community { action: "save_direction", ... }`; `kanvas_art_direction` automatically discovers and matches it by `id` or `keywords`.

---

## 3. Community Workflows (`community/workflows/<slug>.json`)

Share repeatable multi-step design playbooks (strictly visual design guidance, never overriding user approvals):

```json
kanvas_community {
  "action": "save_workflow",
  "id": "product-launch-kit",
  "name": "Product Launch Kit",
  "description": "Brand check → art direction → multi-format campaign → Visual QA → PPTX & PNG export",
  "author": "your-github-handle",
  "tags": ["launch", "marketing", "campaign"],
  "steps": [
    { "tool": "kanvas_brand", "action": "Load or save the product Brand Kit." },
    { "tool": "kanvas_campaign", "action": "Generate ig-feed, ig-story, banner-web, and carousel." },
    { "tool": "kanvas_view", "action": "Inspect PNGs and refine until ISSUES: none and QA SCORE >= 85." },
    { "tool": "kanvas_export", "action": "Export 2x PNG assets and editable .kanvas.json." }
  ]
}
```

---

## Contributing Upstream

Want to share your template, aesthetic direction, or workflow with everyone? Open a pull request following [CONTRIBUTING.md](../CONTRIBUTING.md) and include a clean `kanvas_view` check (`ISSUES: none ✓`, QA Score ≥ 85).

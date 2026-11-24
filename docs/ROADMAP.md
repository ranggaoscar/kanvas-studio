# Kanvas Studio Roadmap

**Kanvas Studio** is built to be the best **agent-native visual design engine** — **100% free, open-source (MIT), and local-first**, with **no paywalls, no subscriptions, and no premium features**, supported solely by voluntary community sponsorship and donations.

---

## Status Summary

| Priority | Initiative | Target Capability | Status |
|---|---|---|---|
| **P0** | **Design Intelligence** | Adaptive art direction, proportional grids, typographic craft, and 7 open aesthetic lenses without rigid templates | **Shipped (v0.3.0)** |
| **P0** | **Brand Kit** | Multi-brand local storage for colors, typography, logos, assets, tone, and guidelines — plus contrast-aware apply | **Shipped (v0.3.0)** |
| **P0** | **Visual Quality Assurance** | Quantitative QA Score (0–100), multi-point/gradient contrast, margins, hierarchy, alignment, density, and brand consistency checks | **Shipped (v0.3.0)** |
| **P1** | **Marketing Automation** | Single-brief multi-format campaign generator (`ig-feed`, `ig-story`, `carousel`, `a4`, `yt-thumbnail`, `banner-web`, `og-image`) | **Shipped (v0.3.0)** |
| **P1** | **Smart Resize** | Aspect-ratio-aware artboard resize with automatic margin, type scale, and horizontal→vertical auto-layout reflow | **Shipped (v0.3.0)** |
| **P1** | **Presentation Engine** | Structured multi-slide deck engine with native zero-dependency **editable PowerPoint (`.pptx`) export** + speaker notes | **Shipped (v0.3.0)** |
| **P1** | **Data Visualization** | Native editable `bar`, `hbar`, `line`, `donut`, `table`, and `diagram` primitives built from standard Kanvas elements | **Shipped (v0.3.0)** |
| **P2** | **Design-to-Code** | Semantic **HTML/CSS**, **React (JSX + CSS)**, and **Tailwind** export mapping auto-layout frames to Flexbox | **Shipped (v0.3.0)** |
| **P2** | **Asset Library** | Reusable local Asset Library (`<workspace>/assets-library/`) for images, logos, and custom SVG vector marks | **Shipped (v0.3.0)** |
| **P2** | **Community Ecosystem** | Pure-JSON community templates, custom aesthetic directions, and workflows (`<workspace>/community/`) + contributor guide | **Shipped (v0.3.0)** |
| **P2** | **Easy Installation** | Cross-platform `kanvas doctor`, `kanvas init-mcp`, `install.sh` (macOS/Linux), `install.ps1` (Windows), npm-ready packaging | **Shipped (v0.3.0)** *(npm registry publish pending maintainer release)* |

---

## Completed Milestones

### P0 — Core Design Quality Foundation *(v0.3.0)*
- **Design Intelligence (`kanvas_art_direction`):** Context-driven art direction with 7 mixable lenses (*Swiss Editorial*, *Luxury Minimalism*, *Neo-Brutalism*, *Cinematic*, *Corporate Premium*, *Experimental*, *Contemporary Product*) and proportional canvas grids — plus Art Direction pills on the Home screen.
- **Multi-Brand Brand Kit (`kanvas_brand`):** Unlimited local brands in `<workspace>/brands/` with colors, fonts, logos, assets, guidelines, WCAG-safe theming, and visual Brand Kit cards/drawer in the UI.
- **Visual Quality Assurance (`kanvas_view`, `app/lint.js`):** QA Score (0–100), per-artboard metrics, multi-point & worst-case gradient contrast, safe margins, typographic hierarchy, font count, line-height collision, icon overlap, near-miss alignment, Brand Kit font checks, and a live toolbar QA Score badge.

### P1 — High-Leverage Agent Workflows *(v0.3.0)*
- **Smart Resize (`kanvas_resize`, `server/resize.js`):** Recompose any artboard across aspect ratios (copy or in-place), preserving circle/icon proportions, scaling typography above legibility floors, and reflowing wide horizontal stacks into portrait columns automatically — available both via MCP and the Artboard toolbar menu.
- **Marketing Automation (`kanvas_campaign`, `server/campaign.js`):** Turn one brief into coordinated multi-format deliverables (IG Feed, IG Story, swipeable Carousel slides with counters, A4 Poster, YouTube Thumbnail, Web Banner, OG Card) aligned to Design Intelligence & Brand Kit.
- **Data Visualization (`kanvas_dataviz`, `server/dataviz.js`):** Native editable `bar`, `hbar`, `line`, `donut`, `table`, and `diagram` visuals using standard Kanvas Studio vectors/groups/text (rendering cleanly on Canvas 2D, SVG, PDF, PNG, and `.pptx`) — also insertable directly from the toolbar.
- **Presentation Engine + Editable `.pptx` Export (`kanvas_presentation`, `server/pptx.js`, `kanvas_export { format: "pptx" }`):** Build non-monotonous multi-slide decks from outlines, KPIs, charts, tables, diagrams, quotes, and presenter speaker notes — and export zero-dependency OOXML `.pptx` files with real editable text, shapes, gradients, vector paths/arcs, embedded images, and presenter notes.

### P2 — Ecosystem, Code Export & Ergonomics *(v0.3.0)*
- **Design-to-Code (`kanvas_to_code`, `server/codegen.js`):** Export artboards to clean semantic HTML/CSS, React (JSX + CSS), or Tailwind markup with Google Fonts links and real Flexbox mapping for auto-layout groups — also available directly from the Export menu.
- **Asset Library (`kanvas_assets`, `server/assets.js`):** Searchable, tagged local library (`<workspace>/assets-library/`) for images and reusable SVG vector marks across projects, browsable from the toolbar Insert menu.
- **Community Ecosystem (`kanvas_community`, `server/community.js`, [docs/COMMUNITY.md](COMMUNITY.md)):** Pure-JSON custom templates, aesthetic design directions, and workflows auto-discovered by `kanvas_templates` and `kanvas_art_direction`.
- **Easy Installation (`bin/kanvas.js`, `install.sh`, `install.ps1`):** `kanvas doctor` environment check, `kanvas init-mcp` config generator, macOS/Linux `install.sh`, Windows `install.ps1`, and npm-ready `package.json`.

---

## Next Horizon *(Open for Community Ideas)*

- Publish `kanvas-studio` to the public npm registry (`npx kanvas-studio mcp`).
- In-canvas UI panels for browsing Brand Kits, Asset Library, and Community extensions inside Hermes Desktop / local web studio.
- Additional chart types (stacked bars, scatter/bubble, timeline Gantt) and richer `.pptx` table/chart native groupings.

Have an idea? Open a [Feature Request](https://github.com/ranggaoscar/kanvas-studio/issues/new?template=feature_request.yml), contribute via [CONTRIBUTING.md](../CONTRIBUTING.md), or support free open-source work through [GitHub Sponsors](https://github.com/sponsors/ranggaoscar).

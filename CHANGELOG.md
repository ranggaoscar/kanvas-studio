# Changelog

All notable changes to **Kanvas Studio** are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [0.4.2]

- **`npx` fix:** publishes both `kanvas` and `kanvas-studio` bin aliases, so `npx -y kanvas-studio mcp` resolves an executable instead of failing with "could not determine executable to run".

## [0.4.1]

- **npm package polish:** excludes `__pycache__`/`*.pyc` from the published tarball and documents the `npx -y kanvas-studio mcp` quickstart for Claude Code, Codex, Cursor, and Hermes.

## [0.4.0]

- **Faster agent workflow:** smaller MCP schemas, `kanvas_guide` quick topics, partial `kanvas_read`, `fast_qa` and `qa_only`, and opt-in deterministic `auto_heal`.
- **Design Taste:** structured blueprints across seven lenses, taste checks for text density, visual balance/focal point and palette/spacing, plus an A4 `admin-report` preset and starter template.
- **Document Bridge:** `kanvas_document`, zero-npm-runtime-dependency XLSX I/O and CSV import, editable Hybrid PDF round-trip, and PDF Quick Edit with a locked background and single-line patch auto-fit. PDF and spreadsheets enter through the same Studio Home import.
- **Smart Presentation:** untyped slides choose charts, diagrams, tables, KPI callouts, or editorial layouts based on structured content. External PDF Quick Edit uses Windows.Data.Pdf or optional local Poppler, including on Linux and macOS.

## [0.3.0] - 2026-11-25

### Added — P0, P1 & P2 Agent-Native Design Engine + Live Canvas UI Upgrade (Zero Runtime Dependencies)
- **Design Intelligence (`kanvas_art_direction`, `server/design-intelligence.js`, `skills/kanvas-studio/references/design-intelligence.md`):**
  - Adaptive art direction engine tailoring visual direction, proportional canvas grids, typography pairings, color systems, and compositional options to any brief and canvas size.
  - 7 open reference aesthetic directions (**Swiss Editorial**, **Luxury Minimalism**, **Neo-Brutalism**, **Cinematic**, **Corporate Premium**, **Experimental**, and **Contemporary Product**) designed as mixable creative lenses rather than rigid layout recipes, plus Art Direction selector pills right on the Home screen.
  - Rewrote `skills/kanvas-studio/SKILL.md` and `docs/FORMAT.md` to eliminate monotonous default recipes while preserving full backward compatibility with `.kanvas.json`.
- **Multi-Brand Brand Kit (`kanvas_brand`, `server/brand.js`, `GET /api/brands`, live UI Brand Kit panel & drawer):**
  - Local-first multi-brand storage inside `<workspace>/brands/` (`brands/index.json` + `brands/<slug>/` logos & assets), working identically in Hermes Desktop and standalone MCP.
  - Full lifecycle actions (`list`, `get`, `save`, `set_default`, `import_asset`, `apply` with WCAG-safe contrast preservation, `delete`) plus visual Brand Kit cards on Home and a Brand Kit toolbar drawer in the canvas editor.
- **Upgraded Visual Quality Assurance (`app/lint.js`, `kanvas_view`, `bin/kanvas.js render`, `skills/kanvas-studio/kanvas_cek.py`, live UI QA badge):**
  - Quantitative **Visual QA Score (0–100)** and per-artboard diagnostics (`whitespacePct`, `minMarginPx`, `fontFamilies`, `typeRatio`).
  - Multi-point horizontal contrast sampling, worst-case gradient contrast, safe edge margins, colliding line-height (`lh < 0.85`), text-on-icon overlap, font family count (>3), flat hierarchy, wall-of-text measure, near-miss alignment, vertical balance, and Brand Kit font consistency — surfaced both over MCP and via a live **QA Score badge & inspector popover** in the canvas toolbar.
- **Smart Resize (`kanvas_resize`, `server/resize.js`, `server/layout.js`, Artboard menu Smart Resize):**
  - Deterministic server-side auto-layout resolver plus aspect-ratio-aware Smart Resize (`copy` or `in_place`) preserving circle/icon aspect ratios, scaling typography above legibility floors, and reflowing wide horizontal `baris` stacks into portrait `kolom` stacks automatically.
- **Marketing Automation (`kanvas_campaign`, `server/campaign.js`):**
  - Single-brief multi-format campaign generator producing coordinated `ig-feed`, `ig-story`, swipeable `carousel` slides with counters, `a4`, `yt-thumbnail`, `banner-web`, `og-image`, and `slide` artboards driven by Design Intelligence and Brand Kit.
- **Native Data Visualization (`kanvas_dataviz`, `server/dataviz.js`, toolbar Insert Data Viz menu):**
  - Generates fully editable `bar`, `hbar`, `line`, `donut`, `table`, and `diagram` primitives built from standard Kanvas Studio elements (vectors, auto-layout groups, and text) with automatic dark/light and Brand Kit theming.
- **Presentation Engine + Editable PowerPoint `.pptx` Export (`kanvas_presentation`, `server/presentation.js`, `server/pptx.js`, `kanvas_export { format: "pptx" }`, UI Export menu):**
  - Multi-slide presentation engine (`cover`, `agenda`, `narrative`, `split`, `stats`, `chart`, `table`, `timeline`/`diagram`, `quote`, `closing`) with presenter speaker notes.
  - Zero-dependency OOXML `.pptx` exporter generating real editable PowerPoint text boxes, shapes, linear gradients, vector paths (including arc-to-cubic conversion), embedded images, and speaker notes — available via MCP, CLI, and directly from the canvas Export menu.
- **Design-to-Code (`kanvas_to_code`, `server/codegen.js`, UI Export menu):**
  - Exports any artboard into semantic `html` (single-file HTML + CSS + Google Fonts), `react` (JSX + CSS), or `tailwind` JSX — translating auto-layout groups into genuine CSS Flexbox.
- **Reusable Local Asset Library (`kanvas_assets`, `server/assets.js`, `GET /api/assets`, toolbar Insert menu):**
  - Searchable, tagged `<workspace>/assets-library/` for importing images and saving reusable custom SVG vector marks across projects.
- **Community Ecosystem (`kanvas_community`, `server/community.js`, `GET /api/community`, `docs/COMMUNITY.md`):**
  - Pure-JSON `<workspace>/community/` extensions for custom templates (auto-discovered by `kanvas_templates` / `kanvas_create`), custom aesthetic directions (auto-merged into `kanvas_art_direction`), and workflow playbooks — zero arbitrary code execution.
- **Easy Installation, Open-Source Readiness & GitHub Sponsors:**
  - Added `kanvas doctor`, `kanvas init-mcp [claude|codex|cursor|hermes]`, `kanvas render --format pptx`, macOS/Linux `install.sh`, `.github/FUNDING.yml` (`github: ranggaoscar`), Sponsors badge & subtle Home footer link, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/ROADMAP.md`, and structured GitHub issue templates.

### Fixed
- Eliminated intermittent empty-page race condition in headless Chrome PDF rendering by switching headless PDF JPEG encoding to synchronous `toDataURL` + `buatPdfBytes` in `desktop/plugin.js` and `app/main.js`.

## [0.2.0] - 2026-11-24

### Added
- **Portable Agent Plugins v1** packaging (`plugin.json` + `mcp.json` + `skills/kanvas-studio` + `desktop/plugin.js`) with zero Python dependencies and zero runtime npm dependencies.
- Automatic cross-OS seeding of `ikon.json` and `template.json` into Hermes Desktop's plugin data directory.
- Security hardening: minimal child process environment (`envMinimal()`) stripping host API tokens/keys, SSRF guard (`urlGambarAman()`) blocking private/loopback/cloud-metadata image URLs in headless render mode, and explicit prompt-injection guard guidance for canvas files and comments.
- Live UI screenshots, 2:1 catalog banner, and polished documentation.

### Fixed
- Group/component tree duplication (`Ctrl+D`, `Ctrl+C`/`Ctrl+V`, duplicate artboard) and slide strip dropdown placement.
- Serialized MCP JSON-RPC writes, atomic temp-file uniqueness, duplicate artboard export filenames, and `kanvas_resolve_comment` empty `ids` handling.
- Sanitized Lucide icon tags for Hermes plugin security validation.

## [0.1.0] - 2026-11-20

### Added
- Initial local-first visual design studio and stdio MCP server (13 tools).
- Live canvas editor with agent cursor choreography, auto-layout groups (`tata`), Figma-style components, vector Pen tool (`path`/`titik`), 2,100+ bundled Lucide icons, Google Fonts loading, comment pins, 6 built-in templates, and PNG/JPG/SVG/PDF/`.kanvas.json` export.

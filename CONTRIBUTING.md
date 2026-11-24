# Contributing to Kanvas Studio

Thank you for helping build **Kanvas Studio**!

Kanvas Studio is **100% free, open-source (MIT), and local-first** — built as the best visual design engine for AI agents, with zero paywalls, zero subscriptions, and zero premium-gated features.

---

## Ways to contribute

- **Core engine & MCP tools:** improve canvas rendering, auto-layout, vector paths, Brand Kit workflows, Visual QA checks, or new P1/P2 roadmap features.
- **Design Intelligence:** refine aesthetic lenses, typographic pairings, compositional principles, or skill guidance in `server/design-intelligence.js` and `skills/kanvas-studio/`.
- **Starter templates:** add clean, editable `.kanvas.json` templates built with auto-layout and components via `scripts/template.js`.
- **Visual QA & tests:** add regression tests for layout bugs, contrast edge cases, MCP tool flows, and security boundaries.
- **Docs & bug reports:** reproduce issues, clarify platform instructions, or improve examples.

---

## Local development setup

Requirements: **Node.js 18+** and **Google Chrome or Microsoft Edge** (for headless rendering tests).

```bash
git clone https://github.com/ranggaoscar/kanvas-studio
cd kanvas-studio
npm install        # dev dependencies only (esbuild, react, lucide-static)
npm run build      # bundles app/dist/kanvas.js, ikon.json, template.json
npm test           # runs full unit + security + MCP + 2,100+ icon tests
```

Run the local studio UI directly during development:

```bash
node bin/kanvas.js
```

If you have Hermes installed locally, also verify catalog admission checks:

```bash
hermes plugins validate .
```

---

## Architecture & compatibility guardrails

Please keep these core principles intact in every PR:

1. **Zero runtime npm dependencies & zero Python runtime dependencies:** keep the plugin portable across Windows, macOS, and Linux (`plugin.json` + `mcp.json` + `skills/` + `desktop/plugin.js`).
2. **Backward-compatible `.kanvas.json` format:** existing files and Indonesian schema keys (`teks`, `kotak`, `elips`, `gambar`, `path`, `grup`, `tata`, `komponen`, `salinan`, `komentar`) must continue opening and rendering cleanly.
3. **Dual compatibility:** changes must work both inside **Hermes Desktop** and in **standalone local MCP** mode (`Claude Code`, `Codex`, `Cursor`, etc.).
4. **Hermes SDK & security boundaries:**
   - `desktop/plugin.js` may only import `@hermes/plugin-sdk` and `react` (no `eval`, no `new Function`, no DOM scraping of host internals).
   - Keep `server/studio.js` bound strictly to `127.0.0.1` with `Host`, `Origin`, and `X-Kanvas: 1` guards, and confine all workspace paths via `jalur()`.
   - Spawned child processes must use `envMinimal()` so host API keys and tokens are never inherited.
   - Keep external headless image URL validation (`urlGambarAman()`) blocking private/loopback/metadata addresses.
5. **No paywalls or telemetry:** never introduce cloud lock-in, tracking, accounts, or paid feature flags.

---

## Pull request checklist

- [ ] `npm run build` completes cleanly (if UI, lint, icons, or templates changed).
- [ ] `npm test` passes completely, with new regression tests for your change.
- [ ] `hermes plugins validate .` passes with `security scan — safe` (if Hermes CLI is available).
- [ ] Docs (`README.md`, `docs/FORMAT.md`, `CHANGELOG.md`, `docs/ROADMAP.md`) accurately reflect what is implemented — never claim unfinished features as shipped.
- [ ] Keep PRs focused and well-scoped.

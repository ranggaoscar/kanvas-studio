# Kanvas Studio — Design Intelligence Reference

Kanvas Studio is an **agent-native visual design engine**, not a rigid template filler. Good design responds to **purpose, audience, medium, tone, and brand identity** — never the same default gradient and 3 rounded cards for every request.

---

## 1. Think like an Art Director before drawing

Before calling `kanvas_edit`, decide these 5 creative choices (or call `kanvas_art_direction` with the user's brief and active Brand Kit):

1. **Context & emotional register:** What is this piece trying to make the viewer feel or do? (Authoritative investor report ≠ brutalist underground concert poster ≠ luxury perfume launch ≠ playful product announcement.)
2. **Aesthetic lens:** Choose a coherent visual language — or blend two intentionally. Reference directions below are **starting points, never boundaries**.
3. **Typography system:** Pick max 2–3 complementary fonts (e.g. expressive Display + readable Body + optional Mono for metadata/numbers). Create clear hierarchy through scale (`3×–5×` display-to-body ratio), weight, optical tracking, and spacing.
4. **Color & surface discipline:** Use a 60-30-10 tonal hierarchy (dominant canvas, calm secondary surface, decisive focal accent). Check WCAG contrast (`≥4.5:1` for body, `≥3:1` for large headlines). If a Brand Kit exists (`kanvas_brand`), honor its palette, fonts, logos, and guidelines first.
5. **Spatial composition & negative space:** Treat empty space as an active design element, not leftover margin. Align elements to shared grid rails, leave 6–12% breathing room at edges (unless intentionally bleeding hero imagery/graphics), and vary layouts across multi-artboard sets.

---

## 2. Reference Aesthetic Directions (Open Inspirations — Mix & Evolve Freely)

| Direction | Visual DNA | Typical Typography | Surface & Layout Character |
|---|---|---|---|
| **Swiss Editorial** | Modular grids, asymmetric balance, sharp hairlines, bold paper/ink + 1 signal accent | `Syne` / `Space Grotesk` / `Instrument Serif` + `Inter` + `IBM Plex Mono` | Flat surfaces, 0–8px corners, crisp 1–2px rules, index numbers (`01`, `02`), generous open columns |
| **Luxury Minimalism** | Quiet prestige, warm alabaster/obsidian/champagne, restrained centerpiece | `Cormorant Garamond` / `Playfair Display` + tracked uppercase `Montserrat` / `Plus Jakarta Sans` | 10–14% margins, subtle borders, zero noisy gradients or heavy shadows |
| **Neo-Brutalism** | Raw high-contrast blocks, stark geometry, heavy borders, electric tension | `Archivo Black` / `Anton` / `Bebas Neue` + `Space Mono` / `IBM Plex Mono` | 0–6px corners, 3–6px solid strokes, oversized tight-leading headlines, hard framing |
| **Cinematic** | Atmospheric depth, full-bleed visuals, dramatic scale contrast | `Oswald` / `Playfair Display` / `Syne` + `Inter` | Moody chiaroscuro dark tones, wide-tracked metadata credits, protected contrast zones |
| **Corporate Premium** | Executive clarity, editorial data authority, calm confidence | `DM Serif Display` / `Plus Jakarta Sans` + `Inter` + `IBM Plex Mono` | Insight-first slide titles, oversized tabular KPIs, subtle 1px hairlines, disciplined deck rails |
| **Experimental** | Sculptural vector `path` forms, kinetic angles, chromatic surprises | `Syne` / `Bricolage Grotesque` / `Fraunces` + `Space Mono` | Intentional diagonal tension, rotated accents, bespoke vector geometry, expressive layering |
| **Contemporary Product** | Clean modern storytelling, tactile bento grids, crisp Lucide icons | `Bricolage Grotesque` / `Space Grotesk` + `DM Sans` | Varied-weight bento tiles, auto-layout stacks, 1 strong focal accent |

> These 7 lenses are creative vocabulary — combine them (e.g. *Swiss Editorial × Corporate Premium* for an annual report, or *Luxury Minimalism × Cinematic* for a fragrance campaign) or invent something completely original when the brief inspires it.

---

## 3. Compositional Craft Principles

- **Asymmetry creates energy:** An intentional 60/40 split or diagonal counter-balance feels far more designed than stacking everything centered down the middle.
- **Hierarchy must be unmistakable in 1 second:** The viewer's eye should immediately read: `1. Focal point (headline or hero visual)` → `2. Supporting insight/detail` → `3. Action or metadata`.
- **Keep copy crisp:** Slides and posters are visual media, not essays. Tighten paragraphs, break long copy into scannable points, and avoid wide walls of body text (>75–90 characters per line).
- **Multi-artboard pacing:** Across a pitch deck or carousel, lock the **grid margins, font pairing, and brand palette**, while **changing composition** from slide to slide (e.g. monumental cover → asymmetric split → editorial 3-column → oversized KPI narrative → calm closing).
- **Always stay editable:** Prefer auto-layout groups (`tata`), reusable components (`jadikan_komponen`), vector paths (`path`/`titik`), and Lucide icons (`ikon`) so the user can effortlessly refine any part on the live canvas.

---

## 4. Autonomous Visual Quality Assurance Loop

Calling `kanvas_view` gives you BOTH **rendered PNGs** and an automated **Visual QA Score + Metrics + Issues/Suggestions**. Never stop at the first render if it merely passes technical syntax:

1. **Fix 100% of `ISSUES`** (overlaps, card/artboard overflows, unreadable contrast, missing images, covered text, colliding line-heights).
2. **Review the QA Score & Metrics:** Check whitespace ratio, font count, type hierarchy ratio, edge margins, near-miss alignments, and Brand Kit alignment. Aim for **QA Score ≥ 85**.
3. **Critique the rendered PNG with your own eyes:**
   - Does the aesthetic actually fit the brief — or does it look like a generic template?
   - Is there clear breathing room, or do blocks feel cramped?
   - Do shared left/top edges align cleanly?
   - Are headlines crisp (1–3 lines) with strong focal impact?
   - Does every color transition and card boundary feel intentional?
4. **Iterate with `kanvas_edit` and call `kanvas_view` again** until both the automated QA and your visual critique are genuinely strong.

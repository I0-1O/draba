# Phase 14 — Export — Data, Textual & Visual

**UI name:** "Export" (toolbar action in every view, alongside Share).

**Status:** 🟢 Planned — scope settled (2026-06-11). This plan supersedes the ROADMAP §14 summary, including its original commitment to server-side gofpdf rendering.

---

## What we're actually building

Get data *out* of draba in the four shapes people actually need:

1. **Data** — CSV / xlsx to take into another tool, edit, and (Phase 15) re-import.
2. **Image** — a PNG of the current view to drop into a slide deck.
3. **Text** — Markdown / plain text / rich clipboard copy to paste into Slack or a prep document.
4. **Print** — a clean, print-styled page the user prints to vector PDF from their own browser; plus a static `.ics` download.

The unifying requirement, same as shares: **the export reflects what's on screen right now** — active filter, sort, group, visible columns. The deliverable is "this view," not "the raw activity list."

### Decisions locked in the design discussion (2026-06-11)

1. **Visual exports render client-side, from the live DOM. No gofpdf, no Chromium.** The ROADMAP's gofpdf plan meant reimplementing four layout engines in Go PDF primitives and keeping them in lockstep with the React views forever — every view feature would need a second implementation, and the "what I see on screen" requirement would mean re-deriving client layout state server-side. Rejected alternatives: **gofpdf** (dual layout engines, permanent drift tax), **chromedp/headless Chromium in the image** (breaks the single-binary promise, bloats the Docker image). A *server-side* pixel renderer, if ever needed (scheduled emailed PDFs, MCP-fetched images), is an **optional Chromium sidecar container** — explicitly deferred, never in the core image.
2. **"PDF" means the printable view, not a raster download.** A client-rasterized PDF is just a PNG in a PDF wrapper (no selectable text, fuzzy at zoom) — cut entirely. Instead, **Export → Printable view** opens a dedicated print-styled route; the user prints to PDF from their browser, which emits true vector output (selectable text, crisp lines, correct pagination) in every modern browser. PNG remains the one raster format, for slide decks.
3. **Data and ICS exports are server-side and API-first; textual and visual exports are client-side and UI-only for v1.** CSV/xlsx/ICS come from authenticated API endpoints a CLI/MCP can hit. Markdown/clipboard/PNG/print are generated in the browser from the already-filtered in-memory rows — guaranteed identical to the screen, zero server layout code. The API-first principle is consciously relaxed for *presentation* formats; the *data of record* formats stay on the API.
4. **Filter fidelity reuses Phase 13 assets.** The export modal captures the current live toolbar state the same way "Share this view" does (resolved `FilterDefinition` + view config). Server-side tabular exports evaluate the frozen filter with the **existing Go `matchesFilter` port** and its golden-fixture parity suite — no new filter machinery.
5. **One ExportDialog for all views, driven by a per-view capability descriptor.** Each view declares which formats it offers and which options apply. Adding a view later = adding a descriptor, not a new dialog.
6. **Cut from scope:** Google Docs/Sheets native integration (xlsx opens in Sheets; a Drive OAuth connector belongs with the connectors phase), RTF (rich-HTML clipboard covers paste into Word/Google Docs), wall-calendar month-grid PDF (edge case; revisit on demand), raster PDF download (see #2).

---

## Reused infrastructure (do not rebuild)

| Concern | Existing asset | Notes |
|---|---|---|
| Filter evaluation (Go) | `matchesFilter` Go port + golden-fixture parity suite (Phase 13.1) | Tabular export evaluates the frozen filter server-side, exactly like the share projection builder. |
| View-state capture | Share-modal `view_config` snapshot (13.2) | Export captures the same resolved `{ filter, group, sort, color, visible columns }` from the live toolbar state. |
| ICS generation | 13.4 feed generator | Static `.ics` export = same generator, authenticated route, `Content-Disposition: attachment`. |
| Read-only render path | Public share viewer (`interactive=false` view modes) | Printable routes render the same non-interactive views with a print stylesheet instead of share chrome. |
| Toolbar slot | Gantt "Export" stub (Phase 8.1); 11.1/11.2/11.3 toolbar slots | Becomes the real Export menu/dialog trigger in every view. |
| Color/identity display | `resolveActivityColor`, `Badge`, `memberGroups.ts` | Same hues and grouping in PNG/print output as on screen. |

---

## The export capability matrix

| Format | Gantt | List | Kanban | Calendar | Pipeline |
|---|---|---|---|---|---|
| CSV | ✓ | ✓ | ✓ | ✓ | Server (data — view-independent) |
| xlsx | ✓ | ✓ | ✓ | ✓ | Server (data — view-independent) |
| ICS | ✓ | ✓ | ✓ | ✓ | Server (13.4 generator) |
| Markdown | — | ✓ | ✓ | ✓ (agenda) | Client (textual) |
| Plain text / clipboard | — | ✓ | ✓ | ✓ (agenda) | Client (textual) |
| PNG | ✓ | ✓ | ✓ | ✓ | Client (DOM rasterization) |
| Printable view | ✓ | ✓ | ✓ | ✓ | Client (print route → user prints to vector PDF) |

Gantt has no sensible textual shape — its Markdown/text need is served by the List view of the same data. Calendar's textual form is an agenda-style date-grouped list, not a grid.

---

## Sub-phases

### 14.1 — Foundation + data exports (M, 2–3 days)

*API:*
- `POST /timelines/:id/export` — authenticated; body `{ format: "csv" | "xlsx" | "ics", viewConfig?: { filter?: FilterDefinition, sort?, group?, visibleColumns? } }`; streams the file with `Content-Disposition: attachment`. The frozen filter is evaluated in Go (reuse the 13.1 evaluator); omitted `viewConfig` = whole timeline.
- `GET /timelines/:id/export.csv|.xlsx|.ics?filter=<savedFilterId>` — convenience GET for CLI/scripting; `?filter=` resolves a saved filter server-side (the 10.4.6 forward-compat hook).
- CSV/xlsx columns match the Phase 15 import template (title, start, end, description, status name, assignee names, tags, parent title, progress, location, url) so the round-trip holds.
- Sync (block and return the file) for v1 — these are bounded by timeline size; revisit only if real-world exports get slow.

*Web:*
- `ExportDialog` — single dialog, sections: format picker (from the active view's capability descriptor), scope (current view as filtered vs. whole timeline), per-format options. Wired into the Gantt toolbar Export stub and the List/Kanban/Calendar toolbar slots. **Design handoff (claude design, 2026-06-12):** [`docs/design/handoffs/export-modal/`](../design/handoffs/export-modal/design_handoff_export_modal/README.md) — format rail + options pane, filter-context strip, verb-distinct actions (download/copy/print), empty-view warning. High-fidelity but directional: recreate with the codebase's Dialog/Button/etc., per the handoff README.
- Per-view capability descriptor module (`lib/exportCapabilities.ts`) — declares formats + options per view type.

### 14.2 — Textual exports (S, ~1 day)

- Markdown: GitHub-flavored table for List/Kanban (Kanban = one section per column); agenda-style date-grouped list for Calendar. Header block: team, timeline, generated-at, filter description.
- Plain text: same structures, aligned monospace.
- **Copy to clipboard** with dual flavors (`text/plain` + `text/html`) so paste lands rich in Slack/Word/Google Docs and clean in editors. Download-as-file also offered for `.md`.
- All generated client-side from the in-memory filtered rows — identical to screen by construction.

### 14.3 — PNG snapshot (S–M, 1–2 days)

- DOM rasterization via `html-to-image` (MIT) of the view container at current state; 2x pixel density for deck quality.
- Header strip (team, timeline, generated-at, filter description) composited above the capture.
- Known constraints to handle: capture full scrollable extent (temporarily unclamp the container), inline self-hosted fonts, force light theme for the capture frame (consistent with shares).

### 14.4 — Printable views (M, 2–3 days)

- Dedicated print routes (e.g. `/timelines/:id/print/:view`) rendering the non-interactive view components with a print stylesheet: fixed printable width, page-break-aware pagination, no app chrome, light theme, header strip on each page.
- Gantt: landscape hint, date-range pagination across pages, member-color legend strip.
- List: styled table, repeating column headers per page.
- Kanban: columns at printable width, page-break between column groups when too wide.
- Calendar: week/month layout paginated by period. (Wall-calendar *poster* layout remains cut.)
- "Export → Printable view" opens the route in a new tab and triggers `window.print()`; the user saves as PDF from the browser dialog — vector output, no draba-side PDF engine.

---

## Open questions — resolved

- **Sync vs. async exports:** sync for v1 (decision #3 / 14.1); no job queue.
- **Find highlights:** filter only — Find is ephemeral (unchanged from ROADMAP).
- **PDF engine:** none — printable views + browser print-to-PDF (decision #2).

## Exit criteria — safe to pause when

*(each sub-phase is independently pausable)*

- **14.1:** CSV and xlsx exports contain exactly the activities visible under the active filter; `?filter=` GET works for a saved filter; static `.ics` imports cleanly into a calendar app; the Export dialog opens from all four view toolbars with formats scoped per view.
- **14.2:** Markdown export renders correctly in a previewer and pastes rich into Slack/Google Docs via the clipboard flavors.
- **14.3:** PNG of each view is recognizable, full-extent, correct colors, header strip present.
- **14.4:** each view's printable route paginates correctly via browser print preview; Gantt bars positioned correctly with legend; output PDF has selectable text.
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean.

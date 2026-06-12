# Handoff: Export view modal (Phase 14)

## Overview
An "Export this view" dialog for **Draba** (team timeline / coordination tool). Triggered from the new **Export** button in every view's toolbar, next to the existing **Share** button (Phase 13). The mental model is identical to Share: **"export what I'm seeing"** — the active filter, sort, grouping, and visible columns apply to the export, and the dialog makes that visibly true.

One dialog serves all four views (**Gantt, List, Kanban, Calendar**). The formats offered depend on the view, driven by a **capability matrix of descriptors** — adding a future view or format means adding a descriptor, not redesigning the dialog.

The original product brief is included as `export-dialog-brief.md` (source of truth: `docs/plans/phase-14-export.md`).

---

## About the Design Files
The files in this bundle are **design references created in HTML/React (via in-browser Babel)** — prototypes that show the intended look and behavior. They are **not production code to copy directly.**

Your task is to **recreate this design in the target codebase using its established environment and patterns.** Draba's stack is **React + Tailwind CSS v4 + shadcn/ui + lucide-react**. Use the codebase's existing components (Dialog, Button, RadioGroup, etc.) and design tokens rather than porting the inline styles. The share modal (Phase 13) is the closest existing sibling — match its shell conventions.

The prototype's inline styles reference CSS custom properties from `colors_and_type.css` — that file is the **single source of truth for tokens** and maps 1:1 onto the codebase's Tailwind theme.

---

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and interaction states are all intentional. Recreate the dialog pixel-accurately using the codebase's component library and the tokens in `colors_and_type.css`. The **backdrop** (sidebar + timeline) is contextual scaffolding only — do **not** implement it; it already exists in the app. The only backdrop change that ships is the new **Export** toolbar button.

---

## Capability matrix (core architecture)

| Format | Gantt | List | Kanban | Calendar | Action verb | Per-format options |
|---|---|---|---|---|---|---|
| CSV | ✓ | ✓ | ✓ | ✓ | Download `.csv` | Scope picker |
| Excel | ✓ | ✓ | ✓ | ✓ | Download `.xlsx` | Scope picker |
| Calendar (.ics) | ✓ | ✓ | ✓ | ✓ | Download `.ics` | Scope picker |
| Markdown | — | ✓ | ✓ | ✓ | **Copy** (primary) + Download `.md` (secondary) | none v1 |
| Plain text | — | ✓ | ✓ | ✓ | **Copy** | none v1 |
| PNG image | ✓ | ✓ | ✓ | ✓ | Download `.png` (with **Generating…** busy state) | none v1 (light theme, 2×, full extent) |
| Printable view | ✓ | ✓ | ✓ | ✓ | **Open print view** (new tab + browser print dialog) | none v1 (orientation/paper via browser) |

In the prototype this is the `XM_FORMATS` array in `ExportModal.jsx`: each descriptor carries `id, name, icon, verb ('download'|'copy'|'print'), ext, scope?, generating?, secondaryDownload?, header?, views?, desc`. A format with no `views` key is available everywhere. Implement the same way — the dialog renders entirely from descriptors.

**Three distinct action verbs** must read differently in the UI:
- **download** → lucide `download` glyph, primary button "Download .csv" etc.
- **copy** → lucide `copy` glyph, primary button "Copy to clipboard"
- **print** → lucide `external-link` glyph, primary button "Open printable view" — it is *not* a download; it opens a clean print-styled page in a new tab and triggers the browser print dialog (that's how users get a vector PDF).

---

## Screens / Views

A single dialog with internal states. All structural values below are from `ExportModal.jsx`.

### 1. Trigger (toolbar)
**Export** button in each view's toolbar, immediately left of **Share**: outline style — `border: 1px var(--border)`, `background: var(--card)`, `color: var(--foreground)`, 13.5px / 600, padding 8px 16px, `radius-md`, lucide `file-output` (15px, stroke 2). (Share stays amber/filled; Export is deliberately quieter.)

### 2. Modal shell
- **Overlay:** fixed, full-viewport, `background: rgb(20 28 33 / 0.55)`, `backdrop-filter: blur(2px)`, centered, 24px padding. **Clicking the overlay does NOT close the dialog** (intentional change from the share modal — avoids losing a chosen format/scope by mis-click). **Esc**, the × button, and **Cancel** close.
- **Card:** `width: min(620px, 100%)` (wider than share's 580 to fit the two-pane body), `max-height: 88vh`, `background: var(--card)`, `border-radius: var(--radius-xl)` (12px), `box-shadow: var(--shadow-lg)`, flex column, `overflow: hidden`. Entrance: fade + `translateY(8px) scale(.98)` → none over 180ms `cubic-bezier(.2,.7,.3,1)`; overlay fades in 150ms.
- Regions top→bottom: **header**, **filter context strip** (both fixed), **body** (format rail + options pane, scrollable), **footer** (fixed).

**Header** (padding 18px 20px 14px):
- Icon tile 38×38, `radius-md`, `background: color-mix(in srgb, var(--primary) 12%, transparent)`, `color: var(--primary)`, lucide `file-output` 19px stroke 2.2.
- Title `h2` "Export this view" — 17px / 700 / `--foreground`.
- Subtitle 12.5px / `--muted-foreground` with 8×8 amber square (`#F29E4C`, radius 2): "Marketing timeline · **{View} view**" — view name is dynamic.
- Close ×: 30×30, `radius-md`, `background: var(--muted)`, lucide `x` 16px.

**Filter context strip** (in a wrapper padded 0 20px 14px with bottom border `1px var(--border)`):
A rounded strip — `radius-lg`, padding 9px 12px, `background: var(--muted)` — that makes "export what I'm seeing" visible:
- lucide `filter` 14px muted + text 12.5px:
  - Filter active → "Filtered: **Status is In progress**" (filter description bold 600)
  - No filter → "Exporting the {View} view as you see it"
- Right-aligned count badge 11.5px / 600 / muted: "23 of 61 activities" (filtered) or "All 61 activities" (no filter).
- **Empty-view warning variant** (0 activities under the current filter): strip background becomes `color-mix(in srgb, var(--warning) 13%, transparent)`, icon swaps to lucide `alert-triangle` in `var(--warning)`, badge "0 of 61 activities" in `var(--warning)`, and a second line (12px muted, margin-left 22 to align past the icon): *"This view has no activities — the export will be empty or headers-only."* **Exporting remains allowed** — warn gently, don't block.

### 3. Body — format rail (left)
`role="listbox"`, width 196px, right border, padding 10, column gap 2, scrolls if needed. One row per available format (filtered by the capability matrix for the current view — Gantt shows 5 rows, List/Kanban/Calendar show all 7).

Row: full-width button, padding 8px 9px, `radius-md`, flex gap 9:
- Format icon 15px — `--muted-foreground` stroke 1.8; selected → `--primary` stroke 2.2. Icons: `table` (CSV), `file-spreadsheet` (Excel), `calendar-plus` (ICS), `file-text` (Markdown), `align-left` (Plain text), `image` (PNG), `printer` (Printable view).
- Name 13px, weight 400 (600 selected), `--foreground`, ellipsizes.
- Right-aligned **verb glyph** 11px (`download` / `copy` / `external-link`), `--muted-foreground` at 0.65 opacity (0.9 when selected), `title` tooltip "Download" / "Copy" / "New tab" — this is how the three action types read at a glance.
- Selected: `background: color-mix(in srgb, var(--primary) 10%, transparent)`. Hover (unselected): `background: var(--muted)`. No left-border accents (design-system rule).

Selecting a format resets any transient action state. **CSV is pre-selected** on open. If the view changes and the current selection becomes unavailable, fall back to CSV.

### 4. Body — options pane (right)
Flex 1, padding 16px 18px, column gap 14, scrollable. Content is descriptor-driven, top→bottom:

1. **Format heading**: name 14px / 700 + one-line description 12.5px muted, line-height 1.5 (exact copy in `XM_FORMATS`).
2. **Scope picker** (data formats CSV/Excel/ICS only) under field label "ACTIVITIES TO EXPORT" (field labels: 11px / 700 / uppercase / letter-spacing 0.06em / muted, margin-bottom 6). A bordered radio group (`1px var(--border)`, `radius-lg`, rows split by 1px borders), rows padded 10px 12px:
   - **Current view** — sub (11.5px muted): "23 of 61 activities · matches your filter" (live count) or "All 61 activities · nothing filtered out" when unfiltered.
   - **Entire timeline** — sub: "All 61 activities · ignores filters".
   - Radio: 16px circle; off `1.5px solid var(--input)`; on `5px solid var(--primary)` with `--primary-foreground` center. Selected row bg `color-mix(in srgb, var(--primary) 9%, transparent)`. Default: **Current view**.
   - All non-data formats always export the current view as seen — no scope UI.
3. **Filename chip** (download verbs only) under label "FILE": `background: var(--muted)`, `radius-md`, padding 7px 11px, `--font-mono` 12px, lucide `file-down` 13px; value `marketing-timeline-2026-06-12.csv` with the extension rendered in `--muted-foreground`. (Name pattern: `<timeline-slug>-<yyyy-mm-dd><ext>` — generated, not editable v1.)
4. **Header-strip hint** (Markdown, Plain text, PNG, Printable — every visual/textual export): dashed box `1px dashed var(--border)`, `radius-md`, padding 8px 11px. Eyebrow "INCLUDES HEADER STRIP" (10px / 700 / uppercase / ls 0.07em / muted) over one muted 11.5px line: "Acme Co · Marketing timeline · Generated Jun 12, 2026 · Status is In progress" (filter segment only when a filter is active). The dialog does not configure the header — this is a preview hint only.
5. **Info hints** (lucide `info` 13px + 12px muted text, line-height 1.5):
   - Printable view: *"Opens in a new tab and starts your browser's print dialog — choose "Save as PDF" there for a crisp vector PDF."*
   - PNG: *"Rendered on your device — large timelines can take a few seconds."*

### 5. Footer
Padding 13px 20px, top border. Right-aligned button row (gap 10):
- **Cancel** — outline (`1px var(--border)`, `background: var(--card)`), 13px / 600, padding 8px 16px, `radius-md`. Closes.
- **Download .md** (Markdown format only) — outline secondary, lucide `download` 14px.
- **Primary action** — `background: var(--primary)`, `color: var(--primary-foreground)`, min-width 168px, centered content, lucide glyph 14px stroke 2.2. Label/icon by verb:
  - download → `download` + "Download .csv" / ".xlsx" / ".ics" / ".png"
  - copy → `copy` + "Copy to clipboard"
  - print → `external-link` + "Open printable view"

**Two-click happy path:** open → pick format (CSV pre-selected) → hit the primary action.

---

## Interactions & Behavior
- **Open/close:** Export button opens. Esc, ×, Cancel close. **Overlay click does not close.**
- **Copy success (Markdown / Plain text):** writes the rendered export to the clipboard; primary button flips for **1600ms** to `background: var(--success)` / `--success-foreground` with lucide `check` + "Copied", then reverts.
- **PNG generating:** click → button shows lucide `loader-2` spinning (`0.9s linear infinite`) + "Generating…", disabled, opacity 0.75 for the client-side render (~1.5s simulated) → success state `check` + "Downloaded" (success colors) for 1600ms → reverts. Export is synchronous v1 — no job queue.
- **Other downloads:** fire immediately; brief 1600ms "Downloaded" success state on the button.
- **Printable view:** opens the print-styled page in a **new tab** and triggers `window.print()` there; the dialog button shows "Opened in new tab" (success state, 1600ms). The printable page itself is a separate brief — out of scope here.
- **Format switch:** resets transient phase (generating/copied/done) and keeps scope selection.
- **Empty view:** warning strip (see above); all actions remain enabled.
- **Animations:** overlay fade 150ms, card pop 180ms, button state transitions 150ms, spinner 0.9s linear. Functional only — no springs/bounces (Draba motion guidance).

## State Management
Per dialog instance:
- `formatId: string` — selected format (default `'csv'`, validated against the current view's matrix).
- `scope: 'view' | 'all'` — data formats only (default `'view'`).
- `phase: 'idle' | 'generating' | 'copied' | 'done' | 'opened'` — transient action feedback; timers cleared on unmount.

Inputs the dialog needs from the app:
- Current **view type** (gantt/list/kanban/calendar) → filters the format descriptors, sets subtitle.
- Current **filter context**: human-readable description (e.g. "Status is In progress"), visible count, total count.
- **Timeline name + team name + generated-at** for the subtitle, filename, and header-strip hint.
- Action handlers per verb: file generation/download (CSV/xlsx/ICS/PNG), clipboard write (Markdown/Plain text), and opening the print route in a new tab.

## Design Tokens
All defined in `colors_and_type.css` (`:root` + `.dark` overrides). Used here:
- **Colors:** `--primary` (#288C9B teal) / `--primary-foreground`; `--success` / `--success-foreground`; `--warning` (empty-state strip); `--card`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--background`; `--secondary` (#F29E4C, backdrop Share button + subtitle square only).
- **Translucent tints** via `color-mix(in srgb, <token> N%, transparent)`: primary 9–12% (selected rows, icon tile), warning 13% (empty strip). Prefer the codebase's existing alpha conventions (the share modal used hsl alpha literals; color-mix keeps tints token-driven across dark mode — either is acceptable, be consistent).
- **Radii:** `--radius-md` 6, `--radius-lg` 8, `--radius-xl` 12.
- **Shadows:** `--shadow-sm`, `--shadow-lg`.
- **Type:** `--font-sans` Open Sans; `--font-mono` (filename chip). Weights 400/600/700. Sizes: 10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 17px.
- **Spacing:** 4px base grid.
- **Dark mode:** toggling `.dark` on the root flips every token — no per-component dark styling. The prototype defaults to dark; verify both themes.

## Assets
- **Icons:** [lucide](https://lucide.dev) (`lucide-react` in the app). Dialog: `file-output`, `filter`, `alert-triangle`, `table`, `file-spreadsheet`, `calendar-plus`, `file-text`, `align-left`, `image`, `printer`, `download`, `copy`, `external-link`, `file-down`, `info`, `check`, `loader-2`, `x`. Backdrop only: `calendar-range`, `columns-3`, `calendar`, `users`, `settings`, `link`.
- **Brand logo:** `assets/icon-teal.svg` — backdrop sidebar only.
- No raster images.

## Out of scope (per brief — do not build)
Google Docs/Sheets integration, RTF, raster-PDF download, wall-calendar poster; async/job-queue export states; the printable page layouts and the PNG/Markdown output contents themselves.

## Files
- `Export Modal.html` — entry point; mounts the app, applies dark mode, wires the Tweaks panel (active view / filter state / dark — a prototyping aid, not part of the feature).
- `ExportModal.jsx` — **the deliverable.** Format descriptors (`XM_FORMATS`), verb metadata, context strip, scope picker, filename chip, header-strip hint, footer action state machine. Filter fixtures (`XM_FILTERS`) are mock data.
- `Backdrop.jsx` — contextual Draba timeline behind the dialog. **Reference only — do not implement.** The new outline **Export** toolbar button next to Share is the one part that ships.
- `tweaks-panel.jsx` — prototype tooling. Ignore for production.
- `colors_and_type.css` — design tokens (maps to the codebase's Tailwind theme).
- `export-dialog-brief.md` — the original Phase 14 product brief.
- `assets/` — brand logo SVG (backdrop only).

To preview: open `Export Modal.html` in a browser. Use the Tweaks panel (toolbar) to switch the active view (Gantt drops the textual formats), the filter state (filtered / none / empty), and light/dark.

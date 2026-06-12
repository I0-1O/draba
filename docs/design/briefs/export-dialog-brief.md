# Design Brief: Export dialog

**For:** claude design — mock up the Export dialog as an HTML/JSX prototype bundle (same deliverable format as the share-modal handoff: entry HTML, JSX component(s), README, `colors_and_type.css`).
**Source of truth:** `docs/plans/phase-14-export.md` (Phase 14). This brief is self-contained — everything needed is below.

---

## Product context

**draba** is a team coordination/planning tool — people plan team activities on a shared timeline and view them as **Gantt, List, Kanban, or Calendar**. Phase 13 added a **Share** button (public read-only links) to every view's toolbar; Phase 14 adds **Export** right next to it.

The export mental model, identical to Share: **"export what I'm seeing."** The active filter, sort, grouping, and visible columns apply to the export. The dialog should make that visibly true (e.g. show the applied-filter description and a visible-activity count).

One dialog serves all four views. The formats offered depend on the view (capability matrix below). Adding a future view should mean adding a descriptor, not redesigning the dialog.

## Capability matrix

| Format | Gantt | List | Kanban | Calendar | Action type |
|---|---|---|---|---|---|
| CSV | ✓ | ✓ | ✓ | ✓ | Download file |
| Excel (xlsx) | ✓ | ✓ | ✓ | ✓ | Download file |
| Calendar (.ics) | ✓ | ✓ | ✓ | ✓ | Download file |
| Markdown | — | ✓ | ✓ | ✓ | **Copy to clipboard** (primary) or download `.md` |
| Plain text | — | ✓ | ✓ | ✓ | **Copy to clipboard** |
| PNG image | ✓ | ✓ | ✓ | ✓ | Download file (brief generating state — client renders it) |
| Printable view | ✓ | ✓ | ✓ | ✓ | **Opens a new tab** + browser print dialog (user saves as PDF) |

Three distinct action verbs — **download**, **copy**, **open print view** — should read differently on their buttons/rows. "Printable view" is not a download: it opens a clean print-styled page in a new tab and triggers the browser's print dialog (this is how users get a vector PDF). Make that expectation legible in the UI (e.g. an external-link/printer affordance and a one-line hint).

## Per-format options

- **CSV / xlsx / ICS (data formats):** a **scope** choice — "Current view" (filtered; show live count, e.g. "23 of 61 activities") vs. "Entire timeline" (all activities, ignores filter). Data formats only; all other formats always export the current view as seen.
- **Markdown / plain text:** no options v1. Primary action = copy (with a ~1.5s "Copied" success state, like the share modal's Copy button); secondary = download `.md`.
- **PNG:** no options v1 (always light theme, 2x density, full extent). Show a short indeterminate "Generating…" state on the action.
- **Printable view:** no options v1 (orientation/paper handled by the browser print dialog).
- Every visual/textual export carries a **header strip** (team name · timeline name · generated-at · filter description) — the dialog doesn't need to configure it, but a small preview hint of it is welcome.

## Flows & states to mock

1. **Default state** — dialog open from a view toolbar; formats for that view; one format pre-selected (CSV). Show at least Gantt (no textual formats) and List (full set) variants.
2. **Format selected → options + action** — the per-format option area and the correctly-verbed primary action (Download / Copy / Open printable view).
3. **Copy success** — transient confirmation.
4. **Generating (PNG)** — brief busy state on the action button.
5. **Filter context** — an active filter is shown ("Filtered: Status is In Progress · 23 of 61 activities") vs. no filter ("All 61 activities").
6. **Empty view** — 0 activities under the current filter: exporting is allowed but warn gently ("This view has no activities — the export will be empty or headers-only").
7. **Dark mode** — token-driven, like the share modal.

Open layout question — designer's call: single surface (format list left / options + action right) vs. a flat list of format rows each with its own inline action. Optimize for the common case being two clicks: open → pick format → act.

## Context & chrome

- **Trigger:** "Export" button in each view's toolbar, sitting next to the existing "Share" button (amber, link icon). Suggest a `download` or `file-output` lucide icon.
- Modal shell conventions should match the share modal: centered card ~`min(580px, 100%)`, overlay `rgb(20 28 33 / 0.55)` + 2px blur, `--radius-xl` card, fade/pop entrance ~180ms, Esc/overlay/× close, footer with a Done/Cancel.
- A simplified backdrop (timeline behind the modal) is welcome for context but is **reference only**, as in prior handoffs.

## Design system

Reuse `colors_and_type.css` from the share-modal handoff (`docs/design/handoffs/share-modal/design_handoff_share_modal/`) — it is the token source of truth and maps 1:1 to the app's Tailwind theme. Key tokens: `--primary` #288C9B teal, `--secondary` #F29E4C amber, `--success`, `--destructive`, `--card/--muted/--border/--foreground` families; radii 6/8/12; Open Sans (`--font-sans`), `--font-mono` for filenames/URLs; 4px spacing grid; `.dark` flips everything. Icons: lucide. Motion: functional, no springs.

Target stack note for the README you produce: the app is React + Tailwind v4 + shadcn/ui + lucide-react; the prototype is a directional reference to be recreated with the codebase's existing Dialog/Button/etc. components, not copied verbatim.

## Out of scope (do not mock)

- Google Docs/Sheets integration, RTF, raster-PDF download, wall-calendar poster — all cut from Phase 14.
- Async/job-queue export states (exports are synchronous v1).
- The printable pages themselves and the PNG/Markdown output contents — this brief covers only the dialog. (Printable-page layout may be a follow-up brief.)

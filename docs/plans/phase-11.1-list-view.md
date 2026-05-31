# Phase 11.1 (ALT) — List View

**UI name:** "List" (the user-facing view label). Internally this doc sometimes says "spreadsheet" to signal the *editing ambition* — but the toolbar button and view switcher say **List**.

**Status:** 🟢 Reviewed — scope settled. All first-round decisions resolved (see [Decisions](#decisions-resolved-first-review) at the bottom): paste-fill/fill handle cut, light multi-select deferred, group/color-by mirror Gantt. Ready to promote into ROADMAP.md when we choose to schedule the phase. This is an *alternate* proposal for Phase 11.1, replacing the current ROADMAP.md plan ("List / Spreadsheet View").

**Why this rewrite exists:** the original 11.1 plan reads like a generic data-grid spec ("scroll 1000+ rows smoothly," "virtualized table," bulk-edit-everything). That's the wrong center of gravity. We are not building a database admin tool. We're building the surface a team lead reaches for when they'd otherwise open Excel or a Google Doc to plan the team's work. Two goals drive everything below:

1. **Edit activities like a spreadsheet** — click a cell, type, Tab to the next, Enter to commit and move down. Keyboard-first, no modal round-trips. (Quick single-cell edits — *not* Excel-grade range fills; that's what import is for.)
2. **Curate a digestible view** — hide/show/reorder columns so a human can take in the whole list *in one sitting*. The win is a calm, readable table, not a 40-column firehose.

The original "edit 1000+ records" framing is explicitly **out**. Real draba timelines are tens of activities, maybe low hundreds. We optimize for *legibility and fast single-cell edits*, not bulk mutation throughput.

---

## How other tools do this (research notes)

Quick survey of the spreadsheet-style editing surfaces in the tools people actually use for team planning, and what's worth borrowing.

### Airtable — the gold standard for "spreadsheet that's secretly a database"
- **Keyboard model** (the part worth copying almost verbatim):
  - Arrow keys move the *selection* between cells without entering edit mode.
  - `Enter` or `F2` enters edit mode on the active cell; `Esc` cancels back to selection.
  - `Tab` / `Shift+Tab` commit + move horizontally; `Enter` commits + moves down.
  - `Cmd/Ctrl+C` / `V` copy-paste — pasting one value into a multi-cell selection fills them all.
  - `Space` expands the active *record* (their version of our detail panel).
  - `Shift+Enter` inserts a row below.
- **Field (column) management:** show/hide via a "Hide fields" menu, drag to reorder, drag edge to resize. State is per-*view*, so the same data can have a "Planning" view and a "Status report" view with different columns. This per-view persistence is the key idea behind making a list "digestible."
- Takeaway: **the selection-vs-edit-mode distinction is the whole game.** A grid that drops you straight into a text input on every click feels nothing like a spreadsheet. A grid where arrows move a highlight and Enter opens the cell *does*.

### Smartsheet — "every row is a grid row, like Excel"
- Treats data as a literal grid (vs. Airtable's record/relation model). Closer to how a non-technical planner thinks.
- `Shift+Space` selects a whole row, `Ctrl+Space` a whole column. Drag the bottom-right corner of a cell to **fill** down/right (the Excel fill handle).
- Takeaway: the **fill handle** and column/row selection are familiar muscle memory for Excel refugees — our exact target user. Worth having on the roadmap even if not in v1.

### monday.com
- Same data shown as grid / Gantt / Kanban / calendar / timeline — view switching over one dataset. Validates our view-switcher direction.
- Their grid leans on colored status "pills" and inline dropdowns rather than raw text cells — editing a status is picking a swatch, not typing. We already have per-timeline statuses with colors; this maps directly.

### Notion databases
- Strength is *not* dense editing — it's the calm, low-chrome table and trivially easy hide/reorder of properties. Editing is click-to-open-cell, lighter-weight keyboard story than Airtable.
- Takeaway: Notion proves the "digestible curated view" half of our goal can be the headline feature on its own. A clean table with great column controls is valuable even before the keyboard grid is fully Excel-grade.

### Linear
- Not a spreadsheet, but its list view nails *inline property editing without a modal*: click an assignee/status/label cell → small command-menu popover → pick → done, all keyboard-drivable. For our set-valued fields (status, assignees, tags) this popover-per-cell pattern is a better fit than a raw text input.

### React implementation landscape
- **TanStack Table v8** is the obvious headless choice: built-in state for `columnVisibility`, `columnOrder`, `columnSizing`, `columnPinning`, sorting, row selection. Headless = we render with our own shadcn/Tailwind markup and own the styling. It does *not* ship virtualization or DnD — you bolt those on only if needed.
- **@dnd-kit/core** is the current standard for column-reorder drag (both official TanStack DnD examples use it).
- **Virtualization** (TanStack Virtual / react-window) is available but **we likely don't need it** at our row counts — see the "no virtualization in v1" decision below.
- A from-scratch grid (no TanStack) is viable too given our modest feature set; trade-off discussed under Open Questions.

**Net synthesis for draba:** Build a *legible, curated* table (Notion's calm + per-view column config) with an *Airtable-grade keyboard editing model* (selection vs. edit mode, Tab/Enter flow, paste-fill) and *Linear-style popovers* for our set-valued fields (status/assignees/tags). Skip the "big data" machinery (virtualization, mass mutation) entirely for v1.

Sources: [Airtable keyboard shortcuts](https://support.airtable.com/docs/airtable-keyboard-shortcuts), [Airtable Interface Designer](https://support.airtable.com/docs/getting-started-with-airtable-interface-designer), [Smartsheet keyboard shortcuts](https://help.smartsheet.com/articles/522200-keyboard-shortcuts), [Smartsheet vs Airtable (monday.com)](https://monday.com/blog/project-management/smartsheet-vs-airtable/), [TanStack Table column ordering](https://tanstack.com/table/v8/docs/guide/column-ordering), [TanStack Table column visibility](https://tanstack.com/table/v8/docs/guide/column-visibility), [TanStack Table column sizing](https://tanstack.com/table/v8/docs/guide/column-sizing), [DataSheetGrid (Show HN)](https://news.ycombinator.com/item?id=38228788).

---

## What we're actually building

A **List View** — a third peer to Gantt (and the later Calendar/Kanban), reachable from the view switcher. It shows the active timeline's activities as a table where:

- The user **curates the columns**: hide the ones they don't care about, reorder the rest, resize them, and that arrangement *sticks* (per-timeline, per-user, via existing preferences).
- The user **edits inline like a spreadsheet**: keyboard-driven cell selection and edit, with field-appropriate editors (text input for title, date picker for dates, color-pill popover for status, avatar-multiselect for assignees).
- The list stays **digestible**: sensible default columns, comfortable density, no horizontal-scroll firehose unless the user opts into more columns.

It is the same activity data as Gantt, respecting the same active filter — just rendered as rows instead of bars.

### Explicitly out of scope (the things I'm cutting from the old plan)
- ❌ "Scroll 1000+ rows smoothly" / virtualization as a v1 requirement. Our timelines aren't that big; chasing it adds a dependency and complexity for a problem we don't have.
- ❌ Heavy bulk-mutation toolbar (bulk archive/delete/status-change across a large selection). The old plan made bulk-edit a co-equal pillar; it shouldn't be.
- ❌ **Paste-fill and fill handle.** Deliberately *not* doing the Excel power-grid gestures. If a user wants spreadsheet-grade bulk manipulation, the right answer is "do it in Excel and import it" (a later phase), not to reimplement Excel inside draba. List editing is for quick single-cell tweaks, not data-entry marathons.
- ❌ Treating this as a "power user database editor." The user is a team lead doing weekly planning, not a data entry operator.
- 🔜 **Light multi-select** (checkbox gutter + Archive / Set-status bar) — *maybe later*, not now. Not in this phase's scope; revisit once the core List view is in use.

---

## The data: columns

Activities already carry everything we need ([`Activity`](../../packages/api/internal/...) — see repomap). Proposed column catalog, with which are shown by default:

| Column | Field | Editable inline | Default visible | Editor type |
|--------|-------|:---:|:---:|-------------|
| Title | `title` | ✅ | ✅ | text input |
| Start | `startAt` | ✅ | ✅ | date (+ time if not all-day) |
| End | `endAt` | ✅ | ✅ | date (+ time if not all-day) |
| Duration | derived (end − start) | ❌ (read-only) | ✅ | computed text |
| Status | `statusId` | ✅ | ✅ | color-pill popover (timeline statuses) |
| Assignees | `assignedMemberIds` | ✅ | ✅ | avatar multi-select popover |
| Tags | `tagIds` | ✅ | ✅ | tag multi-select popover |
| Progress | `percentComplete` | ✅ | ⬜ | number / mini slider |
| Parent | `parentActivityId` | ✅ | ⬜ | activity picker popover |
| All-day | `allDay` | ✅ | ⬜ | checkbox |
| Location | `location` | ✅ | ⬜ | text input |
| URL | `url` | ✅ | ⬜ | text input |
| Description | `description` | ✅ | ⬜ | text input (truncated, expand on edit) |
| Created | `createdAt` | ❌ | ⬜ | computed text |
| Updated | `updatedAt` | ❌ | ⬜ | computed text |

Notes:
- **Default set is deliberately small** (Title, Start, End, Duration, Status, Assignees, Tags). That's the "digestible in one sitting" baseline. Everything else is opt-in via the columns menu.
- `Title` should probably be a **pinned/frozen left column** so it stays visible when the user has scrolled right or resized aggressively. (Linear/Airtable both freeze the primary column.)
- Color/icon could become a thin leading affordance on the Title cell rather than its own columns.

---

## Column curation (the "digestible view" half)

This is the feature that makes the view worth having. Three controls, all persisted per-timeline-per-user:

1. **Hide/show** — a "Columns" menu (checklist) in the view toolbar slot. Toggling re-renders immediately.
2. **Reorder** — drag column headers left/right (@dnd-kit). Pinned Title stays leftmost.
3. **Resize** — drag the header's right edge; double-click edge to auto-fit.

**Persistence:** store a single preference blob, e.g. key `spreadsheet_columns`, scoped to the timeline, shaped like:

```jsonc
{
  "order":   ["title", "startAt", "endAt", "status", "assignees"],
  "hidden":  ["progress", "parent", "location", "url", "description"],
  "widths":  { "title": 280, "startAt": 120, "endAt": 120 }
}
```

This reuses the existing `usePreferences` / `useUpsertPreference` hooks ([usePreferences.ts](../../packages/web/src/hooks/usePreferences.ts)) — same mechanism Gantt's `group_by` / `sort_by` already use. No new persistence machinery.

**Density toggle** (Comfortable / Compact) — a second small control; also persisted. Compact lets more rows fit "in one sitting," directly serving the legibility goal.

**Future (not v1): saved column presets.** Airtable's per-*view* column sets are powerful — "Planning view" vs. "Status report view" over the same data. We get a taste of this for free once Phase 16 (Shares) lands, since a share freezes a view config including visible columns. Worth noting but not building here.

---

## Inline editing (the "spreadsheet" half)

The interaction model, lifted from Airtable because it's correct:

### Two modes: selection vs. edit
- **Selection mode** (default): a single cell is highlighted. Arrow keys move the highlight. Nothing is editable yet — this is what makes it feel like a grid, not a forest of input boxes.
- **Edit mode**: `Enter`, `F2`, or starting to type opens the active cell's editor. `Esc` cancels (revert), `Enter`/`Tab` commits.

### Navigation
| Key | Action |
|-----|--------|
| Arrows | Move selection between cells |
| `Tab` / `Shift+Tab` | Commit edit, move right / left |
| `Enter` | Commit edit, move down (in selection mode: enter edit) |
| `Esc` | Cancel edit, return to selection |
| `Cmd/Ctrl+C` / `V` | Copy / paste cell value(s) |
| `Space` | Open the full [EventDetailPanel] for the active row |
| click off-cell (row gutter) | Open EventDetailPanel |

### Field-appropriate editors (not everything is a text box)
- **Text** (title, location, url, description): inline `<input>`.
- **Dates** (start, end): date popover; respects all-day (hide time component when `allDay`).
- **Status**: color-pill popover listing the timeline's statuses — pick a swatch, à la monday.com.
- **Assignees / Tags**: multi-select popover with avatars/chips, à la Linear. Keyboard: type to filter, Enter to toggle.
- **Progress**: numeric input or tiny slider.
- **Parent**: searchable activity picker.

### Saving
- Each committed cell edit fires a `PATCH /activities/:id` with just the changed field — the same endpoint the EventDetailPanel already uses, so no new API surface.
- **Optimistic update** via TanStack Query so the cell reflects instantly; rollback + toast on failure.
- When the user switches back to Gantt, edits are already reflected (shared query cache).

### Not doing: paste-fill / fill handle
- We intentionally skip Excel's range-paste and drag-corner-fill gestures. Cell copy/paste of a *single* cell is fine, but filling a range is out — that's Excel's job. Bulk spreadsheet manipulation will be served by an **import** path in a later phase, not by rebuilding Excel inside the List view.

### Not doing (this phase): light multi-select
- A checkbox gutter + minimal Archive / Set-status bar is a plausible *future* addition once the view is in real use, but it's **not in this phase**. Core value is the curated, legible table with quick single-cell edits.

---

## View-switcher infrastructure (lands here, reused by 11.2/11.3)

Unchanged from the original plan's intent — this is the one piece worth keeping wholesale:
- Extend `ViewMode` to `'gantt' | 'list' | 'calendar' | 'kanban'`.
- View switcher control in the timeline sub-toolbar; choice persisted per-timeline via preferences.
- **View-specific toolbar slots** so List can contribute its "Columns" and "Density" controls without crowding the shared bar. Gantt keeps its granularity control; List ignores granularity (it doesn't apply to a flat table).

### Group-by / Color-by — mirror Gantt (planned, likely a fast-follow not first cut)

Gantt already exposes these controls ([GanttToolbar.tsx](../../packages/web/src/components/gantt/GanttToolbar.tsx)), and the user wants List to feel consistent with them:

- **Group by** — Gantt offers `none | member | parent`. For List, mirror those and **add `status`** (grouping a table by status column is very natural). Rendered as collapsible group header rows with a count, rows nested beneath.
- **Color by** — Gantt offers `activity | member | status`. In a table this becomes a **colored accent** — a left border stripe on the row or a dot on the Title cell — rather than Gantt's filled bar.

Both persist per-timeline via preferences, reusing the same keys/pattern Gantt uses, so a user's grouping/coloring intent is shared mental model across views. These are drawn as a **planned addition** — the static table + column curation + inline editing are the core; group/color slot in cleanly afterward.

---

## Library decision (to confirm before building)

**Recommendation: TanStack Table v8 (headless) + @dnd-kit for column drag.** No virtualization library in v1.

Rationale:
- TanStack gives us `columnVisibility`, `columnOrder`, `columnSizing`, `columnPinning`, sorting, and row-selection *state management* for free, while we keep full control of markup (shadcn `<Table>` primitives + Tailwind). That's a lot of the column-curation feature handed to us.
- Headless means no fight with its styling — it owns logic, we own pixels.
- It's a new dependency (we currently have zero table libs), but a well-maintained, tree-shakeable, widely-used one. The alternative — hand-rolling column order/visibility/resize state — is genuinely fiddly and TanStack has solved exactly these.

**Counter-option:** roll it by hand. Our feature set is modest and a bespoke grid avoids the dep. But the keyboard grid + column DnD + resize state is the hard 20% TanStack already ships; I'd lean toward the library. *Flag for your call.*

**Virtualization: deferred.** At tens-to-low-hundreds of rows, plain DOM rendering is fine and far simpler. We add TanStack Virtual *only if* a real timeline ever proves janky. This is a direct reversal of the old plan's "must scroll 1000+ rows" requirement and the main thing keeping this phase small.

---

## Rough build order

1. **View-switcher infra** — `ViewMode` extension, switcher control, per-view toolbar slots, preference persistence. (Foundational; 11.2/11.3 depend on it.)
2. **Static table** — TanStack Table wired to the active timeline's activities, default columns, density toggle, respects active filter. Read-only first. This alone is shippable value (the "digestible view").
3. **Column curation** — hide/show menu, drag reorder, resize, persistence blob. Pin Title.
4. **Inline editing — text & dates** — selection/edit modes, Tab/Enter navigation, PATCH + optimistic update.
5. **Inline editing — popover fields** — status pill, assignees, tags, parent.
6. **Group-by / Color-by** — mirror Gantt (group: none/member/parent/status; color: activity/member/status as a row accent), persisted.

*Not in this phase:* light multi-select (maybe later), paste-fill / fill handle (out — Excel's job, served by future import), saved column presets (rides along with Phase 16 Shares).

Each step is independently shippable, which makes this easy to pause — far more so than the old monolithic plan.

---

## Draft exit criteria

Safe to pause when:
- View switcher toggles Gantt ↔ Spreadsheet, choice persists per timeline.
- Spreadsheet shows the active timeline's activities with the default columns, respecting the active filter.
- Hiding, reordering, and resizing columns works and **survives a reload** (persisted per-timeline-per-user).
- Density toggle changes row height and persists.
- Arrow keys move cell selection; Enter/F2 enters edit; Esc cancels; Tab/Enter commit-and-move.
- Editing Title, Start, End, and Status inline saves via PATCH and is reflected in Gantt when switched back.
- Title column stays pinned/visible when scrolled horizontally.
- Sorting by a column header reorders rows without losing selection.
- Group-by and Color-by controls work and persist per-timeline (mirroring Gantt).

---

## Decisions (resolved, first review)

1. **Library — TanStack Table v8 (headless) + @dnd-kit.** ✅ Confirmed. Virtualization stays deferred.
2. **Naming — "List".** ✅ The UI label is **List**; this doc keeps "spreadsheet" only as shorthand for the editing feel.
3. **Sorting — single-column for v1.** ✅
4. **Group-by / Color-by — yes, mirror Gantt.** ✅ Planned addition (see the view-switcher section). Group: `none | member | parent | status`; Color: `activity | member | status` rendered as a row accent.
5. **Paste-fill — cut.** ❌ Excel's job. Bulk spreadsheet manipulation will be served by a future **import** path, not by rebuilding Excel inside List.
6. **Fill handle (drag-corner-to-fill) — cut.** ❌ Same rationale as paste-fill.
7. **Light multi-select — deferred, not this phase.** 🔜 May add a checkbox gutter + Archive / Set-status bar later, once the core view is in real use. Out of scope for now.

### Still open / to decide later
- Exact persistence key names and whether group/color reuse Gantt's literal preference keys or get List-scoped ones (leaning: List-scoped, so a user can group Gantt by member but List by status independently).
- Whether group-by collapsed-state persists.

---

*Once you've reviewed and tweaked, the agreed version replaces the "Phase 11.1 — Web — List / Spreadsheet View" section in [ROADMAP.md](../ROADMAP.md).*

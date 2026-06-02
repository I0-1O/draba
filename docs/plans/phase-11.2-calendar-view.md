# Phase 11.2 — Calendar View

**UI name:** "Calendar" (view-switcher label, alongside Gantt / List / Kanban).

**Status:** 🟢 Reviewed — scope settled. Re-engineered from the original ROADMAP.md plan after two design decisions were made (see [Decisions](#decisions-resolved) at the bottom). Replaces the prior "Month / Week / Day with 24-hour time grid" proposal.

**Why this rewrite exists:** the original plan was modeled on Google Calendar / Outlook — three sub-layouts (Month / Week / **Day**) with a 24-hour vertical time grid and a side-by-side *time-overlap* lane algorithm. That framing is wrong for draba: **every activity is all-day.** There is no time-of-day editor anywhere in the product, and (per the Person + Time Range + Work mental model) there is no plan to add one before Phase 15. So:

1. **Day view is cut.** A day view exists to show hour-by-hour scheduling. With all-day activities there is nothing to schedule within a day — a "day" is just a single calendar cell. Week + Month cover every need.
2. **The 24-hour time grid is cut.** There is no time axis. Both Week and Month are pure **all-day-bar** surfaces.
3. **The time-overlap lane algorithm is cut.** Activities never overlap *in time-of-day* (they have none). The only layout problem that remains is **vertical stacking of concurrent multi-day bars** — a date-range packing problem, not a time-of-day one.

What's left is genuinely simpler than the original L-effort estimate suggested, *except* for three pieces that carry real weight: the lane-packing algorithm, the manual row-height resize affordance, and drag-move/resize on a week-wrapping grid.

---

## What we're actually building

A familiar calendar surface that answers **"what is the team working on this week / this month?"** at a glance. It is **not** a Gantt replacement (Gantt answers "how does this project unfold over a quarter?"). Two zoom levels:

- **Month** — a 6-week grid (the canonical calendar). Multi-day activities render as continuous bars spanning day cells; bars lane-pack within each week row.
- **Week** — 7 day columns, taller cells, same all-day bar model. More vertical room per day, so more lanes are visible before overflow.

Both reuse one component skeleton and one lane-packing core. Both carry over **color-by** (activity / member / status) from Gantt/List, open the existing **`ActivityDetailPanel`** on bar click, prefill **create** on empty-cell click, and support **drag-move + edge-resize** with whole-day snapping.

### The density problem (the one real design question)

With 5 team members each on 1–2 concurrent activities, every day is crossed by 5–10 bars. A naive grid turns into mush. The decision (see [Decisions](#decisions-resolved)) is **classic shared grid + color**, *not* member swimlanes — keep the familiar single-grid Google-calendar feel and lean on three levers to keep it legible:

1. **Color-by** — the primary signal. `color-by: member` lets you read *whose* week is loaded at a glance by hue; `color-by: status` shows what's in-progress vs. blocked; `color-by: activity` is per-activity color. Carried over verbatim from Gantt's `ColorBy` model.
2. **Filters** — the existing filter engine (Phase 10.4.6) is the escape hatch. "Show only Brian's work," "Open only," saved filters — all apply to Calendar unchanged.
3. **Overflow handling = "+N more" popover *plus* a manual row-height resize handle** (the hybrid decision). Each week row has a *visible-lane cap*. Bars beyond the cap collapse into a `+N more` chip per day; clicking it opens a **day popover** listing every activity on that day (each row → `ActivityDetailPanel`). Critically, the user can **drag the bottom edge of any week row to raise its visible-lane cap**, revealing more lanes inline instead of going through the popover. Row-height (cap) state persists per-timeline-per-user.

This hybrid is the heart of the re-plan: uniform compact rows by default (calm, scannable), with a one-drag escape valve to "open up" a busy week without leaving the grid or losing the at-a-glance layout.

---

## Reused infrastructure (do not rebuild)

Everything below already exists and Calendar consumes it as-is. This is most of why the phase is tractable.

| Capability | Where it lives | How Calendar uses it |
|---|---|---|
| View-switcher (`ViewMode = 'gantt' \| 'list' \| 'calendar' \| 'kanban'`) | `TopBar.tsx`, `DashboardPage.tsx` (`view` state, per-timeline `view_mode` pref) | `'calendar'` branch added to the content-area switch, exactly like the `'list'` branch at `DashboardPage.tsx:529`. |
| **Color-by** (`ColorBy = 'activity' \| 'member' \| 'status'`) | `GanttToolbar.tsx:14`; resolution logic in `GanttView.tsx` `toRichActivity` (`:148–151`) | Lift the color-resolution expression into a tiny shared helper (`lib/activityColor.ts`) so Gantt, List, and Calendar share one source of truth. Calendar bars fill from it. |
| **Edit sidebar** (`ActivityDetailPanel`) | Mounted at `DashboardPage.tsx:569`, fed by `selectedApiActivity` / `onSelectApiActivity` | Bar click → `onSelectApiActivity(activity)` → existing panel slides in. **Zero new code** in the panel itself. |
| **Create panel** (`ActivityCreatePanel`) | `DashboardPage.tsx:581`, fed by `createDefaults` | Empty-cell click → set `createDefaults` with `{ start, end, memberId: null }` prefilled to the clicked day. Same mechanism as Gantt lane-drag. |
| **Live drag → sidebar preview** | `onBarDragProgress` / `onBarDragEnd` / `liveDragDates` (`DashboardPage.tsx:513–520`) | Calendar's drag fires the same callbacks so the open sidebar shows live snapped dates during a drag, identical to Gantt. |
| **Filter engine** | `applyActiveFilter` (`lib/presetFilters.ts`), `FilterContext` | Calendar computes `visibleActivities` the same way `GanttView` does (`:494`). |
| **Find** | `FindContext`, `matchEvents` (`lib/findMatcher.ts`) | Calendar registers ordered matches and applies the same highlight treatment to bars. |
| **Timezone-safe dates** | `lib/activityDates.ts` (Phase 11.1.1) — `parseActivityDateUTC`, `formatActivityDate`, `toDateInput`, `toISODate` | **All** calendar cell math, bar positioning, and the today marker use the **UTC basis**. This is non-negotiable — same defect class Phase 11.1.1 fixed for Gantt/List. |
| **Member typing + colors** | `toMember`, `MEMBER_COLORS`, `resolveColorHex` | Same conversion `GanttView` uses (`:105–114`). |
| Per-timeline preference persistence | `usePreferences` / `saveTimelinePref` | Stores `calendar_layout` (month/week), `calendar_anchor_date`, and per-week row-cap overrides. |

---

## Architecture

```
DashboardPage
 └─ CalendarView                 (data container — mirrors GanttView's responsibilities)
     ├─ useTimelineActivities / useTeamMembers / useUpdateActivity
     ├─ applyActiveFilter → visibleActivities
     ├─ buildCalendarModel()    (pure, unit-tested — see below)
     └─ CalendarGrid             (presentational — cells, bars, drag, popover)
         ├─ CalendarToolbar      (layout toggle, today/prev/next, jump-to-date) — or fold into existing toolbar slot
         ├─ MonthGrid / WeekGrid (share cell + bar renderers)
         └─ DayOverflowPopover
```

`CalendarView` is the analog of `GanttView`: it owns no layout chrome, takes `colorBy` / `layout` / `anchorDate` as props from `DashboardPage`, fetches + filters, builds the model, and hands it to `CalendarGrid`. Keep the **pure model-builder exported** for unit tests, exactly as `GanttView` exports `buildRows`.

### The lane-packing core (`lib/calendarLanes.ts`, new, pure, unit-tested)

This is the one genuinely new algorithm. Per **week row** (a contiguous run of 7 day-columns):

1. Clip every activity's `[startAt, endAt]` (UTC, all-day) to the week's date span; drop activities that don't intersect the week.
2. Sort the week's segments by start day, then by longer span first (stable, predictable packing).
3. Greedy lane assignment: place each segment in the lowest lane index whose existing segments don't overlap its `[startCol, endCol]`. This yields the minimum lane count and a deterministic layout.
4. A multi-day activity that crosses a week boundary (e.g. Thu→next Mon) is **split into one segment per week row**, each independently lane-packed. Mark the cut edges so the bar renders without an end-cap on the continued side (standard calendar "continues" affordance).

The model the builder emits:

```ts
interface CalendarSegment {
  activityId: string;
  startCol: number;      // 0–6 within the week row
  endCol: number;        // 0–6, inclusive
  lane: number;          // 0-based packing lane
  continuesLeft: boolean;  // clipped at week start (came from prior week)
  continuesRight: boolean; // clipped at week end (continues next week)
  color: string;           // resolved via shared activityColor helper
  title: string;
  // …find-match flag, isChild, etc.
}
interface WeekRow {
  weekStart: Date;            // UTC midnight, Monday/Sunday per week_start pref
  days: Date[];               // 7 UTC dates
  segments: CalendarSegment[];
  laneCount: number;          // max lane + 1 (the natural height)
  visibleLaneCap: number;     // from per-week pref; default e.g. 3
}
```

`visibleLaneCap` drives both rendering (lanes `>= cap` are hidden) and the per-day `+N more` counts (count of that day's segments whose `lane >= cap`).

### Overflow: "+N more" popover + manual row resize

- **Default cap:** Month rows default to a small cap (≈3 lanes) so a 6-week month stays one screen. Week rows default higher (taller cells, ≈6) since there are only ever 1–5 rows.
- **`+N more` chip:** rendered in a day cell when that day has hidden segments. Click → `DayOverflowPopover` anchored to the cell, listing **all** of that day's activities (color dot + title + date range), each click-through to `ActivityDetailPanel`.
- **Manual row-height handle:** a 4–6px grab strip along the **bottom edge of each week row**. Dragging it down raises that row's `visibleLaneCap` (snapping per lane-height); dragging up lowers it. Min = 1, max = the row's natural `laneCount` (can't drag past "everything visible"). Persisted per-timeline-per-user keyed by week index *or* by `weekStart` ISO. Reuses the same pointer-drag scaffolding as the Gantt label-column resize (`GanttGrid.tsx` `onLabelColWChange`, `:457–466`) — a controlled value + an `onChange`.

### Drag-move and edge-resize on the grid

The user explicitly wants move + resize via mouse (parity with Gantt). The Gantt drag code (`GanttGrid.tsx` bar-drag, `:334–431`) is **column-index based on a single horizontal axis** and does *not* port directly — a calendar wraps weekly, so a horizontal drag can cross a week boundary into a different visual row.

Approach for v1:
- **Hit zones** mirror Gantt: left/right `EDGE_W`(≈8px) edges = resize, body = move.
- **Pointer math is geometric, not column-index:** on pointer-move, hit-test the cursor against the rendered day-cell rects (a flat `Date[]` for the whole visible grid) to resolve the **target day**. This naturally handles week-wrap — moving the cursor to the next row maps to the correct date. Snap to whole days (no sub-day in an all-day model).
- **Move** preserves duration: `newStart = targetDay - grabOffsetDays`, `newEnd = newStart + originalSpan`. **Resize** moves only the grabbed edge, clamped so `end >= start`.
- Fire `onBarDragProgress(id, newStart, newEnd)` live (sidebar preview) and `onBarDrag(id, newStart, newEnd)` on pointer-up → `PATCH /activities/:id` with `{ startAt, endAt }` as ISO UTC midnights (`toISODate`), with the same optimistic `setQueriesData` cache write Gantt uses (`GanttView.tsx:567–589`).
- **Reuse, don't re-derive:** lift Gantt's `handleBarDrag` (optimistic cache update + sidebar push + mutate) into a shared hook (`useActivityDrag`) so Calendar and Gantt share the commit path; only the *geometry → dates* step differs.

---

## Build order

1. **`lib/activityColor.ts`** — extract the color-by resolver from `GanttView.toRichActivity`; refactor Gantt to use it (no behavior change, keeps the three views identical). Tests.
2. **`lib/calendarLanes.ts`** — pure `buildWeekRows(activities, range, weekStart, colorBy, …)` + greedy lane packing + week-boundary splitting. Unit tests are the bulk of correctness here (single-day, multi-day, cross-week, fully-overlapping stacks, empty weeks, `+N` counts at a given cap).
3. **`CalendarGrid` (Month)** — render weeks → day cells → lane-positioned bars; today marker (UTC); `+N more` chips; `DayOverflowPopover`. Read-only first.
4. **Wire into `DashboardPage`** — `'calendar'` content branch, `view === 'calendar'` toolbar slot (layout toggle + today/prev/next + jump-to-date), `calendar_layout` / `calendar_anchor_date` prefs. Color-by reuses existing `colorBy` state.
5. **Click behaviors** — bar → `onSelectApiActivity`; empty cell → `createDefaults` prefilled; popover row → sidebar. (All callbacks already exist on `DashboardPage`.)
6. **Week layout** — same renderers, 7 columns, taller cells, higher default cap.
7. **Manual row-height resize** — bottom-edge handle per week row; per-week cap pref persistence; reuse Gantt resize scaffolding.
8. **`useActivityDrag`** — extract Gantt's commit path; add Calendar's geometric drag-move + edge-resize with whole-day snapping and live sidebar preview.
9. **Find + filter parity** — register matches, apply highlight; confirm `applyActiveFilter` flows through.
10. **Polish** — `week_start` / `date_format` prefs honored; dark mode; empty-state; keyboard (←/→ prev/next, `t` today) if cheap.

---

## Decisions (resolved)

- **Day view: cut.** All activities are all-day; a day view has nothing hour-level to show. Week + Month only.
- **Time grid + time-overlap lane algorithm: cut.** No time axis exists. The only layout problem is multi-day bar stacking.
- **Dense-day model: classic shared grid + color**, not member swimlanes. Keep the familiar single-grid calendar; color-by + filters + overflow handle density. (Swimlanes were considered as the "team at a glance" answer and rejected to preserve the familiar calendar feel — revisit only if the grid proves illegible in practice.)
- **Overflow: "+N more" day popover *plus* a manual per-week row-height resize handle.** Uniform compact rows by default; drag a row's bottom edge to reveal more lanes inline; popover lists the full day for anything still hidden. Cap persists per-timeline-per-user.
- **Color-by: carried over** from Gantt/List via a shared `activityColor` helper (no new toolbar concept — same three modes).
- **Bar click → existing `ActivityDetailPanel`; empty cell → existing `ActivityCreatePanel`.** No new sidebar UI.
- **Drag-move + edge-resize: in v1, both Week and Month**, whole-day snapping, geometric hit-testing (not column-index), sharing Gantt's optimistic commit path via a new `useActivityDrag` hook.

## Open questions (resolve during build, low-risk)

- **Default `visibleLaneCap` values** (Month vs Week) — tune against the multi-assignee sample timeline; the row-resize handle makes the exact default forgiving.
- **Row-cap persistence key** — per `weekStart` ISO date (survives navigation, but unbounded growth) vs. per visible-row-index (bounded, but resets on navigation). Lean to `weekStart` with a capped LRU, decide in step 7.
- **Multi-assignee bar affordance** — a single bar per activity colored by `colorBy`, with stacked member dots on the bar (mirroring the List/Gantt group-header dots from 11.1.2) vs. plain. Cheap to add; decide in step 3.

## Exit criteria — safe to pause when:

- View switcher toggles Gantt ↔ List ↔ Calendar, persisting the choice per timeline.
- Calendar renders the active timeline's activities in correct day cells, honoring the active filter and `week_start` / `date_format` prefs.
- Month and Week layouts both render with no data discrepancy between them or vs. Gantt/List.
- A multi-day activity renders as a continuous bar spanning cells, with correct "continues" affordance across week boundaries.
- Color-by (activity / member / status) recolors bars and matches Gantt/List for the same activity.
- A day with more bars than the visible cap shows a correct `+N more` chip; the popover lists every activity that day; each row opens `ActivityDetailPanel`.
- Dragging a week row's bottom edge raises/lowers its visible lanes and the change survives a reload.
- Clicking a bar opens the edit sidebar; clicking an empty cell opens create prefilled to that day.
- Dragging a bar's body moves it (duration preserved, whole-day snap, correct across week-wrap) and PATCHes; dragging an edge resizes it; the open sidebar shows live dates mid-drag.
- Find highlights matching bars in both layouts.
- `lib/calendarLanes.ts` and `lib/activityColor.ts` have unit tests covering the packing/coloring edge cases.
- `pnpm --filter web lint` clean; `pnpm --filter web test` passes.

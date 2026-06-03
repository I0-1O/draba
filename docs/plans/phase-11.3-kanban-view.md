# Phase 11.3 — Kanban View (Interactive)

**UI name:** "Kanban" (view-switcher label, alongside Gantt / List / Calendar).

**Status:** 🟢 Reviewed — scope settled. **Re-scoped 2026-06-03** from the original ROADMAP.md "Read-Only" plan. The original framing (static board, status-only columns, drag-to-change-status deferred to v2) is replaced with a **fully interactive board**: drag-to-recolumn, group-by-driven columns, color-by, configurable sorts, configurable card fields, and inline create/edit. This plan supersedes the ROADMAP §11.3 summary.

**Design handoff:** `docs/design/handoffs/kanban-view/` (from Claude Design — `Kanban View.html` + `README.md`). The handoff is **directional**: it is a dark-hardcoded HTML/Babel prototype that models a single-timeline status board with HTML5 drag. We recreate it inside the draba codebase using real primitives (`@dnd-kit`, design tokens, `ActivityPanel`, `Badge`, the existing filter/Find/preference infrastructure) and **correct it against our actual data model** (see [Corrections to the handoff](#corrections-to-the-handoff)).

---

## What we're actually building

A **board view** that answers *"what is in each bucket, and let me move things between buckets"* — the column-and-card complement to Gantt (time), List (table), and Calendar (dates). Activities render as cards arranged into vertical columns. The **column axis is whatever `Group by` is set to** (Status by default). Cards can be **dragged between columns to change that grouping dimension** (drag to a new status column → status changes; drag to a member column → reassignment; etc.), clicked to open the existing edit panel, and created inline per column.

It reuses almost all of its machinery from the three shipped views — the only genuinely new pieces are the **board layout + column model**, the **`@dnd-kit` drag-to-recolumn commit path**, and the **per-group-by drag semantics**.

### The five requested capabilities (from the rethink)

1. **Color by** (activity / member / status) — reused verbatim from Gantt/List/Calendar via `lib/activityColor.ts`. Drives the card's **left accent border** (3px). Independent of Group by.
2. **Group by defines the columns** — the column axis *is* the Group by selection. Status → one column per timeline status; Member → one column per team member; etc. (full matrix below).
3. **Sorts** — within-column ordering. See [Sort model](#sort-model).
4. **Terminology** — draba uses **"Member"** and **"Assigned to"**, never "Assignee." The handoff's `assignee` becomes **member** in code (`memberById`, `assignedMemberIds`) and **"Assigned to"** in user-facing column/group labels. (See [Corrections](#corrections-to-the-handoff).)
5. **Card field toggles** — a **"Card fields"** multi-select in the toolbar controls what each card shows (dates, status, tags, members, % complete, parent, description). Persists per-timeline-per-user. See [Card field configuration](#card-field-configuration).

---

## Reused infrastructure (do not rebuild)

Everything below already exists and Kanban consumes it as-is. This is most of why the phase is tractable (S–M, not L).

| Concern | Existing asset | Notes |
|---|---|---|
| Activity + member fetch | `useTimelineActivities`, `useTeamMembers` (`hooks/useTeamActivities.ts`) | Same calls CalendarView makes. |
| Status fetch | `useTimelineStatuses` (`hooks/useStatusTemplates.ts`) | Live per-timeline status rows (`id`, `name`, `color`, `icon`, `isClosed`, `position`). Already passed into views as `timelineStatuses`. |
| Status / reassign / reparent mutation | `useUpdateActivity(timelineId)` | Already supports `{ statusId, assignedMemberIds, parentActivityId }` patches with optimistic cache update. **This is the entire drag-commit backend — no new endpoint.** |
| Color resolution | `resolveActivityColor()` (`lib/activityColor.ts`) | activity / member / status; identical hues to other views. |
| Member-combination grouping | `lib/memberGroups.ts` | `memberComboKey`, `memberComboLabel`, `comboSortComparator` — reused for "group by Assigned to (combination)". |
| Filter engine | `applyActiveFilter` (`lib/presetFilters.ts`) + `FilterContext` | Board respects the active filter exactly like Calendar. |
| Find | `matchEvents` (`lib/findMatcher.ts`) + `FindContext` | Dim non-matches, highlight matches, register ordered match IDs. |
| Preferences | `usePreferenceMap` / `useUpsertPreference` (per-timeline) | Persists collapsed columns, card-field set, group/sort/color. |
| Edit / create panels | `ActivityPanel.tsx` | Card click → detail/edit; column "+ Add" → create prefilled. |
| Identity display | `Badge` + `resolveColorHex` (`components/identity/`) | Member avatars, status dots, tag chips. |
| Drag library | `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | Already a dependency (used by List). Use this, **not** HTML5 DnD from the prototype. |
| Toolbar control idiom | `GanttToolbar` / `CalendarToolbar` | Copy the `select`/`btn`/`divider`/`label` className constants and layout. |
| WebSocket sync | `useWebSocket` wiring in DashboardPage | Cards update live; no Kanban-specific work beyond consuming the shared cache. |

---

## Corrections to the handoff

The prototype encodes assumptions that are wrong for draba. Implement the **draba** column, not the prototype's:

| Handoff says | draba reality | Resolution |
|---|---|---|
| `assignee` / "Assignee" | We use **Member** / "Assigned to"; an activity has `assignedMemberIds[]` (0..n) | Rename everywhere: code → `member`, labels → "Assigned to". Multi-member is the norm, not the exception. |
| `priority: high\|medium\|low` field + footer arrow indicators + "Group by: Priority" + "Sort by: Priority" | **There is no priority field** on `Activity` | **Drop priority entirely.** Replace its slots with real fields: Group by gains Member / Parent; the footer indicator slot is reused for **% complete** (optional card field). |
| Hardcoded status column set (`not-started`, `in-progress`, …) with fixed hexes | Statuses are **per-timeline live rows** from a template; null status is valid | Columns come from `useTimelineStatuses` in `position` order, colored by each status's identity color. Add a leading **"No status"** column for `statusId == null`. |
| Columns = statuses (only Status wired) | Columns = **Group by** (Status / Assigned to / Parent / …) | Generalize: a `buildColumns(groupBy, …)` function produces `{ id, label, color, accept }[]`. |
| Color by: Activity / Assignee | Color by: **activity / member / status** | Reuse the shared `ColorBy` type and `resolveActivityColor`. |
| HTML5 `draggable` + raw drag state | `@dnd-kit` is in the repo | Use `DndContext` + `useDraggable`/`useDroppable` (or `SortableContext`) for reliable reordering + keyboard a11y. |
| Dark-only hardcoded hexes (`#161b22`, …) | Token-driven, light+dark | Drive everything from `--card`, `--border`, `--muted-foreground`, etc. Map the token table in the handoff to our CSS vars. |
| Share modal stub | Share lands in Phase 16 | Keep the toolbar Share/Export **buttons as stubs** (matching Gantt/Calendar), wired to the same no-op handlers. |

---

## Column model (Group by → columns)

`Group by` is the column axis. Each mode produces an ordered list of columns and defines what **dropping a card into a column** mutates.

| Group by | Columns | Order | Drop mutates | Notes |
|---|---|---|---|---|
| **Status** (default) | one per timeline status + leading **"No status"** | status `position` | `statusId` → target status (or `null` for the No-status column) | The canonical kanban. Column header uses status color + name; count badge. |
| **Assigned to (member)** | one per team member + leading **"Unassigned"** | team-member order | sets `assignedMemberIds` to `[targetMemberId]` (see [Reassign semantics](#reassign-semantics)) | Header uses member `Badge` + name. |
| **Assigned to (combination)** | one per distinct member-combination present + **"Unassigned"** | `comboSortComparator` (from `memberGroups.ts`) | **drag disabled** (a combination is not a single settable value) | Mirrors the List/Gantt "combination" grouping. Read-only columns; cards still open/edit. |
| **Parent activity** | one per parent that has children + **"No parent"** | parent title A–Z | `parentActivityId` → target parent (or `null`) | Useful for milestone/sub-task boards. |
| **None** | single column ("All activities") | — | drag = reorder only | Fallback; mostly a degenerate case. Sort still applies. |

- **Closed-status columns** (`isClosed`) render with the same muted treatment used elsewhere; they are normal drop targets.
- A column whose grouping value is gone (e.g. a member removed) is dropped from the board; its cards reflow to Unassigned/No-status.
- Columns can be **collapsed** to a 40px vertical rail (per-column, persisted). Matches the handoff.

### Reassign semantics (Group by: Member)

Activities are multi-member; a column is a single member. Decision: **dropping into member column X sets `assignedMemberIds = [X]`** (replace, not append) — the board treats member columns as "primary owner" buckets, which keeps drag deterministic and reversible. A card assigned to multiple members appears **only in its primary (first) member's column**; the extra members still show as avatars on the card. This is documented in a one-line helper tooltip on the Group-by control when Member is selected. (Append/multi-column membership is explicitly out of scope — revisit if users ask.)

---

## Sort model

Sort orders cards **within** each column. Options (toolbar `Sort by`, persisted):

| Sort | Comparator | Rationale |
|---|---|---|
| **Start date** (default) | `startAt` asc, nulls last | Matches Gantt/List/Calendar default; "what's coming up in this bucket." |
| **End date** | `endAt` asc, nulls last | "What's due first in this bucket" — the most useful kanban sort. |
| **Title** | `title` A–Z, locale-aware | Stable, predictable lookup. |
| **% complete** | `percentComplete` desc, nulls last | Surfaces nearly-done vs. not-started within a column. |
| **Recently updated** | `updatedAt` desc | "What changed lately" — pairs well with real-time sync. |
| **Manual** | persisted per-column order | **See decision below.** |

**Manual ordering decision:** `Activity` has **no `kanbanOrder`/`position` field today**, so true manual within-column ordering would require a schema migration + API field + per-card persistence on every drop. For this phase, **Manual is deferred** — within-column order always follows the chosen Sort. Cross-column drag (the headline interaction) needs no order field because it mutates the grouping value, and the card reflows by Sort. If users want hand-curated card order, it becomes a fast follow (`11.3.1`): add `kanban_order REAL` to `activities`, persist on `dnd-kit` reorder, expose "Manual" sort. Flagged in [Open decisions](#open-decisions).

---

## Card field configuration

A **"Card fields"** dropdown (multi-select checkboxes) in the toolbar controls card content. Default-on marked ✓. Persisted per-timeline-per-user as a JSON string preference (`kanban_card_fields`).

| Field | Default | Renders |
|---|---|---|
| Title | always on (not toggleable) | 13px/500, line-clamp 2 |
| **Date range** | ✓ | calendar icon + `start – end` (respects `date_format` pref; honors timezone-safe formatting from 11.1.1) |
| **Status** | ✓ (hidden automatically when Group by = Status, since the column already encodes it) | small status dot + name chip |
| **Tags** | ✓ | tag chips (name + color), max ~3 then `+N` |
| **Assigned to** | ✓ (hidden automatically when Group by = Member) | overlapping member `Badge` avatars (−6px), 2px card-bg ring |
| **% complete** | ☐ | thin progress bar or `NN%` in the footer (reuses the slot the prototype gave priority) |
| **Parent** | ☐ | parent-activity badge/pill (hidden when Group by = Parent) |
| **Description** | ☐ | 1-line muted snippet under the title |

- **Context-aware suppression:** the field that *is* the current Group by axis is auto-hidden (no point showing Status on a status-grouped card). Implemented as a derived "effective field set," the stored preference is unchanged.
- The **color accent border** is always present (driven by Color by) — it is not a toggleable field.

---

## Interactions

- **Drag to recolumn** (`@dnd-kit`): pick up a card, drop on a column → commit the grouping mutation via `useUpdateActivity` with optimistic cache update (same pattern as `CalendarView.handleBarDragCommit`). Drop target highlights (`{colColor}` tint + accent border) and shows a placeholder gap. Keyboard-draggable (dnd-kit a11y). Disabled for combination grouping and `None`.
- **Card click → edit:** opens `ActivityPanel` (detail/edit), exactly as Calendar/Gantt bar-click. A hover **configure** affordance (pencil, top-right) is optional polish; primary path is full-card click. The configure click must `stopPropagation` so it doesn't initiate a drag.
- **Inline create:** each column header (or footer) has a **"+ Add"** affordance → opens `ActivityPanel` create mode **prefilled with that column's grouping value** (status = column status, or member = column member, etc.). Mirrors Calendar's empty-cell create.
- **Collapse column:** header chevron / clicking the collapsed rail toggles; persisted per-column.
- **Filter parity:** board renders `applyActiveFilter(...)` output; column counts reflect filtered set.
- **Find parity:** non-matching cards dim to ~0.3; matches get the amber outline; active match gets the stronger outline; register ordered match IDs (column order, then in-column Sort order) so prev/next walks the board. If the active match is in a collapsed column, auto-expand it (mirrors Gantt's collapsed-group expand).
- **Real-time:** WebSocket deltas update the shared TanStack cache; cards appear/move/vanish without reload. A card whose status changes in another tab animates to its new column on the next render.
- **Archived hiding:** archived activities excluded by default (filter engine handles it).
- **Empty column:** muted "No activities" placeholder (token-driven), still a valid drop target.
- **Horizontal scroll:** board scrolls columns left→right as a group; each column scrolls its cards vertically and independently when card count exceeds height.

---

## Component layout

Mirrors the `components/calendar/` split (toolbar / grid / view-container):

```
components/kanban/
  KanbanToolbar.tsx   # Group by · Sort by · Color by · Card fields · (Export/Share stubs)
  KanbanBoard.tsx     # DndContext + columns row; renders KanbanColumn[]; owns drag overlay
  KanbanColumn.tsx    # droppable column: header (dot/badge + label + count + collapse), card list, "+ Add"
  KanbanCard.tsx      # draggable card: accent border, title, configurable fields, member avatars
  KanbanView.tsx      # data container: fetch + filter + Find + colorBy + buildColumns + drag commit
  kanbanColumns.ts    # pure: buildColumns(groupBy, activities, members, statuses) → Column[]; unit-tested
  KanbanView.test.ts  # buildColumns + sort comparators (pure-fn tests, mirrors calendarLanes.test.ts)
```

`kanbanColumns.ts` is the pure, testable core (like `calendarLanes.ts`): given `groupBy` + the visible activities + members + statuses, produce ordered `{ id, label, color, icon?, accept, items }[]`. All grouping/labeling/ordering logic lives here so the React components stay thin.

### Wiring into DashboardPage

`ViewMode` already includes `'kanban'`. Add:
- import `KanbanView`; add a `view === 'kanban'` branch in the content region (alongside the existing Gantt/List/Calendar branches), passing the same props CalendarView gets (`teamId`, `timelineId`, `colorBy`, `timelineStatuses={activeTimelineStatuses}`, `savedFilters`, `tags`, select/create callbacks, `onMembersLoaded`).
- Kanban-specific toolbar state (`groupBy`, `sortBy`, `colorBy`, `cardFields`, `collapsedColumns`) lives in DashboardPage (like calendar state), persisted via per-timeline preferences (`kanban_group_by`, `kanban_sort_by`, `kanban_color_by`, `kanban_card_fields`, `kanban_collapsed`). Render `KanbanToolbar` in the sub-toolbar slot when `view === 'kanban'`.
- Add the **Kanban** tab to the view switcher in `TopBar` (icon: lucide `kanban` / `trello`).

---

## Build order

1. **Switcher + shell:** add Kanban tab to `TopBar`; add `KanbanView` branch + toolbar state in DashboardPage; render an empty `KanbanBoard` placeholder. Verify the tab switches and persists.
2. **`kanbanColumns.ts` + tests:** `buildColumns` for Status/Member/Parent/None/combination; sort comparators; "No status"/"Unassigned"/"No parent" sentinels. Unit-test thoroughly before UI.
3. **Static board:** `KanbanColumn` + `KanbanCard`, color-by accent, count badges, empty state, collapse rail. No drag yet. Wire colorBy. Verify against a sample timeline.
4. **Card fields:** `Card fields` multi-select in toolbar; render fields conditionally; context-aware suppression; persist preference.
5. **Group by / Sort by / Color by controls:** full toolbar; columns rebuild on group-by change; in-column sort.
6. **Drag-to-recolumn:** `DndContext` + droppable columns + draggable cards + drag overlay; commit via `useUpdateActivity` (optimistic); per-group-by drop semantics; disable for combination/None.
7. **Create / edit wiring:** card click → `ActivityPanel`; "+ Add" → create prefilled with column value.
8. **Filter + Find parity:** `applyActiveFilter`, `matchEvents`, register ordered matches, collapsed-column auto-expand, dim/highlight.
9. **Polish + a11y:** keyboard drag, focus rings, transitions (~100–150ms), real-time sanity check across two tabs.
10. **Docs:** `docs/log.md` Phase 11.3 entry; update `session-state.md`.

---

## Exit criteria — safe to pause when

- View switcher toggles Gantt ↔ List ↔ Calendar ↔ Kanban, persisting per timeline.
- **Group by = Status** shows one column per timeline status (in `position` order) plus a "No status" column; renaming/recoloring a status in Settings updates the column header live (no reload).
- Changing **Group by** to Member / Parent rebuilds the columns; combination + None render without errors.
- **Color by** recolors the card accent border and matches Gantt/List/Calendar for the same activity.
- **Sort by** reorders cards within every column; default is Start date.
- **Card fields** toggles show/hide date range, status, tags, members, % complete, parent, description; selection persists across reload; the Group-by axis field is auto-suppressed.
- **Dragging a card to another column commits the mutation** (status/reassign/reparent) via PATCH with optimistic update and no reload; dropping back reverts cleanly; combination/None columns are non-droppable without errors.
- **Card click** opens the edit panel; **"+ Add"** opens create prefilled with the column's grouping value.
- **Filter** scopes the board and column counts; **Find** dims non-matches, highlights matches across columns, walks prev/next, and auto-expands a collapsed column containing the active match.
- A card mutated in a second tab moves to its new column within ~500ms (real-time).
- Columns collapse/expand and survive reload; empty columns show a muted placeholder and remain valid drop targets.
- `kanbanColumns` unit tests pass; `pnpm --filter web lint` + `pnpm --filter web test` pass.

---

## Decisions (resolved)

1. ✅ **Member-column reassign = replace** — dropping a card into member column X sets `assignedMemberIds = [X]`. A multi-member card lives only in its primary member's column; extra members still render as avatars on the card. Append / multi-column membership is out of scope. _(Confirmed 2026-06-03.)_
2. ✅ **Combination columns are non-droppable** — "Assigned to (combination)" and "None" render columns that are read-only drop-wise (a combination is not a single settable value); cards still open and edit normally. _(Confirmed 2026-06-03.)_

## Open decisions (deferred, no action needed for v1)

3. **Manual within-column order** — deferred (no `Activity` order field). If wanted later: `11.3.1` adds `kanban_order REAL` + persist-on-drop + a "Manual" sort. Cards order by the chosen Sort in v1.
4. **Group by: Tag** — not included (tags are multi-valued, so a card would appear in N columns; dragging is ambiguous). Could be added as a **read-only** (non-droppable) grouping later if useful.
5. **Configure pencil vs. full-card click** — v1 uses full-card click to open the edit panel; the hover pencil is optional polish, not required.

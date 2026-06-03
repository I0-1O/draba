# Handoff: Kanban View — Draba

## Overview

The Kanban View is one of Draba's primary timeline views (alongside **List**, **Calendar**, and **Gantt**). It presents the activities of a single timeline as draggable cards arranged in vertical, status-based columns. Activities can be dragged between columns to change their status, columns can be collapsed to reclaim horizontal space, and the board can be re-grouped, re-sorted, and re-colored from a dedicated toolbar.

The view is reached by selecting the **Kanban** tab in the top nav while a timeline is open. It renders inside the standard app shell (top nav + left sidebar) and owns the main content region.

## About the Design Files

The files in this bundle are **HTML/React-via-Babel design prototypes** — not production code. Your task is to **recreate this view inside the existing Draba codebase** (described as shadcn/ui + Tailwind CSS v4 + Next.js) using its established components, design tokens, and patterns. Prefer the codebase's real primitives (drag-and-drop library, DropdownMenu, Dialog, Avatar, Badge) over the hand-rolled versions in the prototype.

## Fidelity

**High-fidelity.** Final colors, spacing, typography, and interaction states are specified. The prototype hardcodes a **dark** theme; production should drive everything from the Draba Design System tokens (`--primary`, `--card`, `--border`, `--muted-foreground`, etc.) and support light + dark. Exact hexes are listed under **Design Tokens** so you can map them to the token set.

---

## Layout

The view sits in the standard three-region app shell:

```
┌──────────────────────────────────────────────────────────┐
│ Top nav (50px)  — logo · view tabs · title · filter · me  │
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │ Kanban toolbar (42px) — group/sort/color · CTA │
│ (220px)  ├───────────────────────────────────────────────┤
│          │ Board — horizontal scroll, columns left→right  │
│          │                                                 │
└──────────┴───────────────────────────────────────────────┘
```

- Root: `100vh`, column flex, `overflow: hidden`, background `#0d1117`.
- The content region (right of sidebar) is a column flex: **toolbar** (fixed) over **board** (fills remaining height).
- **Board**: `overflow-x: auto`, `overflow-y: hidden`, padding `16px`, flex row, gap `10px`, `align-items: flex-start`. Columns scroll horizontally as a group; each column scrolls its cards vertically.

---

## Components

### Top nav (`<TopNav>`)
Height `50px`, bg `#161b22`, bottom border `1px solid #30363d`, padding `0 16px`.
- **Brand**: 24px teal rounded tile with a layers icon + wordmark "draba" (16px/600), followed by a vertical divider.
- **View tabs**: List · Calendar · Gantt · **Kanban**. Each is an icon + label button, `5px 11px`, radius 6. Active tab (Kanban): bg `#2d333b`, text `#e6edf3`, 600w; inactive: transparent, `#8b949e`. *(In production, wire these to actually switch views — in the prototype only Kanban renders.)*
- **Title**: centered, flex-1, the timeline name ("New Logo GTM"), 14px/500 `#8b949e`.
- **Right cluster**: search icon button · a "All activities" filter pill (bg `#2d333b`, border, filter icon + chevron) · a 30px teal avatar circle.

### Sidebar (`<Sidebar>`)
Width `220px`, bg `#161b22`, right border, vertical scroll. Sectioned list with uppercase 10px/600 labels (`#484f58`, letter-spacing .7px):
- **Team** — 22px team avatar + name.
- **Members** — each member: 22px color avatar + name (`#8b949e`).
- **Timeline** — list of timelines, each a colored 22px rounded tile + name; the active one ("New Logo GTM") has bg `#2d333b` and brighter text. Followed by a "+ New timeline" link.
- **Activity** — "+ New activity" and "↑ Import activities" links.

> This sidebar mirrors the app's existing navigation — in production, reuse the real `<Sidebar>` component rather than this copy.

### Kanban toolbar (`<KanbanToolbar>`)
Height `42px`, bg `#161b22`, bottom border, padding `0 16px`, flex row, gap 6.
- **Left cluster**: three dropdowns —
  - **Group by**: Status (default) · Assignee · Priority
  - a thin vertical divider
  - **Sort by**: Start date (default) · Assignee · Title
  - **Color by**: Activity (default) · Assignee
- **Right cluster**: **Share** button (share icon) and **Export** button (download icon). Both are secondary buttons: bg `#21262d`, border `#21262d`, `5px 11px`, radius 6, text `#8b949e`.

**Toolbar dropdown (`<ToolbarDropdown>`)**: a button showing a muted `label` (`#484f58`) + the selected value (`#e6edf3`, 500w) + chevron-down. Opens a portal menu (`position: fixed`, flips left if it would overflow the viewport): bg `#21262d`, border `#30363d`, radius 8, shadow `0 8px 24px rgba(0,0,0,.5)`, min-width 168. Selected option row: bg `#2d333b`, text `#e6edf3`. Closes on outside-click.

### Column (collapsed + expanded)
Each status is a column. Radius 10, bg `#161b22`, border `1px solid #21262d`. Drop-target highlight while dragging: bg `{colColor}10`, border `{colColor}55` (expanded) / `{colColor}18` + `{colColor}44` (collapsed).

**Expanded** (width `248px`):
- **Header** (`10px 12px`): 8px color dot + label (12px/600 `#e6edf3`, flex-1) + count badge (11px/600 `#484f58`, bg `#2d333b`, pill `1px 7px`) + collapse button (chevron-down, 50% opacity).
- **Cards area**: `flex: 1`, vertical scroll, padding `0 8px 8px`, column flex, gap 6. A 6px accent-colored placeholder bar (`{colColor}`, opacity .4) is appended while a card hovers over the column.

**Collapsed** (width `40px`): clickable full-height rail — color dot + vertical (rotated) label + count badge. Clicking toggles back to expanded.

**Columns** (id · label · color):
| id | label | color |
|---|---|---|
| `not-started` | Not Started | `#64748B` |
| `in-progress` | In Progress | `#288C9B` (teal) |
| `at-risk` | At Risk | `#F97316` (amber) |
| `on-hold` | On Hold | `#8B5CF6` (violet) |
| `completed` | Completed | `#22C55E` (green) |
| `canceled` | Canceled | `#484f58` (muted) |

### Card
Represents one activity. bg `#21262d`, border `1px solid #21262d`, radius 8, **left accent border `3px solid {accentColor}`**, padding `10px 12px`, `cursor: grab`, `user-select: none`. Hover: bg `#2d333b`, border `#30363d`. While being dragged: `opacity: .35` (`.card-dragging`).
- **Title**: 13px/500 `#e6edf3`, line-height 1.35.
- **Tags** (optional): small chips — 10px, `2px 6px`, radius 4, bg `#373e47`, text `#8b949e`.
- **Footer row** (space-between):
  - Left: **priority indicator** (`high` → red up-arrow `#EF4444`; `medium` → amber minus `#F59E0B`; `low` → none) + calendar icon + start date (and `– end` date where the card component shows it).
  - Right: **assignee avatars** — 20px color circles, overlapping by -6px after the first (2px `#21262d` ring).
- **Configure button** (hover-revealed): 22px tile top-right (bg `#373e47`, border, edit/pencil icon) that opens the activity for editing. It stops drag propagation so the click doesn't start a drag.

**Accent color** depends on the **Color by** setting: `activity` → the card's own `color`; `assignee` → the first assignee's member color.

### Share modal (`<ShareModal>`)
A **stub** — portal overlay (`rgba(0,0,0,.6)`), 420px panel (bg `#21262d`, border, radius 12, shadow), header "Share · New Logo GTM" + close X, and a placeholder body reading *"Share modal — not yet designed."* **This is a known gap** — the real share flow is out of scope for this handoff and should be designed separately (or reuse the share pattern from the timeline view if one exists).

---

## Interactions & Behavior

- **Drag to rechange status**: cards are HTML5-draggable. Dragging sets `draggingId`; hovering a column sets `dragOverCol` and shows the column highlight + a placeholder bar; dropping moves the card to that column (`col` changes). Drop/`onDragEnd`/`mouseUp` all clear the drag state.
  - *Production note:* the prototype only reorders cards **between** columns by status; it does not persist an explicit intra-column index on drop (cards re-flow per the Sort by rule). If precise manual ordering within a column is required, add an order field and insertion-index logic — use the codebase's DnD library (e.g. dnd-kit) rather than raw HTML5 DnD for reliable reordering + keyboard a11y.
- **Sort by**: reorders cards within every column — `Start date` (a stable `sort` rank in the mock), `Assignee` (first assignee name, A→Z), `Title` (A→Z).
- **Color by**: switches the card left-border accent between the activity color and the assignee color (see Card).
- **Group by**: the control is present with options Status / Assignee / Priority. In the prototype only **Status** is wired (columns = statuses). Production should regenerate columns from the chosen grouping (e.g. one column per member, or per priority bucket).
- **Collapse column**: header chevron (or clicking the collapsed rail) toggles a per-column collapsed state.
- **Configure card**: hover a card → pencil button → opens the activity editor (wire to the existing Event/Activity detail panel or Member/Activity edit modal).
- **Share / Export**: Share opens the stub modal; Export is present but inert (wire to the Export Modal — see Related).
- **Transitions**: background/border transitions ~100–150ms ease. No decorative motion, per the design system.

## State Management

Per-view state (prototype `AppFinal`):
```ts
cards:       Card[]                 // source of truth; col changes on drop
sortBy:      'startDate'|'assignee'|'title'
colorBy:     'activity'|'assignee'
collapsed:   Record<columnId, boolean>
draggingId:  string | null          // card being dragged
dragOverCol: string | null          // current drop-target column
shareOpen:   boolean
openCardId:  string | null          // activity opened for editing
```

**Card model** (maps to a Draba activity):
```ts
type Card = {
  id: string;
  col: ColumnId;                    // status
  title: string;
  assignees: MemberId[];            // 0..n members
  start: string; end: string;       // date labels
  color: string;                    // activity color (Color by: activity)
  tags: string[];
  priority: 'high'|'medium'|'low';
  sort: number;                     // stable rank for Start-date sort
};
```
Production: fetch the timeline's activities, derive columns from the active **Group by**, and persist status changes (and order, if implemented) on drop.

---

## Design Tokens

| Token | Value | Use |
|---|---|---|
| bg0 | `#0d1117` | app background |
| bg1 | `#161b22` | nav, sidebar, toolbar, columns |
| bg2 | `#21262d` | cards, dropdown/modal panels |
| bg3 | `#2d333b` | hover surfaces, active tab, count badges |
| bg4 | `#373e47` | tag chips, configure button |
| border | `#30363d` | primary borders |
| border2 | `#21262d` | subtle borders (cards, columns) |
| text1 | `#e6edf3` | primary text |
| text2 | `#8b949e` | secondary text |
| text3 | `#484f58` | muted text / labels |
| accent | `#288C9B` | Draba teal (primary) |

**Column colors**: slate `#64748B` · teal `#288C9B` · amber `#F97316` · violet `#8B5CF6` · green `#22C55E` · muted `#484f58`.
**Priority**: high `#EF4444` · medium `#F59E0B` · low (none).
**Member colors** (avatars): green `#22C55E`, indigo `#6366F1`, amber `#F97316`, teal `#288C9B` (plus the wider activity palette `#A855F7`, `#3B82F6`, `#EC4899`, `#06B6D4`, `#EF4444`).

**Typography**: Inter. 16/600 (brand, modal title) · 14/500 (timeline title) · 13/500 (card title, member names, buttons) · 12/600 (column label) · 11 (dates, count badges) · 10 (tags, sidebar section labels).

**Radii**: columns 10 · cards/buttons/dropdowns 6–8 · modal 12 · badges/avatars 999.

**Spacing**: 4px base. Board gap 10, card gap 6, board padding 16; column header `10px 12px`; toolbar `0 16px`.

**Shadows**: dropdown `0 8px 24px rgba(0,0,0,.5)`; modal `0 24px 64px rgba(0,0,0,.6)`; configure button `0 1px 4px rgba(0,0,0,.3)`.

## Assets

No image assets. Icons are inline SVG (stroke-based, ~1.75px, round caps) — in production use **lucide-react** equivalents: `search`, `chevron-down`/`chevron-right`, `layers`, `download`, `share-2`, `filter`, `arrow-up`, `minus`, `x`, `calendar`, `edit`/`pencil`, `more-horizontal`, `kanban`/`trello`, `grid`/`layout-grid`. Avatars are initials on a colored circle.

## Related Handoffs

- **Export Modal** — the toolbar **Export** button should open it (see `Export Modal Wireframes.html` / its handoff if promoted).
- **Filter Dropdown / Filters Modal** — the top-nav "All activities" filter pill drives the same filtering applied to the board.
- **Member Edit Modal** / activity detail — the card **configure** button opens the activity editor.
- **Share** — currently a stub here; design the real flow separately.

## Files

| File | Description |
|---|---|
| `Kanban View.html` | Full interactive prototype — app shell, toolbar, board, drag-and-drop between columns, collapsible columns, sort/color controls, hover configure button, and the share-modal stub. Open in any browser to explore. |

> **Prototype structure note:** the single HTML file contains some superseded scaffolding (`App`, `KanbanCard`, `KanbanColumn`) left from iteration; the **rendered** path is `AppFinal` → `BoardWithDrag`, which is the source of truth for drag behavior and the card/column markup. Implement from `AppFinal`/`BoardWithDrag`; the standalone `KanbanCard`/`KanbanColumn` components are useful as a cleaner reference for the static card/column structure but their drag handlers are stubs.

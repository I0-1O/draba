# Handoff: Filter Dropdown — Draba Activity Views

## Overview

This is the filter dropdown used on Draba's activity view pages (Timeline, Kanban, List). It lives in the top bar and lets users narrow the activities shown to a specific scope — a preset view, a single team member, a team-promoted filter, or one of their own saved filters.

## About the Design Files

The files in this bundle are **HTML design prototypes** — they show the intended look, structure, and interactive behavior of the component. They are **not** production code to copy directly. Your task is to **recreate this component inside the existing Draba codebase** (React + the Draba design system) using its established patterns, components, and libraries.

## Fidelity

**High-fidelity.** The prototype uses the exact Draba design token values (colors, typography, spacing, radius, shadows). Recreate it pixel-closely using the codebase's existing tokens/variables.

---

## The Component: `<FilterDropdown>`

### Purpose

Replaces the current basic filter control. Allows users to select one active filter at a time across four categories: Presets, Members, Team filters, and My filters.

### Trigger Button

Sits in the TopBar, right-aligned, before the Search icon.

| Property | Value |
|---|---|
| Height | 30px |
| Padding | `5px 9px 5px 8px` |
| Border radius | 6px |
| Font size | 13px |
| Default state | Transparent bg, `#E2E6EA` border, `#343A40` text, muted filter icon |
| Active (non-default) state | `rgba(40,140,155,.09)` bg, `rgba(40,140,155,.22)` border, `#288C9B` text + icon, **semibold** |
| Member filter active | Replace filter icon with an 8px colored dot matching the member's color |
| Max width | 220px — label truncates with ellipsis |
| Right icon | 12px chevron-down, always muted |

---

## Dropdown Panel

Anchored to the bottom-right of the trigger. Opens on click, closes on outside click.

| Property | Value |
|---|---|
| Width | 284px |
| Max height | 460px (scrollable) |
| Background | `#ffffff` |
| Border | `1px solid #E2E6EA` |
| Border radius | 8px |
| Box shadow | `0 8px 24px rgba(0,0,0,.11), 0 2px 6px rgba(0,0,0,.07)` |
| Bottom padding | 4px |

---

## Sections (top to bottom)

Each section has a **section header** and a list of **items**, separated by thin dividers.

### Section Header

```
font-size: 10px
font-weight: 700
letter-spacing: 0.8px
text-transform: uppercase
color: #9bA6B2
padding: 10px 14px 3px
```

"Team filters" header also carries a **pill badge**: text `Team`, teal tint bg + border, 9px bold text.

---

### 1. Presets

Five built-in options. Each has a 14px Lucide icon on the left.

| ID | Label | Icon | Notes |
|---|---|---|---|
| `all` | All activities | `layers` | Default selection |
| `upcoming` | Upcoming | `clock` | Subtitle: "Starting or ending in 7 days" |
| `my` | My events | `user` | Scoped to the logged-in user |
| `overdue` | Overdue | `alert-circle` | Activities past their end date |
| `noassign` | No assignee | `user-x` | Activities with no member assigned |

**Suggested additional presets to consider adding:**
- **This week** — activities with any overlap in the current Mon–Sun window
- **Unstarted** — planned but start date hasn't arrived yet
- **Recently completed** — done in the last 7 days
- **High priority** — if priority tagging exists

---

### 2. Members

One row per team member. No icon — instead an **8px colored dot** (member's color) in the left icon slot.

Long names (e.g. "Alex Williamson-Torres") must truncate with ellipsis. The full name should be accessible via `title` attribute.

Member colors come from the existing member data model.

---

### 3. Team filters

Custom filters that a member nominated and an admin promoted to team-wide visibility. Sourced from a `teamFilters` collection (see State section).

The section header has the "Team" pill badge.

On hover, the **gear icon** (12px, `settings` or `gear`) appears in the right slot — replacing the checkmark if active. Clicking it opens the filter configuration/edit dialog. The gear button should be accessible to any user with permission to edit team filters (team admins).

---

### 4. My filters

Custom filters created by the logged-in user. Same hover-to-configure behavior as team filters. Clicking the gear opens the edit/configure dialog for that filter.

---

### 5. Add filter (footer)

Always visible at the bottom, below a divider.

```
font-size: 13px
color: #6C7A8A (default), #288C9B (hover)
font-weight: 400 (default), 600 (hover)
left icon: plus (14px, 2px stroke)
padding: 7px 14px
background: transparent → #E8ECEF on hover
```

Clicking opens the "Create filter" dialog/flow.

---

## Item Row Anatomy

```
[ 16px icon/dot slot ] [ label + optional subtitle ] [ 24px right slot ]
padding: 5px 10px 5px 14px
```

| State | Background | Label style |
|---|---|---|
| Default | transparent | 13px, weight 400, `#343A40` |
| Hover | `#E8ECEF` | same |
| Active | `rgba(40,140,155,.09)` | 13px, weight 600, `#288C9B` |

Right slot:
- **Active + not hovering**: teal checkmark (13px, 2.5px stroke)
- **Custom filter + hovering**: gear config button (22×22px, `#EDF0F3` bg → `#dde2e8` on hover)
- **Active + custom + hovering**: gear takes priority over checkmark

Label overflow: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`. Always add `title={label}` so the full text is visible on native tooltip.

---

## Interactions & Behavior

- **Single-select** — only one filter active at a time across all sections
- **Selecting any item** closes the dropdown immediately
- **Outside click** closes the dropdown
- **Escape key** should also close the dropdown
- **Trigger updates** to reflect the active filter: label, color treatment, icon vs. dot
- When "All activities" is selected, trigger returns to its default (no-tint) appearance

---

## State

```ts
interface FilterState {
  activeFilterId: string;           // e.g. 'all', 'm1', 'tf2', 'mf1'
}

interface SavedFilter {
  id: string;
  label: string;
  createdBy: string;                // user id
  isTeamWide: boolean;              // promoted by admin
  definition: FilterDefinition;     // the actual filter logic
}
```

`teamFilters` — filters where `isTeamWide === true`, visible to all team members  
`myFilters` — filters where `createdBy === currentUserId && !isTeamWide`

---

## Design Tokens Used

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#288C9B` | Active states, tints |
| `--fg` | `#343A40` | Default text |
| `--fg-muted` | `#6C7A8A` | Muted text, icons |
| `--border` | `#E2E6EA` | Panel border, dividers |
| `--card` | `#ffffff` | Panel background |
| `--muted` | `#EDF0F3` | Gear button bg |
| `--hover` | `#E8ECEF` | Row hover bg |
| Font | `'Open Sans'` | All text |
| Border radius | `6px` (trigger), `8px` (panel) | |

---

## Files

| File | Description |
|---|---|
| `Filter Dropdown.html` | Full interactive prototype — component + TopBar context |

Open in any browser to explore the interaction. The dropdown is **open by default**. Click items to select; hover custom filter rows to see the gear icon.

---

## Notes for Implementation

- The gear/configure action for **team filters** should check permissions — only admins can edit team-wide filters; regular members should see the gear as a "view details" action
- Consider keyboard navigation (↑/↓ to move focus, Enter to select, Esc to close)
- The "Add filter" footer action should integrate with whatever filter-builder flow already exists (or needs to be built)
- Long filter names are a real UX concern — the 284px dropdown width combined with ellipsis + `title` tooltip is the chosen approach; no wrapping

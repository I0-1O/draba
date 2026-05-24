# Handoff: Identity Widget — Draba

## Overview

The Identity Widget lets users assign a visual identity to an entity (a timeline, project, or member) — a combination of a **color** and either a **Lucide icon** or **name-derived initials**. It appears anywhere an entity needs a badge: sidebar rows, settings panels, member lists, and modal headers.

## About the Design Files

The files in this bundle are **HTML design prototypes** — not production code. Your task is to **recreate this component inside the existing Draba codebase** using its established React patterns, design tokens, and libraries.

## Fidelity

**High-fidelity.** Exact colors, spacing, typography, and interaction states are specified. Recreate pixel-closely using Draba's existing token system.

---

## Components Overview

There are four related components that form the system:

| Component | Purpose |
|---|---|
| `<Badge>` | Read-only display of an identity — used everywhere an entity appears |
| `<IdentityTrigger>` | Clickable version of Badge — small badge + chevron pip to open picker |
| `<IdentityPicker>` | The popover panel — color grid + name options + icon grid |
| `<IdentityWidget>` | Composed component — trigger + popover with positioning logic |

---

## Data Model

```ts
interface Identity {
  iconId:  string;   // Lucide icon id, OR one of the special name/none ids below
  colorId: string;   // one of the 16 color ids
}

// Special iconId values:
// '__name_1__'     → show first letter of name (e.g. "N")
// '__name_2__'     → show first 2 letters (e.g. "NL")
// '__name_words__' → show first letter of each word (e.g. "NL" for "New Logo")
// '__none__'       → show nothing (empty badge)
```

### Color palette (16 colors)

| ID | Hex |
|---|---|
| teal | #288C9B |
| cyan | #06B6D4 |
| blue | #3B82F6 |
| indigo | #6366F1 |
| violet | #8B5CF6 |
| purple | #A855F7 |
| pink | #EC4899 |
| rose | #F43F5E |
| red | #EF4444 |
| orange | #F97316 |
| amber | #F59E0B |
| yellow | #EAB308 |
| lime | #84CC16 |
| green | #22C55E |
| slate | #64748B |
| stone | #78716C |

---

## `<Badge>` — Read-only display

Used anywhere an entity's identity needs to be shown without the ability to edit it.

### Props

```ts
interface BadgeProps {
  identity: Identity;
  name:     string;       // used to derive initials for name-based icons
  shape:    'square' | 'circle';
  size:     number;       // px — typically 22–40px
}
```

### Layout & Style

| Property | Value |
|---|---|
| Width / Height | `size` × `size` px |
| Border radius | `shape === 'circle'` → `50%`; `shape === 'square'` → `size * 0.26` px (rounded) |
| Background | The color's hex value |
| Transition | `background 0.15s` |

**Icon rendering (inside badge):**
- If `iconId` is a name id → render a `<span>` with initials text
  - Font size: `size * (text.length > 1 ? 0.37 : 0.52)` px
  - Font weight: 700
  - Color: `rgba(255,255,255,0.95)`
  - Letter spacing: `text.length > 1 ? '-0.5px' : '0'`
- If `iconId === '__none__'` → render nothing
- Otherwise → render the Lucide icon SVG
  - Size: `size * 0.54` px
  - Color: `rgba(255,255,255,0.95)`
  - Stroke width: 2

---

## `<IdentityTrigger>` — Clickable badge

The badge as an interactive trigger button.

### Anatomy

```
[ Badge (28×28) ]
  └── [ Chevron pip (13×13, bottom-right, absolute) ]
```

### Pip style

| Property | Value |
|---|---|
| Size | 13×13px |
| Position | `bottom: -3px; right: -3px` |
| Border radius | 50% |
| Background | `#161b22` (bg1) |
| Border | `1.5px solid #30363d` |
| Icon | 7px chevron-down, stroke `#8b949e`, strokeWidth 3 |

### States

| State | Effect |
|---|---|
| Default | No outline |
| Hover | `outline: 2px solid {color.hex}88`; outline-offset: 2px; badge `filter: brightness(1.12)` |
| Open | Same outline as hover |

---

## `<IdentityPicker>` — Popover panel

Rendered inside a portal, positioned below the trigger.

### Panel container

| Property | Value |
|---|---|
| Width | 312px |
| Background | `#21262d` (bg2) |
| Border | `1px solid #30363d` |
| Border radius | 10px |
| Box shadow | `0 12px 32px rgba(0,0,0,.5)` |
| Overflow | hidden |

### Section 1 — Color grid

Padding: `11px 12px 10px`. Border-bottom: `1px solid #30363d`.

16 color buttons in an 8-column CSS grid, gap 9px, centered.

**Color button:**
- 24×24px circle
- Hover: `transform: scale(1.18)`
- Selected: `box-shadow: 0 0 0 2px {bg2}, 0 0 0 3.5px {color.hex}` + white checkmark (10px, strokeWidth 3.2)
- Transition: `transform 0.1s, box-shadow 0.1s`

### Section 2 — Name options

Padding: `9px 12px 6px`. 4 options in a flex row with gap 6px.

| Option ID | Label | Preview text |
|---|---|---|
| `__none__` | None | *(empty dashed circle)* |
| `__name_1__` | 1 letter | First letter of name |
| `__name_2__` | 2 letters | First 2 letters |
| `__name_words__` | 1 + 1 words | First letter of each word |

**Option card:**
- `flex: 1`, padding `8px 4px 7px`
- Border: `1px solid {border2}` (default) → `1px solid {color.hex}` (selected)
- Background: `bg3` (default) → `{color.hex}18` (selected)
- Border radius: 8px
- Contents: mini badge preview (28×28, matches `shape` prop) + label text below

Label text: 10px, weight 500, color `text3` (default) → `color.hex` (selected)

`__none__` preview: transparent bg, `1.5px dashed #30363d` border

### Section 3 — Icon grid

Padding: `6px 12px 10px`. 64 Lucide icons in an 8-column CSS grid, gap 2px.

**Icon cell (34×34px):**
- Border radius: 6px
- Default bg: transparent
- Hover bg: `#373e47` (bg4)
- Selected bg: `{color.hex}`; outline: `2px solid {color.hex}44`; outline-offset: 1px
- Icon size: 17px; stroke 1.75
- Icon color: `#8b949e` (default) → `#e6edf3` (hover) → `#fff` (selected)
- Transition: `background 0.08s`

---

## `<IdentityWidget>` — Full composed component

Wraps trigger + popover. Handles open/close, portal rendering, and positioning.

### Positioning logic

1. Get trigger's `getBoundingClientRect()`
2. Position popover at `top: rect.bottom + 8px`, `left: rect.left`
3. Clamp left: if `left + 312 > window.innerWidth - 8`, set `left = window.innerWidth - 320`; if `left < 8`, set `left = 8`
4. Render into `document.body` via portal

### Close behavior

- Click outside both trigger and popover → close
- No close-on-select (user may want to continue adjusting)

---

## Where `<Badge>` appears (read-only contexts)

- **Sidebar** — each timeline/project row uses a 22px square badge
- **Member list** — each member row uses a circle badge
- **Modal headers** — 40px badge next to entity name
- **Settings panel header** — 24px square badge

In all these locations, the badge is **not** wrapped in `<IdentityWidget>` — it's just `<Badge>` for display only.

## Where `<IdentityWidget>` appears (editable contexts)

- **Settings / edit panel** — "Identity" field row, typically 28–32px trigger
- **Modal edit header** — next to the entity name when in edit mode

---

## Interactions & Behavior

- Clicking the trigger toggles the popover
- Color changes apply **immediately** (live preview — badge updates in real time)
- Icon/name option changes apply **immediately**
- No save/cancel — changes commit on selection; caller persists via `onChange`
- `onChange(newIdentity)` is called on every color or icon selection

---

## Design Tokens Used

| Token | Value | Usage |
|---|---|---|
| bg0 | `#0d1117` | App background |
| bg1 | `#161b22` | Sidebar, settings panel bg |
| bg2 | `#21262d` | Picker panel bg, modal bg |
| bg3 | `#2d333b` | Field inputs, name option bg |
| bg4 | `#373e47` | Icon cell hover bg |
| border | `#30363d` | Panel borders, dividers |
| border2 | `#21262d` | Name option default border |
| text1 | `#e6edf3` | Primary text |
| text2 | `#8b949e` | Secondary text, icons |
| text3 | `#484f58` | Labels, subtle text |
| accent | `#288C9B` | Draba teal |
| Font | `'Inter'` | All text in this widget |

> **Note:** The main Draba app uses `'Open Sans'`. This widget currently uses `'Inter'`. Align to whichever the codebase uses.

---

## Icon Library

The prototype uses **64 hand-picked Lucide icons** rendered as inline SVG. In production, use the `lucide-react` package and reference icons by their exact Lucide IDs:

```
activity, archive, award, bar-chart, bell, bookmark, briefcase, calendar,
check-circle, clipboard, clock, cloud, code, coffee, compass, cpu, database,
download, edit, eye, file-text, filter, flag, folder, git-branch, globe, grid,
heart, help-circle, home, info, layers, link, list, lock, mail, map,
message-circle, moon, package, pencil, phone, pie-chart, plug, refresh-cw,
search, server, settings, share, shield, star, sun, tag, target, terminal,
trash, trending-up, upload, user, users, wifi, zap
```

---

## Files

| File | Description |
|---|---|
| `Icon Color Picker.html` | Full interactive prototype. Shows the widget in a realistic 3-panel layout: sidebar (badge-only) + placeholder gantt + settings panel (editable). Change color or icon and watch all three update live. |

Open in any browser. The settings panel is on the right — click the badge to open the picker.

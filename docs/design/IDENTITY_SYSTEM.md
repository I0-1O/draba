# Identity System

An **Identity** is a visual fingerprint — a color + icon pair — assigned to any major entity in draba. It provides instant visual recognition across every surface (sidebar, Gantt bars, settings panels, modals, shares).

> Design prototype: `docs/design/assets/identity-widget-prototype.html` (open in any browser).
> Full handoff spec: `docs/design/assets/IDENTITY_WIDGET_HANDOFF.md`.

---

## Data Model

```ts
interface Identity {
  iconId:  string;   // Lucide icon id, or a special name/none id (see below)
  colorId: string;   // one of the 16 identity color ids
}

// Special iconId values:
// '__name_1__'     → first letter of name (e.g. "N")
// '__name_2__'     → first two letters (e.g. "NE")
// '__name_words__' → first letter of each word (e.g. "NL" for "New Logo")
// '__none__'       → empty badge (color only, no content)
```

### Who gets an Identity

| Entity | Shape | Default iconId | Default colorId |
|--------|-------|---------------|-----------------|
| Activity | square | `'__none__'` | `'teal'` |
| Timeline | square | `'__none__'` | `'teal'` |
| Team | square | `'__name_2__'` | `'teal'` |
| Team Member | circle | `'__name_words__'` | auto-assigned from palette |

---

## Color Palette (16 colors)

Replaces the previous 8-color `MEMBER_COLORS` and `ACTIVITY_COLORS` arrays with a single unified palette used by all entities.

| ID | Name | Hex | Notes |
|----|------|-----|-------|
| `teal` | Teal | `#288C9B` | Brand primary |
| `cyan` | Cyan | `#06B6D4` | |
| `blue` | Blue | `#3B82F6` | |
| `indigo` | Indigo | `#6366F1` | |
| `violet` | Violet | `#8B5CF6` | |
| `purple` | Purple | `#A855F7` | |
| `pink` | Pink | `#EC4899` | |
| `rose` | Rose | `#F43F5E` | |
| `red` | Red | `#EF4444` | |
| `orange` | Orange | `#F97316` | |
| `amber` | Amber | `#F59E0B` | |
| `yellow` | Yellow | `#EAB308` | |
| `lime` | Lime | `#84CC16` | |
| `green` | Green | `#22C55E` | |
| `slate` | Slate | `#64748B` | Neutral cool |
| `stone` | Stone | `#78716C` | Neutral warm |

All 16 colors maintain ≥3:1 contrast ratio against both light and dark backgrounds with white text overlay.

### Migration from legacy palettes

The old 8-color palettes (`MEMBER_COLORS`, `ACTIVITY_COLORS`) stored raw hex values. The new system stores **color IDs** (e.g. `"teal"`, `"violet"`). A mapping function converts legacy hex values to the nearest identity color ID for existing data.

| Legacy hex | → Identity color ID |
|-----------|-------------------|
| `#288C9B` | `teal` |
| `#F29E4C` | `amber` |
| `#5BC0DE` | `cyan` |
| `#2ECC71` | `green` |
| `#9B59B6` | `violet` |
| `#E74C3C` | `rose` |
| `#5C6BC0` | `indigo` |
| `#8BC34A` | `lime` |

---

## Icon Library

64 hand-picked Lucide icons that cover common project/team concepts. Rendered via `lucide-react` (already installed).

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

## Component Architecture

Four components, layered from display-only to fully interactive:

### `<Badge>` — read-only display

Shows an entity's identity anywhere it appears. No interactivity.

```tsx
<Badge identity={identity} name={name} shape="circle" size={22} />
```

| Prop | Type | Notes |
|------|------|-------|
| `identity` | `Identity` | The color + icon to display |
| `name` | `string` | Used to derive initials for name-based icons |
| `shape` | `'square' \| 'circle'` | Circle for members, square for everything else |
| `size` | `number` | px — typically 22–40px |

**Rendering rules:**
- Border radius: circle → `50%`, square → `size * 0.26` px
- Name-based icon: bold white initials, font size scales with badge size
- Lucide icon: `size * 0.54` px, white, stroke-width 2
- `__none__`: color only, no content

### `<IdentityTrigger>` — clickable badge

A `<Badge>` wrapped in a button with a chevron pip indicator.

- Fixed 28×28 badge
- 13×13 chevron pip at bottom-right
- Hover/open: colored outline ring + brightness boost

### `<IdentityPicker>` — popover panel

The picker rendered inside a popover. Three sections:

1. **Color grid** — 16 colors in an 8×2 grid; selected color shows checkmark + ring
2. **Name options** — None / 1 letter / 2 letters / 1+1 words; mini badge preview per option
3. **Icon grid** — 64 Lucide icons in an 8×8 grid; selected icon highlighted with identity color

All changes fire `onChange(newIdentity)` immediately — no save/cancel flow.

### `<IdentityWidget>` — composed component

Wraps `<IdentityTrigger>` + `<IdentityPicker>` in a popover with positioning logic. This is what form UIs render.

```tsx
<IdentityWidget
  identity={activity.identity}
  name={activity.title}
  shape="square"
  onChange={handleIdentityChange}
/>
```

---

## Where components appear

### Badge (read-only)

| Surface | Size | Shape |
|---------|------|-------|
| Sidebar timeline rows | 22px | square |
| Sidebar member rows | 22px | circle |
| Gantt bar label column | 20px | square |
| Activity detail panel header | 24px | square |
| Modal headers | 40px | varies |

### IdentityWidget (editable)

| Surface | Context |
|---------|---------|
| ActivityDetailPanel | Replaces the current icon stub + color picker |
| Settings — Members tab | Member identity editing (Phase 10.1) |
| Settings — General tab | Team identity editing (Phase 10.1) |
| Timeline create/edit | Timeline identity editing (Phase 10.3) |

---

## Schema Changes

### Activities — already have `icon` and `color` columns
No migration needed. The `icon` column stores the `iconId`; the `color` column currently stores hex but will store `colorId` after migration.

### Team Members — have `color`, need `icon`
- Add `icon TEXT` column to `team_members` (nullable, default NULL)

### Teams — need both `color` and `icon`
- Add `color TEXT` column to `teams` (nullable, default NULL)
- Add `icon TEXT` column to `teams` (nullable, default NULL)

### Timelines — need both `color` and `icon`
- Add `color TEXT` column to `timelines` (nullable, default NULL)
- Add `icon TEXT` column to `timelines` (nullable, default NULL)

### Data migration
- Convert existing `activities.color` hex values → color IDs using the mapping table
- Convert existing `team_members.color` hex values → color IDs using the mapping table

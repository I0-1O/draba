# Design System

## Foundation
- **Component library:** shadcn/ui (copy-paste — components live in `packages/web/src/components/ui/`)
- **Styling:** Tailwind CSS v4
- **Theming:** CSS custom properties (HSL channel values) in `packages/web/src/index.css`
- **Dark mode:** class-based — `dark` class on `<html>` element

shadcn stores colors as bare HSL channels (no `hsl()` wrapper), e.g. `--primary: 188 59% 38%`. Tailwind then references them as `hsl(var(--primary))`. All token values below follow this convention.

---

## Color Palette

### Brand Colors (Source)

| Name | Hex | HSL | Role |
|------|-----|-----|------|
| Teal | `#288C9B` | `188 59% 38%` | Primary — actions, active states, links |
| Amber | `#F29E4C` | `30 87% 62%` | Secondary — highlights, energy, badges |
| Charcoal | `#343A40` | `210 10% 23%` | Text, dark backgrounds |
| Off-White | `#F8F9FA` | `210 17% 98%` | Page background, light surfaces |
| Sky Blue | `#5BC0DE` | `194 67% 61%` | Accent — CTAs, hover highlights |

---

## CSS Tokens

Copy this into `packages/web/src/index.css` after `shadcn init`:

```css
@layer base {
  :root {
    --background:             210 17% 98%;   /* #F8F9FA — page background */
    --foreground:             210 10% 23%;   /* #343A40 — default text */

    --card:                   0 0% 100%;     /* white — card/panel surface */
    --card-foreground:        210 10% 23%;

    --popover:                0 0% 100%;
    --popover-foreground:     210 10% 23%;

    --primary:                188 59% 38%;   /* #288C9B — teal */
    --primary-foreground:     0 0% 100%;     /* white text on teal */

    --secondary:              30 87% 62%;    /* #F29E4C — amber */
    --secondary-foreground:   210 10% 23%;   /* charcoal text on amber */

    --muted:                  210 14% 93%;   /* light gray — subtle backgrounds */
    --muted-foreground:       210 10% 45%;   /* mid-gray — captions, placeholders */

    --accent:                 194 67% 61%;   /* #5BC0DE — sky blue */
    --accent-foreground:      210 10% 23%;

    --destructive:            0 72% 51%;     /* red — delete, errors */
    --destructive-foreground: 0 0% 100%;

    --success:                145 63% 42%;   /* green — confirmations */
    --success-foreground:     0 0% 100%;

    --warning:                38 92% 50%;    /* yellow-orange — caution */
    --warning-foreground:     210 10% 23%;

    --border:                 210 14% 89%;
    --input:                  210 14% 89%;
    --ring:                   188 59% 38%;   /* teal focus ring */

    --radius: 0.5rem;
  }

  .dark {
    --background:             210 15% 11%;   /* deep charcoal — page background */
    --foreground:             210 17% 93%;   /* near-white — default text */

    --card:                   210 15% 15%;   /* slightly lighter than background */
    --card-foreground:        210 17% 93%;

    --popover:                210 15% 15%;
    --popover-foreground:     210 17% 93%;

    --primary:                188 55% 52%;   /* teal — lightened to pop on dark */
    --primary-foreground:     210 15% 10%;   /* very dark text on bright teal */

    --secondary:              30 80% 60%;    /* amber — slightly muted in dark */
    --secondary-foreground:   210 15% 10%;

    --muted:                  210 15% 20%;
    --muted-foreground:       210 15% 58%;

    --accent:                 194 60% 55%;   /* sky blue — muted slightly for dark */
    --accent-foreground:      210 15% 10%;

    --destructive:            0 63% 45%;
    --destructive-foreground: 0 0% 100%;

    --success:                145 55% 40%;
    --success-foreground:     0 0% 100%;

    --warning:                38 85% 55%;
    --warning-foreground:     210 15% 10%;

    --border:                 210 15% 22%;
    --input:                  210 15% 22%;
    --ring:                   188 55% 52%;
  }
}
```

---

## Member Colors

Each team member has a display color used in Kanban view and other person-first views. These are data (stored in `team_members.color`), not theme tokens — they do not change with dark/light mode.

Eight colors are pre-defined; the palette cycles if a team exceeds 8 members. Admins and members can override their assigned color.

| Slot | Name | Hex | Notes |
|------|------|-----|-------|
| 1 | Teal | `#288C9B` | Brand primary |
| 2 | Amber | `#F29E4C` | Brand secondary |
| 3 | Sky | `#5BC0DE` | Brand accent |
| 4 | Emerald | `#2ECC71` | Fresh green |
| 5 | Violet | `#9B59B6` | Purple — distinct from blues |
| 6 | Rose | `#E74C3C` | Red-rose — reserved feel |
| 7 | Indigo | `#5C6BC0` | Blue-purple — calm |
| 8 | Lime | `#8BC34A` | Yellow-green — high contrast |

All member colors must maintain a minimum 3:1 contrast ratio against both light (`#F8F9FA`) and dark (`#1C2128`) backgrounds when used as block fills with white/dark text overlay. Verify during implementation.

---

## Typography

### Font Family
**Open Sans** — humanist sans-serif; clean, readable, professional.

```css
/* packages/web/src/index.css */
/* Option A: Self-hosted (recommended for self-hosted product — no Google dependency) */
/* Download from fonts.google.com and place in packages/web/public/fonts/ */
@font-face {
  font-family: 'Open Sans';
  src: url('/fonts/OpenSans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* Repeat for weights 300, 600, 700 */

/* Option B: Google Fonts CDN (simpler, requires internet) */
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap');

/* Apply via Tailwind config */
--font-sans: 'Open Sans', ui-sans-serif, system-ui, sans-serif;
```

> Recommendation: self-host the font. draba is a self-hosted product — loading a Google font defeats the point for privacy-conscious users.

### Weights in Use
| Weight | Class | Use |
|--------|-------|-----|
| 300 Light | `font-light` | Subtle labels, secondary captions |
| 400 Regular | `font-normal` | Body text, descriptions, form inputs |
| 600 SemiBold | `font-semibold` | Headings, important labels, nav items |
| 700 Bold | `font-bold` | Page titles, primary headings, emphasis |

### Type Scale
| Use | Tailwind | Size | Weight |
|-----|----------|------|--------|
| Page heading | `text-2xl font-bold` | 24px | 700 |
| Section heading | `text-lg font-semibold` | 18px | 600 |
| Card / panel title | `text-base font-semibold` | 16px | 600 |
| Body text | `text-sm font-normal` | 14px | 400 |
| Caption / metadata | `text-xs font-normal` | 12px | 400 |
| Tag / badge label | `text-xs font-semibold` | 12px | 600 |
| Timeline block label | `text-xs font-semibold` | 12px | 600 |

### Color on Typography
- Default body text: `text-foreground` (charcoal / off-white in dark mode)
- Secondary / metadata: `text-muted-foreground`
- Links and interactive: `text-primary` (teal)
- Destructive / error: `text-destructive`
- Headings: `text-foreground` — rely on weight and size, not color, for hierarchy

---

## Spacing

Tailwind's 4px base grid throughout.

| Context | Tailwind | px |
|---------|----------|-----|
| Tight inline gaps (icon + label) | `gap-1.5` | 6px |
| Component internal padding (compact) | `p-2` | 8px |
| Component internal padding (standard) | `p-3` or `p-4` | 12–16px |
| Between related elements | `gap-3` | 12px |
| Between sections | `gap-6` | 24px |
| Page-level horizontal margins | `px-6` | 24px |
| Page-level vertical padding | `py-8` | 32px |
| Timeline lane height | TBD during implementation | — |
| Event block vertical padding | TBD during implementation | — |

---

## Border Radius

Base `--radius: 0.5rem` (8px). shadcn derives sm/md/lg/xl from this.

| Element | Class | Notes |
|---------|-------|-------|
| Buttons, inputs | `rounded-md` (6px) | shadcn default |
| Cards, panels, dialogs | `rounded-lg` (8px) | shadcn default |
| Event blocks on timeline | `rounded-md` | Pill-ish but not fully rounded |
| Kanban cards | `rounded-md` | |
| Badges, tags | `rounded-full` | Fully rounded for compact labels |
| Avatars | `rounded-full` | |

---

## Shadows

Keep shadows subtle — the UI should feel clean and flat, not heavily layered.

| Use | Class |
|-----|-------|
| Cards, panels | `shadow-sm` |
| Popovers, dropdowns | `shadow-md` |
| Modals / dialogs | `shadow-lg` |
| Timeline blocks | `shadow-sm` |
| No elevation | `shadow-none` |

---

## Icons

- **Library:** `lucide-react` (shadcn's default peer dependency — already installed)
- **Sizes:** `size-4` (16px) inline with text; `size-5` (20px) standalone/buttons; `size-6` (24px) feature/section icons
- **Color:** inherit from text color by default (`currentColor`)
- **Event block icons:** emoji or Lucide subset — TBD during event detail implementation
- **Stroke width:** Lucide default (1.5) — do not override unless a specific component calls for it

---

## Dark Mode

- Supported from day one via shadcn's class-based system
- Toggle stored in `localStorage`; respects `prefers-color-scheme` on first visit
- Implementation: `next-themes` or a simple custom hook — TBD during web scaffold
- All semantic tokens have dark overrides in `index.css` (defined above)
- Member colors are fixed hex values — test contrast on both `--background` values before finalizing

---

## shadcn Components

Install via:
```bash
pnpm dlx shadcn@latest add <component>
```

| Component | Used for | Status |
|-----------|---------|--------|
| button | Actions, CTAs | — |
| input | Form fields | — |
| dialog | Confirmations, destructive warnings | — |
| sheet | Event detail slide-in panel | — |
| popover | Date pickers, color pickers, tooltips | — |
| calendar | Date range picker in event detail | — |
| select | Status dropdown, view switcher | — |
| badge | Tags on event cards and blocks | — |
| avatar | Team member display | — |
| tooltip | Block hover info, truncated labels | — |
| sonner | Toast notifications (replaces toast) | — |
| dropdown-menu | Context menus, action menus | — |
| separator | Visual dividers | — |
| skeleton | Loading placeholders | — |
| switch | Toggle settings (dark mode, visibility) | — |
| tabs | Settings pages, secondary navigation | — |

> Mark status as **added** when installed. Add new rows as new components are needed.

---

## Custom Components (Not from shadcn)

Built from scratch with Tailwind — no shadcn equivalent:

| Component | Notes |
|-----------|-------|
| `TimelineGrid` | Core horizontal timeline canvas; handles pan and zoom |
| `TimelineBlock` | Individual event block; drag to move/resize |
| `TimelineLane` | Person row in the timeline |
| `KanbanBoard` | Status columns + event card layout |
| `KanbanCard` | Event card in Kanban view; color = member color |
| `CalendarGrid` | Weekly/daily/monthly calendar layout |
| `MemberColorDot` | Small circular color indicator for assignees |
| `ViewSwitcher` | Timeline / Calendar / List / Kanban toggle |
| `ConnectionStatusDot` | WebSocket live connection indicator |

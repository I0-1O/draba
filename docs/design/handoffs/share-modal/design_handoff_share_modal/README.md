# Handoff: Share view modal

## Overview
A "Share this view" modal for **Draba** (a team timeline / coordination tool). Triggered from the **Share** button in any view's top bar. The modal lets a user:

- See all existing share links for the current view, who created each, and metadata (URL, description, date, view count, password state).
- Create a new share link with a title, optional description, and optional password protection.
- Copy a link to the clipboard.
- Delete a share link — **admins can delete any share; regular members can delete only their own**.

The prototype renders the modal over a simplified Draba timeline so it reads in context.

---

## About the Design Files
The files in this bundle are **design references created in HTML/React (via in-browser Babel)** — prototypes that show the intended look and behavior. They are **not production code to copy directly.**

Your task is to **recreate this design in the target codebase using its established environment and patterns.** Draba's stack (per its design system) is **React + Tailwind CSS v4 + shadcn/ui + lucide-react**. Use the codebase's existing components (Dialog, Button, Input, Switch, Avatar, Badge, etc.) and design tokens rather than porting the inline styles. If no front-end environment exists yet, choose the most appropriate framework and implement there.

The prototype's inline styles reference CSS custom properties from `colors_and_type.css` — that file is the **single source of truth for tokens** and maps 1:1 onto the codebase's Tailwind theme.

---

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and interaction states are all intentional. Recreate the modal UI pixel-accurately using the codebase's existing component library and the tokens in `colors_and_type.css`. The **backdrop** (sidebar + timeline) is contextual scaffolding only — do **not** implement it; it already exists in the app.

---

## Screens / Views

The feature is a single modal with several internal states. All structural values below are from `ShareModal.jsx`.

### 1. Modal shell
- **Trigger:** top-bar **Share** button (amber `--secondary`, link icon, label "Share").
- **Overlay:** fixed, full-viewport, `background: rgb(20 28 33 / 0.55)`, `backdrop-filter: blur(2px)`, centered, 24px padding. Click on overlay (outside the card) closes. **Esc** also closes.
- **Card:** `width: min(580px, 100%)`, `max-height: 88vh`, `background: var(--card)`, `border-radius: var(--radius-xl)` (12px), `box-shadow: var(--shadow-lg)`, `overflow: hidden`, flex column. Entrance animation: fade + `translateY(8px) scale(.98)` → none over 180ms, `cubic-bezier(.2,.7,.3,1)`.
- **Three fixed regions** (header, section bar, footer) with a **scrollable body** between them.

**Header** (padding 18px 20px, bottom border `1px var(--border)`):
- Leading icon tile: 38×38, `radius-md` (6px), `background: hsl(188 59% 38% / 0.12)`, `color: var(--primary)`, lucide `link` icon (19px, stroke 2.2).
- Title `h2`: "Share this view" — 17px / 700 / `var(--foreground)`.
- Subtitle: 12.5px / `var(--muted-foreground)`, with an 8×8 amber square (`#F29E4C`, radius 2) preceding text: "Marketing timeline · anyone with a link can view". (View name is dynamic; replace "Marketing timeline" with the current view.)
- Close button: 30×30, `radius-md`, `background: var(--muted)`, lucide `x` (16px), `color: var(--muted-foreground)`.

**Section bar** (padding 13px 20px 11px, flex row):
- Eyebrow label "ACTIVE LINKS" — 11px / 700 / `--muted-foreground` / uppercase / letter-spacing 0.06em.
- Count chip: pill, `background: var(--muted)`, 11px / 700, min-width 20, centered — shows number of shares.
- Right-aligned **New share** button (hidden while the add-form is open): primary, `background: var(--primary)`, `color: var(--primary-foreground)`, 12.5px / 600, padding 6px 13px, `radius-md`, lucide `plus` (14px, stroke 2.4).

**Body** (flex column, `gap: 12px`, padding `0 20px 20px`, `min-height: 120px`, `overflow-y: auto`): contains the add-form (when open) at the top, then the share rows, or the empty state.

**Footer** (padding 13px 20px, top border):
- Left: role hint — lucide `shield-check` (admin, `--primary`) or `user` (member); text 12px / `--muted-foreground`: "Admin · you can manage every share" OR "Member · you can manage only your own shares".
- Right: **Done** button — outline (`1px var(--border)`, `background: var(--card)`), 13px / 600, padding 8px 20px, `radius-md`. Closes the modal.

### 2. Share row (list item)
Card: `border: 1px var(--border)`, `radius-lg` (8px), `background: var(--card)`, padding 14, `box-shadow: var(--shadow-sm)`, `position: relative`.

Structure:
- **Top row** (flex, gap 10, align flex-start):
  - Type tile: 32×32, `radius-md`. Protected → `background: hsl(30 87% 62% / 0.16)`, `color: var(--secondary)`, lucide `lock`. Unprotected → `background: hsl(188 59% 38% / 0.12)`, `color: var(--primary)`, lucide `link`. (16px, stroke 2.2.)
  - Main column (flex 1):
    - Title 14px / 600 / `--foreground`. If protected, a **password badge** follows: inline pill, 11px / 600, `background: hsl(30 87% 62% / 0.22)`, `radius-full`, lucide `lock` 10px + text "password".
    - Description `p`: 12.5px / `--muted-foreground` / line-height 1.45, margin-top 3.
  - **Delete button** (only rendered when the current user may delete this share — see Permissions): 28×28, `radius-md`, transparent, lucide `trash-2` (15px), `color: var(--muted-foreground)`. Hover → `background: hsl(0 72% 51% / 0.1)`, `color: var(--destructive)`.
- **URL row** (flex, gap 8, margin-top 11):
  - URL field: flex 1, `background: var(--muted)`, `radius-md`, padding 7px 11px, `font-family: var(--font-mono)`, 12.5px, with a leading lucide `link-2` (13px, `--muted-foreground`). Text ellipsizes. Value pattern: `draba.app/v/<slug>`.
  - **Copy button**: outline, 12.5px / 600, padding 7px 12px, `radius-md`, lucide `copy` + "Copy". On click → copies `https://<url>` to clipboard and switches for ~1600ms to: `border: var(--success)`, `background: hsl(145 63% 42% / 0.12)`, `color: var(--success)`, lucide `check` + "Copied".
- **Footer meta** (flex, gap 8, margin-top 11, 12px / `--muted-foreground`): creator avatar (20px circle, member color, white initials) + creator name (600, `--foreground`); if it's the current user's share append " · you" in muted regular; then "•" separators before date and a `eye` icon + "N views".

**Inline delete confirmation** (overlays the row, `position: absolute; inset: 0`): `background: var(--card)`, `border: 1px var(--destructive)`, `radius-lg`, centered content. Trash tile (30×30, `hsl(0 72% 51% / 0.1)`, `--destructive`) + heading "Delete this share?" (13.5px / 600) + body "Anyone with the link will immediately lose access. This can't be undone." (12px / muted). Actions right-aligned: **Cancel** (outline) and **Delete link** (`background: var(--destructive)`, `color: var(--destructive-foreground)`).

### 3. Add-share form (inline, expands at top of body)
Card: `border: 1.5px solid var(--primary)`, `radius-lg`, `background: var(--card)`, padding 16, plus focus glow `box-shadow: 0 0 0 3px hsl(188 59% 38% / 0.08)`. Auto-focuses the title input on open.

- Header: lucide `plus-circle` (16px, `--primary`) + "New share link" (13.5px / 700).
- **Title** field (required): label "Title" (11px / 600 / muted). Input: full width, 13px, padding 8px 11px, `border: 1px var(--input)`, `radius-md`, `background: var(--card)`. Focus → `border-color: var(--primary)` + `box-shadow: 0 0 0 2px hsl(188 59% 38% / 0.2)`. Placeholder "e.g. Acme stakeholder view".
- **Description** field (optional): label "Description · optional". `<textarea rows=2>`, same styling, `resize: vertical`. Placeholder "What's this link for, and who is it shared with?".
- **Password protect** block: bordered container (`1px var(--border)`, `radius-md`).
  - Row: lock tile (28×28, `var(--muted)`) + title "Password protect" (13px / 600) + subtext "Require a password to open the link" (11.5px / muted) + a **toggle switch** on the right.
  - **Switch**: 40×22 pill button, `role="switch"`, `aria-checked`. Off → `background: var(--border)`, knob at left:2. On → `background: var(--primary)`, knob at left:20. Knob: 18×18 white circle, `box-shadow: var(--shadow-sm)`, `transition: left .15s`.
  - When **on**, a password sub-field appears (top border separator): input group with lucide `key-round` leading icon, `type=password`, placeholder "Set a password", and a trailing show/hide button toggling lucide `eye` / `eye-off`.
- **Actions row** (margin-top 16):
  - Left (margin-right auto): "Sharing as <current user>" with a 20px avatar.
  - **Cancel** (outline) — collapses the form.
  - **Create link** (primary, lucide `link` + "Create link"). **Disabled** (opacity 0.45, `cursor: not-allowed`) until the title is non-empty AND (password is off OR a password has been entered).

On submit: prepend a new share to the list with `creatorId = current user`, `created = "Today"`, a freshly generated 6-char slug, `views = 0`, then collapse the form and scroll the body to top.

### 4. Empty state (no shares, form closed)
Centered in body: dashed-border container (`1px dashed var(--border)`, `radius-lg`, padding 36px 20px). 48×48 `--muted` tile with lucide `link` (22px) → heading "No share links yet" (14px / 600) → body "Create a link to let people outside your team view this timeline." (12.5px / muted, max-width 280) → primary **Create share link** button (lucide `plus` + label).

---

## Interactions & Behavior
- **Open/close:** Share button opens; overlay click, close (×), Done, and **Esc** all close.
- **Copy:** writes `https://draba.app/v/<slug>` to clipboard (`navigator.clipboard.writeText`), shows success state for 1600ms, then reverts.
- **Add flow:** New share → inline form (title auto-focused) → Create link validates → prepends row → form collapses → body scrolls to top.
- **Password toggle:** reveals/hides the password sub-field; show/hide button switches input type between `password` and `text`.
- **Delete flow:** trash icon → inline confirm overlay on that row → Delete link removes it, or Cancel dismisses.
- **Validation:** Create link disabled unless `title.trim()` non-empty and (password off OR `password.trim()` non-empty).
- **Slug generation:** 6 chars from alphabet `abcdefghjkmnpqrstuvwxyz23456789` (ambiguous chars omitted).
- **Animations:** overlay fade-in 150ms; card pop 180ms `cubic-bezier(.2,.7,.3,1)`; switch knob 150ms; copy state 150ms. Keep functional, no springs/bounces (Draba motion guidance).

## State Management
Per modal instance:
- `shares: Share[]` — the list. `Share = { id, title, desc, protected, creatorId, created, slug, views }`.
- `adding: boolean` — whether the add-form is open.
- Per row: `copied: boolean` (transient), `confirming: boolean` (delete confirm).
- Add-form local: `title`, `desc`, `pwOn`, `pw`, `showPw`.

Inputs the modal needs from the app:
- `currentUserId` (and current user's name/initials/color) — the signed-in member.
- `isAdmin: boolean` — drives delete permission.
- Current view name + accent color for the header subtitle.
- Real data: `GET` shares for the view; `POST` create (returns server-generated slug/url); `DELETE` a share. The prototype mocks all of this in memory.

### Permissions (core requirement)
`canDelete(share) = isAdmin || share.creatorId === currentUserId`.
The delete affordance is **not rendered** when `canDelete` is false. Enforce the same rule server-side on the DELETE endpoint — the UI gate is not sufficient.

## Design Tokens
All defined in `colors_and_type.css` (`:root` + `.dark` overrides). Key ones used here:

- **Colors:** `--primary` (#288C9B teal), `--primary-foreground`; `--secondary` (#F29E4C amber), `--secondary-foreground`; `--success` (hsl 145 63% 42%); `--destructive` (hsl 0 72% 51%), `--destructive-foreground`; `--card`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--background`.
- **Translucent fills used inline:** `hsl(188 59% 38% / 0.12)` (teal tint), `hsl(30 87% 62% / 0.16 | 0.22)` (amber tint), `hsl(0 72% 51% / 0.1)` (red tint), `hsl(145 63% 42% / 0.12)` (green tint).
- **Member colors (data, not theme):** teal `#288C9B`, amber `#F29E4C`, sky `#5BC0DE`, emerald `#2ECC71`, violet `#9B59B6`, rose `#E74C3C`, indigo `#5C6BC0`, lime `#8BC34A`.
- **Radii:** `--radius-md` 6, `--radius-lg` 8, `--radius-xl` 12, `--radius-full` 9999.
- **Shadows:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`.
- **Type:** `--font-sans` Open Sans; `--font-mono` for URLs. Weights 400/600/700. Sizes used: 11, 11.5, 12, 12.5, 13, 13.5, 14, 17px.
- **Spacing:** 4px base grid (`--space-*`).
- **Dark mode:** toggling `.dark` on the root flips every token — the modal needs no per-component dark styling.

## Assets
- **Icons:** [lucide](https://lucide.dev) (`lucide-react` in the app). Used: `link`, `link-2`, `lock`, `key-round`, `copy`, `check`, `eye`, `eye-off`, `trash-2`, `plus`, `plus-circle`, `x`, `shield-check`, `user`. Backdrop only: `calendar-range`, `columns-3`, `calendar`, `users`, `settings`.
- **Brand logo:** `assets/icon-teal.svg` (and `icon-color.svg`) from the Draba design system — used in the backdrop sidebar only.
- No raster images.

## Files
- `Share Modal.html` — entry point; mounts the app, applies dark mode, wires the Tweaks panel (role / state / dark — a prototyping aid, not part of the feature).
- `ShareModal.jsx` — **the deliverable.** Modal shell, `ShareRow`, `AddShareForm`, empty state, permission logic, mock data (`SM_MEMBERS`, `SHARES_INIT`).
- `Backdrop.jsx` — contextual Draba timeline behind the modal. **Reference only — do not implement.**
- `tweaks-panel.jsx` — prototype tooling. Ignore for production.
- `colors_and_type.css` — design tokens (maps to the codebase's Tailwind theme).
- `assets/` — brand logo SVGs (backdrop only).

To preview: open `Share Modal.html` in a browser. Use the Tweaks panel (toolbar) to switch role (admin/member), populated/empty, and light/dark.

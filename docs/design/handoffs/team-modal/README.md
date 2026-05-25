# Handoff: Team Modal — Draba

## Overview

The Team Modal handles two flows — **creating a new team** and **editing an existing one** — in a single component with mode-aware behavior. It covers team identity (icon + color), metadata (name, description, notes), full member management (search, add, roles, stubs, pending invites, invite link), and a destructive archive action with confirmation step.

## About the Design Files

The files in this bundle are **HTML design prototypes** — not production code. Your task is to **recreate this component inside the existing Draba codebase** using its established React patterns, design tokens, and libraries.

## Fidelity

**High-fidelity.** Exact colors, spacing, typography, and interaction states are specified. Recreate pixel-closely using Draba's existing token system.

---

## Component: `<TeamModal>`

### Props

```ts
interface TeamModalProps {
  mode:    'new' | 'edit';
  team?:   Team;        // required when mode === 'edit'
  onClose: () => void;
}
```

### Rendering

Rendered into `document.body` via a React portal. Backdrop: `rgba(0,0,0,.7)`, clicking it closes the modal. The panel itself stops propagation.

### Panel

| Property | Value |
|---|---|
| Width | 580px |
| Max height | 90vh (scrollable content area) |
| Background | `#21262d` |
| Border | `1px solid #30363d` |
| Border radius | 14px |
| Box shadow | `0 24px 64px rgba(0,0,0,.6)` |
| Layout | Column flex: header / [banner] / tabs / scrollable content / footer |

---

## Sections

### 1. Header

```
[ IdentityBadge 36px square ] [ label + team name ] [ × close ]
padding: 16px 20px
border-bottom: 1px solid #30363d
```

- Label: `NEW TEAM` or `EDIT TEAM` — 11px, 600w, uppercase, letter-spacing .6px, `#484f58`
- Name: 16px, 600w, `#e6edf3`; falls back to `#484f58` placeholder when empty
- Close: × icon, 18px, `#484f58`

### 2. Saved banner (conditional)

Shown briefly after "Create team" is clicked in new mode. Auto-dismisses after 3 seconds.

```
padding: 8px 20px
background: {teamColor}18
border-bottom: 1px solid {teamColor}44
```

Content: 14px checkmark + 12px text: `"Team created — you can now add members."`, both in `teamColor`.

### 3. Tab bar

Two tabs: **Settings** and **Members**. Padding `0 20px`, border-bottom `1px solid #30363d`.

**Tab button:**
- Padding: `10px 14px`
- Font: 13px, 500w
- Active: `color: #e6edf3`, `border-bottom: 2px solid {teamColor}`
- Inactive: `color: #8b949e`, `border-bottom: 2px solid transparent`
- Margin-bottom: -1px (overlaps panel border)

**Members tab — member count badge:**
- 11px, `#484f58`, bg `#2d333b`, border-radius 99px, padding `1px 6px`

**Members tab locked state (new team, not yet saved):**
- Opacity: 0.45, cursor: `not-allowed`
- Tooltip on hover: `"Save the team first to add members"` — positioned below tab, `bg #161b22`, 11px, 7px border-radius

### 4. Footer

```
padding: 12px 20px
border-top: 1px solid #30363d
display: flex; justify-content: space-between; align-items: center
```

**Left side:**
- "Archive team" button — only shown when editing an existing team (`mode === 'edit'`)
- Style: `bg none`, border `#30363d`, color `#484f58`, 12px, archive icon 13px

**Right side:**
- Cancel button: bg none, border `#30363d`, color `#8b949e`, 13px
- Primary button: `bg {teamColor}`, white text, 13px, 600w
  - Label: `"Create team"` (new, unsaved) → `"Save changes"` (edit or after creation)

---

## Settings Tab

Fields stacked vertically, gap 18px, padding 20px.

### Identity field

```
<IdentityPicker> (36px square trigger) + "Click to change icon & color" hint
```

Uses the shared `<IdentityPicker>` / `<IdentityWidget>` component — see **Identity Widget handoff** for full spec. Shape is `'square'` for teams (vs `'circle'` for members).

### Name field (required)

Standard text input. Placeholder: `"Team name…"`. Required indicator: red `*` in field label.

### Description field

Single-line text input. Placeholder: `"Short description of this team…"`.

### Notes field

`<textarea>` with `resize: vertical`, 4 rows. Placeholder: `"Internal notes, context, links…"`. Line-height 1.5.

**All inputs:**
```
background: #2d333b
border: 1px solid #30363d
border-radius: 7px
padding: 8px 12px
color: #e6edf3
font-size: 13px
```

---

## Members Tab

Padding 20px, gap 20px between sections.

### Search / Add input

```
display: flex; align-items: center; gap: 8
background: #2d333b; border: 1px solid #30363d; border-radius: 8px; padding: 8px 12px
```

- Search icon (14px, `#484f58`) on the left
- Flex-1 input, no border/bg, `color: #e6edf3`, 13px, placeholder: `"Search users or enter email to invite…"`
- × clear button appears when query is non-empty

**Search results dropdown:**

Anchored below the input, full width, `bg #21262d`, border `#30363d`, border-radius 8, shadow `0 8px 24px rgba(0,0,0,.5)`. Max 6 results.

Each result row: `padding: 9px 12px`, flex, gap 10.

| Result type | Left | Center | Right |
|---|---|---|---|
| **User match** | 28px avatar | Name (13px 500w) + email (11px `#484f58`) | "Add" button (teal bg) OR "Already added" / "Invite pending" (muted text) |
| **Email invite** | 28px dashed circle with mail icon | "Invite {email}" + "Send an email invitation" | "Invite" button (bg `#373e47`, border `#30363d`) |

Already-added users: `opacity: 0.45`.

"Add" button: `bg #288C9B`, white, 12px, 600w, border-radius 6, padding `4px 12px`.

### Stub member creation

Below the search box. Default state: a dashed-circle `+` button + `"Create stub member"` text link (12px, `#484f58`).

When expanded, shows a form panel:

```
background: #2d333b; border: 1px solid #30363d; border-radius: 8; padding: 12px 14px
```

Header: amber dot + `"Create stub member"` label in amber (`#F97316`).

Explainer text: 11px, `#484f58`, line-height 1.5: `"Stub members can be assigned activities but don't have a Draba login. They appear with a dashed avatar."`

Fields:
- `<IdentityPicker>` (36px circle) + "Set icon & color" hint
- Name input (required) — autofocused
- Email input (optional, reference only)
- Cancel + "Create stub" buttons (right-aligned)

"Create stub" button: disabled until name is non-empty. Active: amber tint bg, amber border/text. Disabled: muted.

**Stub avatar rendering:** 28px circle with `border: 2px dashed #30363d` overlay, indicating no login.

### Member list

Section label: `MEMBERS ({count})` — standard FL label style.

Each member row:
```
padding: 7px 10px; border-radius: 8; background: #2d333b
display: flex; align-items: center; gap: 10
```

| Slot | Content |
|---|---|
| Left | 28px avatar (dashed border if stub) |
| Center | Name (13px, 500w) + optional "No login" pill (amber) + email (11px, `#484f58`) |
| Right | `<RoleDropdown>` + × remove button |

**"No login" pill:** `fontSize: 10, color: #F97316, bg: rgba(249,115,22,.15), padding: 1px 6px, border-radius: 99px, fontWeight: 600`

### Role dropdown (`<RoleDropdown>`)

Trigger: `<RolePill>` + 11px chevron-down. Rendered via portal.

Panel: `bg #21262d`, border `#30363d`, border-radius 9, shadow, padding `4px 0`, min-width 240px.

Three roles:

| Role | Pill style | Description |
|---|---|---|
| `admin` | Teal tint bg + teal text | Can manage team settings and members |
| `member` | `#373e47` bg + `#8b949e` text | Can view and contribute to timelines |
| `stub` | Amber tint bg + amber text | Assignable but has no Draba login |

Selected role row: bg `#2d333b`. Each row: column flex, role pill + 11px description.

**Role pill (`<RolePill>`):**
```
fontSize: 11, fontWeight: 600, padding: 2px 8px, border-radius: 99px
```

### Pending invitations

Only shown if `invites.length > 0`. Section label: `PENDING INVITATIONS ({count})`.

Each invite row: same layout as member row.
- Left: 28px dashed circle with mail icon (`bg #373e47`)
- Center: email address (13px) + "Sent {date}" (11px, `#484f58`)
- Right: "Revoke" button — `color: #EF4444, bg: rgba(239,68,68,.18), border: 1px solid rgba(239,68,68,.44), border-radius: 6, padding: 3px 10px, fontSize: 11, fontWeight: 500`

### Invite link

Section label: `INVITE LINK`.

```
display: flex; gap: 8
```

- URL display: flex-1, `bg #2d333b`, border `#30363d`, border-radius 7, padding `8px 12px`, 12px, `#484f58`, `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- Copy button: icon + "Copy link" label; transitions to checkmark + "Copied!" for 2s after click

Copy button states:
- Default: `bg #373e47`, border `#30363d`, color `#8b949e`
- Copied: `bg rgba(40,140,155,.22)`, border `#288C9B`, color `#288C9B`

Note below: 11px, `#484f58`, margin-top 6: `"Anyone with this link can request to join. Admins approve requests."`

---

## Archive Flow

Triggered by "Archive team" in the footer. Replaces the modal content entirely with a confirmation panel (same portal, same backdrop).

```
padding: 32px 28px; flex column; align-items: center; gap: 16; text-align: center
```

Icon container: 48×48, border-radius 12, `bg rgba(249,115,22,.20)`, border `1.5px solid rgba(249,115,22,.44)`, archive icon 22px amber.

Title: 16px, 600w, `#e6edf3`: `Archive "{teamName}"?`

Body: 13px, `#8b949e`, line-height 1.6, max-width 400: `"The team will be hidden from active views. All timelines and activities will be preserved and the team can be restored from the Archived section at any time."`

Buttons (flex, gap 10):
- Cancel: bg none, border `#30363d`, color `#8b949e`
- "Archive team": `bg rgba(249,115,22,.22)`, border `rgba(249,115,22,.66)`, color `#F97316`, 600w

---

## State model

```ts
interface TeamModalState {
  tab:         'settings' | 'members';
  teamSaved:   boolean;           // false = new unsaved team; true = edit or after create
  savedBanner: boolean;           // shows briefly after creation
  archiving:   boolean;           // shows archive confirmation

  // Settings tab
  identity:    Identity;          // { iconId, colorId }
  name:        string;
  description: string;
  notes:       string;

  // Members tab
  members:     TeamMember[];      // { userId, role }
  invites:     PendingInvite[];   // { id, email, sentDate }
}

interface TeamMember {
  userId: string;
  role:   'admin' | 'member' | 'stub';
}

interface PendingInvite {
  id:       string;
  email:    string;
  sentDate: string;
}
```

---

## New team flow (mode === 'new')

1. Modal opens on **Settings tab**, all fields empty
2. Members tab is **locked** (opacity 0.45, not-allowed cursor, tooltip on hover)
3. Footer primary button: **"Create team"**
4. On click → `teamSaved = true`, show saved banner for 3s, unlock Members tab
5. Footer primary button becomes **"Save changes"**

---

## Edit team flow (mode === 'edit')

1. Modal opens on **Settings tab**, pre-populated with existing team data
2. Members tab is immediately **unlocked**
3. "Archive team" button visible in footer left
4. Footer primary button: **"Save changes"**

---

## Design Tokens Used

| Token | Value |
|---|---|
| bg0 | `#0d1117` |
| bg1 | `#161b22` |
| bg2 | `#21262d` |
| bg3 | `#2d333b` |
| bg4 | `#373e47` |
| border | `#30363d` |
| border2 | `#21262d` |
| text1 | `#e6edf3` |
| text2 | `#8b949e` |
| text3 | `#484f58` |
| accent | `#288C9B` |
| danger | `#EF4444` |
| warn | `#F97316` |
| Font | `'Inter'` (align to codebase font) |

---

## Dependencies / Related Handoffs

- **Identity Widget** — `<IdentityPicker>` / `<IdentityBadge>` are used inside this modal. See the Identity Widget handoff for full spec.
- **Member Edit Modal** — separate modal for editing an individual member's profile, triggered from the member list.

---

## Files

| File | Description |
|---|---|
| `Team Modal.html` | Full interactive prototype. Two launch buttons: "New team" and "Edit · Product Marketing". Exercises both modes, all tabs, stub creation, role switching, invite management, and archive confirmation. |

Open in any browser and click either button to explore the modal.

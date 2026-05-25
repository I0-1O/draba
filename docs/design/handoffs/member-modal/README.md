# Handoff: Member Edit Modal — Draba

## Overview

The Member Edit Modal handles viewing and editing a single team member's profile. It is role-aware — a **Team Admin** sees a subset of controls, while an **Account Admin** (system-wide administrator) sees the full set including destructive actions and the ability to promote members to Account Admin status.

## About the Design Files

The files in this bundle are **HTML design prototypes** — not production code. Your task is to **recreate this component inside the existing Draba codebase** using its established React patterns, design tokens, and libraries.

## Fidelity

**High-fidelity.** Exact colors, spacing, typography, and interaction states are specified.

---

## Component: `<MemberModal>`

### Props

```ts
interface MemberModalProps {
  member:     Member;
  viewerRole: 'teamadmin' | 'accountadmin';
  onClose:    () => void;
}
```

Rendered into `document.body` via React portal. Backdrop: `rgba(0,0,0,.7)`. Clicking backdrop closes modal; panel stops propagation.

### Panel

| Property | Value |
|---|---|
| Width | 560px |
| Max height | 90vh |
| Background | `#21262d` |
| Border | `1px solid #30363d` |
| Border radius | 14px |
| Box shadow | `0 24px 64px rgba(0,0,0,.6)` |
| Layout | Column flex: header / scrollable content / footer |

---

## Member data model

```ts
interface Member {
  id:             string;
  name:           string;
  email:          string | null;       // null for stub members
  identity:       Identity;            // { iconId, colorId } — see Identity Widget handoff
  stub:           boolean;             // stub = no login, assignable only
  isAccountAdmin: boolean;             // has system-wide account admin privileges
  joinedDate:     string;
  lastActive:     string;
  stats: {
    timelines: {
      active:   number;               // timelines currently active
      archived: number;               // timelines that have been archived
    };
    activities: {
      pastDue:     number;            // end date passed, on active timeline
      running:     number;            // start date passed + end date future, on active timeline
      upcoming:    number;            // start date not yet reached, on active timeline
      unscheduled: number;            // no start/end date, on active timeline
      archived:    number;            // on archived timelines (historical)
    };
  };
  teams: Array<{
    name:     string;
    color:    string;
    initials: string;
    role:     'Admin' | 'Member' | 'Stub';
  }>;
}
```

---

## Header

```
padding: 16px 20px
border-bottom: 1px solid #30363d
display: flex; align-items: center; gap: 12
```

**Left:** `<IdentityPicker>` trigger — 40px circle badge (editable). See Identity Widget handoff.

**Center (flex:1):**
- Subline: `{stub ? 'Stub member' : 'Team member'} · {viewerRole === 'accountadmin' ? 'Account admin view' : 'Team admin view'}` — 11px, 600w, uppercase, letter-spacing .6px, `#484f58`
- Name row: 16px, 600w, `#e6edf3`, flex, gap 8, flex-wrap
  - **"No login" pill** (stub only): amber — `#F97316`, bg `rgba(249,115,22,.15)`, border `rgba(249,115,22,.44)`
  - **"Account Admin" badge** (when `member.isAccountAdmin || justPromoted`): indigo — `#6366F1`, bg `rgba(99,102,241,.15)`, border `rgba(99,102,241,.44)`, includes 10px shield-check icon

**Right:** × close button, 18px icon, `#484f58`.

---

## Scrollable content

`padding: 20px`, `gap: 18px`, `overflow-y: auto`.

### Name + Email row

2-column grid, gap 12.

- **Name:** text input, required.
- **Email:** text input (non-stub) OR dashed placeholder `"No email — stub member"` (stub, read-only).

Input style:
```
background: #2d333b; border: 1px solid #30363d; border-radius: 7px;
padding: 8px 12px; color: #e6edf3; font-size: 13px;
```

### Timelines + Activity stats

Two labeled sub-sections, stacked with gap 12.

**Chip style (shared):**
```
display: flex; flex-direction: column; align-items: center; gap: 3;
padding: 10px 14px; background: #2d333b; border-radius: 8; min-width: 72;
border-top: 2px solid {color}
```

Value: 18px, 700w, `#e6edf3`. Label: 10px, 500w, uppercase, letter-spacing .3px, `#484f58`.

#### Timelines (FL label: `TIMELINES`)

2 chips in a flex row, gap 8.

| Chip | Top border color |
|---|---|
| Active | `#288C9B` teal |
| Archived | `#484f58` muted |

#### Activities (FL label: `ACTIVITIES`)

5 chips in a flex row with `flex-wrap`, gap 8.

Stats are **date-relative, not status-relative** — each timeline can define its own custom statuses, so status labels are not meaningful as global stats.

| Chip | Description | Top border color |
|---|---|---|
| Past due | End date has passed; on an active timeline | `#EF4444` red if > 0, else `#484f58` |
| Running | Start date passed AND end date in future; on active timeline | `#288C9B` teal |
| Upcoming | Start date has not yet arrived; on active timeline | `#3B82F6` blue |
| Unscheduled | No start or end date set; on active timeline | `#8b949e` muted |
| Archived | On archived timelines (historical) | `#484f58` muted |

### Joined / Last active

2-column grid, gap 12. Each: read-only pill with calendar/activity icon, `#2d333b` bg, 13px, `#8b949e`.

### Teams

`FL` label: `TEAMS ({count})`. Flex column, gap 6.

Each row: `padding: 7px 10px`, `background: #2d333b`, border-radius 8.
- 22px square team badge (team color, white initials)
- Team name (13px, `#e6edf3`, flex:1)
- Role pill (11px, `#484f58`, bg `#373e47`, border-radius 99)

### Account section *(Team Admin + non-stub only)*

Separator line above. Label: `ACCOUNT`.

**Password reset button:**
- Default: border `#30363d`, color `#8b949e`, mail icon
- Sent state (3s): border + color `#22C55E`, check icon, label `"Reset email sent to {email}"`
- Transition: `all .2s`

---

## Account Admin Actions section *(Account Admin view only)*

Separator line above. Label: `ACCOUNT ADMIN ACTIONS`.

Flex row, gap 8, flex-wrap, align-items center.

### 1 — Promote to Account Admin

Only shown for **non-stub** members.

**Not yet admin:**
```
Button: background rgba(99,102,241,.15), border rgba(99,102,241,.44),
color #6366F1, font-size 13, font-weight 500
Icon: shield-check 13px
Label: "Promote to Account Admin"
→ opens PromoteConfirm dialog
```

**Already an Account Admin:**
```
Read-only pill: background rgba(99,102,241,.12), border rgba(99,102,241,.33),
color #6366F1, font-size 12
Icon: shield-check 13px
Label: "Already an Account Admin"
```

### 2 — Inactivate / Delete

**Deletable** (`stats.total === 0 && teams.length === 1`):
```
Button: bg rgba(239,68,68,.15), border rgba(239,68,68,.44), color #EF4444
Icon: trash 13px; Label: "Delete member"
→ opens DeleteConfirm dialog
```

**Not deletable:**
```
Button: bg rgba(249,115,22,.15), border rgba(249,115,22,.44), color #F97316
Icon: slash 13px; Label: "Inactivate account"
→ opens InactivateConfirm dialog
```

If not deletable and has activities, show explanation text (11px, `#484f58`) inline.

---

## Confirmation dialogs

All three share the same shell: a separate portal over a `rgba(0,0,0,.7)` backdrop, 500px panel, 14px border-radius.

```
padding: 32px 28px; flex column; align-items: center; gap: 16; text-align: center
```

Icon container: 48×48, border-radius 12.

| Type | Icon | Color |
|---|---|---|
| Promote | shield-check | `#6366F1` indigo |
| Inactivate | slash-circle | `#F97316` amber |
| Delete | trash | `#EF4444` red |

Each has a title (16px, 600w), body (13px, `#8b949e`, line-height 1.6, max-width 380), and Cancel + confirm buttons.

### Promote copy
- Title: `Promote "{name}" to Account Admin?`
- Body: `"They will have full system access: manage all teams, members, and account settings across Draba. This can be reversed at any time."`
- Confirm label: `"Promote to Account Admin"` (indigo)
- **On confirm:** sets `memberIsAdmin = true`, closes dialog, shows badge in header — does NOT close the modal

### Inactivate copy
- Title: `Inactivate "{name}"?`
- Body: `"Their access will be disabled. Assigned activities remain intact. You can reactivate the account at any time."`
- Confirm label: `"Inactivate account"` (amber)
- On confirm: close modal (calls `onClose`)

### Delete copy
- Title: `Delete "{name}"?`
- Body: `"This will permanently remove their account from Draba. This cannot be undone."`
- Confirm label: `"Delete member"` (red)
- On confirm: close modal

---

## Footer

```
padding: 12px 20px; border-top: 1px solid #30363d;
display: flex; justify-content: flex-end; gap: 8
```

- **Cancel**: bg none, border `#30363d`, color `#8b949e`, 13px
- **Save changes**: bg `{member identity color}`, white, 13px, 600w

---

## Role permission matrix

| Capability | Team Admin | Account Admin |
|---|---|---|
| Edit name | ✓ | ✓ |
| Edit email | ✓ (non-stub) | ✓ (non-stub) |
| Change identity | ✓ | ✓ |
| Send password reset | ✓ (non-stub) | ✓ (non-stub) |
| Promote to Account Admin | — | ✓ (non-stub) |
| Inactivate account | — | ✓ |
| Delete member | — | ✓ (deletable only) |

**Deletable** = `(activities.pastDue + activities.running + activities.upcoming + activities.unscheduled) === 0 && teams.length === 1`

Note: archived activity count does **not** factor into deletability — historical activities on archived timelines don't block removal.

**Cannot promote stubs** — the promote button is hidden when `member.stub === true`.

---

## Design Tokens

| Token | Value | Usage |
|---|---|---|
| bg2 | `#21262d` | Modal bg, confirmation panel |
| bg3 | `#2d333b` | Inputs, chips, team rows |
| bg4 | `#373e47` | Role pills bg |
| border | `#30363d` | Panel/input borders |
| border2 | `#21262d` | Section separator |
| text1 | `#e6edf3` | Primary text |
| text2 | `#8b949e` | Secondary text |
| text3 | `#484f58` | Labels, subtle, section heads |
| accent | `#288C9B` | Teal — In Progress, identity default |
| danger | `#EF4444` | Delete |
| warn | `#F97316` | Inactivate, stub pill |
| success | `#22C55E` | Completed, reset sent |
| promote | `#6366F1` | Account Admin badge + promote actions |

---

## Dependencies / Related Handoffs

- **Identity Widget** — `<IdentityPicker>` and `<IdentityBadge>` used in the modal header. See Identity Widget handoff.
- **Team Modal** — separate modal for managing the team entity itself (members list, roles, invite links). See Team Modal handoff.

---

## Files

| File | Description |
|---|---|
| `Member Edit Modal v2.html` | Full interactive prototype. Toggle "Team Admin" vs "Account Admin" at the top, then select a member. John Doe is pre-seeded as an existing Account Admin. Try promoting Lindsay K. to see the full flow. |

Open in any browser — no build step needed.

# Tasks

## Current Sprint — Foundation

### Repo & Tooling
- [x] Initialize Go module (`packages/api/`) with basic project structure — 2026-04-29
- [x] Initialize React + TypeScript + Vite project (`packages/web/`) — 2026-04-29
- [x] Set up pnpm workspace (`pnpm-workspace.yaml`) — 2026-04-29
- [x] Add `golangci-lint` config (`.golangci.yml`) — 2026-04-29
- [x] Set up GitHub Actions CI: lint + test on PR — 2026-04-29
- [x] Write `docker-compose.yml` for local development — 2026-04-29

### API — Core
- [x] DB abstraction layer with SQLite adapter (sqlx + modernc.org/sqlite) — 2026-04-30
- [x] Migration runner (auto-runs on startup) — 2026-04-30
- [x] Initial schema migrations: users, teams, team_members, invites, events, event_tags, event_assignments, timelines, timeline_access, calendar_connections, api_tokens — 2026-04-30
- [x] Auth: JWT issue/validate, password hash/verify, invite token generate/validate — 2026-04-30
- [x] `POST /auth/register` (invite token required) — 2026-04-30
- [x] `POST /auth/login` — 2026-04-30
- [x] `POST /auth/refresh` — 2026-04-30
- [x] `POST /teams` — create team — 2026-05-03
- [x] `POST /teams/:id/invites` — send invite — 2026-05-03
- [x] `GET /teams/:id/members` — 2026-05-03
- [x] `POST /teams/:id/events` — create event — 2026-05-03
- [x] `GET /teams/:id/events` — list events (date range filter) — 2026-05-03
- [x] `PATCH /events/:id` — update event — 2026-05-03
- [x] `DELETE /events/:id` — delete event — 2026-05-03

### API — Real-Time
- [x] WebSocket hub (`internal/ws/`) — 2026-05-14
- [x] Team-scoped subscription model — 2026-05-14
- [x] Broadcast on `events.*` internal bus events — 2026-05-14

### API — Timelines
- [x] `POST /teams/:id/timelines` — create timeline — 2026-05-15
- [x] `GET /timelines/:id` — fetch timeline (public or auth-gated) — 2026-05-15
- [x] `GET /timelines/share/:token` — public share link handler — 2026-05-15
- [x] Timeline access list enforcement — 2026-05-15

### Web — Scaffold
- [x] Initialize shadcn/ui: `pnpm dlx shadcn@latest init` — 2026-05-16
- [x] Set color tokens in `src/index.css` once palette is decided — 2026-05-16
- [x] Set up dark mode toggle (localStorage + `prefers-color-scheme`) — 2026-05-16
- [x] Routing setup (React Router) — 2026-05-16
- [x] Auth flow: login, register (via invite), token storage — 2026-05-16
- [x] API client (TanStack Query + fetch wrapper using generated types) — 2026-05-16
- [x] WebSocket client hook (`useWebSocket`) — 2026-05-16
- [x] Embed React build in Go binary (`//go:embed`); API serves SPA at `GET /` — 2026-05-16

### RBAC Refactor + First-Run Setup (Phase 8.0)
- [x] Migration 003: `team_members` PK, nullable `user_id`, `display_name` — 2026-05-18
- [x] Migration 003: `event_assignments` + `timeline_access` swap `user_id` FK for `team_member_id` — 2026-05-18
- [x] Migration 003: `timeline_access` gains `role (admin|member)`; `visibility` dropped from `timelines` — 2026-05-18
- [x] `User.IsSuperadmin`: first registered user auto-granted superadmin — 2026-05-18
- [x] `GET /setup/status` — public endpoint (`{ needsSetup: bool }`) — 2026-05-18
- [x] Timeline access: team admins bypass check; members require explicit `timeline_access` entry — 2026-05-18
- [x] `SetupPage`: 3-step first-run wizard (account → team → timeline) — 2026-05-18
- [x] `ProtectedRoute`: redirect to `/setup` when `needsSetup` is true — 2026-05-18
- [x] Production Dockerfile: run as non-root `draba` user (uid 1000) — 2026-05-18

### Web — Timeline View (Phase 8.1: Shell & Rendering — Gantt pivot)
- [x] API: `GET /teams`, `GET /teams/:id/timelines`, `assignedMemberIds[]` on Event — 2026-05-18
- [x] `TimelineView` + `TimelineGrid` (person-lane prototype, later pivoted) — 2026-05-18
- [x] Pixel ↔ date math (map date range to X offset/width) — 2026-05-18
- [x] Wire to `GET /teams/:id/events?start=&end=` and `GET /teams/:id/members` — 2026-05-18
- [x] `TimelineGrid` rewrite: Gantt layout — one row per event, sticky label col, member avatars — 2026-05-18
- [x] `TimelineToolbar` component: zoom in/out, group-by, sort-by, export stub — 2026-05-18
- [x] `TimelineView` update: build `GanttRow[]` with grouping + sorting logic — 2026-05-18
- [x] Group by Member: section headers per assignee, events under primary assignee — 2026-05-18
- [x] Group by Parent: root events first, children indented below their parent — 2026-05-18
- [x] Sort by: start date, end date, title A–Z — 2026-05-18
- [x] Zoom: variable `colWidth` stepped through [40, 60, 80, 120, 160] px/day — 2026-05-18
- [x] `DashboardPage`: render `TimelineToolbar`, pass group/sort/zoom state to `TimelineView` — 2026-05-18

### Web — Timeline View (Phase 8.2: Interactions)
- [x] Click event block → open `EventDetailPanel` (view mode) — 2026-05-19
- [x] Edit form in panel (title, description, date range, status, assignees); save via `PATCH /events/:id` — 2026-05-19
- [x] Delete event with confirm dialog; remove from timeline — 2026-05-19
- [x] Drag on empty lane cell → open `EventCreateForm` pre-filled with date range + lane member — 2026-05-19
- [x] Submit create form → `POST /teams/:id/events`, insert block into timeline — 2026-05-19

### Web — Gantt Bar Drag (Phase 8.2.1: Resize & Move)
- [x] Detect mousedown on left/right edge (8px zone) vs. bar body — 2026-05-19
- [x] Edge drag: update start or end date live as user drags; snap to active granularity column — 2026-05-19
- [x] Body drag: shift both start and end dates by the same column delta — 2026-05-19
- [x] Show date tooltip during drag (start date for left edge, end date for right edge, both for body) — 2026-05-19
- [x] PATCH `/events/:id` with new startAt/endAt on mouseup; optimistic update in cache — 2026-05-19
- [x] Block drag on `is_external` events (read-only; Phase 14 flag) — 2026-05-19

### Web — Timeline View (Phase 8.3: Real-Time Sync)
- [x] Connect `useWebSocket` to subscribe to `events.*` for active team — 2026-05-19
- [x] `events.created` delta: insert block into TanStack Query cache — 2026-05-19
- [x] `events.updated` delta: update block in cache — 2026-05-19
- [x] `events.deleted` delta: remove block from cache — 2026-05-19
- [x] Handle optimistic update conflicts (in-flight local edit vs. arriving WS delta) — 2026-05-19

### OpenAPI
- [x] Write initial `openapi.yaml` in `packages/shared/` — 2026-05-04
- [x] Set up TypeScript type generation from spec (openapi-typescript) — 2026-05-04
- [x] Set up Go type generation from spec (`oapi-codegen`) — 2026-05-16
- [x] Refactor existing Go handlers to use generated OpenAPI models — 2026-05-16

### Web — Persistent View Settings (Phase 8.4)
- [x] Migration 004: `user_preferences` table with empty-string sentinel for global scope — 2026-05-20
- [x] `UserPreference` model (`models.go`) — 2026-05-20
- [x] `UserPreferenceRepo`: `List` and `Upsert` methods — 2026-05-20
- [x] `GET /users/me/preferences?timeline_id=` — returns scoped or global prefs — 2026-05-20
- [x] `PUT /users/me/preferences` — upsert single key/value, validates JSON — 2026-05-20
- [x] OpenAPI spec: `UserPreference` schema + two endpoints — 2026-05-20
- [x] TypeScript types regenerated from spec — 2026-05-20
- [x] `usePreferences` / `useUpsertPreference` / `usePreferenceMap` hooks — 2026-05-20
- [x] `DashboardPage`: restore toolbar state from per-timeline prefs on timeline switch — 2026-05-20
- [x] `DashboardPage`: save toolbar state (group_by, sort_by, zoom_granularity, color_by) on change — 2026-05-20
- [x] `DashboardPage`: persist dark mode preference globally — 2026-05-20

### Web — Find (Phase 8.5)
In-view "find in page" with highlight + match navigation. Scoped to already-loaded events; respects active filters. Global cross-team search is deferred to Phase 15.

**Find bar:**
- [x] `FindBar` component in the TopBar (between FilterDropdown and ProfileMenu) — query input, match counter (`N / M`), prev/next chevrons, close (×) — 2026-05-20
- [x] Open via `Ctrl/Cmd+F` global keybinding and via a search icon in the TopBar; close via `Esc` or × — 2026-05-20
- [x] Debounced (~150ms) client-side matcher over already-fetched events — 2026-05-20

**Match scope:**
- [x] Case-insensitive match against: event title, description, assignee display names, parent event title — 2026-05-20
- [x] Respect active filters — only events already visible in the current view are candidates — 2026-05-20

**Visual treatment:**
- [x] Matching events: amber outline / glow using existing design tokens — 2026-05-20
- [x] Non-matching events: dimmed to ~0.3 opacity — 2026-05-20
- [x] Active match (prev/next cursor position): stronger outline + subtle pulse to distinguish from other matches — 2026-05-20
- [x] On hover, non-title matches show a "why matched" hint (e.g. `matched assignee Jane`) — 2026-05-20

**Navigation:**
- [x] `Enter` / `Shift+Enter` and ◀ ▶ chevrons walk forward/backward through matches — 2026-05-20
- [x] Auto-scroll the Gantt on each step — horizontal pan to event's date range, vertical scroll to its row, centered in viewport — 2026-05-20

**Empty / edge cases:**
- [x] Zero matches, no filters active → bar shows `No matches` — 2026-05-20
- [x] Zero matches in view, filters active → soft callout: *"No matches in current view. [Clear filters]"* — 2026-05-20
- [x] Find query is ephemeral (not persisted across navigation/reload); bar open-state also ephemeral — 2026-05-20

**Testing:**
- [x] Unit: matcher returns correct hits across all match fields, case-insensitive — 2026-05-20
- [ ] Integration: Find works at every granularity level and every group-by mode (requires live data — manual)
- [ ] Keyboard: full prev/next cycle reachable with keyboard only (manual verification with live events)

## Up Next

> **Member management work is absorbed into Phase 10.1 (Teams — Full CRUD)** — see the dedicated 10.1 task block below. The previously enumerated sidebar gear-icon + add-member-sheet tasks are reframed there.

### Web — Filter Scoping (FilterDropdown + API)
Reorganizes the filter dropdown into four explicit sections. Filters are stored as personal by default; admins can promote any filter to team or timeline scope; members can nominate their filters for admin review.

**Data model:**
- Single `saved_filters` table: `(id, team_id, timeline_id nullable, created_by, name, definition JSON, scope ENUM(personal|nominated|team|timeline), status ENUM(active|pending_review))`
- `scope=personal` — visible only to creator; `scope=team` — visible to all team members; `scope=timeline` — visible to all members of that timeline; `scope=nominated` — personal filter flagged by member for admin review (visible to admins)

**API:**
- [ ] Migration: replace current `saved_filters` shape with the unified schema above
- [ ] `GET /teams/:id/filters` — returns filters scoped `team` or `timeline` (for the active timeline), plus the calling user's `personal` and `nominated` filters
- [ ] `POST /teams/:id/filters` — create a new personal filter; `definition` is the filter JSON
- [ ] `PATCH /filters/:id` — update name or definition (creator or admin)
- [ ] `PATCH /filters/:id/scope` — promote/demote scope; admin-only for `team`/`timeline`; any member can set `nominated`
- [ ] `DELETE /filters/:id` — creator or admin

**Web — FilterDropdown layout:**
- [ ] Reorganize dropdown into four labeled sections, each hidden when empty:
  1. **Default** — All events / Upcoming / My events (hardcoded presets, always present)
  2. **Team** — filters with `scope=team` from API
  3. **Timeline** — filters with `scope=timeline` for the active timeline
  4. **Mine** — caller's `personal` filters; nominated filters shown with a "Pending" badge
- [ ] Filter names truncate with ellipsis at a max width; full name in tooltip on hover
- [ ] "New filter…" opens filter editor (personal scope by default); "Share…" action on existing personal filters lets the member nominate it or (if admin) promote directly to team/timeline
- [ ] Pass active timeline ID through context so the dropdown can fetch timeline-scoped filters
- [ ] Admin-visible section at bottom of "Mine": nominated filters awaiting review, with Approve / Reject actions

---

> **Connectors sidebar + per-timeline connector model is absorbed into the External Connectors (Inbound Webhooks) task block further down** — that section now carries both the webhook backend and the sidebar UI work.

### API — Token Auth (Phase 9)
- [x] `POST /tokens` — create API token (returns value once) — 2026-05-20
- [x] `GET /tokens` — list tokens for current user — 2026-05-20
- [x] `DELETE /tokens/:id` — revoke token (preserved row, sets revoked_at) — 2026-05-20
- [x] Middleware: accept Bearer token (JWT or API token) on all authenticated routes — 2026-05-20
- [x] Enforce token scope on writes (read-only tokens blocked from mutations) — 2026-05-20

### API — Archive (Phase 9)
- [x] `POST /events/:id/archive` and `POST /events/:id/unarchive` — 2026-05-20
- [x] `POST /timelines/:id/archive` and `POST /timelines/:id/unarchive` (team-admin only) — 2026-05-20
- [x] List endpoints exclude archived records by default; `?archived=true` to include — 2026-05-20

### Phase 10 — Entity Management (data-cornerstone CRUD)

Closes CRUD gaps for the three core data entities. Events are already CRUD-complete (Phases 3 / 8.2 / 8.2.1 + Phase 9 archive); Teams and Timelines are not, so 10.x focuses on them.

---

### Teams — Full CRUD (Phase 10.1)
Closes the Teams cornerstone. Absorbs the previous "Web — Member Management (Sidebar)" Up-Next block.

**API — team-level:**
- [ ] `GET /teams/:id` — full team detail (name, timezone, week start, member count, timeline count)
- [ ] `PATCH /teams/:id` — rename, change timezone, change week start day (admin only)
- [ ] `POST /teams/:id/archive` and `POST /teams/:id/unarchive` (depends on Phase 9)

**API — member-level:**
- [ ] `POST /teams/:id/members` — add existing registered user by `userId`; admin only
- [ ] `PATCH /teams/:id/members/:memberId` — update display name, color, role (admin for role; member can set own color/display name)
- [ ] `DELETE /teams/:id/members/:memberId` — remove member; reject if last admin
- [ ] `POST /teams/:id/participants` — create login-less participant (admin only; from 8.0 schema)

**API — invite-level:**
- [ ] `GET /teams/:id/invites` — list pending invites
- [ ] `DELETE /teams/:id/invites/:inviteId` — cancel pending invite

**Web — team creation & general settings:**
- [ ] "New team" affordance in the team picker → create-team modal (name, timezone, week start)
- [ ] `/settings/team/:id` General tab: name, timezone, week start, archive button
- [ ] Team archive flow: confirmation dialog; archived teams surfaced in an "Archived teams" section
- [ ] `/settings` route shell with left-nav (foundation lands here; sections fill in across 10.1–10.4)

**Web — member management (`/settings/team/:id` Members tab):**
- [ ] Member list with role, color swatch, last seen
- [ ] Member row hover → gear icon → member config drawer: editable display name, color picker, role selector; save → `PATCH /teams/:id/members/:memberId`
- [ ] "Add member" sheet with two modes:
  - _Add existing user_ — search registered users not yet on this team → `POST /teams/:id/members` with `userId`
  - _Send invite_ — email → `POST /teams/:id/invites`; pending row appears in list immediately
- [ ] Pending invites list with cancel (×) → `DELETE /teams/:id/invites/:id`
- [ ] Non-admin view of Members tab is read-only
- [ ] Sidebar gear-icon member quick-edit drawer reuses Members-tab components

**Web — participants (`/settings/team/:id` Participants tab):**
- [ ] Create / rename / archive login-less participants

---

### Team Statuses & Member Colors (Phase 10.2)
API + UI bundled. Required before Phase 11.3 (Kanban).

**API:**
- [ ] `team_statuses` migration and repository
- [ ] Seed default statuses (Planned / In Progress / Done) on team creation
- [ ] `GET /teams/:id/statuses` — list in order
- [ ] `POST /teams/:id/statuses` — create
- [ ] `PATCH /statuses/:id` — rename, recolor, reorder
- [ ] `DELETE /statuses/:id` — requires `replacementStatusId`; migrates events
- [ ] Self-protect: cannot delete the last remaining status

**Web (`/settings/team/:id` Statuses tab):**
- [ ] Drag-to-reorder list with inline rename + color picker
- [ ] Delete-with-replacement dialog: lists affected event count, picker for replacement
- [ ] Member color picker in Members tab confirmed wired to same color field (work primarily lives in 10.1)

---

### Timelines — Full CRUD (Phase 10.3)
Closes the Timelines cornerstone. Today timelines can be created in the wizard and never managed afterward; access lists exist in schema but have no CRUD endpoints.

**API — timeline-level:**
- [ ] `PATCH /timelines/:id` — rename, change start/end date, change description (admin only)
- [ ] `DELETE /timelines/:id` — hard delete; admin only; double-confirm
- [ ] Archive endpoints already in Phase 9

**API — access list:**
- [ ] `GET /timelines/:id/access` — list current grants (team member + role)
- [ ] `PUT /timelines/:id/access/:memberId` — grant or update role (admin / member)
- [ ] `DELETE /timelines/:id/access/:memberId` — revoke grant

**Web:**
- [ ] "New timeline" affordance in the sidebar timelines list → create-timeline modal (name, date range)
- [ ] Edit-timeline modal from the sidebar (or a `/settings/team/:id/timelines` sub-route): rename, change date range, archive, delete
- [ ] Access-list management UI: search-pick team members, role toggle, remove
- [ ] Archived timelines under a collapsed "Archived" group in the sidebar; unarchive from there

---

### Profile, Tokens & Admin Settings (Phase 10.4)
Cross-cutting settings shell. Consumes Phase 9 (tokens API) and reuses the `/settings` shell scaffolded in 10.1.

**Profile (`/settings/profile`):**
- [ ] Display name edit; change password form
- [ ] Email shown read-only for v1
- [ ] Avatar upload (stretch)

**API Tokens (`/settings/tokens`) — UI for Phase 9 endpoints:**
- [ ] List existing tokens with revoke button (name, scope, last used, created)
- [ ] Create token dialog: name + scope picker (read-only / add / edit-own / edit-all)
- [ ] One-time secret reveal on creation, with copy-to-clipboard

**Admin (`/settings/admin`, superadmin only):**
- [ ] Instance name + branding (logo, accent color override)
- [ ] Registration policy toggle (invite-only vs open)
- [ ] Backup status read-only surface (DB path, last-modified)
- [ ] SMTP config — deferred to Phase 14 with password reset

---

### Timeline Views — List / Spreadsheet (Web — Phase 11.1)
Ships the view-switcher infrastructure plus the dense, sortable, inline-editable List view.

**Infrastructure:**
- [ ] Extend `ViewMode` to `'gantt' | 'list' | 'calendar' | 'kanban'`
- [ ] View switcher control in the timeline sub-toolbar; per-timeline persisted via existing preferences (8.4)
- [ ] View-specific toolbar slots so each view contributes its own controls

**List view:**
- [ ] Virtualized table (TanStack Virtual or react-virtual) — must handle 1000+ rows smoothly
- [ ] Default columns: Title, Start, End, Duration, Status, Assignees, Tags, Parent
- [ ] Column show/hide menu; column reorder via drag; resizable widths — persisted via preferences (new prefs keys)
- [ ] Sort by clicking a column header (single-column sort for v1)
- [ ] Density toggle (Comfortable / Compact)
- [ ] Inline edit for title, dates, status; Tab / Shift+Tab / Enter cell navigation
- [ ] Row click (off editable cell) opens existing `EventDetailPanel`
- [ ] Bulk selection via checkbox column; contextual bulk-action bar (archive / delete / status-change)
- [ ] Find bar (8.5) highlights matching rows in List view

---

### Timeline Views — Calendar (Web — Phase 11.2)
Three sub-layouts sharing one component skeleton.

**Shared:**
- [ ] Sub-layout switcher (Month / Week / Day) in the view's toolbar slot
- [ ] Today / prev / next navigation; jump-to-date picker
- [ ] Click empty cell → Event create form prefilled with that date
- [ ] Click event → `EventDetailPanel`
- [ ] Drag event between cells → PATCH new start/end preserving duration (Week / Day only for v1)

**Month layout:**
- [ ] 6-week grid; multi-day events render as continuous bars across cells
- [ ] "+N more" overflow affordance per cell

**Week layout:**
- [ ] 7 day columns, 24-hour vertical time grid, configurable working-hours zoom
- [ ] All-day strip above the time grid for events without time components
- [ ] Overlapping-event lane algorithm: side-by-side columns within a day

**Day layout:**
- [ ] Single-day variant of Week; same time grid and lane algorithm

**Open question to resolve at start of phase:**
- [ ] Decide handling for date-only events in time-grid layouts (default 9am vs. all-day strip)

---

### Timeline Views — Kanban (Web — Phase 11.3)
Read-only per requirements. Depends on Phase 10.1 (status API) and 10.2 (status UI).

- [ ] Columns from `team_statuses` in display order; column header colored from status color
- [ ] Cards: title, date range, assignee avatars (stacked color indicators for multi-assignee), parent badge if nested
- [ ] Empty column shows muted "No events" placeholder
- [ ] Each column scrolls independently when card count exceeds viewport height
- [ ] Card click → `EventDetailPanel`
- [ ] Status renamed/recolored in Settings updates Kanban column header without refresh
- [ ] Attempting to drag a card produces no errors and no state change (read-only enforcement)

### Calendar Sync
- [ ] Google Calendar OAuth connect flow
- [ ] Outbound sync: push draba events to Google Calendar on create/update/delete
- [ ] Inbound sync: Google webhook handler → upsert event in draba
- [ ] Built-in CalDAV server (`internal/caldav/`)
- [ ] CalDAV connect flow (user provides URL + credentials)
- [ ] Outbound sync: push draba events to CalDAV on create/update/delete
- [ ] Team iCal feed endpoint: `GET /timelines/:ical_token/feed.ics` (public, sanitized — no notes)

### Shares — Multi-Share Views with Passwords (Phase 13)
First-class Share entity. One timeline can host many shares, each frozen to a specific view + config.

**Schema:**
- [ ] Migration: `shares` table — id, timeline_id, view_type, view_config JSON, password_hash (nullable), expires_at (nullable), created_by, created_at, last_viewed_at, view_count, revoked_at
- [ ] Migration: migrate existing `timelines.share_token` value into a first share row, then drop the column in a follow-up migration once UI references are gone

**API:**
- [ ] `POST /timelines/:id/shares` — create share with view_type + view_config snapshot + optional password + optional expiry
- [ ] `GET /timelines/:id/shares` — list shares (creator + admins)
- [ ] `PATCH /shares/:id` — rename / change password / extend expiry / revoke
- [ ] `DELETE /shares/:id` — hard delete
- [ ] `GET /shares/:token` — public lookup; password-protected returns 401 with `passwordRequired: true`
- [ ] `POST /shares/:token/unlock` — exchange password for a short-lived view JWT scoped to that share
- [ ] Rate-limit unlock attempts per IP

**Web — creating shares:**
- [ ] "Share this view" button in every view's toolbar slot (Gantt / List / Calendar / Kanban)
- [ ] Share modal: snapshots current toolbar state into `view_config`, optional password + expiry toggles, returns URL with copy button

**Web — viewing shares:**
- [ ] Public viewer route `/s/:token` — no auth required
- [ ] Password gate page for protected shares
- [ ] Mount the appropriate view component in read-only mode with `view_config` applied
- [ ] Branding strip: team name, "Shared view", last-updated timestamp

**Web — managing shares:**
- [ ] Manage-shares section on each timeline (list, view counts, revoke, edit)
- [ ] Indicator chip on timeline tile showing active share count

---

### Data Portability & Exports (Phase 14)

**Tabular (round-trip):**
- [ ] `GET /timelines/:id/export.csv` and `GET /timelines/:id/export.xlsx`
- [ ] `POST /teams/:id/events/import` — CSV/Excel import with preview + validation
- [ ] Downloadable import template at `GET /import-template.csv` and `.xlsx`

**Visual exports (gofpdf):**
- [ ] Gantt → PDF: landscape, paginated by date range, member-color legend strip
- [ ] Gantt → PNG: single-page rasterized variant
- [ ] Kanban → PDF: columns side-by-side, paginated when too wide
- [ ] Kanban → PNG: single-page
- [ ] List → Markdown (GitHub-flavored table) and PDF (styled table)
- [ ] Calendar → PDF: one page per month / week / day depending on active sub-layout
- [ ] Header strip on every visual export: team name, timeline name, generated-at timestamp, applied filter description
- [ ] All visual exports respect active filter / sort / group at time of export

**Wiring:**
- [ ] Gantt toolbar's existing "Export" stub becomes a real menu: CSV / xlsx / PDF / PNG
- [ ] Same export menu in 11.1 / 11.2 / 11.3 toolbar slots, scoped to formats valid for that view

**SMTP & password reset (lands here because import errors / reset emails are first SMTP use):**
- [ ] Password reset flow (email required — pick SMTP or transactional email provider)
- [ ] SMTP configuration surface in `/settings/admin`

---

### External Connectors (Inbound Webhooks) — Phase 15
Includes both the webhook backend and the per-timeline connector sidebar UI (previously a separate Up-Next block).

**Backend:**
- [ ] Create `team_inbound_webhooks` and `event_links` DB migrations
- [ ] Add `is_external` boolean column to `events` table
- [ ] `POST /teams/:id/webhooks` — generate an inbound webhook URL for a provider (e.g. Asana)
- [ ] `GET /teams/:id/webhooks` — list active inbound webhooks
- [ ] `POST /webhooks/:provider/:token` — generic inbound webhook handler to map payload to Draba events
- [ ] Web UI: Render `is_external` events as read-only (disable drag-and-drop handles)
- [ ] Web UI: Show external provider icon/link on the event detail card

**Per-timeline connector model (was Up-Next "Web — Connectors"):**
- [ ] Migration: `team_connectors (id, team_id, timeline_id, provider ENUM, display_name, config JSON, created_by, created_at)` — one row per connector instance
- [ ] Provider values initially: `asana | aha | google_sheets | excel_online | webhook`
- [ ] `GET /timelines/:id/connectors` — list connectors for a timeline
- [ ] `POST /timelines/:id/connectors` — create connector (admin only); returns generated inbound token
- [ ] `PATCH /connectors/:id` — update display name or config (admin only)
- [ ] `DELETE /connectors/:id` — remove connector (admin only)
- [ ] `POST /connectors/:token/ingest` — public inbound endpoint; validates token; maps payload via provider adapter

**Sidebar CONNECTORS section (already stubbed):**
- [ ] Wire `GET /timelines/:id/connectors` — list active connectors beneath the active timeline label
- [ ] "Add connector" → connector setup sheet: provider picker → config fields → save → `POST /timelines/:id/connectors`
- [ ] Connector row hover → gear icon → config drawer; delete with confirm
- [ ] Provider icon set (Asana, Aha, Sheets, Excel, generic Plug)

## Done
- [x] Initialize repo scaffold — 2026-04-27
- [x] Define requirements, architecture, conventions — 2026-04-27

## Parking Lot
- MySQL/MariaDB and Postgres DB adapters (SQLite first, then add others)
- CLI binary
- MCP server for AI agent access
- Mobile native apps (ship PWA first)
- Microsoft/Outlook calendar sync (v2)
- Multi-tenant cloud hosting
- SSO / OAuth login (GitHub, Google)
- Notifications (email, push)
- Recurring event UI (RRULE editing)
- Kanban drag-to-change-status (v2; v1 Kanban is read-only)

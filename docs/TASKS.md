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

## Up Next

### Web — Member Management (Sidebar)
Adds inline member config, a two-path add-member flow with pending invite list, and a manage-members entry to the sidebar Members list.

**API:**
- [ ] `PATCH /teams/:id/members/:memberId` — update display name, color, role (admin only)
- [ ] `DELETE /teams/:id/members/:memberId` — remove member; team admin only; reject if last admin
- [ ] `POST /teams/:id/members` — add an existing registered user to the team by `userId`; admin only
- [ ] `GET /teams/:id/invites` — list pending (unaccepted) invites for the team
- [ ] `DELETE /teams/:id/invites/:inviteId` — cancel a pending invite; admin only

**Web — member row:**
- [ ] On hover, show gear icon on each member row; click opens member config drawer
- [ ] Member config drawer: editable display name, color swatch picker, role selector (admin/member); save → `PATCH /teams/:id/members/:memberId`

**Web — members list footer (below last member, above section border):**
- [ ] "Add member" button opens add-member sheet with two tabs/modes:
  - _Add existing user_ — search registered users not yet on this team → `POST /teams/:id/members` with `userId`
  - _Send invite_ — email input → `POST /teams/:id/invites`; on success, invite appears immediately in the pending list below
- [ ] Pending invites list in the sheet: shows email + "Pending" badge + cancel (×) button → `DELETE /teams/:id/invites/:id`; fetched from `GET /teams/:id/invites`
- [ ] "Manage members" row with a Users icon → navigates to `/settings/members` (stub page for now)

---

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

### Web — Connectors (Sidebar + API)
Inbound-only data connectors that push external events (Asana, Aha, Google Sheets, live Excel, etc.) into a specific draba timeline. Contextual to the active timeline.

**Data model:**
- `team_connectors (id, team_id, timeline_id, provider ENUM, display_name, config JSON, created_by, created_at)` — one row per connector instance
- `provider` values initially: `asana | aha | google_sheets | excel_online | webhook` (generic fallback)

**API:**
- [ ] Migration: `team_connectors` table
- [ ] `GET /timelines/:id/connectors` — list connectors for a timeline (team members)
- [ ] `POST /timelines/:id/connectors` — create connector; admin only; returns connector with generated inbound token
- [ ] `PATCH /connectors/:id` — update display name or config; admin only
- [ ] `DELETE /connectors/:id` — remove connector; admin only
- [ ] `POST /connectors/:token/ingest` — public inbound webhook endpoint; validates token; maps payload to events via provider-specific adapter

**Web — sidebar CONNECTORS section (already stubbed):**
- [ ] Wire `GET /timelines/:id/connectors` — list active connectors beneath the active timeline label; each row shows provider icon + display name
- [ ] "Add connector" → opens connector setup sheet: provider picker → config fields (varies by provider) → save → `POST /timelines/:id/connectors`
- [ ] Connector row: on hover show gear icon → opens config drawer; delete option with confirm
- [ ] Provider icon set: one small icon per supported provider (Asana, Aha, Sheets, Excel, generic Plug)

---

### API — Token Auth
- [ ] `POST /tokens` — create API token (returns value once)
- [ ] `GET /tokens` — list tokens for current user
- [ ] `DELETE /tokens/:id` — revoke token
- [ ] Middleware: accept Bearer token (JWT or API token) on all authenticated routes
- [ ] Enforce token scope on writes (read-only tokens blocked from mutations)

### API — Archive
- [ ] `POST /events/:id/archive` and `POST /events/:id/unarchive`
- [ ] `POST /timelines/:id/archive` and `POST /timelines/:id/unarchive`
- [ ] All list endpoints exclude archived records by default; `?archived=true` to include

### Team Configuration (API)
- [ ] `team_statuses` migration and repository
- [ ] Seed default statuses (Planned / In Progress / Done) on team creation
- [ ] `GET /teams/:id/statuses` — list statuses in order
- [ ] `POST /teams/:id/statuses` — create status
- [ ] `PATCH /statuses/:id` — rename, recolor, reorder
- [ ] `DELETE /statuses/:id` — requires `replacementStatusId` in body; migrates events
- [ ] `color` field on `team_members` — set by admin or member

### Timeline Views (Web)
- [ ] Calendar view component: weekly, daily, monthly grid layouts
- [ ] List view component: chronological event list
- [ ] Kanban view component: columns = statuses (ordered), cards = events, color = member color
- [ ] View switcher in timeline header

### Calendar Sync
- [ ] Google Calendar OAuth connect flow
- [ ] Outbound sync: push draba events to Google Calendar on create/update/delete
- [ ] Inbound sync: Google webhook handler → upsert event in draba
- [ ] Built-in CalDAV server (`internal/caldav/`)
- [ ] CalDAV connect flow (user provides URL + credentials)
- [ ] Outbound sync: push draba events to CalDAV on create/update/delete
- [ ] Team iCal feed endpoint: `GET /timelines/:ical_token/feed.ics` (public, sanitized — no notes)

### Data Portability
- [ ] `GET /timelines/:id/export.csv` and `GET /timelines/:id/export.xlsx`
- [ ] `POST /teams/:id/events/import` — CSV/Excel import with preview + validation
- [ ] Downloadable import template at `GET /import-template.csv` and `.xlsx`

### External Connectors (Inbound Webhooks)
- [ ] Create `team_inbound_webhooks` and `event_links` DB migrations
- [ ] Add `is_external` boolean column to `events` table
- [ ] `POST /teams/:id/webhooks` — generate an inbound webhook URL for a provider (e.g. Asana)
- [ ] `GET /teams/:id/webhooks` — list active inbound webhooks
- [ ] `POST /webhooks/:provider/:token` — generic inbound webhook handler to map payload to Draba events
- [ ] Web UI: Render `is_external` events as read-only (disable drag-and-drop handles)
- [ ] Web UI: Show external provider icon/link on the event detail card

### Polish
- [ ] Password reset flow (email required — pick SMTP or transactional email provider)
- [ ] Public timeline read-only view (no login)
- [ ] Timeline restricted-access enforcement

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
- List view (secondary to timeline)
- Recurring event UI (RRULE editing)

# Roadmap

This document organizes development into discrete phases with effort estimates and exit criteria — clear goalposts for testing and evaluation between sessions. For the granular task checklist, see [TASKS.md](TASKS.md).

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔄 | In Progress |
| ⬜ | Not Started |

## Phase Summary

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 0 | [Scaffold & Docs](#phase-0-scaffold--docs) | XS | ✅ |
| 1 | [Project Infrastructure](#phase-1-project-infrastructure) | S — 2–4 hrs | ✅ |
| 2 | [API Foundation — DB & Auth](#phase-2-api-foundation--db--auth) | L — 3–5 days | ✅ |
| 3 | [Core API — Events & Teams](#phase-3-core-api--events--teams) | M — 2–3 days | ✅ |
| 4 | [OpenAPI Spec & Type Generation](#phase-4-openapi-spec--type-generation) | S — 1 day | ✅ |
| 5 | [API — Real-Time (WebSocket)](#phase-5-api--real-time-websocket) | M — 2–3 days | ✅ |
| 6 | [API — Timelines](#phase-6-api--timelines) | S — ½–1 day | ✅ |
| 7 | [Web — Scaffold](#phase-7-web--scaffold) | M — 2–3 days | ✅ |
| 8.0 | [RBAC Refactor + First-Run Setup](#phase-80-rbac-refactor--first-run-setup) | M — 1–2 days | ✅ |
| 8.1 | [Web — Gantt Shell & Event Rendering](#phase-81-web--gantt-shell--event-rendering) | L — 3–5 days | ✅ |
| 8.1.1 | [Rename Timeline View → Gantt](#phase-811-rename-timeline-view--gantt) | XS — 1 hr | ✅ |
| 8.1.2 | [Gantt View Polish](#phase-812-gantt-view-polish) | M — 1–2 days | ✅ |
| 8.2 | [Web — Gantt Interactions](#phase-82-web--gantt-interactions) | L — 3–5 days | ✅ |
| 8.2.1 | [Gantt Bar Drag — Resize & Move](#phase-821-gantt-bar-drag--resize--move) | M — 1–2 days | ✅ |
| 8.3 | [Web — Real-Time WebSocket Sync](#phase-83-web--real-time-websocket-sync) | M — 1–2 days | ✅ |
| 8.4 | [Persistent View Settings](#phase-84-persistent-view-settings) | M — 2–3 days | ✅ |
| 8.5 | [Find (In-View)](#phase-85-find-in-view) | M — 1–2 days | ✅ |
| 9 | [API Token Auth & Archive](#phase-9-api-token-auth--archive) | M — 1–2 days | ⬜ |
| 10 | [Team Configuration](#phase-10-team-configuration) | M — 1–2 days | ⬜ |
| 11 | [Web — Calendar, List & Kanban Views](#phase-11-web--calendar-list--kanban-views) | L — 1 wk | ⬜ |
| 12 | [Calendar Sync — Google & CalDAV](#phase-12-calendar-sync--google--caldav) | XL — 1–2 wks | ⬜ |
| 13 | [Data Portability & Polish](#phase-13-data-portability--polish) | M — 3–5 days | ⬜ |
| 14 | [External Connectors (Webhooks)](#phase-14-external-connectors-webhooks) | M — 3–5 days | ⬜ |
| 15 | [Global Search](#phase-15-global-search) | M — 2–3 days | ⬜ |

**Parking Lot (v2):** MySQL/Postgres adapters, CLI, MCP server, mobile apps, Microsoft/Outlook sync, multi-tenant hosting, SSO, notifications.

---

## Phase Detail

### Phase 0 — Scaffold & Docs
**Status:** ✅ Done — 2026-04-27

Repo created. Requirements, architecture, conventions, and design docs written.

---

### Phase 1 — Project Infrastructure
**Status:** ✅ Done — 2026-04-29 | **Effort:** S (2–4 hrs)

**Scope:**
- Go module initialized at `packages/api/`
- React + TypeScript + Vite initialized at `packages/web/`
- `pnpm-workspace.yaml` wiring both packages
- `golangci-lint` config (`.golangci.yml`)
- GitHub Actions CI: lint + test on PR
- `docker-compose.yml` for local development

**Exit criteria — safe to pause when:**
- `go build ./...` completes without errors
- `pnpm build` (web) completes without errors
- CI pipeline is green on a test push
- `docker compose up` starts both services without errors

---

### Phase 2 — API Foundation — DB & Auth
**Status:** ✅ Done — 2026-04-30 | **Effort:** L (3–5 days)

**Scope:**
- DB abstraction layer with SQLite adapter (sqlc or sqlx)
- Migration runner (auto-runs on startup, idempotent)
- Initial schema: `users`, `teams`, `team_members`, `team_statuses`, `invites`, `api_tokens`, `events`, `event_tags`, `event_assignments`, `timelines`, `timeline_access`, `calendar_connections`
- JWT issue/validate, password hash/verify, invite token generate/validate
- Endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`

**Exit criteria — safe to pause when:**
- `POST /auth/register` (invite token required), `POST /auth/login`, and `POST /auth/refresh` all return correct responses
- JWT validates on a subsequent authenticated request
- All schema tables exist in the SQLite file
- Migration runner re-run produces no changes (idempotent)

---

### Phase 3 — Core API — Events & Teams
**Status:** ✅ Done — 2026-05-03 | **Effort:** M (2–3 days)

**Scope:**
- `POST /teams` — create team
- `POST /teams/:id/invites` — send invite
- `GET /teams/:id/members`
- `POST /teams/:id/events` — create event
- `GET /teams/:id/events` — list events (date range filter)
- `PATCH /events/:id` — update event
- `DELETE /events/:id` — delete event

**Exit criteria — safe to pause when:**
- Full invite flow works: create team → send invite → register via token → list members
- Events can be created, listed (filtered by date range), updated, and deleted via HTTP with a valid JWT
- All responses match the expected shape (verified manually or with a test script)

---

### Phase 4 — OpenAPI Spec & Type Generation
**Status:** ✅ Done — 2026-05-04 | **Effort:** S (1 day)

**Scope:**
- `packages/shared/openapi.yaml` covering all Phase 2–3 endpoints
- `openapi-typescript` codegen configured in `packages/shared/`
- Generated types importable from `packages/web/`

**Exit criteria — safe to pause when:**
- `pnpm generate` (or equivalent) completes with no errors
- All Phase 2–3 endpoints are represented in the spec
- A generated type (e.g., `Event`) can be imported in a web file without TypeScript errors

---

### Phase 5 — API — Real-Time (WebSocket)
**Status:** ✅ Done — 2026-05-14 | **Effort:** M (2–3 days)

**Scope:**
- WebSocket hub (`internal/ws/`)
- Team-scoped subscription model
- Broadcast on `events.*` internal bus events (create, update, delete)

**Exit criteria — safe to pause when:**
- Two browser clients subscribed to the same team both receive a broadcast delta within 500ms of an event mutation
- A client subscribed to team A does not receive events from team B
- 30-second heartbeat keeps idle connections alive without dropping

---

### Phase 6 — API — Timelines
**Status:** ✅ Done — 2026-05-15 | **Effort:** S (½–1 day)

**Scope:**
- `POST /teams/:id/timelines` — create timeline
- `GET /timelines/:id` — fetch timeline (auth-gated)
- `GET /timelines/share/:token` — public share link handler
- Timeline access list enforcement

**Exit criteria — safe to pause when:**
- Can create a timeline and retrieve it with a valid JWT
- Public share token returns the timeline without auth
- A user not on the access list is rejected with 403

---

### Phase 7 — Web — Scaffold
**Status:** ✅ Done — 2026-05-17 | **Effort:** M (2–3 days)

**Scope:**
- shadcn/ui initialized (`pnpm dlx shadcn@latest init`)
- Color tokens set in `src/index.css`
- Dark mode toggle (localStorage + `prefers-color-scheme`)
- Routing (React Router)
- Auth flow: login page, register-via-invite page, token storage
- API client: TanStack Query + fetch wrapper using generated types
- WebSocket client hook (`useWebSocket`)
- oapi-codegen wired for Go handler types (no drift between OpenAPI spec and Go)
- React build embedded in Go binary via `//go:embed`; single container, single port

**Exit criteria — safe to pause when:**
- `/login` renders and authenticates against the live API (served from the Go binary)
- Protected routes redirect unauthenticated users to `/login`
- A TanStack Query hook successfully fetches and displays team events
- WebSocket connects and emits events visible in browser DevTools Network tab
- `docker build --target prod` produces a single image; the login page loads at port 8080 with no second container

---

### Phase 8.0 — RBAC Refactor + First-Run Setup
**Status:** ✅ Done — 2026-05-18 | **Effort:** M (1–2 days)

Prerequisite work before the web timeline phases: tightened the auth model and added a first-run experience.

**Scope:**
- Migration 003: `team_members` PK, nullable `user_id` (login-less Participants), `team_member_id` FKs on `event_assignments` and `timeline_access`, `role` on `timeline_access`, `visibility` dropped from `timelines`
- First registered user auto-granted `is_superadmin`; team admins bypass timeline access checks; members require explicit grant
- `GET /setup/status` public endpoint; 3-step first-run setup wizard (Account → Team → Timeline)
- Production container runs as non-root user (uid 1000)

**Exit criteria:**
- Migration runs cleanly on a fresh DB; existing data preserved on upgrade
- First user through the wizard lands in the app as superadmin with a team and timeline
- Navigating to `/setup` after setup is complete redirects to `/login`
- `go test ./...` all pass; `golangci-lint run` clean

---

### Phase 8.1 — Web — Gantt Shell & Event Rendering
**Status:** ✅ Done — 2026-05-18 | **Effort:** L (3–5 days)

Static, data-driven Gantt chart. No drag interactions — layout, rendering, grouping, sorting, and zoom only.

**Design pivot (2026-05-18):** Switched from person-lane resource view to event-row Gantt layout based on first live preview. Person grouping is now one of several "Group by" options rather than the fixed row axis.

**Scope:**
- `GanttGrid` component: Gantt layout — one row per event, sticky label column (title + member avatars), horizontal time grid, horizontal scroll
- `GanttToolbar` component: zoom (granularity), group-by selector (None / Member / Parent event), sort-by selector (Start date / End date / Title), Export stub
- `GanttView` component: data container — fetches events + members, applies grouping + sorting, builds `GanttRow[]`, passes to `GanttGrid`
- Pixel ↔ date math (map date range to X offset/width); variable column width for zoom
- Wire to `GET /teams/:id/events?start=&end=` via TanStack Query
- Wire to `GET /teams/:id/members` for group labels and member avatars
- API additions: `GET /teams` (list user's teams), `GET /teams/:id/timelines` (list timelines for date bounds), `assignedMemberIds[]` on Event responses

**Exit criteria — safe to pause when:**
- Events render as bars in the correct date columns, with correct width
- Group by Member shows one section per assignee with correct events beneath
- Group by Parent shows children indented under their parent event
- Sort by Start date / End date / Title reorders rows within groups
- Zoom steps change column width and the grid scrolls correctly
- Gantt toolbar renders and all controls are functional

---

### Phase 8.1.1 — Rename Timeline View → Gantt
**Status:** ✅ Done — 2026-05-19 | **Effort:** XS (1 hr)

Renamed the Gantt view components to eliminate confusion between the "Timeline" data entity (date-bounded event container) and the view layer.

**Scope:**
- Renamed directory `components/timeline/` → `components/gantt/`
- Renamed `TimelineView` → `GanttView`, `TimelineGrid` → `GanttGrid`, `TimelineToolbar` → `GanttToolbar`
- Updated `ViewMode` type: `'timeline'` → `'gantt'`
- All data entity code (Sidebar, API, hooks) untouched

---

### Phase 8.1.2 — Gantt View Polish
**Status:** ✅ Done — 2026-05-19 | **Effort:** M (1–2 days)

Three polish items bundled together.

**Scope:**
- Reusable `EmptyState` component (`components/shared/EmptyState.tsx`) — draba icon, message, optional description; dark-mode aware via `currentColor`
- Fixed empty state centering — renders outside the scroll container so it stays centered on screen
- Zoom rethink — replaced pixel-width slider with time granularity dropdown (Auto / Day / Week / Month / Quarter / Year). Auto-fit picks the finest granularity that fills the viewport. New `granularity.ts` utility for column generation and fractional event positioning.

**Exit criteria — safe to pause when:**
- Empty state shows centered draba icon + "No viewable events" when no events exist
- Zoom dropdown changes time granularity; Auto picks an appropriate level based on timeline duration
- Event bars position correctly with fractional column math at all granularity levels

---

### Phase 8.2 — Web — Gantt Interactions
**Status:** ✅ Done — 2026-05-19 | **Effort:** L (3–5 days)

Builds on 8.1. Full CRUD interactions on the timeline.

**Scope:**
- Click event block → open `EventDetailPanel` (view mode)
- Edit button → inline editing form (title, description, date range, status, assignees)
- Save → `PATCH /events/:id`, optimistic update, close panel
- Delete → `DELETE /events/:id`, confirm dialog, remove from timeline
- Drag on empty lane cell → capture start/end date range → open `EventCreateForm` pre-filled with lane member + dates
- Submit form → `POST /teams/:id/events`, add block to timeline

**Exit criteria — safe to pause when:**
- Clicking an event block opens an edit panel; changes save and reflect immediately in the UI
- Dragging on an empty lane cell opens a creation form pre-filled with the selected range
- Created and edited events appear correctly in the timeline without page reload

---

### Phase 8.2.1 — Gantt Bar Drag — Resize & Move
**Status:** ✅ Done — 2026-05-19 | **Effort:** M (1–2 days)

Builds on 8.2. Direct manipulation of event bars on the Gantt chart.

**Scope:**
- **Edge drag (resize):** mousedown on the left or right 8px edge of an event bar → drag to change start or end date; show date tooltip during drag; PATCH on mouseup
- **Body drag (move):** mousedown on the bar body → drag horizontally to shift both start and end dates by the same delta; show date tooltip during drag; PATCH on mouseup
- Visual feedback: bar moves/resizes live during drag (optimistic); ghost/overlay at original position optional
- Snap to column boundaries (e.g. day, week) matching the active granularity
- `is_external` events (Phase 14) are non-draggable (read-only)

**Exit criteria — safe to pause when:**
- Dragging a bar edge changes the event's start or end date and saves on mouseup without a page reload
- Dragging a bar body shifts both dates by the same amount and saves on mouseup
- A date tooltip shows the new date(s) during drag
- Snap-to-column works at all granularity levels

---

### Phase 8.3 — Web — Real-Time WebSocket Sync
**Status:** ✅ Done — 2026-05-19 | **Effort:** M (1–2 days)

Builds on 8.2. Wire live WebSocket deltas into the timeline's state.

**Scope:**
- Connect `useWebSocket` hook (Phase 7) to subscribe to `events.*` messages for the active team
- On `events.created` delta: insert new event block into TanStack Query cache
- On `events.updated` delta: update existing block in cache (position + content)
- On `events.deleted` delta: remove block from cache
- Handle optimistic update conflicts (local edit in-flight when WS delta arrives for same event)

**Exit criteria — safe to pause when:**
- A second browser tab's Gantt view updates within 500ms when an event is mutated in the first tab
- No duplicate or ghost blocks after rapid create/edit/delete sequences

---

### Phase 8.4 — Persistent View Settings
**Status:** ✅ Done — 2026-05-20 | **Effort:** M (2–3 days)

Server-side user preferences so view settings survive login/logout and sync across devices.

**Scope:**
- New `user_preferences` table: `id`, `user_id`, `timeline_id` (nullable), `key`, `value` (JSON), `updated_at`; unique on `(user_id, timeline_id, key)`
- Global preferences (timeline_id NULL): theme, selected_team, selected_timeline
- Per-timeline preferences: filter preset, group_by, sort_by, zoom_granularity
- API: `GET /users/me/preferences?timeline_id=`, `PUT /users/me/preferences`
- Frontend: `usePreferences(timelineId?)` hook — reads/writes, caches via TanStack Query
- On timeline switch: fetch per-timeline prefs, apply to toolbar state
- On login: fetch global prefs, restore theme/team/timeline selection

**Exit criteria — safe to pause when:**
- Changing zoom/group/sort on a timeline, switching to another timeline, and switching back restores the original settings
- Dark mode and selected team persist across logout/login
- Settings sync between two browser tabs via API (not just localStorage)

---

### Phase 8.5 — Find (In-View)
**Status:** ✅ Done — 2026-05-20 | **Effort:** M (1–2 days)

Browser-style "find in page" for the active view. Scoped to events the current view has already loaded; respects active filters. **Global cross-team search is deferred to [Phase 15](#phase-15-global-search).**

**Design rationale:**
Two distinct tools, not one box. **Find** answers *"highlight what I'm looking at"* — fast, keyboard-driven, walks matches. Global **Search** (Phase 15) answers *"find an event when I don't know where it lives"* — palette-style, navigates across teams/timelines. Mixing them in one input is where these UIs get muddy. With Find + the upcoming List view (Phase 11), we expect ~95% of real-world lookup needs to be covered.

**Scope:**

*Trigger & layout:*
- Find bar opens on `Ctrl/Cmd+F` (and via a search icon in the TopBar between FilterDropdown and ProfileMenu)
- `Esc` closes; clear button (×) resets the query
- Bar shows: query input · match counter (`3 / 12`) · prev/next chevrons · close

*Match scope (client-side, against already-fetched events):*
- Event title, description, tag names, assignee display names, parent event title
- Case-insensitive, debounced (~150ms)
- Search respects active filters by default — the visible view defines the search world

*Visual treatment:*
- Matching events: amber outline / glow (uses existing design tokens)
- Non-matching events: dimmed to ~0.3 opacity
- **Active** match (the one prev/next is parked on): stronger outline + subtle pulse, so users can tell it apart from the other matches
- For non-title matches, a small badge or tooltip on hover surfaces *why it matched* (e.g. `matched tag #urgent`, `matched assignee Jane`) so highlights on otherwise-blank-looking cards aren't mysterious

*Navigation:*
- `Enter` / `Shift+Enter` (and the ◀ ▶ chevrons) walk forward/backward through matches
- On step, the Gantt auto-scrolls **both axes** to center the active match (horizontal pan to the event's date range, vertical scroll to its row)
- If the active match lives inside a collapsed group, the group expands automatically

*Empty-state behavior:*
- Zero matches, no filters active → bar shows `No matches`
- Zero matches **in view**, but filters are active → soft inline callout: *"No matches in current view. [Clear filters]"*. (We do **not** silently search outside the filters — that's Phase 15's job.)

*Persistence:*
- The query itself is **not** persisted across navigation or reloads — Find is ephemeral by design (matches browser Cmd+F muscle memory)
- Open/closed state of the bar is also ephemeral

**Out of scope (explicitly):**
- Cross-team or cross-timeline search → Phase 15
- Server-side full-text search → Phase 15
- Saved searches / recent queries → Phase 15
- Highlighting matches that aren't in the currently-loaded event set (no dynamic loading exists yet; revisit when/if windowed loading lands)

**Exit criteria — safe to pause when:**
- `Ctrl/Cmd+F` opens the Find bar; `Esc` closes it
- Typing dims non-matches and highlights matches across title, description, tags, assignees, and parent title
- Match counter shows `N / M` and updates as the query changes
- Prev/next (and `Enter` / `Shift+Enter`) cycle through matches, auto-scrolling the Gantt to center each one
- Active match is visually distinguishable from other matches
- Non-title matches surface a "why matched" hint on hover
- With filters active and zero in-view matches, the "Clear filters" callout appears
- Find works correctly at all granularity levels and with all group-by modes

---

### Phase 9 — API Token Auth & Archive
**Status:** ⬜ | **Effort:** M (1–2 days)

**Scope:**
- `POST /tokens`, `GET /tokens`, `DELETE /tokens/:id`
- Auth middleware accepts Bearer (JWT or API token) on all authenticated routes
- Read-only token scope enforcement (blocked from mutations)
- `POST /events/:id/archive`, `POST /events/:id/unarchive`
- `POST /timelines/:id/archive`, `POST /timelines/:id/unarchive`
- List endpoints exclude archived records by default; `?archived=true` to include

**Exit criteria — safe to pause when:**
- Can create an API token and use its value as a Bearer token on a GET request
- A read-only token is rejected (403) on a POST/PATCH/DELETE request
- Archiving an event removes it from the default event list; `?archived=true` restores it

---

### Phase 10 — Team Configuration
**Status:** ⬜ | **Effort:** M (1–2 days)

**Scope:**
- `team_statuses` migration and repository
- Seed default statuses (Planned / In Progress / Done) on team creation
- `GET /teams/:id/statuses`, `POST /teams/:id/statuses`
- `PATCH /statuses/:id` — rename, recolor, reorder
- `DELETE /statuses/:id` — requires `replacementStatusId`; migrates events
- `color` field on `team_members` (settable by admin or member)

**Exit criteria — safe to pause when:**
- A newly created team has exactly 3 seeded statuses
- Statuses can be renamed, recolored, and reordered via API
- Deleting a status without a replacement ID returns a validation error
- Deleting a status with a replacement migrates all associated events to the replacement
- A team member's color can be set and is returned in member list responses

---

### Phase 11 — Web — Calendar, List & Kanban Views
**Status:** ⬜ | **Effort:** L (1 wk)

**Scope:**
- Calendar view: weekly, daily, and monthly grid layouts
- List view: chronological event list
- Kanban view: columns = statuses (in order), cards = events, card color = member color
- View switcher in the top bar

**Exit criteria — safe to pause when:**
- View switcher cycles between Gantt, Calendar (3 sub-layouts), List, and Kanban without error
- All views show the same set of events (no data discrepancy)
- Kanban columns appear in the same order as team statuses; cards show the correct member color

---

### Phase 12 — Calendar Sync — Google & CalDAV
**Status:** ⬜ | **Effort:** XL (1–2 wks)

**Scope:**
- Google Calendar OAuth connect flow
- Outbound sync: push draba events to Google on create/update/delete
- Inbound sync: Google webhook handler → upsert event in draba
- Built-in CalDAV server (`internal/caldav/`)
- CalDAV connect flow (user provides URL + credentials)
- Outbound sync: push draba events to CalDAV on create/update/delete
- Team iCal feed: `GET /timelines/:ical_token/feed.ics` (public, no private notes)

**Exit criteria — safe to pause when:**
- Connecting Google Calendar and creating a draba event causes it to appear in Google Calendar within 30s
- Editing that event in Google Calendar updates the draba event within 30s (webhook round-trip)
- A CalDAV client (e.g., iOS Calendar) can subscribe to a user's feed and see their draba events
- The iCal feed URL is importable into a calendar app without errors

---

### Phase 13 — Data Portability & Polish
**Status:** ⬜ | **Effort:** M (3–5 days)

**Scope:**
- `GET /timelines/:id/export.csv` and `.xlsx`
- `POST /teams/:id/events/import` — CSV/Excel import with preview + validation step
- `GET /import-template.csv` and `.xlsx`
- Password reset flow (requires SMTP or transactional email provider)
- Public read-only timeline view (no login required)
- Timeline restricted-access enforcement

**Exit criteria — safe to pause when:**
- Exporting a timeline produces a valid CSV and Excel file with all events
- Importing that CSV back in shows a preview, validates rows, and creates events on confirm
- Password reset sends an email and allows setting a new password
- A public timeline share link is fully viewable without logging in

---

### Phase 14 — External Connectors (Webhooks)
**Status:** ⬜ | **Effort:** M (3–5 days)

**Scope:**
- Schema changes: `event_links`, `team_inbound_webhooks`, `is_external` flag on `events`
- `POST /teams/:id/webhooks` to generate inbound webhook URLs
- Generic JSON parsing for inbound webhook payload mapping (e.g. Asana, Aha)
- Disabling edit UI for `is_external` blocks in the timeline (read-only)

**Exit criteria — safe to pause when:**
- Generating a webhook creates a unique URL for the team
- Sending a dummy JSON payload to that URL creates an `is_external` event block mapped to a user
- Trying to drag or edit that block in the UI is prevented (read-only mode)

---

### Phase 15 — Global Search
**Status:** ⬜ | **Effort:** M (2–3 days, directional estimate)

Cross-team, cross-timeline event search via a command palette. Complements (does **not** replace) the in-view Find from [Phase 8.5](#phase-85-find-in-view).

**Why a separate phase:**
By the time we reach Phase 15 we'll have: Find (8.5), List view (11), real-time sync (8.3), and likely more events per team than fit in one fetch. Global Search needs server-side full-text and a different UX surface (a palette, not an inline bar), so it earns its own phase. With Find + List already shipped, this should feel like the natural "I genuinely don't know where this event is" escape hatch — used rarely but valued when needed.

**Directional scope (to be firmed up before the phase):**
- Command palette opened via `Ctrl/Cmd+K` (separate keybinding from Find's `Ctrl/Cmd+F`)
- Server-side search endpoint: `GET /search/events?q=` — scoped to teams/timelines the caller can access
- Full-text index over title, description, tags, assignee names (SQLite FTS5 for the default backend; equivalent for MySQL/Postgres adapters when those land)
- Results grouped by team → timeline, each row showing event title, date range, assignees, and a snippet of the matched field
- Selecting a result navigates to that timeline and **hands off to Find**, pre-seeding the query so the event is highlighted on arrival (reuses 8.5's scroll-to-match logic)
- Keyboard-first: arrow keys to move, Enter to navigate, Esc to close
- Recent searches / pinned searches — stretch goal, evaluate during the phase

**Open questions (resolve before starting):**
- Does Search surface archived events by default, or behind a toggle?
- Do we index event descriptions in v1, or just title/tags/assignees? (description indexing has size implications for SQLite FTS5)
- Permission model: do we filter results post-query or push the auth predicate into the FTS query?

**Exit criteria (placeholder — refine in-phase):**
- `Ctrl/Cmd+K` opens a palette returning results across every team the user belongs to
- Selecting a result navigates to the correct timeline and the event is visibly highlighted on arrival
- Users with no access to a team never see that team's events in results
- Search returns within ~200ms for a database with 10k events

---

## How to Use This Document

1. Work phases in order — each phase's exit criteria assume the previous phase is complete.
2. After finishing a phase, flip its status to ✅ and update the summary table.
3. Use the exit criteria as your acceptance checklist before calling a phase done.
4. For the granular task list within each phase, refer to [TASKS.md](TASKS.md).

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
| 9 | [API Token Auth & Archive](#phase-9-api-token-auth--archive) | M — 1–2 days | ✅ |
| 9.5 | [Rename Event → Activity (The Great Rename)](#phase-95--rename-event--activity-the-great-rename) | M — 1–2 days | ✅ |
| 9.6 | [Identity System (Color + Icon)](#phase-96--identity-system-color--icon) | M — 2–3 days | 🔄 |
| 10.1.1 | [Teams — CRUD & Management](#phase-1011--teams--crud--management) | M — 2 days | 🔄 |
| 10.1.2 | [Members — Management & Editing](#phase-1012--members--management--editing) | M — 2–3 days | 🔄 |
| 10.1.3 | [Settings — Profile, Tokens & Admin](#phase-1013--settings--profile-tokens--admin) | M — 2–3 days | 🔄 |
| 10.1.4 | [Member Access & Data Lifecycle](#phase-1014--member-access--data-lifecycle) | S–M — 1–2 days | 🔄 |
| 10.2 | [Status Templates & Timeline Statuses](#phase-102--status-templates--timeline-statuses) | M — 2–3 days | ✅ |
| 10.3 | [Timelines — Full CRUD (API + UI)](#phase-103--timelines--full-crud-api--ui) | M — 2–3 days | 🔄 |
| 10.4.1 | [Preference Consumption & Session Handling](#phase-1041--preference-consumption--session-handling) | S–M — 1–2 days | 🔄 |
| 10.4.2 | [Activity Schema Normalization — Drop team_id](#phase-1042--activity-schema-normalization--drop-team_id) | S — ½–1 day | ✅ |
| 10.4.3 | [UI Consistency — Modals, Sidebar & Toolbar](#phase-1043--ui-consistency--modals-sidebar--toolbar) | M — 1–2 days | ✅ |
| 10.4.4 | [Gantt Interaction & Activity Edit Polish](#phase-1044--gantt-interaction--activity-edit-polish) | M — 2–3 days | 🔄 |
| 10.4.5 | [Activity Tags, Parent & Progress Fields](#phase-1045--activity-tags-parent--progress-fields) | M — 2–3 days | ✅ |
| 10.4.6 | [Filter Implementation](#phase-1046--filter-implementation) | M–L — 3–4 days | 🔄 |
| 10.5 | [Communications Testing](#phase-105--communications-testing) | S — 1 day | ⬜ |
| 10.6 | [AI Key Management](#phase-106--ai-key-management) | M — 2–3 days | ⬜ |
| 10.7 | [Localization & Language Support](#phase-107--localization--language-support) | L — 3–5 days | ⬜ |
| 11.1 | [Web — List / Spreadsheet View](#phase-111--web--list--spreadsheet-view) | M — 2–3 days | ⬜ |
| 11.2 | [Web — Calendar View](#phase-112--web--calendar-view) | L — 3–5 days | ⬜ |
| 11.3 | [Web — Kanban View (Read-Only)](#phase-113--web--kanban-view-read-only) | S–M — 1–2 days | ⬜ |
| 12 | [Calendar Sync — Google & CalDAV](#phase-12-calendar-sync--google--caldav) | XL — 1–2 wks | ⬜ |
| 13 | [Shares — Multi-Share Views with Passwords](#phase-13-shares--multi-share-views-with-passwords) | M — 3–5 days | ⬜ |
| 14 | [Data Portability & Exports](#phase-14-data-portability--exports) | L — 1 wk | ⬜ |
| 15 | [External Connectors (Webhooks)](#phase-15-external-connectors-webhooks) | M — 3–5 days | ⬜ |
| 16 | [Global Search](#phase-16-global-search) | M — 2–3 days | ⬜ |
| 17 | [Backup & Restore](#phase-17--backup--restore) | M — 2–3 days | ⬜ |

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

### Phase 3 — Core API — Activities & Teams (originally Events; renamed in Phase 9.5)
**Status:** ✅ Done — 2026-05-03 | **Effort:** M (2–3 days)

**Scope:**
- `POST /teams` — create team
- `POST /teams/:id/invites` — send invite
- `GET /teams/:id/members`
- `POST /teams/:id/activities` — create activity (shipped as `/events`; renamed in Phase 9.5)
- `GET /teams/:id/activities` — list activities (date range filter)
- `PATCH /activities/:id` — update activity
- `DELETE /activities/:id` — delete activity

**Exit criteria — safe to pause when:**
- Full invite flow works: create team → send invite → register via token → list members
- Activities can be created, listed (filtered by date range), updated, and deleted via HTTP with a valid JWT
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
- Click activity block → open `ActivityDetailPanel` (view mode) *(shipped as `EventDetailPanel`; renamed in Phase 9.5)*
- Edit button → inline editing form (title, description, date range, status, assignees)
- Save → `PATCH /activities/:id`, optimistic update, close panel *(shipped as `PATCH /events/:id`; renamed in Phase 9.5)*
- Delete → `DELETE /activities/:id`, confirm dialog, remove from timeline *(shipped as `DELETE /events/:id`; renamed in Phase 9.5)*
- Drag on empty lane cell → capture start/end date range → open `ActivityCreatePanel` pre-filled with lane member + dates *(shipped as `EventCreateForm`; renamed in Phase 9.5)*
- Submit form → `POST /teams/:id/activities`, add block to timeline *(shipped as `POST /teams/:id/events`; renamed in Phase 9.5)*

**Exit criteria — safe to pause when:**
- Clicking an activity block opens an edit panel; changes save and reflect immediately in the UI
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
- On `activity.created` delta: insert new event block into TanStack Query cache
- On `activity.updated` delta: update existing block in cache (position + content)
- On `activity.deleted` delta: remove block from cache
- Handle optimistic update conflicts (local edit in-flight when WS delta arrives for same event)

**Exit criteria — safe to pause when:**
- A second browser tab's Gantt view updates within 500ms when an activity is mutated in the first tab
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
**Status:** ✅ Done — 2026-05-20 | **Effort:** M (1–2 days)

**Scope:**
- `POST /tokens`, `GET /tokens`, `DELETE /tokens/:id`
- Auth middleware accepts Bearer (JWT or API token) on all authenticated routes
- Read-only token scope enforcement (blocked from mutations)
- `POST /events/:id/archive`, `POST /events/:id/unarchive`
- `POST /timelines/:id/archive`, `POST /timelines/:id/unarchive`
- List endpoints exclude archived records by default; `?archived=true` to include

> **Note:** Phase 9 ships the API surface only. The token management **UI** (create / list / revoke from a settings page) lands in [Phase 10.1.3 — Settings](#phase-1013--settings--profile-tokens--admin). Until 10.1.3 ships, tokens are created via direct API calls or a temporary admin script.

**Exit criteria — safe to pause when:**
- Can create an API token and use its value as a Bearer token on a GET request
- A read-only token is rejected (403) on a POST/PATCH/DELETE request
- Archiving an event removes it from the default event list; `?archived=true` restores it

---

### Phase 9.5 — Rename Event → Activity (The Great Rename)
**Status:** ✅ Done — 2026-05-21 | **Effort:** M (1–2 days)

Rename the domain entity `Event` → `Activity` end-to-end (DB, Go API, OpenAPI, generated TS, web hooks/components, user-facing copy, docs). The pub/sub bus keeps its `internal/events` package name (correct event-driven-architecture term), but its message-type constants and wire strings move to `activity.*`. Calendar fields (`google_event_id`, `caldav_uid`) are preserved — they map to external VEVENT identifiers.

**Why now:** the name collides with internal pub/sub events and with calendar VEVENTs. Cost of disambiguation grows fast in Phase 12 (Calendar Sync) and Phase 15 (Webhooks). Cheapest to fix while pre-1.0, single LAN test instance, no external API consumers.

**Approach:** hard cutover. No `/events` aliases, no dual message types. Single migration via `ALTER TABLE RENAME`. See **[GreatEventToActivity.md](GreatEventToActivity.md)** for the full runbook (token map, per-layer checklist, verification, rollback).

**Scope (summary — see runbook for the full list):**
- DB: `events` → `activities`, `event_tags` → `activity_tags`, `event_assignments` → `activity_assignments`, `parent_event_id` → `parent_activity_id`. New migration `005_rename_events_to_activities.sql`. **Keep** `google_event_id` and `caldav_uid`.
- Go: `models.Event` → `Activity`; `EventRepo` → `ActivityRepo`; `event_handler.go` → `activity_handler.go`; all routes `/events*` → `/activities*`; bus constants `EventCreated/Updated/Deleted` → `ActivityCreated/Updated/Deleted` and wire strings `event.*` → `activity.*`. **Keep** `internal/events` package name and `TimelineCreated/Updated`.
- OpenAPI: `Event` schema → `Activity`; all operationIds, tags, paths. **Keep** `googleEventId`/`caldavUid` fields. Regenerate TS types.
- Web: `useTeamEvents` → `useTeamActivities`; `EventDetailPanel`/`EventCreatePanel`/`EventPanel` → `Activity*`; `DrabaEvent`/`EventStatus`/`EVENT_COLORS` → `Activity*`/`ACTIVITY_COLORS`; UI strings ("Add Event" → "Add Activity", sidebar "Events" → "Activities", etc.); WebSocket message switch updated.
- Tests, seed (`seed-find-test-events.sql` → `…-activities.sql`), and docs (ROADMAP/REQUIREMENTS/ARCHITECTURE/CONVENTIONS/TESTING/UX_PATTERNS) swept.

**Exit criteria — safe to pause when:**
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean
- Migration applies cleanly against a copy of the production DB; row counts unchanged; `PRAGMA foreign_key_check` returns no rows
- Smoke test on test docker passes: create / edit / archive / unarchive / delete an Activity; WebSocket frames arrive as `activity.created` (not `event.created`)
- `googleEventId` / `caldavUid` still present in OpenAPI `Activity` schema and in the `activities` table
- Final-sweep grep returns only the expected remaining matches (bus package, calendar fields, historical log)
- `docs/log.md` Phase 9.5 entry written

---

### Phase 9.6 — Identity System (Color + Icon)
**Status:** 🔄 In Progress — 2026-05-24, all automated checks pass; manual UI verification on Docker still needed | **Effort:** M (2–3 days)

Builds a reusable Identity component system — a color + icon pair that gives every major entity (activities, timelines, teams, members) a consistent visual fingerprint. Ships the component library, expands the color palette from 8 to 16, adds schema fields where missing, and swaps the new components into every existing UI surface that edits color or icon.

**Why now:** Phase 10.x builds full CRUD for teams, timelines, and members. Each will need an identity editor. Building the component system now means 10.x simply drops `<IdentityWidget>` into each form instead of inventing bespoke color/icon pickers per entity. The existing `ActivityDetailPanel` already has a color picker (8 squares) and an icon stub ("coming soon") — this phase replaces both with the real thing.

**Design reference:** [docs/design/IDENTITY_SYSTEM.md](design/IDENTITY_SYSTEM.md) — full spec, palette, component API. Prototype: `docs/design/assets/identity-widget-prototype.html`.

**Scope:**

*Schema (migration 006):*
- Add `icon TEXT` column to `team_members` (nullable)
- Add `color TEXT`, `icon TEXT` columns to `teams` (nullable)
- Add `color TEXT`, `icon TEXT` columns to `timelines` (nullable)
- Convert existing `activities.color` hex values → color IDs (e.g. `#288C9B` → `teal`)
- Convert existing `team_members.color` hex values → color IDs
- Activities already have both `icon` and `color` columns — no structural change needed

*API:*
- Update `models.go`: add `Icon` and `Color` fields to `Team` and `Timeline`; add `Icon` field to `TeamMember`
- Update OpenAPI spec: add `icon`/`color` to `Team` and `Timeline` schemas; add `icon` to `TeamMember` schema
- Existing PATCH endpoints already handle `color` and `icon` for activities — no new endpoints needed; Team/Timeline PATCH lands in Phase 10.x
- Regenerate TypeScript types

*Web — component library (`src/components/identity/`):*
- `identity-constants.ts` — 16-color palette, 64-icon list, name-text helpers, legacy hex→colorId mapping
- `Badge.tsx` — read-only identity display (replaces and supersedes `MemberAvatar`)
- `IdentityTrigger.tsx` — clickable badge with chevron pip
- `IdentityPicker.tsx` — popover panel: color grid + name options + icon grid
- `IdentityWidget.tsx` — composed trigger + popover with portal positioning

*Web — integration into existing surfaces:*
- `ActivityDetailPanel`: replace the 8-color swatch grid and icon stub with `<IdentityWidget>`; color changes now persist as color IDs
- `ActivityCreatePanel`: add optional `<IdentityWidget>` for setting identity at creation time
- Gantt bar label column: replace inline color dot with `<Badge>` (square, 20px)
- Sidebar timeline rows: replace inline colored squares with `<Badge>` (square, 22px)
- Sidebar member rows: replace inline colored circles with `<Badge>` (circle, 22px)
- `MemberAvatar`: refactor to delegate to `<Badge>` internally (preserves existing API, avoids a sweeping import change)
- Update `ACTIVITY_COLORS` and `MEMBER_COLORS` arrays → import from `identity-constants.ts`
- Update CSS custom properties `--member-N-*` → identity palette hex values

*Design system docs:*
- Update `DESIGN_SYSTEM.md`: replace 8-color member palette section with 16-color identity palette
- Add `IDENTITY_SYSTEM.md` as the canonical reference for the identity data model and component specs

**Exit criteria — safe to pause when:**
- `<Badge>` renders correctly in all four modes: Lucide icon, 1-letter, 2-letter, none — at sizes 20–40px, both shapes
- `<IdentityWidget>` opens a popover with 16 colors, 4 name options, and 64 icons; selecting any fires `onChange` immediately
- The `ActivityDetailPanel` uses `<IdentityWidget>` instead of the old color grid + icon stub; color persists as a color ID (e.g. `"violet"`, not `"#8B5CF6"`)
- Existing activities with legacy hex colors display correctly (hex→colorId mapping works)
- Sidebar member and timeline rows use `<Badge>` instead of inline styled divs
- Migration 006 applies cleanly: new columns added, existing hex values converted to color IDs
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean
- `docs/log.md` Phase 9.6 entry written

---

### Phase 10 — Entity Management (data-cornerstone CRUD)

**Framing:** Phase 10 closes the gaps in CRUD for the three core data entities — Teams, Timelines, Activities (renamed from Events in Phase 9.5) — plus the cross-cutting settings shell. Today the first-run wizard creates one of each and there is no path to manage them afterward. We tackle them entity-by-entity, top-down, so that by the time Phase 11 (views) ships, the data layer underneath is fully manageable. Activities are already CRUD-complete from Phases 3 / 8.2 / 8.2.1 (archive lands in Phase 9), so Phase 10 only needs to address Teams and Timelines.

Sub-phase dependency: 9.6 (Identity) → 10.1.1 (Teams) → 10.1.2 (Members) → 10.2 (Statuses) → 10.3 (Timelines) → 10.4 (Profile/Tokens/Admin). All entity forms use the `<IdentityWidget>` from 9.6 for color/icon editing. 10.1.2 depends on 10.1.1 because the Members tab lives inside the Team Modal and member API endpoints are team-scoped. 10.2 depends on 10.1.2 because the statuses tab sits alongside the Members tab in team settings. 10.3 doesn't strictly depend on 10.2 but is sequenced after for clean delivery.

**Design references:**
- Team Modal handoff: `docs/design/handoffs/team-modal/` — create + edit flows, Settings tab, Members tab, archive confirmation
- Member Edit Modal handoff: `docs/design/handoffs/member-modal/` — member profile editing, stats, admin actions

---

### Phase 10.1.1 — Teams — CRUD & Management
**Status:** 🔄 In Progress — 2026-05-25, all automated checks pass; manual UI verification on Docker still needed | **Effort:** M (2 days)

Closes the Teams data entity. Today a user can create one team via the first-run wizard and never manage it again. After this phase, teams are a fully manageable entity from both API and UI. Ships the Team Modal component with the Settings tab functional; the Members tab UI is scaffolded but locked until 10.1.2.

**Design rationale:**
Teams are the outermost data scope — everything else (timelines, activities, members, statuses, tokens, shares) hangs off a team. Without a way to rename, reconfigure, or add additional teams, the rest of the app is essentially read-only at the structural level. This phase focuses on the team entity itself; member management is split to [Phase 10.1.2](#phase-1012--members--management--editing) to keep each phase focused.

**Scope:**

*Schema (migration 008):*
- Add `description TEXT` column to `teams` (nullable)
- Add `notes TEXT` column to `teams` (nullable)
- Add `archived_at DATETIME` column to `teams` (nullable)

*API — team-level:*
- `GET /teams/:id` — full team detail (name, description, notes, icon, color, timezone, week start, member count, timeline count, archived_at)
- `PATCH /teams/:id` — update name, description, notes, icon, color (admin only)
- `POST /teams/:id/archive` and `POST /teams/:id/unarchive` (depends on Phase 9 archive pattern)
- Update `POST /teams` to accept `description`, `notes`, `icon`, `color` on creation
- `GET /teams` already exists — add `?archived=true` to include archived teams

*Web — Team Modal component (`<TeamModal>`):*
- Modal shell: header (identity badge + team name), tab bar (Settings / Members), scrollable content, footer
- Two modes: `new` (create) and `edit` (existing team)
- **Settings tab**: identity picker (square shape), name (required), description, notes fields
- **Members tab**: scaffolded as locked/disabled in this phase — tooltip "Save the team first" in new mode; placeholder content in edit mode until 10.1.2 ships
- Footer: Cancel, Save changes / Create team (primary button uses team color); Archive team button (edit mode only)
- "Saved" banner: shown briefly after new team creation, auto-dismisses after 3 seconds
- New-team flow: Settings tab only → Create team → banner → Members tab unlocks (but content is 10.1.2)
- Archive confirmation dialog: replaces modal content, amber styling, preserves all data

*Web — team picker + settings shell:*
- "New team" affordance in the team picker dropdown → opens Team Modal in `new` mode
- Existing team gear/edit icon → opens Team Modal in `edit` mode
- `/settings` route shell with left-nav layout (foundation for 10.1.2–10.4.2)
- Archived teams surfaced in team picker under a collapsed "Archived" section with unarchive affordance

*OpenAPI + types:*
- Update `Team` schema: add `description`, `notes`, `archivedAt` fields
- Update `CreateTeamInput` and `PatchTeamInput` bodies
- Regenerate TypeScript types

**Exit criteria — safe to pause when:**
- A user can create a second team from the team picker without going through the first-run wizard
- The Team Modal opens in both `new` and `edit` modes with correct behavior
- A team admin can edit name, description, notes, icon, and color via the Settings tab
- The Members tab is visible but locked/placeholder (ready for 10.1.2 to fill in)
- Archiving a team removes it from the active picker; unarchive restores it
- The "Saved" banner appears after creating a new team and auto-dismisses
- A non-admin member cannot access team edit actions (modal opens in read-only or is hidden)
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean

---

### Phase 10.1.2 — Members — Management & Editing
**Status:** 🔄 In Progress — 2026-05-25, all automated checks pass; manual UI verification on Docker still needed | **Effort:** M (2–3 days)

Fills in the Members tab of the Team Modal and adds the standalone Member Edit Modal. Covers the full member lifecycle: add, edit, role changes, inactivation, removal, participant management, and both email invites and reusable invite links.

**Design rationale:**
Member management is the most interaction-dense part of team administration. Splitting it from the team entity work (10.1.1) keeps each phase focused — 10.1.1 closes the "team as a data entity" gap, while 10.1.2 closes the "people within a team" gap. The Member Edit Modal introduces member-level stats and admin actions that require new API endpoints and computation.

**Terminology mapping:**
- **Participant** = login-less team member (team_members with `user_id = NULL`). The design handoffs use "stub" but we use "Participant" — it's the established codebase term (Phase 8.0) and more user-friendly. The UI displays "Participant" in role dropdowns and "No login" pills; the backend model is unchanged.
- "Inactivate" in the UI maps to the existing `archived_at` pattern on `team_members`. Archiving a member disables their access but preserves their data and activity assignments.
- "Super Admin" in the UI maps to the existing `users.is_superadmin` field.

**Scope:**

*Schema (migration 009):*
- Add `archived_at DATETIME` column to `team_members` (nullable) — supports member inactivation
- Add `archived_at DATETIME` column to `users` (nullable) — supports account-level inactivation by superadmin
- Add `invite_link_token TEXT` column to `teams` (nullable, unique) — reusable team invite link

*API — member CRUD:*
- `GET /teams/:id/members/:memberId` — full member detail including stats (timeline counts, activity counts by date status)
- `GET /teams/:id/members/:memberId/stats` — lightweight stat-only endpoint (same data as the stats object in the detail response)
- `POST /teams/:id/members` — add existing registered user by `userId` (admin only)
- `PATCH /teams/:id/members/:memberId` — update display name, color, icon, role (admin for role; member can set own display name/color/icon)
- `DELETE /teams/:id/members/:memberId` — remove member from team; reject if last admin
- `POST /teams/:id/members/:memberId/archive` — inactivate member (sets `archived_at`)
- `POST /teams/:id/members/:memberId/unarchive` — reactivate member (clears `archived_at`)

*API — participant CRUD:*
- `POST /teams/:id/participants` — create login-less participant (admin only); accepts name, icon, color, optional email (reference only)
- Participants are managed via the same `PATCH` and `DELETE` member endpoints (role is always `member`, `user_id` stays NULL)

*API — invites:*
- `GET /teams/:id/invites` — list pending invites (email, sent date, status)
- `DELETE /teams/:id/invites/:inviteId` — revoke/cancel a pending invite
- `POST /teams/:id/invites` already exists (Phase 3) — verified working
- `POST /teams/:id/invite-link` — generate or regenerate a reusable team invite link token
- `POST /teams/:id/invite-link/reset` — alias for regenerate (invalidates old token); stub for now, wired to email-sending sub-phase
- `GET /teams/:id/invite-link` — get the current invite link (or null if none)
- `DELETE /teams/:id/invite-link` — revoke the current invite link
- `POST /auth/register` — update to accept reusable invite link tokens (in addition to existing one-time invite tokens)

*API — member stats (computed, not stored):*
- Timeline counts: active timelines the member has access to, archived timelines
- Activity counts (date-relative, not status-relative):
  - **Past due**: end date passed, on an active timeline
  - **Running**: start date passed + end date in future, on an active timeline
  - **Upcoming**: start date not yet reached, on an active timeline
  - **Unscheduled**: no start or end date set, on an active timeline
  - **Archived**: on archived timelines (historical count)

*API — superadmin actions:*
- `POST /users/:id/promote` — set `is_superadmin = true` (superadmin only; not applicable to participants)
- `POST /users/:id/archive` — inactivate user account (superadmin only; sets `users.archived_at`)
- `POST /users/:id/unarchive` — reactivate user account (superadmin only)
- `DELETE /users/:id` — hard delete user (superadmin only; only when deletable — no active activities, single team)
- Auth middleware: reject login attempts from archived users with a clear error message

*Web — Team Modal Members tab:*
- Search/add input: search registered users by name/email, or type an email to send an invite
- Search results dropdown: user matches with "Add" button, email-only results with "Invite" button; already-added users shown muted
- Participant creation: inline expandable form with identity picker, name (required), optional email
- Member list: each row shows avatar (dashed border if participant), name, "No login" pill (participants), email, role dropdown, remove (×) button
- Role dropdown (`<RoleDropdown>`): three options — Admin (teal), Member (muted), Participant (amber) — with descriptions; role changes save immediately via PATCH
- Pending invitations section: invite rows with email, sent date, "Revoke" button (red)
- Invite link section: generated URL with copy button (transitions to "Copied!" for 2s), explanatory note; admins can regenerate or revoke

*Web — Member Edit Modal (`<MemberModal>`):*
- Opened from member list rows (in Team Modal or sidebar gear icon)
- Header: identity picker (40px circle, editable), subline (participant/team member + viewer role), name with role badges
- Scrollable content:
  - Name + email fields (email read-only for stubs)
  - Timeline stats chips (active, archived) with color-coded top borders
  - Activity stats chips (past due, running, upcoming, unscheduled, archived) — date-relative
  - Joined date + last active date (read-only)
  - Teams list showing all teams the member belongs to with role pills
  - Account section (non-participant only): password reset button — UI present but shows "SMTP not configured" until Phase 14
  - Super Admin actions section (superadmin viewer only): promote to super admin, inactivate/delete with confirmation dialogs
- Footer: Cancel + Save changes (in member's identity color)
- Role permission matrix: team admins can edit name/email/identity; superadmins additionally see promote/inactivate/delete
- Confirmation dialogs: promote (indigo), inactivate (amber), delete (red) — each with icon, title, body copy, cancel/confirm buttons
- Deletable rule: member can be deleted only when they have zero active activities and belong to a single team

*Web — sidebar integration:*
- Member rows in sidebar: gear icon on hover → opens Member Edit Modal
- Inactivated members: shown with reduced opacity and "Inactive" indicator; filterable

**Exit criteria — safe to pause when:**
- The Team Modal Members tab is fully functional: search/add users, send email invites, create participants, manage roles, revoke invites
- A team admin can add a registered user, invite a new email, create a participant, change a member's role, and remove a member
- The reusable invite link can be generated, copied, and used to register a new account
- The Member Edit Modal opens from member list rows and shows correct stats and fields
- A superadmin can promote a member to super admin, inactivate an account, and delete a deletable member — all with confirmation dialogs
- Inactivated members cannot log in; reactivation restores access
- A non-admin member sees member list in read-only form (no role changes, no add/remove)
- Removing the last admin from a team returns a validation error
- Password reset button is present but shows "SMTP not configured" state
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean

---

### Phase 10.1.3 — Settings — Profile, Tokens & Admin
**Status:** 🔄 In Progress — 2026-05-26, all automated checks pass; manual UI verification on Docker still needed | **Effort:** M (2–3 days)

Builds out the `/settings` page shell (already scaffolded in 10.1.1) into a working settings experience. Every user gets a profile page, identity management, preferences, and API token management; superadmins get SMTP configuration, instance defaults, and an orphaned-users view. Also ships the forgot-password flow, which depends on SMTP.

**Why now (before 10.1.4):** Users currently cannot change their own display name, password, or identity without API calls. Self-service profile editing and password management are table-stakes for any multi-user deployment. SMTP configuration unlocks email-based invite delivery and password reset — both of which become increasingly painful to lack as more users join. Shipping this before the data-lifecycle hardening in 10.1.4 means admins have full visibility into users and accounts before we tighten deletion semantics.

**What exists today:**
- Settings page shell with left-nav (`SettingsPage.tsx`) — links to Profile, Tokens, Teams, Admin; only Teams has content
- `GET /auth/me` returns the current user's profile
- No `PATCH /users/me` endpoint — display name and password cannot be changed from the UI
- `reset_password.go` CLI subcommand exists (hashes + updates by email) but no HTTP endpoint
- API token CRUD is fully implemented in the backend (`POST /tokens`, `GET /tokens`, `DELETE /tokens/:id`)
- No SMTP infrastructure — invites work via manual token copy, no emails sent
- `users` table has no color/icon fields; identity lives at the `team_members` level only
- `user_preferences` table and `GET/PUT /users/me/preferences` endpoints exist (shipped in Phase 8.4) — used for per-timeline view settings but no UI for account-level preferences

**Scope:**

*Schema (migration 010):*
- Add `color TEXT` and `icon TEXT` columns to `users` table — user-level identity, same value space as `team_members.color/icon`
- Add `instance_settings` table (`key` TEXT PK, `value` TEXT, `updated_at`) — stores SMTP config and instance-level defaults
- Add `password_reset_tokens` table (`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`)

*API — profile management:*
- `PATCH /users/me` — update `display_name`, `color`, `icon`; validates non-empty name, trims whitespace; when color or icon changes, propagates to all `team_members` rows for the user where the member's color/icon has not been explicitly overridden by a team admin (i.e. where `team_members.color/icon` currently matches the user's old value, or is NULL)
- `PUT /users/me/password` — change password; requires `currentPassword` + `newPassword`; verifies current hash before updating; returns 401 `WRONG_PASSWORD` on mismatch
- Email remains read-only for v1 (changing email would require verification flow)

*API — forgot password:*
- `POST /auth/forgot-password` — accepts `{ email }`; generates a time-limited reset token (1 hour), stores hash in `password_reset_tokens` table; sends reset link via SMTP if configured; always returns 200 (no email enumeration)
- `POST /auth/reset-password` — accepts `{ token, newPassword }`; validates token not expired, hashes new password, updates user, invalidates token; returns 200 or 400 `TOKEN_INVALID`/`TOKEN_EXPIRED`

*API — SMTP configuration (superadmin only):*
- `GET /admin/smtp` — returns current SMTP config (password masked); superadmin only
- `PUT /admin/smtp` — upsert SMTP config; validates by sending a test email to the calling user's address; returns success/failure with error details; superadmin only
- `POST /admin/smtp/test` — sends a test email without saving config; superadmin only
- `DELETE /admin/smtp` — clears SMTP config; superadmin only
- Internal `mailer` package: wraps `net/smtp`; reads config from `instance_settings` at send time (no restart needed); exposes `Send(to, subject, htmlBody)` and `IsConfigured() bool`
- When SMTP is not configured: `forgot-password` returns 200 but logs a warning; invite endpoints continue to return the token for manual copy

*API — orphaned users (superadmin only):*
- `GET /admin/users` — returns all users with their team membership counts and account status (active/archived); supports `?orphaned=true` filter (users with zero active team memberships); superadmin only
- This reuses the existing user model; no new tables needed

*API — instance settings (superadmin only):*
- `GET /admin/settings` — returns all instance-level settings (registration policy, default timezone, default date format, default week start); superadmin only
- `PATCH /admin/settings` — update one or more instance-level settings; superadmin only
- Settings stored in `instance_settings` table alongside SMTP config
- Instance defaults provide fallbacks for users who haven't set personal preferences

*Web — Profile (`/settings/profile`):*
- Display name field with save button; calls `PATCH /users/me`
- **Identity picker:** color + icon selector (reuses the existing `IdentityWidget` component from 9.6); changing identity here propagates to all team memberships
- Email shown read-only with explanatory note
- Success/error feedback inline (no toast system needed — keep it simple)

*Web — Security (`/settings/security`):*
- Change password form: current password + new password + confirm; calls `PUT /users/me/password`
- Validation: new + confirm must match; new ≥ 8 chars; save disabled until valid
- Success/error feedback inline

*Web — Preferences (`/settings/preferences`):*
- **Defaults:** default team (dropdown of user's teams), default timeline (filtered by selected team) — stored via existing `PUT /users/me/preferences`
- **Regional:** timezone (IANA selector), date format (`MMM D, YYYY` / `MM/DD/YYYY` / `DD/MM/YYYY` / `YYYY-MM-DD`), week starts on (Monday / Sunday)
- **Appearance:** theme toggle (Light / Dark / System) — already partially wired via localStorage; this phase persists it server-side
- All preferences use the existing `user_preferences` API; this phase adds the UI and stores the values but does **not** require the Gantt or other views to consume them yet (that lands in 10.4.1)

*Web — API Tokens (`/settings/tokens`):*
- Table: name, scope badge, last used (relative time), created date, revoke button
- Create dialog: name input + scope picker (read-only / add / edit-own / edit-all) with brief descriptions of each scope
- On creation: one-time secret reveal with copy-to-clipboard; warning that it won't be shown again
- Revoke: confirmation dialog, then `DELETE /tokens/:id`

*Web — Admin (`/settings/admin`, superadmin only):*
- **Instance defaults section:** default timezone, default date format, default week start — these serve as fallbacks for users who haven't set personal preferences; calls `PATCH /admin/settings`
- **Registration policy:** toggle between invite-only and open registration (stored in `instance_settings`)
- **SMTP section:** form with host, port, username, password, from address, from name, encryption dropdown (none/TLS/STARTTLS); "Test connection" button sends test email; "Save" validates then stores; info note: "When SMTP is not configured, password resets and email invitations are unavailable"
- **Users section:** table of all users (name, email, team count, status badge); orphaned alert banner with count + filter toggle; search by name/email; click row opens existing MemberModal; "Assign team" action on orphaned users

*Web — Forgot password flow:*
- `/forgot-password` public page: email input → calls `POST /auth/forgot-password` → shows "check your email" message (regardless of whether email exists)
- `/reset-password?token=...` public page: new password + confirm → calls `POST /auth/reset-password` → success redirects to login
- Login page: "Forgot password?" link
- When SMTP is not configured: forgot-password page shows "Password reset is not available — contact your administrator"

**Error-reduction notes:** Recent phases (10.1.1, 10.1.2) had significant bug fix rounds. To reduce errors in this phase:
- Each API endpoint gets at least one happy-path and one error-path test before moving to the next endpoint
- Frontend forms are tested against the real API (via dev proxy to Docker) before marking the section complete, not just type-checked
- SMTP send is tested with a real mail server (or a local test tool like MailHog) before marking SMTP complete
- The forgot-password flow is tested end-to-end (request → email received → click link → new password works) before exit

**Exit criteria — safe to pause when:**
- A user can change their display name and identity (color/icon) from `/settings/profile`; identity change propagates to all team memberships; visible in sidebar and member lists
- A user can change their password from `/settings/security`; the old password stops working and the new one works
- A user can set preferences (default team/timeline, timezone, date format, week start, theme) from `/settings/preferences`; values persist across logout (views don't need to consume them yet)
- Forgot-password: requesting a reset sends an email (when SMTP configured); clicking the link allows setting a new password; the token expires after 1 hour and after use
- Forgot-password without SMTP: the page shows a clear "contact admin" message instead of a broken form
- A user can create an API token, see the secret once, copy it, and use it to authenticate an API call; can revoke it and it stops working
- A superadmin can configure SMTP from the admin page; test email arrives; saving persists without restart
- A superadmin can set instance defaults (timezone, date format, week start); these are stored and retrievable
- A superadmin can view all users and filter to orphaned users; clicking a user opens their detail; "Assign team" works on orphaned users
- A superadmin can toggle registration policy; the setting takes effect immediately
- A non-superadmin does not see the Admin section
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean

---

### Phase 10.1.4 — Member Access & Data Lifecycle
**Status:** 🔄 In Progress — 2026-05-27, all automated checks pass; manual Docker verification still needed | **Effort:** S–M (1–2 days)

Closes the data-integrity and access-revocation gaps left open by 10.1.2. Defines explicit semantics for every lifecycle state a member can be in and ensures that activity data is never silently orphaned or destroyed.

**The problem 10.1.2 leaves open:**
- `DELETE /teams/:id/members/:memberId` attempts to hard-delete the `team_members` row. If the member has `activity_assignments`, SQLite FK behavior (RESTRICT, CASCADE, or no-op depending on pragma state) is undefined and may leave orphaned assignment rows or silently destroy assignment history.
- There is no UI affordance to distinguish *"this member can be fully removed"* from *"this member has history — inactivate instead."*
- The three access states (active → inactivated membership → deactivated account) are implemented but not clearly surfaced or documented in the UI.
- There is no single "revoke all access" operation for superadmins — today they would need to inactivate the user account and individually inactivate each team membership in separate steps across potentially many modals.

**Lifecycle states defined:**

| State | `users.archived_at` | `team_members.archived_at` | Can log in? | Data preserved? |
|-------|---------------------|-----------------------------|-------------|-----------------|
| Active member | NULL | NULL | ✅ | ✅ |
| Inactivated membership | NULL | set | ✅ (other teams) | ✅ |
| Deactivated account | set | any | ❌ | ✅ |
| Removed from team | — | row deleted | ✅ (other teams) | ✅ only if zero assignments |

Hard-delete of a `team_members` row is only ever permitted when the member has zero `activity_assignments`. All other cases must use inactivation (soft delete). This invariant protects historical activity data unconditionally.

**Scope:**

*Schema (migration 011):*
- Verify `activity_assignments.team_member_id` FK is declared with `ON DELETE RESTRICT`; add an explicit constraint migration if not
- Same for `timeline_access.team_member_id`
- Enable `PRAGMA foreign_keys = ON` in the DB initialization path (currently SQLite defaults to off) to enforce the constraint at runtime

*API — removal guard:*
- `DELETE /teams/:id/members/:memberId` — before deleting, count `activity_assignments` for the member; if count > 0, respond 409 `MEMBER_HAS_ASSIGNMENTS` with `{ assignmentCount: N }` in the error body; direct the caller to use archive/inactivate instead
- Hard-delete proceeds only when assignment count is 0 — no behavior change for clean removals

*API — full revoke (superadmin only):*
- `POST /users/:id/revoke` — new endpoint; atomically: (1) sets `users.archived_at` (blocks login everywhere), (2) sets `archived_at` on every `team_members` row for the user (inactivates all memberships), (3) hard-deletes any `team_members` rows where assignment count is 0 (cleans up zero-history memberships); returns `{ accountDeactivated: true, membershipsInactivated: N, membershipsRemoved: N }`
- Superadmin only; 403 if caller is not superadmin; 400 `CANNOT_SELF_REVOKE` if caller targets their own account
- Note: the original spec listed a 409 for participant targets. This is unreachable — participants have no `users` row so `/users/:id/revoke` returns 404 naturally; no separate guard is needed.

*Web — TeamModal Members tab:*
- Remove (×) button: on 409 `MEMBER_HAS_ASSIGNMENTS`, show an inline error beneath the member row: *"N assignment(s) found — [Inactivate instead]"* where the bracketed text is a direct action button that calls the archive endpoint
- On success, replace the error with confirmation and re-fetch the member list

*Web — MemberModal:*
- Add **"Revoke all access"** button to the Super Admin Actions section (red, below Inactivate); opens a confirmation dialog that lists the three effects (account deactivated, all memberships inactivated, zero-history memberships removed), shows the return summary once complete
- After confirmation, calls `POST /users/:id/revoke`, then closes the modal and invalidates relevant query cache
- Button is hidden if the user is already fully inactivated (`users.archived_at` set AND all `team_members.archived_at` set)

*Web — activity display:*
- Inactivated members: already shown at 50% opacity in sidebar and member list; no change needed
- Gantt bars and detail panels: assignee badge continues to render using the preserved `team_members` row data (name + color/icon); no display change — historical data reads accurately
- Removed members (zero-assignment clean removals): those `activity_assignments` rows don't exist, so no badge to render; this is already correct behavior

**Exit criteria — safe to pause when:**
- Attempting to remove a member with existing assignments returns 409 with assignment count; the TeamModal shows *"N assignment(s) — Inactivate instead"* with a one-click inactivate action
- Removing a member with zero assignments succeeds as before
- `POST /users/:id/revoke` atomically deactivates account + inactivates all memberships + cleans zero-assignment memberships; returns the summary breakdown
- MemberModal "Revoke all access" confirmation dialog shows the three effects and calls the endpoint on confirm
- `PRAGMA foreign_keys = ON` is in effect at startup; attempting a raw FK violation in a test is rejected
- Inactivated members' avatars still render correctly on existing Gantt bars (data preserved, no orphaned rows)
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean

---

### Phase 10.2 — Status Templates & Timeline Statuses
**Status:** ✅ Done — 2026-05-27 | **Effort:** M (2–3 days)

Statuses represent phases for an activity (e.g., Planned → In Progress → Done). They are **timeline-scoped** — each timeline has its own set. To reduce setup friction, teams maintain **status templates** (reusable presets). When a timeline is created, a template's items are copied into timeline-specific status rows; from that point the timeline's statuses are independent of the template. Activities default to null status (no auto-assignment). Required before Phase 11.3 (Kanban) so admins can configure columns.

**Data model:**

*`status_templates` (team-level reusable presets):*
- `id`, `team_id` (FK teams), `name`, `description`, `position`, `created_by` (FK users), `created_at`, `updated_at`

*`status_template_items` (statuses within a template):*
- `id`, `template_id` (FK status_templates CASCADE), `name`, `color`, `icon`, `is_closed` (boolean — closure flag for filtering), `position`

*`statuses` (live statuses on a timeline, copied from template):*
- `id`, `timeline_id` (FK timelines CASCADE), `name`, `color`, `icon`, `is_closed`, `position`, `created_at`, `updated_at`

*Migration:* `activities.status_id` FK moves from `team_statuses` → `statuses`; drop `team_statuses`.

**Scope:**

*API — templates (team-level):*
- Seed one default template ("Simple": Planned / In Progress / Done; Done is `is_closed`) on team creation
- `GET /teams/:id/status-templates` — list templates with items
- `POST /teams/:id/status-templates` — create template
- `PATCH /status-templates/:id` — rename, reorder
- `DELETE /status-templates/:id` — blocked if last template on team
- `POST /status-templates/:id/items` — add item
- `PATCH /status-template-items/:id` — rename, recolor, reicon, toggle is_closed, reorder
- `DELETE /status-template-items/:id` — blocked if last item in template

*API — timeline statuses:*
- On timeline creation, copy items from chosen template (or team's first template) into `statuses`
- `GET /timelines/:id/statuses` — list statuses for a timeline

*Web — Team Modal → "Status Templates" tab:*
- List templates with expand/collapse to show items
- Create template, rename, delete (with guard)
- Within a template: add/remove/reorder items, inline edit name + identity (color/icon) + is_closed toggle
- Drag-to-reorder items

**Exit criteria — safe to pause when:**
- New team gets one "Simple" template with 3 statuses (last marked closed)
- Templates can be created, edited, reordered, deleted from team modal
- Creating a timeline copies the selected template's statuses into `statuses` table
- `GET /timelines/:id/statuses` returns the copied statuses
- `is_closed` flag stored and returned in API responses

---

### Phase 10.3 — Timelines — Full CRUD (API + UI)
**Status:** 🔄 In Progress — 2026-05-27, all automated checks pass; manual UI verification on Docker still needed | **Effort:** M (2–3 days)

Closes the Timelines cornerstone. Same problem space as 10.1: today timelines can be created in the wizard and never managed afterward, and access lists exist in the schema (Phase 8.0) with no CRUD endpoints. Also wires the status system from 10.2 into the timeline and activity UIs.

**Scope:**

*API — timeline-level:*
- `PATCH /timelines/:id` — rename, change start/end date, change description (admin only)
- `POST /timelines/:id/archive` and `POST /timelines/:id/unarchive` (depends on Phase 9)
- `DELETE /timelines/:id` — hard delete; admin only; confirms via second action

*API — timeline statuses (editing):*
- `POST /timelines/:id/statuses` — add a status
- `PATCH /statuses/:id` — rename, recolor, reicon, toggle is_closed, reorder
- `DELETE /statuses/:id` — requires `replacementStatusId` if activities reference it; blocked if last status

*API — access-list:*
- `GET /timelines/:id/access` — list current grants (team member + role)
- `PUT /timelines/:id/access/:memberId` — grant or update role (admin / member)
- `DELETE /timelines/:id/access/:memberId` — revoke grant

*Web — timeline CRUD:*
- "New timeline" affordance in the sidebar → create-timeline modal (name, date range, **template picker** with status preview)
- Edit-timeline modal reachable from each timeline in the sidebar: rename, change date range, archive, delete
- Access-list management UI: search-pick team members, role toggle, remove
- Sidebar shows archived timelines under a collapsed "Archived" group; unarchive from there

*Web — status uplifts (wiring 10.2 into the UI):*
- **Timeline status management:** within edit-timeline modal, a "Statuses" tab where admins can add, rename, reorder, delete statuses; delete-with-replacement dialog shows affected activity count; identity (color/icon) and is_closed toggle inline
- **Activity detail status picker:** `ActivityDetailPanel` gets a status dropdown populated from `GET /timelines/:id/statuses`; shows identity (color dot + icon) next to each option; null = "No status"
- **"Hide closed" filter toggle:** in the Gantt toolbar filter area, hides activities whose status has `is_closed = true`

*Deferred:*
- "Re-apply template" (replace timeline statuses from a template with merge semantics) — future effort
- Gantt bar status indicator (small color dot/icon on bars) — polish pass

**Exit criteria — safe to pause when:**
- A user can create a second timeline without going through the first-run wizard
- Timeline creation modal shows template picker; selected template's statuses are previewed and copied
- A timeline admin can rename a timeline and change its date range; activities outside the new range are not deleted, just hidden from default views
- Timeline status management: add, rename, reorder, delete (with replacement) all work from the UI
- Activity detail panel shows status dropdown; selected status persists across reload
- "Hide closed" toggle hides activities with a closed status; removing the filter restores them
- Archiving a timeline removes it from the active sidebar; unarchive restores it
- The access-list UI lets an admin grant / revoke access for any team member; a non-admin attempting these actions is rejected
- A team member without an access grant cannot open the timeline (existing 8.0 enforcement) — verified end-to-end through the new UI

---

### Phase 10.4.1 — Preference Consumption & Session Handling
**Status:** 🔄 In Progress — 2026-05-28, all automated checks pass; manual Docker verification still needed | **Effort:** S–M (1–2 days)

Wires the user and instance preferences stored in 10.1.3 into the rest of the system, fixes the broken session lifecycle, and adds cosmetic branding for admins.

**Why now:** User preferences for date format, week start, and theme are stored (Phase 10.1.3) but not consumed by any view. The Gantt hardcodes Monday week-start and `en-US` date formatting. Additionally, access tokens expire after 15 minutes with no refresh interceptor — after 15 minutes of use, every API call silently fails.

**Scope:**

*Session lifecycle (token refresh):*
- Add a 401 interceptor to `apiFetch` in `packages/web/src/lib/api.ts`: on 401, attempt silent refresh using stored refresh token, retry the original request with the new access token; if refresh also fails (expired/revoked), clear tokens and redirect to `/login`
- Use a mutex/queue so concurrent 401s don't fire multiple refresh calls
- Completely invisible to the user — no toast, no banner (standard SPA pattern)
- Best practice: short-lived access token (15 min — already correct) + silent refresh on 401 + hard redirect when refresh fails

*Preference consumption (system-wide):*
- **Date format:** Create a `useFormatDate()` hook that reads user's `date_format` preference and returns a formatter; wire into `granularity.ts` `formatLabel()` (currently hardcoded to `en-US`), `ActivityDetailPanel` date displays, and any other date-displaying surface
- **Week start:** Pass user's `week_start` preference into `granularity.ts` `startOfWeek()` (currently hardcodes Monday); Gantt column alignment shifts to match the user's chosen start day
- **Timezone:** Stored and displayed; actual date math conversion deferred (complex, low urgency for self-hosted single-timezone teams)
- **Theme sync:** On login, read server-side theme preference and apply it; `useDarkMode.ts` currently ignores the server value and only reads localStorage
- **Instance defaults fallback:** For public/shared timeline views (no logged-in user), read instance-level defaults from `GET /admin/settings`

*Admin — branding (`/settings/admin`, superadmin only — extends 10.1.3):*
- Instance name field (stored in `instance_settings`); shown in browser tab title and login page
- Accent color override (stored in `instance_settings`); applies globally via CSS custom property
- Optional logo upload (stretch)

**Exit criteria — safe to pause when:**
- After 15+ minutes of use, API calls silently refresh the access token; if the refresh token is also expired, the user is redirected to `/login` cleanly
- Gantt view renders dates using the user's chosen date format; public views use instance defaults
- Week-start preference shifts the Gantt grid column alignment (e.g., Sunday start when configured)
- Theme persists across devices — logging in on a new browser picks up the server-side theme
- A superadmin can set a custom instance name; it appears in the browser tab title and on the login page
- A superadmin can set an accent color override; the change applies globally
- Settings persist across container restarts

---

### Phase 10.4.2 — Activity Schema Normalization — Drop team_id
**Status:** ✅ Done — 2026-05-28 | **Effort:** S (½–1 day)

Removes `activities.team_id` now that `timeline_id` is stored and the relationship `activity → timeline → team` is sufficient. `team_id` is a transitive dependency (`activity_id → timeline_id → team_id`) — a violation of 3NF that creates two sources of truth for the same fact. If timelines are ever moved between teams, every activity row would also need updating or the data silently lies.

**Why now:** Phase 10.4.1 added `timeline_id`. The redundant column is cheapest to remove before more code accumulates that reads `activity.TeamID` directly. The auth checks and WebSocket routing that currently use `activity.TeamID` are straightforward to reroute through the timeline.

**Prerequisite:** `activities.timeline_id` is currently nullable (migration 014 used `ON DELETE SET NULL` for backward compatibility). This phase hardens it to `NOT NULL`.

**Scope:**

*Schema (migration 015 — table rebuild):*
- Backfill: `UPDATE activities SET timeline_id = (SELECT id FROM timelines WHERE team_id = activities.team_id ORDER BY created_at LIMIT 1) WHERE timeline_id IS NULL` — assigns any orphaned activities to the team's oldest timeline; log a warning if any activities remain NULL after backfill (manual remediation required)
- Rebuild `activities` table without `team_id`, with `timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE`; use the SQLite table-rebuild pattern (CREATE new → INSERT → DROP old → RENAME) to enforce the NOT NULL constraint cleanly and add the cascade
- Recreate `idx_activities_timeline_id` on the new table

*API — Go:*
- `models.Activity`: remove `TeamID` field; change `TimelineID` from `*string` to `string`
- `ActivityRepo.Create`: remove `team_id` from INSERT
- `ActivityRepo.ListByTeam`: rename to `ListByTimeline(timelineID string, ...)` — query becomes `WHERE timeline_id = ?` directly; remove the `timelineID *string` optional filter added in 10.4.1 since it is now the only filter
- `handleUpdateActivity`, `handleDeleteActivity`, `handleArchiveActivity`/`handleUnarchiveActivity`: replace `activity.TeamID` usage with a timeline lookup — call `s.timelines.GetByID(activity.TimelineID)` to retrieve `timeline.TeamID` for the membership check
- WebSocket broadcasts: derive `TeamID` from the same timeline lookup before `s.bus.Publish`
- Move activity routes to timeline scope: `POST /teams/{id}/activities` → `POST /timelines/{id}/activities`; `GET /teams/{id}/activities` → `GET /timelines/{id}/activities` (no `?timelineId=` param — it is now the path param); remove the old team-scoped routes
- `handleCreateActivity`: path param is now `timelineId`; look up the timeline to get `teamID` for the membership check; `timelineId` is no longer in the request body
- `handleListActivities`: path param is now `timelineId`; no query param needed
- Add `/timelines` prefix to the Go mux and Vite proxy (activities already sit under `/timelines/*` for status routes — this is consistent)

*Frontend:*
- `Activity` generated type: `teamId` field removed; `timelineId` becomes `string` (non-optional)
- Rename `useTeamActivities(teamId, from, to, timelineId)` → `useTimelineActivities(timelineId, from, to)` — URL becomes `/timelines/{id}/activities`
- Rename `useCreateActivity(teamId)` → `useCreateActivity(timelineId)` — URL becomes `/timelines/{id}/activities`; remove `timelineId` from request body since it is in the URL
- Update cache keys: `keys.teamActivities` → `keys.timelineActivities(timelineId, from, to)`; WS cache updates match on `['timelines', timelineId, 'activities']`
- `GanttView`: prop changes from `teamId + timelineId` to just `timelineId` for the activities query (still receives `teamId` for the members query)
- `ActivityCreatePanel`: `teamId` prop removed (only `timelineId` needed); `useCreateActivity` called with `timelineId`
- `DashboardPage`: pass `activeTimelineId` to `ActivityCreatePanel` (already done); update `GanttView` activities hook call; keep `teamId` only for the members query
- Update OpenAPI spec: move activity endpoints under `/timelines/{timelineId}/activities`; regenerate TS types

*Tests:*
- Update `TestCreateActivity_*`, `TestListActivities_*`, `TestUpdateActivity_*` handler tests: seed a timeline, use `/timelines/{timelineId}/activities` path, remove `teamId` from activity body
- Update `TestActivityRepo_*` db tests: `makeActivity` helper no longer sets `TeamID`; all `ListByTeam` calls become `ListByTimeline`
- Add `TestActivityRepo_ListByTimeline_Filter` to verify timeline scoping works correctly

**Exit criteria — safe to pause when:**
- `activities` table has no `team_id` column; `timeline_id` is `NOT NULL`
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean
- Gantt view still loads activities for the active timeline
- Creating an activity from the panel associates it with the correct timeline; creating on a different timeline does not bleed into the wrong Gantt view
- `PRAGMA foreign_key_check` returns no rows after migration runs against a copy of the test DB
- No remaining references to `activity.TeamID` / `activity["teamId"]` in Go or TS source (grep confirms)

---

### Phase 10.4.3 — UI Consistency — Modals, Sidebar & Toolbar
**Status:** ✅ Done — 2026-05-28 | **Effort:** M (1–2 days)

Standardizes visual patterns across the three main modals (Team, Member, Timeline), the sidebar, and the Gantt toolbar. Today these surfaces use three different inline-editing patterns, three different archive button styles, three different confirmation dialog implementations, and a mix of hardcoded hex colors vs CSS variables.

**Why now:** Every new modal or surface built from here forward will inherit whatever pattern exists. Standardizing now prevents compounding inconsistency as the UI grows through Phase 11 (views) and beyond.

**Scope:**

*Inline name editing (3 patterns → 1):*
- Current: `MemberModal` uses always-input with focus underline; `TeamModal` toggles between div and input via a state machine; `TimelineModal` uses always-input with no visual cue
- Standardize to: always-input with subtle bottom border on hover/focus (refined MemberModal pattern); extract to a shared `InlineEditableTitle` component used by all three modals

*Archive/restore buttons (3 styles → 1):*
- Current: `MemberModal` uses amber background + border + icon (most prominent); `TeamModal` uses neutral gray that looks disabled; `TimelineModal` uses amber border-only with no icon
- Standardize to: consistent amber styling with Archive icon for archive, teal for restore; extract shared button style constants or a small `ArchiveButton` / `RestoreButton` component

*Confirmation dialogs (3 implementations → 1):*
- Current: `MemberModal` uses a custom `ConfirmDialog`; `TeamModal` uses `ArchiveDialog`; `TimelineModal` uses inline confirmation panels
- Standardize to: single `ConfirmDialog` component with color variants (red = destructive, amber = archive, indigo = promote, teal = restore)

*Color system (mixed → CSS variables):*
- Current: `TeamModal` and `MemberModal` hardcode hex colors (`#21262d`, `#30363d`, etc.); `TimelineModal` uses CSS variables (`var(--card)`, `var(--border)`)
- Standardize to: CSS variables everywhere; migrate all hardcoded hex values in modal components

*Sidebar & toolbar audit:*
- Sidebar member/timeline rows: verify Badge usage, hover states, and gear icon consistency across all row types
- Gantt toolbar controls: verify button styling consistency with the new modal patterns
- Fix any inconsistencies found

**Exit criteria — safe to pause when:**
- All three modals use the same `InlineEditableTitle` component for name editing — identical visual behavior
- Archive and restore buttons look identical across all three modals (amber archive, teal restore, both with icons)
- All confirmation dialogs use the same `ConfirmDialog` component with appropriate color variants
- No hardcoded hex colors remain in modal components; all use CSS variables or design-token references
- Sidebar member rows and timeline rows have consistent hover states and gear icon placement
- Gantt toolbar buttons are visually consistent with modal footer button patterns

---

### Phase 10.4.4 — Gantt Interaction & Activity Edit Polish
**Status:** 🔄 In Progress — 2026-05-29, all automated checks pass; manual UI verification on Docker still needed | **Effort:** M (2–3 days)

Refines the Gantt chart's direct-manipulation UX and overhauls the Activity Edit sidebar to match the Activity Create sidebar's layout, adds missing fields, and removes unnecessary UI elements.

**Why now:** The Gantt bar interactions have rough edges (accidental drags, coarse snap, no live feedback to sidebar) and the edit sidebar diverges from the create sidebar in layout and style. Polishing these before Phase 11 (new views) ensures the core interaction patterns are solid before they're replicated.

**Scope:**

*Gantt — resizable activity column:*
- The label column (`LABEL_COL_W = 240`) becomes user-resizable via a drag handle on its right edge
- Min: 140px, Max: 400px; header and all rows use the same live width
- Optionally persist width as a per-timeline user preference

*Gantt — click-to-activate before drag:*
- First click on a bar **selects** it (existing behavior); only a **selected** bar shows grab/ew-resize cursors and allows drag/resize
- Unselected bars show `cursor: pointer` — prevents accidental date changes when users just want to inspect an activity

*Gantt — bar drag updates sidebar dates live:*
- When dragging or resizing a bar, the `ActivityDetailPanel` start/end date inputs update in real-time to reflect the current snapped dates
- On mouseup, the PATCH fires as today and the panel re-syncs from the API response

*Gantt — finer-grained snap during drag:*
- Snap one level finer than the active granularity (except day, which stays day):
  - Day → day (no finer unit)
  - Week → snap to day
  - Month → snap to week
  - Quarter → snap to month
  - Year → snap to quarter
- The drag tooltip already shows exact dates; this is primarily a math change in the mousemove handler

*Gantt — "Hide closed" moves to filter preset:*
- Remove the `hideClosed` checkbox from `GanttToolbar`
- Add an `'open'` preset to the `FilterDropdown` presets list — "Open only" with description "Hide activities with a closed status"
- Wire the `'open'` filter into `GanttView`'s `visibleActivities` memo where `hideClosed` currently lives

*Activity Edit Sidebar — layout and field changes:*
- **Remove** "All day" checkbox — all activities are implicitly all-day; remove state and toggle
- **Simplify dates** — remove the human-readable date summary line; keep only the two date picker inputs
- **Move description** — from bottom ("Notes" section) to directly below the date pickers, matching create panel order
- **Assigned to** — restyle to match the create panel's bordered-card style (colored border + tint when selected) instead of opacity-based toggle buttons
- **Status dropdown** — replace plain `<select>` with a custom dropdown showing each status's color dot, icon, and name, ordered by position
- **Remove "Identity" line** — from Classify section (the identity widget in the header is self-evident)
- **Rename "Details" → "Advanced"**
- **Add Notes field** — multi-line `<textarea>` at the bottom (above footer/delete); requires adding `notes TEXT` column to activities table (migration 016), OpenAPI schema update, and TS type regeneration

*Schema (migration 016):*
- Add `notes TEXT` column to `activities` (nullable)

*Final edit panel field order (top to bottom):*
1. Header — Identity widget + Title
2. When — Date pickers (start → end)
3. Description — single-line input
4. Assigned to — bordered card style
5. Classify — Status (rich dropdown), Tags (stub)
6. Advanced — Parent (stub), Progress (stub), Location, URL
7. Notes — multi-line textarea
8. Footer — Delete button

**Exit criteria — safe to pause when:**
- Activity column is resizable by dragging the right edge; width persists during session
- Bar requires a selection click before drag/resize cursors appear; unselected bars show pointer cursor
- Dragging a bar updates the sidebar date pickers in real-time
- Drag snaps at one level finer than the zoom granularity (week→day, month→week, etc.)
- "Hide closed" checkbox removed from toolbar; "Open only" preset appears in filter dropdown and hides closed-status activities
- All-day checkbox removed from edit sidebar; date section shows only the pickers
- Edit sidebar field order matches the spec (description under dates, notes at bottom)
- Assigned-to section styled like the create panel (bordered cards with color tint)
- Status dropdown shows color dot + icon + name per option
- "Identity" line removed from Classify; "Details" section renamed to "Advanced"
- Notes field (multi-line) added at bottom; backed by new `notes` column on activities
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean

---

### Phase 10.4.5 — Activity Tags, Parent & Progress Fields
**Status:** ✅ Done — 2026-05-30 | **Effort:** M (2–3 days)

Replaces the three "coming soon" stubs in the activity edit panel with fully functional fields: **tags** (team-scoped, normalized), **parent activity** (searchable picker), and **progress** (editable slider). Tags require a new schema and full API; parent and progress already have backend support but need frontend controls.

**Why now:** These fields are prerequisites for Phase 10.4.6 (Filters) — the filter builder needs tags to exist as a filterable dimension, and progress/parent filters need editable values to be meaningful. Shipping stubs into the filter UI would create dead controls.

**Design decisions:**
- **Tags are normalized.** A team-scoped `tags` table (id, team_id, name, color) + a junction table (`activity_tags` referencing tag IDs) replaces the original simple (activity_id, tag_text) design. This enables colored tag pills, rename-all-at-once, autocomplete from existing tags, and name-based filter matching across timelines.
- **The original `activity_tags` table** (migration 001, renamed in 005) has **never been wired to any Go code or API** — no repo methods, no handlers, not in OpenAPI. It is safe to DROP and recreate with the new schema. No data migration needed.

**Detailed plan:** [docs/plans/phase-10.4.5.md](plans/phase-10.4.5.md)

**Scope summary:**

*Schema (migration 017):*
- New `tags` table: `id TEXT PK`, `team_id TEXT FK`, `name TEXT NOT NULL`, `color TEXT`, `created_by TEXT FK`, `created_at DATETIME`; unique on `(team_id, name)`
- Rebuild `activity_tags`: drop old (activity_id, tag text) table, create new (activity_id FK, tag_id FK) with cascade deletes

*API — tag CRUD:*
- `GET /teams/{id}/tags` — list team tags (any member)
- `POST /teams/{id}/tags` — create tag (any member; sets `created_by` from JWT)
- `PATCH /tags/{id}` — update name/color (any member)
- `DELETE /tags/{id}` — delete tag (any member; cascades from activity_tags)

*API — activity tag wiring:*
- `Activity` model gains `TagIDs []string` field (same `db:"-"` pattern as `AssignedMemberIDs`)
- `ActivityRepo` gains `SetTags` / `GetTags` methods (same transaction pattern as `SetAssignments` / `GetAssignments`)
- `ListByTimeline` batch-populates `TagIDs` on returned activities (same JOIN pattern as `AssignedMemberIDs`)
- Activity create/update handlers accept `tagIds`; activity list responses include `tagIds`

*Web — tags:*
- `useTags.ts` hook — CRUD following `useSavedFilters.ts` pattern
- `TagInput.tsx` component — combobox with colored pills, autocomplete from team tags, "Create tag" option for on-the-fly creation
- Replaces stub in `ActivityDetailPanel` and added to `ActivityCreatePanel`

*Web — parent picker:*
- Backend already handles `parentActivityId` in create/update — no API changes needed
- Replace stub in `ActivityDetailPanel` with searchable combobox of activities in same timeline
- Exclude self and descendants to prevent cycles
- Save on select; null to clear

*Web — progress:*
- Backend already handles `percentComplete` in create/update — no API changes needed
- Replace read-only progress bar stub with range slider (0–100)
- Save on mouse-up
- Optional: Gantt bar partial-fill indicator (darker overlay at `percentComplete%` width)

*Web — Gantt tree expand/collapse (ratified in-scope):*
- Activities with `parentActivityId` render indented under their parent in the Gantt grid
- Chevron toggle per row collapses/expands that parent's children
- Group-level rows (assignee / status grouping) have their own collapse toggle
- `collapsedParents` and `collapsedGroups` state in `GanttView`; `buildRows` rewritten for arbitrary-depth nesting
- `GanttView.tree.test.ts` covers the `buildRows` tree and collapse logic

*Sample data:*
- `sample_data/10_tags.sql` — 5–8 tags per team + activity_tags associations

**Exit criteria — safe to pause when:**
- Tag CRUD API works end-to-end; activities carry `tagIds` in create/update/list responses
- Tag combobox in detail + create panels; create-on-the-fly produces a new team tag and associates it
- Parent picker: searchable dropdown within same timeline, replaces stub; cycles prevented
- Progress slider: editable 0–100 range, saves on change, replaces stub
- Sample data includes tags and activity-tag associations
- Gantt tree expand/collapse renders parent-child hierarchy with per-row chevron toggles
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean

---

### Phase 10.4.6 — Filter Implementation
**Status:** 🔄 In Progress — 2026-05-30, all automated checks pass; manual Docker verification still needed | **Effort:** M–L (3–4 days)

Makes the filter system fully operational. Today only the "Open only" preset actually filters activities — the other five presets, member filters, and saved filters exist as UI selections but are never evaluated. This phase ships: a filter definition language, a client-side filter engine, a visual filter builder, team-scoped filter promotion, and the "Manage filters" admin experience.

**Depends on:** 10.4.5 (tags must exist for tag-based filtering)

**Design decisions:**
- **Filters are team-scoped, not timeline-scoped.** Status filter conditions match by **name** (case-insensitive), not by status ID. A filter for "In Progress" works across all timelines that have a status with that name. If a timeline lacks a matching status, the condition simply finds no matches — nothing breaks. Tags and assignees are already team-scoped. This makes filters intuitive and portable.
- **Filter admin lives inline in the filter dropdown**, not in a separate Team Modal tab. A "Manage filters" link opens a management panel in the existing right sidebar. This keeps the workflow close to where users interact with filters.
- **Client-side evaluation for v1.** Activities are already fully fetched per-timeline. The filter engine is a pure function that can later move server-side when data volumes warrant it.

**Detailed plan:** [docs/plans/phase-10.4.6.md](plans/phase-10.4.6.md)

**Scope summary:**

*Filter definition schema (stored as JSON in `saved_filters.definition`):*
- A filter is `{ logic: 'and' | 'or', conditions: FilterCondition[] }`
- Each condition is `{ field, op, value }` with field-specific operator and value types
- Supported fields: `status` (name match), `tag` (name match), `assignee` (member ID), `title` (string), `progress` (number), `hasParent` (boolean), `startDate` / `endDate` (date)
- Operators vary by type: equals, not_equals, contains, in, not_in, gt, lt, is_empty, is_not_empty, before, after, between, is_true, is_false

*Schema (migration 018):*
- `ALTER TABLE saved_filters ADD COLUMN is_team_filter BOOLEAN NOT NULL DEFAULT 0`

*API — team filter support:*
- `SavedFilter` model gains `IsTeamFilter bool`
- `ListByTeamUser` returns user's own filters + all team filters (`WHERE team_id = ? AND (user_id = ? OR is_team_filter = 1)`)
- `PATCH /saved_filters/{id}` accepts `isTeamFilter` (admin-only to set `true`)
- Admins can delete team filters they don't own

*Web — filter engine (`lib/filterEngine.ts`):*
- Pure function: `matchesFilter(activity, filterDef, context) → boolean`
- Resolves status name from `statusId` using timeline's status list (case-insensitive comparison)
- Resolves tag names from `tagIds` using team's tag list
- Evaluates conditions, combines with AND/OR

*Web — unified filter application:*
- `applyActiveFilter(activities, activeFilter, context)` — single function handling all filter kinds
- Replaces the current GanttView open-only filtering (lines 358–363) with full evaluation
- Makes all 6 presets actually work: all, open (uses isClosed flag), upcoming (7-day window), my (assigned to current user), overdue (past end + not closed), noassign (empty assignees)
- Member filter kind: filters by selected member's assignments
- Saved filter kind: parses definition JSON, evaluates via filter engine

*Web — filter builder (`components/filters/FilterEditor.tsx`):*
- Replaces "coming soon" in the RightSidebar
- Filter name input, AND/OR toggle, condition rows with + / − buttons, Save / Delete footer
- `FilterConditionRow.tsx`: field dropdown → operator dropdown → contextual value input (status: multi-select from deduped names across timelines; tag: multi-select from team tags; assignee: multi-select from members; dates: date picker; etc.)

*Web — team filters & management:*
- `FilterDropdown.tsx`: "Team filters" section shows filters where `isTeamFilter === true`; replaces current stub
- "Manage filters" link at bottom of dropdown opens `FilterManagePanel.tsx` in the right sidebar
- Management panel: lists user's filters + team filters; edit/delete buttons; admins see "Promote to team" on user filters

*Forward compatibility:*
- Shared views (Phase 13) will reference saved filters by ID — the `saved_filters` table and team-scoping design support this
- Exports (Phase 14) will accept a filter ID to scope exported data
- New activity fields added in future phases should be added to the `FilterCondition` union and the filter engine

**Exit criteria — safe to pause when:**
- All 6 preset filters actually filter activities (not just "Open only")
- Member filter kind filters by assignee
- Filter builder UI: add/remove conditions, pick field/op/value for all supported fields, AND/OR toggle
- Save/load/edit/delete custom filters works end-to-end
- Status conditions match by name (case-insensitive) across timelines
- Tag conditions match by tag name
- Team filter flag works: admins can promote a user filter to a team filter
- Team filters visible to all team members in the filter dropdown
- "Manage filters" panel accessible from dropdown; shows all filters with admin actions
- Filter engine has comprehensive unit tests (each field type, each operator, AND/OR logic, edge cases)
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean

---

### Phase 10.5 — Communications Testing
**Status:** ⬜ | **Effort:** S (1 day)

Comprehensive automated tests for every outbound email flow. No new features; this phase closes the test gap flagged in the 10.1.3 review and ensures all comms work correctly before enabling SMTP in production.

**Scope:**

*Flows to cover (one integration test each):*
- Invite email: `POST /teams/:id/invites` → mailer.SendInvite called with correct recipient and link
- Password reset request: `POST /auth/forgot-password` with a known-SMTP server → email delivered; token stored hashed
- Password reset confirm: `POST /auth/reset-password` → password updated; token marked used; second attempt rejected
- SMTP validation: `PUT /admin/smtp` with a valid test server → test email sent before config is persisted
- SMTP test: `POST /admin/smtp/test` → email sent to caller; no config persisted

*Mailer unit tests:*
- `SaveConfig` → password is encrypted before storage (sentinel prefix present)
- `LoadConfig` → encrypted password is decrypted on read; plaintext fallback for legacy values
- `Send` with no config → no-op (returns nil)
- `encryptPassword` / `decryptPassword` round-trip

*Test infrastructure:*
- Add a `newTestSMTPServer(t)` helper using `net/smtp` or a simple TCP listener to capture outbound SMTP without a real mail server

**Exit criteria — safe to pause when:**
- All flows above have at least one passing integration test
- `SaveConfig`/`LoadConfig` encryption round-trip has a unit test
- `go test ./...` passes clean

---

### Phase 10.6 — AI Key Management
**Status:** ⬜ | **Effort:** M (2–3 days)

Ships the AI/LLM key configuration surface stubbed in Phase 10.1.3. Adds encrypted storage, model routing, and a usage log so superadmins can connect AI providers and see which features are consuming tokens.

**Scope:**

*API:*
- New table `ai_provider_keys`: id, provider (anthropic | openai | google | custom), api_key (encrypted AES-256-GCM, same pattern as SMTP password), model_override, created_at, updated_at
- `GET /admin/ai/keys` — list configured providers (key masked); superadmin only
- `PUT /admin/ai/keys/:provider` — upsert a provider key; validates by making a lightweight test call; superadmin only
- `DELETE /admin/ai/keys/:provider` — remove a provider key; superadmin only

*Web — `/settings/ai` (replaces current stub):*
- Real form replacing the placeholder cards: provider selector, API key input (masked), model override field
- "Test connection" button calls a test endpoint before saving
- Usage log section (read-only): last 10 AI requests with timestamp, provider, model, token count

*Encryption:*
- Reuse the AES-256-GCM pattern introduced for SMTP passwords in Phase 10.1.3

**Exit criteria — safe to pause when:**
- A superadmin can configure an Anthropic key and verify via the test connection button
- The key is stored encrypted and masked in the GET response
- Removing a key clears it from the DB
- `golangci-lint run` clean; `go test ./...` passes

---

### Phase 10.7 — Localization & Language Support
**Status:** ⬜ | **Effort:** L (3–5 days)

Adds i18n infrastructure and ships the first non-English locale. The "Default language" fields in `/settings/preferences` and `/settings/organization` (currently disabled stubs) become functional.

**Scope:**

*Infrastructure:*
- Adopt `react-i18next` (or equivalent) for the web client
- Extract all user-facing strings from React components into locale JSON files
- Add a `language` column to `user_preferences` (per-user) and a `default_language` key to `instance_settings`
- `PATCH /users/me/preferences` accepts `language` key; `PATCH /admin/settings` accepts `default_language`

*Locales:*
- `en` — English (extracted from existing strings; the baseline)
- Ship at least one additional locale to validate the pipeline (e.g. `es` — Spanish, or `fr` — French)

*Web — settings surfaces:*
- Enable the "Language" dropdown in `/settings/preferences` (user-level)
- Enable the "Default language" dropdown in `/settings/organization` (instance-level)
- Language change takes effect on next page load (no hard reload required)

**Exit criteria — safe to pause when:**
- Switching to the second locale changes all UI strings in the web app
- User language preference persists across logout/login
- Instance default language is used when the user has no preference set
- Adding a new locale requires only a new JSON file (no code changes)
- `pnpm --filter web lint` clean

---

### Phase 11.1 — Web — List / Spreadsheet View
**Status:** ⬜ | **Effort:** M (2–3 days)

The "spreadsheet" surface — a dense, sortable, inline-editable table view of the same events shown in Gantt. Cheapest of the three new views to build and the highest-utility for power users who want to bulk-scan or bulk-edit. Shipped first so the view-switcher infrastructure lands here and the later views slot in.

**Design rationale:**
Gantt answers "when," List answers "what" — a flat, scannable inventory with column-level sorting, density that fits 50+ events on screen, and inline edits without opening a side panel. This is the view most users will reach for once Find (8.5) gets them close to a row.

**Scope:**

*View-switcher infrastructure (lands here, reused by 11.2 / 11.3):*
- `ViewMode` extended to `'gantt' | 'list' | 'calendar' | 'kanban'`
- View switcher control in the timeline sub-toolbar; per-timeline persisted via existing preferences (8.4)
- View-specific toolbar slots so each view can contribute its own controls without crowding the shared bar

*List view itself:*
- Virtualized table (react-virtual or TanStack Virtual) — must scroll 1000+ rows smoothly
- Default columns: Title, Start, End, Duration, Status, Assignees, Tags, Parent
- Column show/hide menu; column order via drag; column widths resizable — persisted via preferences
- Sort by clicking a column header (single-column sort for v1)
- Density toggle (Comfortable / Compact)
- Inline edit on click for title, dates, status — Tab/Shift+Tab/Enter navigation between cells
- Row click (off-editable-cell) opens the existing `EventDetailPanel`
- Bulk selection via checkbox column; bulk archive / delete / status-change actions in a contextual toolbar
- Respects active filter, Find highlight (8.5), and granularity-independent — granularity does not apply to List

**Exit criteria — safe to pause when:**
- View switcher toggles between Gantt and List, persisting the choice per timeline
- List shows all visible events with correct columns and respects the active filter
- Sorting by any column reorders rows without losing scroll position
- Inline editing title / dates / status saves via PATCH and reflects in Gantt when switched back
- Bulk selecting 3+ events and applying "Archive" archives all selected events
- 1000-row test fixture scrolls without jank
- Find bar highlights matching rows in List view the same way it highlights bars in Gantt

---

### Phase 11.2 — Web — Calendar View
**Status:** ⬜ | **Effort:** L (3–5 days)

Three calendar sub-layouts (Month / Week / Day) sharing one component skeleton. Week / Day need an overlapping-event lane algorithm; Month is the cheaper grid.

**Design rationale:**
A familiar surface for users coming from Google Calendar / Outlook. Not a Gantt replacement — it answers "what's happening this week?" rather than "how does this project unfold?". Multi-day events render as continuous bars across cells (Month) or pinned to an all-day strip above the time grid (Week / Day).

**Scope:**

*Shared:*
- Sub-layout switcher (Month / Week / Day) inside the view's toolbar slot
- Today / prev / next navigation; "jump to date" picker
- Click empty cell → open Event create form, prefilled with that date
- Click event → open `EventDetailPanel`
- Drag event between cells → PATCH new start/end (preserving duration); only valid on Week / Day for v1

*Month layout:*
- 6-week grid; multi-day events render as continuous bars spanning cells; overflow handled with a "+N more" affordance per cell

*Week layout:*
- 7 day columns, 24-hour vertical time grid, configurable working-hours zoom
- All-day strip at the top for events without time components
- Overlapping-event lane algorithm: side-by-side columns within a day

*Day layout:*
- Single-day variant of Week; same time grid and lane algorithm

**Open question (resolve early in phase):**
- Events without time components (date-only) — do they all live in the all-day strip, or do they get a default block at e.g. 9am? Affects sync compatibility with Phase 12.

**Exit criteria — safe to pause when:**
- Switching to Calendar from List/Gantt renders the current month with all events in correct cells
- Month / Week / Day sub-toggles each render correctly with no data discrepancy
- A multi-day event renders as a continuous bar in Month and pinned to the all-day strip in Week / Day
- Two overlapping events in Week view render side-by-side without occlusion
- Dragging an event to a different day in Week view updates start/end via PATCH
- Find highlights matching events in all three sub-layouts

---

### Phase 11.3 — Web — Kanban View (Read-Only)
**Status:** ⬜ | **Effort:** S–M (1–2 days)

Read-only Kanban per [REQUIREMENTS.md](REQUIREMENTS.md). Columns are team statuses in their configured order; cards are events colored by primary assignee. Drag-to-change-status is explicitly v2.

**Depends on:** Phase 10.2 (statuses API + UI), so admins can actually configure columns.

**Scope:**
- Columns from `team_statuses` in display order; column header colored from status color
- Cards: title, date range, assignee avatars (stacked color indicators for multi-assignee), parent badge if nested
- Empty column shows muted "No events" placeholder
- Column scroll independently when card count exceeds viewport height
- Card click → `EventDetailPanel`
- Respects active filter, Find highlight, archived hiding

**Exit criteria — safe to pause when:**
- Kanban columns appear in the same order as the team's configured statuses
- Cards show the correct member color (or stacked indicators for multi-assignee)
- A status renamed / recolored in Settings updates the Kanban column header without refresh
- Find highlights matching cards across columns
- Attempting to drag a card produces no errors and no state change (read-only enforcement)

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

### Phase 13 — Shares — Multi-Share Views with Passwords
**Status:** ⬜ | **Effort:** M (3–5 days)

A first-class **Share** entity. One timeline can have many shares; each share is a frozen pairing of `{ view type + view config + optional password + optional expiry }`. This is the feature that lets a team publish, e.g., a public Gantt sorted by start date with the "Marketing" filter applied, alongside a password-protected List view of the same data for an external stakeholder.

**Design rationale:**
The existing single share token on `timelines` is too coarse — it shares "the timeline" with no opinion about which view, filter, sort, or grouping the viewer should land in. With four view types live (Gantt + 11.1 + 11.2 + 11.3), the surface a sharer wants to publish is the *configured view*, not the raw timeline. Multiple shares per timeline also enable stakeholder-specific snapshots (different filters, different views, different passwords) without forcing the team into a one-link compromise.

**Scope:**

*Schema:*
- New `shares` table: `id`, `timeline_id`, `view_type` (gantt/list/calendar/kanban), `view_config` JSON (filter preset, group_by, sort_by, granularity, visible-columns, etc.), `password_hash` (nullable, bcrypt), `expires_at` (nullable), `created_by`, `created_at`, `last_viewed_at`, `view_count`, `revoked_at`
- Public-token column on `shares` (unguessable, URL-safe) — the existing single token on `timelines` is migrated to the first share row
- `timelines.share_token` deprecated and removed in a follow-up migration once UI references are migrated

*API:*
- `POST /timelines/:id/shares` — create share; body carries `view_type`, `view_config`, optional `password`, optional `expires_at`
- `GET /timelines/:id/shares` — list shares for a timeline (creator + admins only)
- `PATCH /shares/:id` — rename / change password / extend expiry / revoke
- `DELETE /shares/:id` — hard delete
- `GET /shares/:token` — public lookup; if password-protected returns 401 with a `passwordRequired: true` marker (no data leakage)
- `POST /shares/:token/unlock` — exchange password for a short-lived view JWT scoped to that share

*Web — creating shares:*
- "Share this view" button in every view's toolbar slot (Gantt / List / Calendar / Kanban)
- Click → modal that snapshots the current toolbar state (filter, sort, group, zoom, etc.) into `view_config`, offers password + expiry toggles, then returns the URL with copy button
- View-config snapshot is **frozen** at creation time — later changes to the live view do not mutate existing shares

*Web — viewing shares:*
- Public viewer route `/s/:token` — no auth required; if password-protected, gates behind a password prompt; on success, mounts the corresponding view component in read-only mode with `view_config` applied
- Read-only enforcement: no drag, no inline edit, no create — the same lockdown used for `is_external` events (Phase 15) applied to the whole surface
- Branding strip at the top: team name, "Shared view," last-updated timestamp

*Web — managing shares:*
- "Manage shares" section on each timeline (also reachable from `/settings/team/:id` via a Timelines tab if scope allows): list, view counts, revoke, edit
- Indicator chip on a timeline tile showing active share count

**Open questions (resolve before starting):**
- Do password-protected shares get a rate limit on unlock attempts? (Probably yes — N attempts per IP per hour.)
- Should the unlock JWT be tied to the share's `view_config` snapshot, or refetch live? (Snapshot — that's the whole point.)
- Do we expose share view counts to non-creators with admin access, or keep them creator-private?

**Exit criteria — safe to pause when:**
- A user can create a share from any of the four views, with the current toolbar state captured in `view_config`
- Visiting the share URL renders the saved view exactly as it was configured at creation time
- A password-protected share prompts for the password; wrong password is rejected; correct password renders the view
- Setting an expiry causes the share to return 410 Gone after that date
- A revoked share returns 410 Gone immediately and the URL is no longer usable
- One timeline can host at least three independent shares with different view types and configurations
- Public viewers cannot mutate any data through the share URL (no edits, no drags, no creates)

---

### Phase 14 — Data Portability & Exports
**Status:** ⬜ | **Effort:** L (1 wk)

Tabular import / export plus view-aware exports (Gantt → PDF, Kanban → PDF, List → Markdown, etc.). Each visual export respects the active filter / sort / group at time of export — the deliverable is "what's on the screen right now," not the raw event list.

**Implementation note (PDF engine):**
PDFs are generated server-side using **gofpdf** (pure-Go, no Chrome dependency in the Docker image). This keeps the binary lean at the cost of reimplementing Gantt / Kanban / Calendar layouts in PDF primitives — accepted tradeoff because the alternative (chromedp) significantly inflates the image size and breaks the "single binary" promise. Visual fidelity for the Gantt PDF will not match the live view pixel-for-pixel; the target is "readable and recognizable," not "screenshot quality."

**Scope:**

*Tabular import / export (was the old Phase 13):*
- `GET /timelines/:id/export.csv` and `.xlsx`
- `POST /teams/:id/events/import` — CSV/Excel import with preview + validation step
- `GET /import-template.csv` and `.xlsx` downloadable template
- Password reset flow (requires SMTP or transactional email provider) — kept here because import errors / reset emails are the first time we need SMTP

*Visual / textual exports (per view):*
- **Gantt → PDF:** landscape, paginated by date range; columns scale to fit a printable width per page; legend strip with member colors; export current filter/sort/group state. Gantt → PNG as a single-page variant.
- **Kanban → PDF:** columns laid out side-by-side; if more columns than fit a printable width, paginate across pages with a column-overflow indicator. Kanban → PNG single-page.
- **List → CSV, xlsx, Markdown, PDF.** Markdown export uses a GitHub-flavored table; PDF is a styled table with the same columns shown in the UI.
- **Calendar → PDF:** Month layout → one page per month in range; Week layout → one page per week; Day layout → one page per day.
- All visual exports include a header strip: team name, timeline name, generated-at timestamp, applied filter description.

*Wiring:*
- The Gantt toolbar's existing "Export" stub (Phase 8.1) becomes a real menu: CSV / xlsx / PDF / PNG
- Same menu in 11.1 / 11.2 / 11.3 toolbar slots, scoped to each view's relevant formats

**Open questions (resolve before starting):**
- Are exports synchronous (block and return the file) or async (job queue with a download link)? Probably sync for v1; revisit if multi-hundred-page PDFs become slow.
- Do exports respect Find highlights or just the filter? (Filter only — Find is ephemeral.)

**Exit criteria — safe to pause when:**
- Exporting a timeline to CSV and xlsx produces files containing all visible events with the active filter applied
- Importing the exported CSV back in shows a preview, validates rows, and creates events on confirm
- Gantt → PDF renders a recognizable Gantt chart with bars in the correct positions and a member-color legend
- Kanban → PDF renders the visible columns and cards in the same order shown on screen
- List → Markdown produces a clean GitHub-flavored table that renders correctly in a Markdown previewer
- Calendar → PDF in Month layout produces one page per month with events in correct cells
- Password reset flow sends an email and allows setting a new password
- All export menus are reachable from their respective view toolbars; format options match the view type

---

### Phase 15 — External Connectors (Webhooks)
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

### Phase 16 — Global Search
**Status:** ⬜ | **Effort:** M (2–3 days, directional estimate)

Cross-team, cross-timeline event search via a command palette. Complements (does **not** replace) the in-view Find from [Phase 8.5](#phase-85-find-in-view).

**Why a separate phase:**
By this point we'll have: Find (8.5), List view (11.1), real-time sync (8.3), and likely more events per team than fit in one fetch. Global Search needs server-side full-text and a different UX surface (a palette, not an inline bar), so it earns its own phase. With Find + List already shipped, this should feel like the natural "I genuinely don't know where this event is" escape hatch — used rarely but valued when needed.

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

### Phase 17 — Backup & Restore
**Status:** ⬜ | **Effort:** M (2–3 days, directional estimate)

Admin tools for database backup visibility, manual backups, and scheduled backup configuration. Self-hosted deployments need a way to know their data is safe without SSH-ing into the container.

**Directional scope (to be firmed up before the phase):**

*Backup status (read-only admin surface):*
- `/settings/admin/backup` page: current DB file path, file size, last-modified timestamp, WAL size (SQLite), connection count
- Health indicator: green when last backup < 24h old, amber when 1–7 days, red when > 7 days or no backup exists
- For MySQL/Postgres adapters: show connection string (masked), database size, last `pg_dump`/`mysqldump` timestamp if available

*Manual backup:*
- "Back up now" button → triggers a hot copy of the SQLite file (using `VACUUM INTO` or the backup API) to a configurable backup directory
- For MySQL/Postgres: trigger `pg_dump`/`mysqldump` to the backup directory
- Download backup file directly from the admin UI (optional — evaluate security implications)

*Scheduled backups:*
- Cron-style schedule configuration (daily at 2am, every 6 hours, etc.)
- Retention policy: keep last N backups, or keep backups for N days
- Backup location: local directory (default), or S3-compatible object storage (stretch)
- Notification on backup failure (via SMTP if configured)

*API:*
- `GET /admin/backup/status` — current backup state (superadmin only)
- `POST /admin/backup` — trigger immediate backup (superadmin only)
- `GET /admin/backup/history` — list recent backups with size and status
- `GET/PUT /admin/backup/schedule` — read/update backup schedule config
- `DELETE /admin/backup/:id` — delete a specific backup file

**Open questions (resolve before starting):**
- Should backup files be downloadable from the admin UI, or only stored on the server filesystem? (Security tradeoff: convenience vs. risk of unauthorized download)
- For SQLite, `VACUUM INTO` vs. the SQLite backup API — which handles concurrent writes better under WAL mode?
- Do we need backup encryption at rest? (Probably not for v1 if the backup directory is on the same host)

**Exit criteria (placeholder — refine in-phase):**
- A superadmin can see the current DB status (path, size, last modified) on the admin backup page
- "Back up now" creates a usable copy of the database in the configured backup directory
- A scheduled backup runs at the configured interval and produces a valid backup file
- Retention policy automatically cleans up old backups beyond the configured limit
- Backup history shows the last N backups with timestamps and sizes

---

## How to Use This Document

1. Work phases in order — each phase's exit criteria assume the previous phase is complete.
2. After finishing a phase, flip its status to ✅ and update the summary table.
3. Use the exit criteria as your acceptance checklist before calling a phase done.
4. For the granular task list within each phase, refer to [TASKS.md](TASKS.md).

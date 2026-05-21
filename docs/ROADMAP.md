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
| 10.1 | [Teams — Full CRUD (API + UI)](#phase-101--teams--full-crud-api--ui) | M — 2 days | ⬜ |
| 10.2 | [Team Statuses & Member Colors (API + UI)](#phase-102--team-statuses--member-colors-api--ui) | M — 1–2 days | ⬜ |
| 10.3 | [Timelines — Full CRUD (API + UI)](#phase-103--timelines--full-crud-api--ui) | M — 2 days | ⬜ |
| 10.4 | [Profile, Tokens & Admin Settings (Web)](#phase-104--profile-tokens--admin-settings-web) | S — 1 day | ⬜ |
| 11.1 | [Web — List / Spreadsheet View](#phase-111--web--list--spreadsheet-view) | M — 2–3 days | ⬜ |
| 11.2 | [Web — Calendar View](#phase-112--web--calendar-view) | L — 3–5 days | ⬜ |
| 11.3 | [Web — Kanban View (Read-Only)](#phase-113--web--kanban-view-read-only) | S–M — 1–2 days | ⬜ |
| 12 | [Calendar Sync — Google & CalDAV](#phase-12-calendar-sync--google--caldav) | XL — 1–2 wks | ⬜ |
| 13 | [Shares — Multi-Share Views with Passwords](#phase-13-shares--multi-share-views-with-passwords) | M — 3–5 days | ⬜ |
| 14 | [Data Portability & Exports](#phase-14-data-portability--exports) | L — 1 wk | ⬜ |
| 15 | [External Connectors (Webhooks)](#phase-15-external-connectors-webhooks) | M — 3–5 days | ⬜ |
| 16 | [Global Search](#phase-16-global-search) | M — 2–3 days | ⬜ |

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
- Click activity block → open `EventDetailPanel` (view mode)
- Edit button → inline editing form (title, description, date range, status, assignees)
- Save → `PATCH /events/:id`, optimistic update, close panel
- Delete → `DELETE /events/:id`, confirm dialog, remove from timeline
- Drag on empty lane cell → capture start/end date range → open `EventCreateForm` pre-filled with lane member + dates
- Submit form → `POST /teams/:id/events`, add block to timeline

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

> **Note:** Phase 9 ships the API surface only. The token management **UI** (create / list / revoke from a settings page) lands in [Phase 10.4 — Profile, Tokens & Admin Settings](#phase-104--profile-tokens--admin-settings-web). Until 10.4 ships, tokens are created via direct API calls or a temporary admin script.

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

### Phase 10 — Entity Management (data-cornerstone CRUD)

**Framing:** Phase 10 closes the gaps in CRUD for the three core data entities — Teams, Timelines, Activities (renamed from Events in Phase 9.5) — plus the cross-cutting settings shell. Today the first-run wizard creates one of each and there is no path to manage them afterward. We tackle them entity-by-entity, top-down, so that by the time Phase 11 (views) ships, the data layer underneath is fully manageable. Activities are already CRUD-complete from Phases 3 / 8.2 / 8.2.1 (archive lands in Phase 9), so Phase 10 only needs to address Teams and Timelines.

Sub-phase dependency: 10.1 (Teams) → 10.2 (Statuses) → 10.3 (Timelines) → 10.4 (Profile/Tokens/Admin). 10.2 depends on 10.1 because the statuses tab lives inside `/settings/team/:id`. 10.3 doesn't strictly depend on 10.2 but is sequenced after for clean delivery.

---

### Phase 10.1 — Teams — Full CRUD (API + UI)
**Status:** ⬜ | **Effort:** M (2 days)

Closes the Teams cornerstone. Today a user can create one team via the first-run wizard and never manage it again. After this phase, teams are a fully manageable entity from both API and UI.

**Design rationale:**
Teams are the outermost data scope — everything else (timelines, events, members, statuses, tokens, shares) hangs off a team. Without a way to rename, reconfigure, manage members, or add additional teams, the rest of the app is essentially read-only at the structural level. This is also where the existing Up-Next "Member Management (Sidebar)" task block lands — those tasks are absorbed here rather than shipped separately.

**Scope:**

*API — team-level:*
- `GET /teams/:id` — full team detail (name, timezone, week start, member count, timeline count)
- `PATCH /teams/:id` — rename, change timezone, change week start day (admin only)
- `POST /teams/:id/archive` and `POST /teams/:id/unarchive` (depends on Phase 9 archive)
- `POST /teams` already exists (Phase 3) — exposed via a new "Create team" UI path

*API — member-level:*
- `POST /teams/:id/members` — add existing registered user by `userId` (admin only)
- `PATCH /teams/:id/members/:memberId` — update display name, color, role (admin for role; member can set own color/display name)
- `DELETE /teams/:id/members/:memberId` — remove member; reject if last admin
- `POST /teams/:id/participants` — create login-less participant (admin only; from Phase 8.0 schema)

*API — invite-level:*
- `GET /teams/:id/invites` — list pending invites
- `DELETE /teams/:id/invites/:inviteId` — cancel pending invite
- (`POST /teams/:id/invites` already exists — Phase 3)

*Web:*
- "New team" affordance in the team picker → create-team modal (name, timezone, week start)
- `/settings/team/:id` — General tab: name, timezone, week start, archive button
- `/settings/team/:id` — Members tab: list with role / color / last seen; promote / demote / remove; pending invites with resend / cancel; "Invite new" + "Add existing user" entry points
- `/settings/team/:id` — Participants tab: create / rename / archive login-less members
- Team archive flow: confirmation dialog, removes team from active picker, surfaces in an "Archived teams" section
- Inline member quick-edit in the sidebar (gear icon on hover) opens a lightweight drawer that reuses Members-tab components

**Exit criteria — safe to pause when:**
- A user can create a second team from the team picker without going through the first-run wizard
- A team admin can rename their team, change timezone, and change week start from `/settings/team/:id`
- A team admin can add a registered user, invite a new email, cancel a pending invite, promote a member to admin, change a member's color, and remove a member — all from the Members tab
- A non-admin member visiting `/settings/team/:id` sees the page in read-only form
- Archiving a team removes it from the active picker; unarchive restores it
- Removing the last admin from a team returns a validation error
- The sidebar gear-icon member quick-edit drawer saves changes that immediately reflect in the Members tab

---

### Phase 10.2 — Team Statuses & Member Colors (API + UI)
**Status:** ⬜ | **Effort:** M (1–2 days)

Statuses are team-scoped configuration; pairing them with the Statuses tab UI in one phase keeps the API and the only consumer of that API shipping together. Required before Phase 11.3 (Kanban) so admins can configure columns.

**Scope:**

*API:*
- `team_statuses` migration and repository
- Seed default statuses (Planned / In Progress / Done) on team creation
- `GET /teams/:id/statuses`, `POST /teams/:id/statuses`
- `PATCH /statuses/:id` — rename, recolor, reorder
- `DELETE /statuses/:id` — requires `replacementStatusId`; migrates events
- Self-protect: cannot delete the last remaining status on a team
- `color` field on `team_members` (already established in 10.1 via member PATCH; reaffirmed here)

*Web:*
- `/settings/team/:id` — Statuses tab: drag-to-reorder list, inline rename, color picker
- Delete-with-replacement dialog: lists affected event count, requires picking a replacement status before confirming
- Member color picker in Members tab (already shipped in 10.1) — confirmed wired to the same color field

**Exit criteria — safe to pause when:**
- A newly created team has exactly 3 seeded statuses
- Statuses can be renamed, recolored, and reordered from the UI; changes persist
- Deleting a status without a replacement is blocked at both API and UI levels
- Deleting a status with a replacement migrates all associated events
- Deleting the last remaining status is blocked
- Member color changes from the Members tab reflect immediately wherever members are shown

---

### Phase 10.3 — Timelines — Full CRUD (API + UI)
**Status:** ⬜ | **Effort:** M (2 days)

Closes the Timelines cornerstone. Same problem space as 10.1: today timelines can be created in the wizard and never managed afterward, and access lists exist in the schema (Phase 8.0) with no CRUD endpoints.

**Scope:**

*API — timeline-level:*
- `PATCH /timelines/:id` — rename, change start/end date, change description (admin only)
- `POST /timelines/:id/archive` and `POST /timelines/:id/unarchive` (depends on Phase 9)
- `DELETE /timelines/:id` — hard delete; admin only; confirms via second action

*API — access-list:*
- `GET /timelines/:id/access` — list current grants (team member + role)
- `PUT /timelines/:id/access/:memberId` — grant or update role (admin / member)
- `DELETE /timelines/:id/access/:memberId` — revoke grant

*Web:*
- "New timeline" affordance in the sidebar timelines list → create-timeline modal (name, date range)
- Edit-timeline modal reachable from each timeline in the sidebar (or a `/settings/team/:id/timelines` sub-route): rename, change date range, archive, delete
- Access-list management UI: search-pick team members, role toggle, remove
- Sidebar shows archived timelines under a collapsed "Archived" group; unarchive from there

**Exit criteria — safe to pause when:**
- A user can create a second timeline without going through the first-run wizard
- A timeline admin can rename a timeline and change its date range; events outside the new range are not deleted, just hidden from default views
- Archiving a timeline removes it from the active sidebar; unarchive restores it
- The access-list UI lets an admin grant / revoke access for any team member; a non-admin attempting these actions is rejected
- A team member without an access grant cannot open the timeline (existing 8.0 enforcement) — verified end-to-end through the new UI

---

### Phase 10.4 — Profile, Tokens & Admin Settings (Web)
**Status:** ⬜ | **Effort:** S (1 day)

Cross-cutting settings — everything that isn't team- or timeline-scoped. Smaller than the original 10.2 because team/timeline management now lives in 10.1 / 10.2 / 10.3.

**Scope:**

*Routing & shell:*
- `/settings` route with left-nav layout; sections gated by role
- Nav items: Profile · API Tokens · Team (× N) · Admin (superadmin only) — the Team entries link to the surfaces shipped in 10.1–10.3

*Profile (`/settings/profile`):*
- Display name edit (PATCH against user record), change password form
- Email shown read-only for v1
- Avatar upload — stretch

*API Tokens (`/settings/tokens`):*
- List existing tokens (name, scope, last used, created) with revoke button
- Create token dialog: name + scope picker (read-only / add / edit-own / edit-all)
- One-time secret reveal on creation with copy-to-clipboard; never shown again

*Admin (`/settings/admin`, superadmin only):*
- Instance name + branding (logo, accent color override)
- Registration policy toggle (invite-only vs open)
- Backup status read-only surface (DB path, last-modified)
- *Deferred to Phase 14:* SMTP config (lands with password-reset flow)

**Exit criteria — safe to pause when:**
- A user can change display name and password from `/settings/profile`; both persist across logout
- A user can create, see the secret once for, and revoke an API token from the UI; the token successfully authenticates an API call
- A superadmin sees the Admin nav item and can change instance name, branding, and registration policy
- A non-superadmin does not see the Admin nav item
- All four `/settings` sections coexist with the team and timeline surfaces from 10.1–10.3 without route collision

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

## How to Use This Document

1. Work phases in order — each phase's exit criteria assume the previous phase is complete.
2. After finishing a phase, flip its status to ✅ and update the summary table.
3. Use the exit criteria as your acceptance checklist before calling a phase done.
4. For the granular task list within each phase, refer to [TASKS.md](TASKS.md).

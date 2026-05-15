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
| 7 | [Web — Scaffold](#phase-7-web--scaffold) | M — 2–3 days | ⬜ |
| 8 | [Web — Timeline View (Core UI)](#phase-8-web--timeline-view-core-ui) | XL — 1–2 wks | ⬜ |
| 9 | [API Token Auth & Archive](#phase-9-api-token-auth--archive) | M — 1–2 days | ⬜ |
| 10 | [Team Configuration](#phase-10-team-configuration) | M — 1–2 days | ⬜ |
| 11 | [Web — Calendar, List & Kanban Views](#phase-11-web--calendar-list--kanban-views) | L — 1 wk | ⬜ |
| 12 | [Calendar Sync — Google & CalDAV](#phase-12-calendar-sync--google--caldav) | XL — 1–2 wks | ⬜ |
| 13 | [Data Portability & Polish](#phase-13-data-portability--polish) | M — 3–5 days | ⬜ |

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
**Status:** ⬜ | **Effort:** M (2–3 days)

**Scope:**
- shadcn/ui initialized (`pnpm dlx shadcn@latest init`)
- Color tokens set in `src/index.css`
- Dark mode toggle (localStorage + `prefers-color-scheme`)
- Routing (React Router)
- Auth flow: login page, register-via-invite page, token storage
- API client: TanStack Query + fetch wrapper using generated types
- WebSocket client hook (`useWebSocket`)

**Exit criteria — safe to pause when:**
- `/login` renders and authenticates against the live API
- Protected routes redirect unauthenticated users to `/login`
- A TanStack Query hook successfully fetches and displays team events
- WebSocket connects and emits events visible in browser DevTools Network tab

---

### Phase 8 — Web — Timeline View (Core UI)
**Status:** ⬜ | **Effort:** XL (1–2 wks)

The heaviest phase. This is the product's core differentiator.

**Scope:**
- Horizontal timeline component: person lanes on the Y-axis, time on the X-axis
- Event block: renders title, color, icon, and date range within a lane
- Click a block to open view/edit detail panel
- Click-and-drag on an empty lane cell to create a new event
- Real-time: apply incoming WebSocket deltas to timeline state without a full reload

**Exit criteria — safe to pause when:**
- Team member lanes render with correct names and colors
- Events appear as blocks spanning the correct date range in the correct lane
- Dragging on a lane opens a creation form pre-filled with the selected range
- Clicking an event block opens an edit panel; changes save and reflect immediately
- A second browser tab's timeline updates within 500ms when an event is mutated in the first tab

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
- View switcher in the timeline header

**Exit criteria — safe to pause when:**
- View switcher cycles between Timeline, Calendar (3 sub-layouts), List, and Kanban without error
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
- Docker image: embed React build into Go binary, single artifact

**Exit criteria — safe to pause when:**
- Exporting a timeline produces a valid CSV and Excel file with all events
- Importing that CSV back in shows a preview, validates rows, and creates events on confirm
- Password reset sends an email and allows setting a new password
- A public timeline share link is fully viewable without logging in
- `docker build` produces a single image; `docker run` serves both the API and the web app with no additional containers

---

## How to Use This Document

1. Work phases in order — each phase's exit criteria assume the previous phase is complete.
2. After finishing a phase, flip its status to ✅ and update the summary table.
3. Use the exit criteria as your acceptance checklist before calling a phase done.
4. For the granular task list within each phase, refer to [TASKS.md](TASKS.md).

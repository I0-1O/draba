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

### Web — Timeline View
- [ ] Horizontal timeline component (person lanes, time blocks)
- [ ] Event block: render title, color, icon, date range
- [ ] Click block to view/edit event detail
- [ ] Create block by click-and-drag on a lane
- [ ] Real-time update: apply WebSocket deltas to timeline state

### OpenAPI
- [x] Write initial `openapi.yaml` in `packages/shared/` — 2026-05-04
- [x] Set up TypeScript type generation from spec (openapi-typescript) — 2026-05-04

## Up Next

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

### Polish
- [ ] Password reset flow (email required — pick SMTP or transactional email provider)
- [ ] Public timeline read-only view (no login)
- [ ] Timeline restricted-access enforcement
- [ ] Docker image: embed React build into Go binary, single artifact

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

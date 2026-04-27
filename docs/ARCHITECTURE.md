# Architecture

## System Overview
draba is an API-first, event-driven team coordination tool. The API server is the single source of truth. All clients (web, CLI, MCP agents) are dumb consumers of the same REST + WebSocket API. Every state change emits an internal event; calendar sync, real-time broadcast, and notifications are event consumers.

```
Web UI ──┐
   CLI ──┤
   MCP ──┤──→ REST API ──→ Internal Event Bus ──→ Calendar Sync (Google, CalDAV)
Agents ──┤                                    ──→ WebSocket Broadcast
         └──→ WebSocket (real-time subscribe)  ──→ Notifications (future)
```

The server also implements a built-in CalDAV endpoint, allowing iOS/macOS Calendar apps to connect directly without any external CalDAV server dependency.

---

## Components

### API Server (`packages/api/`)
- Language: Go
- Transport: HTTP/REST + WebSocket
- Auth: JWT (access token) + short-lived refresh tokens; invite tokens for registration
- Database access: abstracted repository layer supporting SQLite, MySQL/MariaDB, and Postgres
- Internal event bus: in-process pub/sub; every write operation publishes a typed event
- CalDAV server: built-in, implemented as part of the Go server (no Radicale dependency)
- Google Calendar sync: OAuth 2.0 connection per user; outbound push + inbound webhook
- Entry point: `cmd/draba/main.go`

### Web Frontend (`packages/web/`)
- Framework: React (TypeScript, strict mode)
- UI components: shadcn/ui (copy-paste components, owned by the repo — not a runtime dependency)
- Styling: Tailwind CSS v4; design tokens via CSS custom properties following shadcn convention
- State management: TanStack Query (server state); React Context or Zustand for global UI state (TBD when needed)
- Routing: React Router
- Real-time: WebSocket client, reconnects automatically
- Build: Vite
- Static files served by the Go binary in production (embedded)

### Shared (`packages/shared/`)
- OpenAPI specification (`openapi.yaml`) — the contract between API and web
- TypeScript types generated from the OpenAPI spec (used by `packages/web`)
- This is the source of truth for the API shape; Go structs and TS types both derive from it

---

## Data Model

### Core Entities

```
users
  id, email, password_hash, display_name, avatar_url, created_at, updated_at

teams
  id, name, slug, created_at, updated_at

team_members
  team_id, user_id, role (admin|member), color, joined_at

team_statuses
  id, team_id, name, color, position, created_at, updated_at
  -- seeded with Planned / In Progress / Done on team creation
  -- position controls Kanban column order and dropdown sort order

invites
  id, team_id, email, token, role, invited_by, expires_at, accepted_at

api_tokens
  id, user_id, name, token_hash,
  scope (read|add|edit_own|edit_all),
  last_used_at, created_at, revoked_at (nullable)

events
  id, team_id, title, description, status, percent_complete,
  icon, color, start_at, end_at, all_day,
  status_id (FK → team_statuses),
  parent_event_id (nullable → self-ref FK),
  location, url, rrule,
  caldav_uid, google_event_id,     -- external IDs for sync
  created_by, created_at, updated_at, archived_at (nullable)

event_tags
  event_id, tag

event_assignments
  event_id, user_id

timelines
  id, team_id, name, start_date, end_date,
  visibility (public|restricted), share_token, ical_token,
  created_by, created_at, updated_at, archived_at (nullable)

timeline_access
  timeline_id, user_id     -- only used when visibility = restricted

calendar_connections
  id, user_id, provider (google|caldav),
  credentials_encrypted, caldav_url,
  last_synced_at, created_at
```

### Key Relationships
- An event belongs to a team and can be assigned to multiple users (`event_assignments`)
- An event can have a parent event (same team), enabling nesting without a separate Project entity
- A timeline is a named date range over a team's events — not a data container
- Calendar connections are per-user; each user chooses which calendars to sync their events to

---

## Data Flow

### Event Create / Update
1. Client sends REST request → API handler validates and writes to DB
2. Handler publishes typed event to internal event bus (e.g., `events.updated`)
3. Event bus fans out to consumers:
   - **WebSocket broadcaster** — pushes delta to all connected clients subscribed to that team
   - **Calendar sync worker** — pushes change to Google Calendar and/or CalDAV for each assigned user who has a connection

### Inbound Google Calendar Sync
1. Google pushes a webhook notification to `/webhooks/google`
2. Handler fetches the changed event from Google Calendar API
3. Upserts the event in draba DB (matched on `google_event_id`)
4. Publishes `events.updated` to the event bus → WebSocket broadcast

### CalDAV (Inbound from iOS/macOS)
1. Client issues a CalDAV REPORT or PUT to draba's built-in CalDAV endpoint
2. draba handles the CalDAV protocol natively and writes to DB
3. Publishes to event bus → WebSocket broadcast + outbound Google sync if connected

### Real-Time
- WebSocket connections are scoped per team
- On connect, client subscribes to one or more team rooms
- Server broadcasts JSON delta payloads on `events.*` and `timeline.*` events

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Go | Single static binary; easy Docker distribution; excellent concurrency for WebSockets |
| Database default | SQLite | Zero-config self-hosting — one binary + one file |
| DB abstraction | Repository pattern | Swap SQLite/MySQL/Postgres without touching business logic |
| CalDAV | Built-in Go server | No external Radicale dependency; simpler self-hosted story |
| Calendar sync v1 | Google + CalDAV only | Microsoft is lower priority; adds OAuth complexity for small gain |
| Frontend | React + TypeScript | Large ecosystem; strong typing; team familiarity |
| UI library | shadcn/ui + Tailwind CSS | Copy-paste ownership model; Tailwind utility classes; strong shadcn/React ecosystem |
| API contract | OpenAPI spec in `packages/shared/` | Single source of truth; generate TS types for web |
| Auth | JWT + email invite flow | Simple, stateless, no OAuth complexity in v1 |
| Real-time | WebSockets | Lower latency than polling; Go handles many concurrent connections well |
| Static files | Embedded in Go binary | Single artifact deployment — no separate static server needed |
| Deployment | Docker container | Zero external dependencies in SQLite mode; ships as one image |
| Tenancy | One container per customer | Simpler ops and data isolation to start; multi-tenant is a later optimization |

---

## Infrastructure

### Self-Hosted (v1)
- Single Docker image: `ghcr.io/draba/draba:latest`
- Configuration via environment variables (DB path, DB type, SMTP, Google OAuth credentials)
- SQLite: data stored in a mounted volume
- MySQL/Postgres: point to external DB via connection string env var
- No external services required in SQLite mode

### Directory Structure (Go server)
```
packages/api/
  cmd/draba/          -- main entry point
  internal/
    api/              -- HTTP handlers and routing
    auth/             -- JWT, invite tokens, password hashing
    caldav/           -- built-in CalDAV server implementation
    calendar/         -- Google Calendar sync + CalDAV outbound sync
    db/               -- repository layer (SQLite/MySQL/Postgres adapters)
    events/           -- internal event bus
    models/           -- domain types
    ws/               -- WebSocket hub and broadcaster
  migrations/         -- SQL migration files
```

### CI/CD
- [TBD — GitHub Actions; build + test on PR; publish Docker image on tag]

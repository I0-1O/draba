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

> **Member management work is split across Phase 10.1.1 (Teams — CRUD) and Phase 10.1.2 (Members — Management & Editing)**. Team entity CRUD (create, edit, archive) is in 10.1.1; member lifecycle (add, edit, roles, invites, stubs, inactivation, admin actions) is in 10.1.2. The previously enumerated sidebar gear-icon + add-member-sheet tasks are absorbed into 10.1.2.

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

### The Great Event → Activity Rename (Phase 9.5)
Rename the domain entity `Event` → `Activity` everywhere. Runbook: [GreatEventToActivity.md](GreatEventToActivity.md). Roadmap: [Phase 9.5](ROADMAP.md#phase-95--rename-event--activity-the-great-rename).

> **Historical note:** Phase 3 / 8.x / 9 task entries above use "event" because that was the entity's name when those phases shipped. Do not rewrite them. Phase 9.5 is the formal cutover; all later entries use "activity".

**DB:**
- [x] Write migration `005_rename_events_to_activities.sql` — 2026-05-21 (`ALTER TABLE ... RENAME`)
- [x] Rename indexes containing `event` in their name — 2026-05-21
- [x] Update `migrations_test.go` to assert new table + column names — 2026-05-21
- [ ] Verify against a copy of the prod DB: row counts unchanged, `PRAGMA foreign_key_check` clean

**Go API:**
- [x] `models.Event` → `models.Activity` — 2026-05-21
- [x] Rename file `internal/db/event_repo.go` → `activity_repo.go`; `EventRepo` → `ActivityRepo` — 2026-05-21
- [x] Rename file `internal/api/event_handler.go` → `activity_handler.go`; all `handle*Event*` functions — 2026-05-21
- [x] `server.go`: routes `/events*` → `/activities*` — 2026-05-21
- [x] `internal/events/bus.go`: rename constants `EventCreated/Updated/Deleted` — 2026-05-21 → `ActivityCreated/Updated/Deleted` + wire strings (`event.*` → `activity.*`). **Keep** package name and `TimelineCreated/Updated`.
- [x] Update `bus_test.go`, `hub_test.go` wire-string assertions — 2026-05-21
- [x] `golangci-lint run` clean, `go test ./...` passes — 2026-05-21

**OpenAPI + generated types:**
- [x] `packages/shared/openapi.yaml`: schema, paths, operationIds — 2026-05-21, tags, body types. **Keep** `googleEventId` and `caldavUid` fields.
- [x] Run `pnpm --filter shared generate`; verify `Activity` exports — 2026-05-21, zero `Event` exports

**Web:**
- [x] `src/types/index.ts`: `DrabaEvent`/`EventStatus`/`EVENT_COLORS` — 2026-05-21 → `DrabaActivity`/`ActivityStatus`/`ACTIVITY_COLORS`
- [x] Rename `useTeamEvents.ts` → `useTeamActivities.ts`; hooks + query keys — 2026-05-21
- [x] `useWebSocket.ts`: update message-type switch to `activity.*` — 2026-05-21
- [x] Rename `EventDetailPanel`, `EventCreatePanel`, `EventPanel` → `Activity*` — 2026-05-21; fix imports
- [x] UI copy sweep: sidebar label, panel titles, empty state, ARIA, button labels — 2026-05-21
- [x] `pnpm --filter web lint` clean — 2026-05-21

**Tests + seed:**
- [x] Rename `event_handler_test.go` → `activity_handler_test.go` — 2026-05-21
- [x] Rename `scripts/seed-find-test-events.sql` → `seed-find-test-activities.sql` — 2026-05-21; update INSERTs + cleanup

**Docs:**
- [x] Sweep ROADMAP.md, REQUIREMENTS.md, ARCHITECTURE.md, CONVENTIONS.md, TESTING.md, design/UX_PATTERNS.md — 2026-05-21
- [x] Hand-review: ROADMAP Phase 3 title — 2026-05-21 → "Core API — Activities & Teams (originally Events; renamed in Phase 9.5)"
- [x] Do **not** rewrite `docs/log.md` historical entries — 2026-05-21
- [x] Add Phase 9.5 entry to `docs/log.md` — 2026-05-21

**Verification (smoke against http://epcot.lan:8081):**
- [ ] Create / edit / archive / unarchive / delete an Activity end-to-end
- [ ] WebSocket frames arrive as `activity.created` / `.updated` / `.deleted`
- [ ] Final sweep `rg "\bevent" packages/ docs/` returns only expected hits (bus package, calendar fields, log.md)

### Identity System (Phase 9.6)
Reusable Identity component system (color + icon) for all entities. Design spec: [IDENTITY_SYSTEM.md](design/IDENTITY_SYSTEM.md). Prototype: `docs/design/assets/identity-widget-prototype.html`.

**Schema (migration 006):**
- [x] Write migration `006_identity_fields.sql` — 2026-05-24
- [x] Update `migrations_test.go` to assert new columns exist — 2026-05-24

**Go API:**
- [x] `models.go`: add `Icon *string` + `Color *string` to `Team`; add `Icon *string` + `Color *string` to `Timeline`; add `Icon *string` to `TeamMember` — 2026-05-24
- [x] Update `TeamMemberWithUser` to surface the new `Icon` field (via embedding) — 2026-05-24
- [x] Update OpenAPI spec: add `icon`/`color` to `Team`, `Timeline`, `TeamMember` schemas — 2026-05-24
- [x] Regenerate TypeScript types (`pnpm --filter shared generate`) — 2026-05-24
- [x] `golangci-lint run` clean; `go test ./...` passes — 2026-05-24

**Web — component library (`src/components/identity/`):**
- [x] `identity-constants.ts` — 2026-05-24
- [x] `Badge.tsx` — 2026-05-24
- [x] `IdentityTrigger.tsx` — 2026-05-24
- [x] `IdentityPicker.tsx` — 2026-05-24
- [x] `IdentityWidget.tsx` — 2026-05-24

**Web — replace existing color/icon UI:**
- [x] `ActivityDetailPanel`: `<IdentityWidget>` replacing icon stub + 8-color swatch — 2026-05-24
- [x] `ActivityCreatePanel`: `<IdentityWidget>` replacing color swatch — 2026-05-24
- [x] Gantt bar label column: `<Badge size={20} shape="square">` — 2026-05-24
- [x] Sidebar timeline rows: `<Badge size={20} shape="square">` — 2026-05-24
- [x] Sidebar member rows: `<Badge size={20} shape="circle">` — 2026-05-24

**Web — MemberAvatar migration:**
- [x] Refactor `MemberAvatar.tsx` to delegate to `<Badge>` — 2026-05-24
- [ ] Verify all existing MemberAvatar call sites render correctly (manual)

**Web — palette consolidation:**
- [x] Update `types/index.ts`: re-export `ACTIVITY_COLORS` and `MEMBER_COLORS` from `identity-constants.ts` — 2026-05-24
- [x] Update `index.css`: `--member-N-*` → 16 `--identity-<name>` custom properties — 2026-05-24
- [x] Update `DESIGN_SYSTEM.md`: 8-color → 16-color identity palette reference — 2026-05-24

**Testing & verification:**
- [x] `pnpm --filter web lint` clean — 2026-05-24
- [x] `golangci-lint run` clean — 2026-05-24
- [x] `go test ./...` passes — 2026-05-24
- [ ] Badge renders all four modes (Lucide icon, 1-letter, 2-letter, none) at sizes 20–40px, both shapes (manual)
- [ ] IdentityWidget popover opens/closes; color, name option, and icon selection fire onChange (manual)
- [ ] Legacy hex colors in existing activities display correctly via `hexToColorId()` mapping (manual — test on Docker)
- [ ] Manual: ActivityDetailPanel uses IdentityWidget; changes persist as color IDs (manual — test on Docker)
- [ ] Manual: sidebar member + timeline rows use Badge (manual)

**Docs:**
- [x] Add Phase 9.6 entry to `docs/log.md` — 2026-05-24

---

### Phase 10 — Entity Management (data-cornerstone CRUD)

Closes CRUD gaps for the three core data entities. Activities (renamed from Events in Phase 9.5) are already CRUD-complete (Phases 3 / 8.2 / 8.2.1 + Phase 9 archive); Teams and Timelines are not, so 10.x focuses on them.

Design references:
- Team Modal: `docs/design/handoffs/team-modal/` — Settings tab, Members tab, archive flow
- Member Edit Modal: `docs/design/handoffs/member-modal/` — member profile, stats, admin actions

---

### Teams — CRUD & Management (Phase 10.1.1)
Closes the Teams data entity. Ships the Team Modal with Settings tab functional; Members tab scaffolded as locked/placeholder until 10.1.2.

**Schema (migration 008):**
- [x] Add `description TEXT` column to `teams` (nullable) — 2026-05-25
- [x] Add `notes TEXT` column to `teams` (nullable) — 2026-05-25
- [x] Add `archived_at DATETIME` column to `teams` (nullable) — 2026-05-25
- [x] Update `migrations_test.go` to assert new columns — 2026-05-25

**API — team-level:**
- [x] `GET /teams/:id` — full team detail (name, description, notes, icon, color, archived_at) — 2026-05-25
- [x] `PATCH /teams/:id` — update name, description, notes, icon, color (admin only) — 2026-05-25
- [x] `POST /teams/:id/archive` and `POST /teams/:id/unarchive` — 2026-05-25
- [x] Update `POST /teams` to accept `description`, `notes`, `icon`, `color` — 2026-05-25
- [x] Update `GET /teams` — add `?archived=true` to include archived teams — 2026-05-25

**OpenAPI + types:**
- [x] Update `Team` schema: add `description`, `notes`, `archivedAt` — 2026-05-25
- [x] Update `CreateTeamInput` and `PatchTeamInput` request bodies — 2026-05-25
- [x] Regenerate TypeScript types (`pnpm --filter shared generate`) — 2026-05-25

**Web — Team Modal (`<TeamModal>`):**
- [x] Modal shell: portal, backdrop, panel (580px, dark theme), header, tab bar, scrollable content, footer — 2026-05-25
- [x] Header: identity badge (36px square) + label ("NEW TEAM" / "EDIT TEAM") + team name + close button — 2026-05-25
- [x] Tab bar: Settings (active) + Members (locked/placeholder in this phase) — 2026-05-25
- [x] Members tab locked state: opacity 0.45, not-allowed cursor, tooltip "Save the team first to add members" — 2026-05-25
- [x] Settings tab: `<IdentityPicker>` (square shape), name (required), description, notes (textarea) — 2026-05-25
- [x] Footer: Archive team button (edit mode, left side), Cancel + Create team / Save changes (right side, team-color primary button) — 2026-05-25
- [x] "Saved" banner: appears after new team creation, auto-dismisses after 3s — 2026-05-25
- [x] New-team flow: Settings tab → Create team → banner → Members tab unlocks (placeholder content) — 2026-05-25
- [x] Edit-team flow: pre-populated Settings tab, Members tab unlocked (placeholder) — 2026-05-25
- [x] Archive confirmation dialog: replaces modal content, amber styling, icon, title, body, Cancel + Archive team buttons — 2026-05-25

**Web — team picker + settings shell:**
- [x] "New team" affordance in team picker dropdown → opens `<TeamModal mode="new">` — 2026-05-25
- [x] Team edit affordance (gear icon or similar) → opens `<TeamModal mode="edit" team={...}>` — 2026-05-25
- [x] `/settings` route shell with left-nav layout (foundation for 10.1.2–10.4.2) — 2026-05-25
- [x] Archived teams in picker under collapsed "Archived" section with unarchive action — 2026-05-25
- [x] `GET /teams` query includes archived teams for the picker's Archived section — 2026-05-25

**Testing & verification:**
- [x] `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean — 2026-05-25
- [ ] Manual: create second team from picker, edit existing team, archive/unarchive
- [ ] Manual: Team Modal opens in both modes with correct Settings tab behavior
- [x] `docs/log.md` Phase 10.1.1 entry written — 2026-05-25

---

### Members — Management & Editing (Phase 10.1.2)
Fills in the Team Modal Members tab and adds the Member Edit Modal. Full member lifecycle: add, edit, roles, stubs, invites, reusable invite link, stats, inactivation, superadmin actions. Depends on 10.1.1 (Team Modal shell).

**Terminology:** "Participant" = login-less team member (backend: `user_id = NULL`). Design handoffs use "stub" but we use "Participant" — established in Phase 8.0, more user-friendly. "Inactivate" = `archived_at`-based disabling. "Super Admin" = `is_superadmin`.

**Schema (migration 009):**
- [x] Add `archived_at DATETIME` column to `team_members` (nullable) — member inactivation — 2026-05-25
- [x] Add `archived_at DATETIME` column to `users` (nullable) — account-level inactivation — 2026-05-25
- [x] Add `invite_link_token TEXT UNIQUE` column to `teams` (nullable) — reusable invite link — 2026-05-25
- [x] Update `migrations_test.go` to assert new columns — 2026-05-25

**API — member CRUD:**
- [x] `GET /teams/:id/members/:memberId` — full member detail with computed stats — 2026-05-25
- [x] `POST /teams/:id/members` — add existing registered user by `userId` (admin only) — 2026-05-25
- [x] `PATCH /teams/:id/members/:memberId` — update display name, color, icon, role (admin for role; self for own name/color/icon) — 2026-05-25
- [x] `DELETE /teams/:id/members/:memberId` — remove from team; reject if last admin — 2026-05-25
- [x] `POST /teams/:id/members/:memberId/archive` — inactivate member (set `archived_at`) — 2026-05-25
- [x] `POST /teams/:id/members/:memberId/unarchive` — reactivate member (clear `archived_at`) — 2026-05-25

**API — participant CRUD:**
- [x] `POST /teams/:id/participants` — create login-less participant (admin only); name, icon, color, optional email — 2026-05-25
- [x] Participants managed via same PATCH/DELETE member endpoints (role always `member`, `user_id` stays NULL) — 2026-05-25

**API — invites:**
- [x] `GET /teams/:id/invites` — list pending invites (email, sent date) — 2026-05-25
- [x] `DELETE /teams/:id/invites/:inviteId` — revoke/cancel pending invite — 2026-05-25
- [x] `POST /teams/:id/invite-link` — generate or regenerate reusable team invite link token — 2026-05-25
- [x] `GET /teams/:id/invite-link` — get current invite link (or null) — 2026-05-25
- [x] `DELETE /teams/:id/invite-link` — revoke current invite link — 2026-05-25
- [x] Update `POST /auth/register` to accept reusable invite link tokens alongside existing one-time tokens — 2026-05-25

**API — member stats (computed per request, not stored):**
- [x] Timeline counts: active, archived (per member) — 2026-05-25
- [x] Activity counts: past due, running, upcoming, unscheduled, archived (date-relative, not status-relative) — 2026-05-25

**API — superadmin actions:**
- [x] `POST /users/:id/promote` — set `is_superadmin = true` (superadmin only, not applicable to participants) — 2026-05-25
- [x] `POST /users/:id/archive` — inactivate user account (superadmin only) — 2026-05-25
- [x] `POST /users/:id/unarchive` — reactivate user account (superadmin only) — 2026-05-25
- [x] `DELETE /users/:id` — hard delete user (superadmin only; zero active activities + single team only) — 2026-05-25
- [x] Auth middleware: reject login from archived users with clear error — 2026-05-25

**OpenAPI + types:**
- [x] Add `MemberDetail` schema with stats, teams list, archived_at — 2026-05-25
- [x] Add invite link endpoints to spec — 2026-05-25
- [x] Add superadmin action endpoints to spec — 2026-05-25
- [x] Update `TeamMember` schema with `archivedAt` — 2026-05-25
- [x] Regenerate TypeScript types — 2026-05-25

**Web — Team Modal Members tab:**
- [x] Search/add input: search users by name/email, or type email to invite; clear button — 2026-05-25
- [x] Search results dropdown: user matches with "Add" / "Already added" / "Invite pending"; email-only with "Invite" — 2026-05-25
- [x] Participant creation: expandable inline form — identity picker (circle), name (required), optional email, "Create participant" button (amber) — 2026-05-25
- [x] Member list: avatar (dashed border for stubs), name, "No login" pill (stubs, amber), email, `<RoleDropdown>`, remove (×) — 2026-05-25
- [x] `<RoleDropdown>`: Admin (teal), Member (muted), Participant (amber) — with descriptions; portal-rendered; role changes save immediately — 2026-05-25
- [x] Pending invitations section: rows with dashed-circle mail icon, email, sent date, "Revoke" button (red) — 2026-05-25
- [x] Invite link section: URL display + "Copy link" button (teal transition to "Copied!"), explanatory note below — 2026-05-25
- [x] Member count badge on Members tab label — 2026-05-25

**Web — Member Edit Modal (`<MemberModal>`):**
- [x] Modal shell: portal, backdrop, 560px panel, header / scrollable content / footer — 2026-05-25
- [x] Header: `<IdentityPicker>` (40px circle), subline (participant/team member + viewer role label), name + badges ("No login" amber) — 2026-05-25
- [x] Name + email row: 2-column grid; email read-only for participants ("No email — participant" placeholder) — 2026-05-25
- [x] Timeline stats: 2 chips — Active (teal border), Archived (muted border) — 2026-05-25
- [x] Activity stats: 5 chips — Past due (red if >0), Running (teal), Upcoming (blue), Unscheduled (muted), Archived (muted) — 2026-05-25
- [x] Joined date: read-only pill with icon — 2026-05-25
- [x] Teams list: each row with team badge (square, initials), team name, role pill — 2026-05-25
- [x] Account section (team admin + non-participant): password reset button — shows "SMTP not configured" until Phase 14 — 2026-05-25
- [x] Super Admin actions section (superadmin viewer only): Promote to Super Admin button (indigo), Inactivate (amber) / Delete (red) based on deletability — 2026-05-25
- [x] Promote confirmation dialog: indigo icon, title, body, Cancel + Promote — 2026-05-25
- [x] Inactivate confirmation dialog: amber icon, title, body, Cancel + Inactivate — 2026-05-25
- [x] Delete confirmation dialog: red icon, title, body, Cancel + Delete — 2026-05-25
- [x] Footer: Cancel + Save changes (member identity color) — 2026-05-25
- [x] Deletable rule: zero active activities AND single team membership — 2026-05-25
- [x] Role permission matrix enforcement: team admin vs superadmin capability differences — 2026-05-25

**Web — sidebar integration:**
- [x] Member rows: gear icon on hover → opens `<MemberModal>` for that member — 2026-05-25
- [x] Inactivated members: reduced opacity — 2026-05-25

**Testing & verification:**
- [x] `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean — 2026-05-25
- [ ] Manual: add user, invite email, create participant, change roles, remove member
- [ ] Manual: generate invite link, copy, register new user via link
- [ ] Manual: Member Modal shows correct stats, admin actions work with confirmations
- [ ] Manual: inactivated user cannot log in; reactivation restores access
- [x] `docs/log.md` Phase 10.1.2 entry written — 2026-05-25

---

### Settings — Profile, Tokens & Admin (Phase 10.1.3)
Builds out the `/settings` page into a working settings experience. Users get profile + identity management, security (password change), preferences, and API token management. Superadmins get SMTP config, instance defaults, and an orphaned-users view. Also ships forgot-password flow.

**Design reference:** `docs/design/handoffs/settings-modal.zip` — directional prototype. Using the visual language (sidebar nav, field styling, token palette) but as a full page (existing `/settings` route), not a modal. Skipping Notifications panel (no infrastructure), Organization panel (multi-tenant concept doesn't apply), Billing panel (self-hosted), and Sessions section (JWTs are stateless). Security panel scoped to password change only.

**Schema (migration 010):**
- [x] Add `color TEXT` and `icon TEXT` columns to `users` table — user-level identity — 2026-05-26
- [x] Create `instance_settings` table (`key TEXT PRIMARY KEY`, `value TEXT`, `updated_at DATETIME`) — 2026-05-26
- [x] Create `password_reset_tokens` table (`id TEXT PK`, `user_id TEXT FK`, `token_hash TEXT`, `expires_at DATETIME`, `used_at DATETIME`, `created_at DATETIME`) — 2026-05-26
- [x] Update `migrations_test.go` to assert new columns and tables — 2026-05-26

**API — profile management:**
- [x] `PATCH /users/me` — update `display_name`, `color`, `icon`; validate non-empty name; trim whitespace — 2026-05-26
- [x] Identity propagation: when color/icon changes, update all `team_members` rows for the user where the member's value matches the user's old value or is NULL — 2026-05-26
- [x] Add `UpdateProfile` repo method with propagation logic — 2026-05-26
- [x] Test: happy path — name change persists; color change propagates to team_members — 2026-05-26
- [x] Test: error path — empty name returns 400 — 2026-05-26

**API — password change:**
- [x] `PUT /users/me/password` — requires `{ currentPassword, newPassword }`; verify current hash; update; return 200 — 2026-05-26
- [x] Return 401 `WRONG_PASSWORD` on mismatch; 400 `WEAK_PASSWORD` if < 8 chars — 2026-05-26
- [x] Test: happy path — password changed — 2026-05-26
- [x] Test: error path — wrong current password returns 401 — 2026-05-26

**API — forgot password:**
- [x] `POST /auth/forgot-password` — accepts `{ email }`; generate 1-hour reset token; store hash in `password_reset_tokens`; send email via mailer if configured; always return 200 — 2026-05-26
- [x] `POST /auth/reset-password` — accepts `{ token, newPassword }`; validate token not expired/used; hash new password; update user; mark token used; return 200 — 2026-05-26
- [x] Return 400 `TOKEN_INVALID` or `TOKEN_EXPIRED` on bad/expired token — 2026-05-26
- [x] Test: invalid token returns TOKEN_INVALID — 2026-05-26
- [x] Test: forgot-password always returns 200 (no enumeration) — 2026-05-26

**API — SMTP configuration (superadmin only):**
- [x] Internal `mailer` package (`internal/mailer/`): wraps `net/smtp`; reads config from `instance_settings` at send time; exposes `Send(to, subject, htmlBody) error` and `IsConfigured() bool` — 2026-05-26
- [x] `GET /admin/smtp` — return current SMTP config with password masked; 403 if not superadmin — 2026-05-26
- [x] `PUT /admin/smtp` — upsert config (host, port, username, password, from_name, from_email, encryption); validate by sending test email to caller; 403 if not superadmin — 2026-05-26
- [x] `POST /admin/smtp/test` — send test email without saving; 403 if not superadmin — 2026-05-26
- [x] `DELETE /admin/smtp` — clear SMTP config; 403 if not superadmin — 2026-05-26
- [ ] SMTP password encrypted at rest (currently stored as JSON in instance_settings; encryption deferred)
- [x] Test: 403 for non-superadmin on admin settings endpoints — 2026-05-26

**API — instance settings (superadmin only):**
- [x] `GET /admin/settings` — return all instance settings (registration_policy, default_timezone, default_date_format, default_week_start); 403 if not superadmin — 2026-05-26
- [x] `PATCH /admin/settings` — update one or more settings; validate values; 403 if not superadmin — 2026-05-26
- [ ] Test: set registration_policy to "open" → registration without invite succeeds (manual only)

**API — orphaned users (superadmin only):**
- [x] `GET /admin/users` — return all users with team membership count and status; support `?orphaned=true` filter; 403 if not superadmin — 2026-05-26
- [x] Test: superadmin can list all users — 2026-05-26

**OpenAPI + types:**
- [x] Add `PATCH /users/me` to spec (UpdateProfile request/response) — 2026-05-26
- [x] Add `PUT /users/me/password` to spec (ChangePassword request/response) — 2026-05-26
- [x] Add `POST /auth/forgot-password` and `POST /auth/reset-password` to spec — 2026-05-26
- [x] Add `GET/PUT/DELETE /admin/smtp` and `POST /admin/smtp/test` to spec — 2026-05-26
- [x] Add `GET/PATCH /admin/settings` to spec — 2026-05-26
- [x] Add `GET /admin/users` to spec — 2026-05-26
- [x] Regenerate TypeScript types — 2026-05-26

**Web — Settings page layout:**
- [x] Rework `SettingsPage.tsx`: sidebar nav with grouped nav items, active state styling — 2026-05-26
- [x] Route structure: `/settings/profile`, `/settings/security`, `/settings/preferences`, `/settings/tokens`, `/settings/admin` (superadmin only) — 2026-05-26
- [x] Admin nav items hidden for non-superadmin users — 2026-05-26
- [x] Sub-route content renders in right panel with title + subtitle header pattern — 2026-05-26

**Web — Profile (`/settings/profile`):**
- [x] Display name field with save button; calls `PATCH /users/me` — 2026-05-26
- [x] Identity picker (reuse `IdentityWidget` from 9.6): color + icon selection; changes call `PATCH /users/me` with new color/icon — 2026-05-26
- [x] Identity badge preview (avatar at current color/icon) — 2026-05-26
- [x] Email shown read-only with explanatory note ("Email changes are not yet supported") — 2026-05-26
- [x] Inline success/error feedback on save — 2026-05-26

**Web — Security (`/settings/security`):**
- [x] Change password form: current password, new password (min 8 chars), confirm new password — 2026-05-26
- [x] Validation: new + confirm must match; save disabled until valid — 2026-05-26
- [x] On success: show success message, clear form — 2026-05-26
- [x] On 401 WRONG_PASSWORD: show "Current password is incorrect" error — 2026-05-26
- [x] Calls `PUT /users/me/password` — 2026-05-26

**Web — Preferences (`/settings/preferences`):**
- [x] Regional section: timezone (IANA selector), date format dropdown, week starts on — 2026-05-26
- [x] Appearance section: theme toggle (Light / Dark / System) — 2026-05-26
- [x] All values read/written via existing `GET/PUT /users/me/preferences` endpoints — 2026-05-26
- [x] Theme change applies immediately — 2026-05-26
- [ ] Defaults section: default team/timeline dropdowns (deferred — requires loading teams/timelines)

**Web — API Tokens (`/settings/tokens`):**
- [x] Table: name, scope badge, last used (relative time or "Never"), created date, revoke button — 2026-05-26
- [x] Create form: name input + scope picker with descriptions (read-only / add / edit-own / edit-all) — 2026-05-26
- [x] On creation: one-time secret reveal with copy-to-clipboard button; close dismisses — 2026-05-26
- [x] Revoke: inline confirmation → `DELETE /tokens/:id` → remove from list — 2026-05-26
- [x] Empty state when no tokens exist — 2026-05-26

**Web — Admin: Instance (`/settings/admin`):**
- [x] Instance defaults form: default timezone, default week start — calls `PATCH /admin/settings` — 2026-05-26
- [x] Registration policy toggle: invite-only vs open — calls `PATCH /admin/settings` — 2026-05-26
- [x] Instance name field — 2026-05-26
- [x] Save button with inline success feedback — 2026-05-26

**Web — Admin: Email / SMTP (`/settings/admin`):**
- [x] SMTP form: host, port (2-column), username, password (masked with eye toggle), from name, from email (2-column), encryption dropdown — 2026-05-26
- [x] "Save SMTP settings" button → `PUT /admin/smtp` — 2026-05-26
- [x] "Send test email" button → `POST /admin/smtp/test`; transitions through Sending → Sent/Failed — 2026-05-26
- [x] Info note: "When SMTP is not configured, password resets and email invitations are unavailable" — 2026-05-26

**Web — Admin: Users (`/settings/admin`):**
- [x] Orphaned alert banner (when count > 0): warning-colored, count + "View" button — 2026-05-26
- [x] Tabs: "All (N)" / "Orphaned (N)" — segmented control — 2026-05-26
- [x] Search input: filter by name or email — 2026-05-26
- [x] User rows: avatar, name, email, team count, status badge — 2026-05-26
- [ ] Click user row → opens existing `MemberModal` (deferred — requires passing modal state up)
- [ ] Orphaned users: "Assign team" action (deferred)

**Web — Forgot password flow:**
- [x] `/forgot-password` public page: email input → shows "If an account exists, a reset link has been sent" — 2026-05-26
- [x] `/reset-password?token=...` public page: new password + confirm → success redirects to `/login` — 2026-05-26
- [x] Login page: "Forgot password?" link below the password field — 2026-05-26
- [ ] When SMTP not configured: `/forgot-password` shows "contact admin" (deferred — requires public SMTP status endpoint)

**Testing & verification:**
- [x] `golangci-lint run` clean — 2026-05-26
- [x] `go test ./...` passes — 2026-05-26
- [x] `pnpm --filter web lint` clean — 2026-05-26
- [ ] Manual: change display name → visible in sidebar and team member lists after refresh
- [ ] Manual: change identity color/icon → propagated to team memberships; visible on Gantt bars
- [ ] Manual: change password → old password rejected, new password works
- [ ] Manual: forgot-password → email received → click link → set new password → login works
- [ ] Manual: create API token → secret shown once → copy → use in curl → works; revoke → rejected
- [ ] Manual: configure SMTP → test email arrives → save persists across restart
- [ ] Manual: set instance defaults → values persist
- [ ] Manual: view all users; filter orphaned
- [ ] Manual: toggle registration policy → test with/without invite
- [ ] Manual: non-superadmin does not see admin sections
- [x] `docs/log.md` Phase 10.1.3 entry written — 2026-05-26

---

### Member Access & Data Lifecycle (Phase 10.1.4)
Closes data-integrity and access-revocation gaps from 10.1.2. Protects historical activity data, defines the three membership lifecycle states, and gives superadmins a single "revoke all access" action.

**Schema (migration 011):**
- [x] Verify `activity_assignments.team_member_id` FK has `ON DELETE RESTRICT`; add explicit constraint in migration if missing — 2026-05-27
- [x] Same check for `timeline_access.team_member_id` — 2026-05-27
- [x] Enable `PRAGMA foreign_keys = ON` in DB initialization (`internal/db/`) — already set since early phases — 2026-05-27
- [x] Update `migrations_test.go` to assert FK pragma is on and both FKs are RESTRICT — 2026-05-27

**API — removal guard:**
- [x] `DELETE /teams/:id/members/:memberId` — count `activity_assignments` before deleting; if count > 0, return 409 `MEMBER_HAS_ASSIGNMENTS` with `{ "assignmentCount": N }` — 2026-05-27
- [x] Zero-assignment removal continues to hard-delete as before (deletes timeline_access first due to RESTRICT FK) — 2026-05-27
- [x] Add `MemberHasAssignments` error handling to OpenAPI spec via `RevokeUserResult` and inline error response — 2026-05-27

**API — full revoke (superadmin only):**
- [x] `POST /users/:id/revoke` — new endpoint; superadmin only; atomically: set `users.archived_at`, set `archived_at` on all `team_members` for the user, hard-delete `team_members` rows where assignment count is 0; return `{ accountDeactivated: bool, membershipsInactivated: int, membershipsRemoved: int }` — 2026-05-27
- [x] Add `RevokeUser` repo method: wraps the three steps in a transaction — 2026-05-27
- [x] 403 if caller is not superadmin; 404 if user not found — 2026-05-27
- [x] Add `POST /users/{id}/revoke` to OpenAPI spec; regenerate TypeScript types — 2026-05-27

**Web — TeamModal Members tab:**
- [x] On 409 `MEMBER_HAS_ASSIGNMENTS` from the remove (×) button, show inline error beneath the member row: "N assignment(s) — [Inactivate instead]" where the bracketed link calls `POST /teams/:id/members/:memberId/archive` — 2026-05-27
- [x] On inactivate success from the inline error, dismiss the error and re-fetch the member list — 2026-05-27
- [x] Clear the inline error before each new removal attempt for the same member — 2026-05-27

**Web — MemberModal:**
- [x] Add "Revoke all access" button to Super Admin Actions section (red, below Delete) — 2026-05-27
- [x] Button hidden when user is already fully inactivated (`users.archived_at` set) — 2026-05-27
- [x] Confirmation dialog: lists all three effects (account deactivated, memberships inactivated, zero-history memberships removed) — 2026-05-27
- [x] On confirm: call `POST /users/:id/revoke`; on success show a summary chip for 2s, then close modal — 2026-05-27
- [x] Invalidate `['teams']` query cache on success — 2026-05-27

**Testing & verification:**
- [ ] Manual: remove a member with assignments → 409; inline error appears; "Inactivate instead" button works
- [ ] Manual: remove a member with zero assignments → success
- [ ] Manual: superadmin uses "Revoke all access" → account deactivated; user can no longer log in; existing Gantt bars still show their avatar name
- [ ] Manual: inactivated members' avatars still render on Gantt bars (data preserved)
- [x] `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean — 2026-05-27
- [x] `docs/log.md` Phase 10.1.4 entry written — 2026-05-27

---

### Status Templates & Timeline Statuses (Phase 10.2)
API + UI bundled. Required before Phase 11.3 (Kanban). Depends on 10.1.2 (Members).

**Schema (migration 012):**
- [x] Create `status_templates` (team-level), `status_template_items`, `statuses` (timeline-level) tables — 2026-05-27
- [x] Rebuild `activities` table so `status_id` references `statuses` instead of `team_statuses`; drop `team_statuses` — 2026-05-27
- [x] Update `migrations_test.go` — 2026-05-27

**Go API:**
- [x] `StatusTemplate`, `StatusTemplateItem`, `Status` models — 2026-05-27
- [x] `StatusRepo`: list/get/create/update/delete templates; list/get/create/update/delete items; `SeedDefaultTemplate`; `CopyTemplateToTimeline` — 2026-05-27
- [x] `handleCreateTeam` — seeds "Simple" template (Planned / In Progress / Done) on team creation — 2026-05-27
- [x] `handleCreateTimeline` — copies first template's items into live statuses on timeline creation — 2026-05-27
- [x] `GET /teams/:id/status-templates` — list templates with items — 2026-05-27
- [x] `POST /teams/:id/status-templates` — create template — 2026-05-27
- [x] `PATCH /status-templates/:id` — rename, reorder — 2026-05-27
- [x] `DELETE /status-templates/:id` — blocked if last template on team — 2026-05-27
- [x] `POST /status-templates/:id/items` — add item — 2026-05-27
- [x] `PATCH /status-template-items/:id` — rename, recolor, reicon, toggle is_closed, reorder — 2026-05-27
- [x] `DELETE /status-template-items/:id` — blocked if last item in template — 2026-05-27
- [x] `GET /teams/:id/timelines/:timelineId/statuses` — list statuses for a timeline — 2026-05-27

**OpenAPI + types:**
- [x] `StatusTemplate`, `StatusTemplateItem`, `Status` schemas + input types — 2026-05-27
- [x] All new endpoint paths — 2026-05-27
- [x] Regenerate TypeScript types — 2026-05-27

**Web:**
- [x] `useStatusTemplates.ts` — hooks for all status template and statuses endpoints — 2026-05-27
- [x] `StatusTemplatesTab.tsx` — template list with expandable item rows, inline editing, color picker, is_closed toggle, add/delete guards — 2026-05-27
- [x] `TeamModal.tsx` — "Status Templates" tab added (locked until team saved) — 2026-05-27

**Testing & verification:**
- [x] `status_handler_test.go` — default seeding, admin-only create, last-template guard, item add/delete, statuses copied to timeline — 2026-05-27
- [x] `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean — 2026-05-27
- [ ] Manual: new team gets "Simple" template; open TeamModal → Status Templates tab shows Planned / In Progress / Done
- [ ] Manual: create second template, add items, rename/recolor items
- [ ] Manual: delete non-last template → success; delete last template → blocked with 409
- [ ] Manual: create timeline → GET statuses returns 3 rows matching Simple template
- [x] `docs/log.md` Phase 10.2 entry written — 2026-05-27

---

### Timelines — Full CRUD (Phase 10.3)
Closes the Timelines cornerstone. Today timelines can be created in the wizard and never managed afterward; access lists exist in schema but have no CRUD endpoints.

**API — timeline-level:**
- [x] `PATCH /timelines/:id` — rename, change start/end date, color, icon (team or timeline admin) — 2026-05-27
- [x] `DELETE /timelines/:id` — hard delete; team admin only — 2026-05-27
- [x] Archive endpoints already in Phase 9

**API — timeline statuses (editing):**
- [x] `POST /teams/:id/timelines/:timelineId/statuses` — add a status — 2026-05-27
- [x] `PATCH /statuses/:id` — rename, recolor, reicon, toggle is_closed, reorder — 2026-05-27
- [x] `DELETE /statuses/:id` — requires replacementStatusId if activities reference it; blocked if last status — 2026-05-27

**API — access list:**
- [x] `GET /teams/:id/timelines/:timelineId/access` — list current grants (team member + role) — 2026-05-27
- [x] `PUT /teams/:id/timelines/:timelineId/access/:memberId` — grant or update role (admin / member) — 2026-05-27
- [x] `DELETE /teams/:id/timelines/:timelineId/access/:memberId` — revoke grant — 2026-05-27

**Web:**
- [x] "New timeline" affordance in the sidebar timelines list → `TimelineModal` in create mode (name, date range, identity, template preview) — 2026-05-27
- [x] Edit-timeline modal from the sidebar gear icon: rename, change date range, identity, archive, delete — 2026-05-27
- [x] `TimelineModal` Statuses tab: add/edit/delete live statuses; delete-with-replacement dialog — 2026-05-27
- [x] `TimelineModal` Access tab: search-pick team members, role toggle, remove — 2026-05-27
- [x] Archived timelines under a collapsed "Archived" group in the sidebar; Restore button for unarchive — 2026-05-27
- [x] Activity detail panel: status dropdown populated from live timeline statuses — 2026-05-27
- [x] "Hide closed" toggle in GanttToolbar (shown when timeline has closed statuses) — 2026-05-27
- [x] `TimelineAccessEntry` model + `TimelineStore` interface expanded; `canAdminTimeline` helper — 2026-05-27

**Testing & verification:**
- [x] `TestUpdateTimeline_AdminCanRename`, `TestUpdateTimeline_NonAdminForbidden` — 2026-05-27
- [x] `TestDeleteTimeline_AdminCanDelete`, `TestDeleteTimeline_NonAdminForbidden` — 2026-05-27
- [x] `TestTimelineAccessList_GrantAndRevoke` — 2026-05-27
- [x] `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean — 2026-05-27
- [ ] Manual: create second timeline from sidebar → modal opens → create → new timeline appears
- [ ] Manual: edit timeline name, date range → save → sidebar reflects changes
- [ ] Manual: add/edit/delete statuses via Statuses tab → activity detail panel shows updated list
- [ ] Manual: grant/revoke member access via Access tab → member can/cannot access timeline
- [ ] Manual: archive timeline → disappears from active list → appears in Archived → Restore restores it
- [ ] Manual: delete timeline → confirm → gone from sidebar
- [ ] Manual: hide-closed toggle hides activities with closed status; unchecking restores them
- [x] `docs/log.md` Phase 10.3 entry written — 2026-05-27

---

### Preference Consumption & Session Handling (Phase 10.4.1)
Wires user and instance preferences (stored in 10.1.3) into views. Fixes the broken session lifecycle (access tokens expire after 15 min with no refresh interceptor). Adds cosmetic branding for admins.

**Session lifecycle:**
- [x] Add 401 interceptor to `apiFetch` (`packages/web/src/lib/api.ts`): on 401, attempt silent refresh via stored refresh token, retry original request; if refresh also fails, clear tokens and redirect to `/login`
- [x] Mutex/queue so concurrent 401s don't fire multiple refresh calls
- [x] Invisible to user — no toast, no banner (standard SPA pattern)

**Preference consumption:**
- [x] Create `useFormatDate()` hook — reads user's `date_format` preference, returns a formatter
- [x] Gantt `granularity.ts` `formatLabel()`: replace hardcoded `en-US` with user's date format preference
- [x] Gantt `granularity.ts` `startOfWeek()`: replace hardcoded Monday with user's `week_start` preference; Gantt columns align to user's chosen start day
- [ ] `ActivityDetailPanel` and other date displays: consume date format preference (date inputs are native browser — no explicit text formatting needed until a read-only date display surface is added)
- [ ] Public/shared timeline views: fall back to instance-level defaults when no user is logged in (deferred — shared views ship in Phase 13)
- [x] Theme: sync server-side preference on login (`useDarkMode.ts` — added `applyTheme`; `ThemeSync` component applies server value on auth init)

**Admin — branding (`/settings/admin`):**
- [x] Instance name field (stored in `instance_settings`); shown in browser tab title and login page
- [x] Accent color override (stored in `instance_settings`); applies globally via CSS custom property
- [ ] Optional logo upload (stretch — deferred)

---

### Activity Schema Normalization — Drop team_id (Phase 10.4.2)
Removes `activities.team_id` (redundant now that `timeline_id` is stored). Hardens `timeline_id` to NOT NULL. Moves activity routes to `/teams/{id}/timelines/{timelineId}/activities` (team-scoped prefix avoids Go 1.22 mux conflict with `GET /timelines/share/{token}`).

**Schema (migration 015):**
- [x] Backfill NULL `timeline_id` rows (assign to team's oldest timeline) — 2026-05-28
- [x] Rebuild `activities` table without `team_id`, with `timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE` — 2026-05-28
- [x] Recreate `idx_activities_timeline_id` on the new table — 2026-05-28

**API — Go:**
- [x] `models.Activity`: remove `TeamID` field; change `TimelineID` from `*string` to `string` — 2026-05-28
- [x] `ActivityRepo.Create`: remove `team_id` from INSERT — 2026-05-28
- [x] `ActivityRepo.ListByTeam` → `ListByTimeline(timelineID string, ...)`: query becomes `WHERE timeline_id = ?` — 2026-05-28
- [x] `handleCreateActivity`, `handleListActivities`: path params are `teamId` + `timelineId`; look up timeline to verify ownership — 2026-05-28
- [x] `handleUpdateActivity`, `handleDeleteActivity`, `handleArchive/Unarchive`: replace `activity.TeamID` with timeline lookup — 2026-05-28
- [x] WebSocket broadcasts: derive `TeamID` from timeline lookup — 2026-05-28
- [x] Move activity routes: `POST /teams/{id}/timelines/{timelineId}/activities`, `GET /teams/{id}/timelines/{timelineId}/activities` — 2026-05-28

**OpenAPI + types:**
- [x] Update `Activity` schema: replace `teamId` with `timelineId` (required, non-nullable) — 2026-05-28
- [x] Update activity endpoints to new team-scoped path — 2026-05-28
- [x] Regenerate TypeScript types — 2026-05-28

**Frontend:**
- [x] Rename `useTeamActivities` → `useTimelineActivities(teamId, timelineId, from, to)` — cache key `['timelines', timelineId, 'activities']` — 2026-05-28
- [x] `useCreateActivity(teamId, timelineId)`: URL becomes `/teams/${teamId}/timelines/${timelineId}/activities`; no `timelineId` in request body — 2026-05-28
- [x] `useUpdateActivity(timelineId)`, `useDeleteActivity(timelineId)`: cache key updated — 2026-05-28
- [x] `useTeamActivitySync`: update cache key lookups to `['timelines', timelineId, 'activities']` — 2026-05-28
- [x] `GanttView`: use `useTimelineActivities`; `timelineId` prop is now required (not optional) — 2026-05-28
- [x] `ActivityCreatePanel`: `teamId` + `timelineId` passed to `useCreateActivity`; no `timelineId` in body — 2026-05-28
- [x] `ActivityDetailPanel`: `timelineId` required; passed to `useUpdateActivity`/`useDeleteActivity` — 2026-05-28
- [x] `DashboardPage`: updated GanttView/ActivityCreatePanel/ActivityDetailPanel prop signatures — 2026-05-28

**Tests:**
- [x] `activity_repo_test.go`: `makeActivity` uses `timelineID`; all `ListByTeam` calls → `ListByTimeline` — 2026-05-28
- [x] Added `TestActivityRepo_ListByTimeline_Filter` — 2026-05-28
- [x] `activity_handler_test.go`: `activityTestSetup` creates a timeline; all routes updated — 2026-05-28
- [x] `archive_test.go`, `revoke_user_test.go`, `team_handler_test.go`: create timeline before activity; use new routes — 2026-05-28
- [x] `user_repo_test.go`, `migrations_test.go`: activity INSERTs use `timeline_id` instead of `team_id` — 2026-05-28

**Testing & verification:**
- [x] `golangci-lint run` clean — 2026-05-28
- [x] `go test ./...` passes — 2026-05-28
- [x] `pnpm --filter web lint` clean — 2026-05-28
- [ ] Manual: Gantt view loads activities for the active timeline
- [ ] Manual: Creating an activity from the panel associates it with the correct timeline
- [ ] Manual: `PRAGMA foreign_key_check` returns no rows after migration on Docker DB

---

### UI Consistency — Modals, Sidebar & Toolbar (Phase 10.4.3) [was mislabeled 10.4.2]
Standardizes visual patterns across TeamModal, MemberModal, TimelineModal, sidebar, and Gantt toolbar. Eliminates three different inline-editing patterns, three different archive button styles, three different confirmation dialog implementations, and mixed hardcoded hex colors vs CSS variables.

**Inline name editing (3 → 1):**
- [x] Extract shared `InlineEditableTitle` component: always-input with subtle bottom border on hover/focus — 2026-05-28
- [x] Replace `MemberModal.tsx` name editing (focus underline pattern) with `InlineEditableTitle` — 2026-05-28
- [x] Replace `TeamModal.tsx` name editing (toggle div/input state machine) with `InlineEditableTitle` — 2026-05-28
- [x] Replace `TimelineModal.tsx` name editing (no visual cue) with `InlineEditableTitle` — 2026-05-28

**Archive/restore buttons (3 → 1):**
- [x] Standardize archive button: amber bg+border+icon (aligned with MemberModal prominence) — 2026-05-28
- [x] Standardize restore button: teal bg+border+RotateCcw icon — 2026-05-28
- [x] Fix `TeamModal.tsx` archive button (was neutral gray) — 2026-05-28
- [x] Fix `TimelineModal.tsx` archive button (was border-only, no icon) — 2026-05-28

**Confirmation dialogs (3 → 1):**
- [x] Consolidate into shared `ConfirmDialog` component with color variants (red, amber, indigo, teal) — 2026-05-28
- [x] Replace `MemberModal.tsx` custom ConfirmDialog — 2026-05-28
- [x] Replace `TeamModal.tsx` ArchiveDialog — 2026-05-28
- [x] Replace `TimelineModal.tsx` inline confirmation panels — 2026-05-28

**Color system (mixed → CSS variables):**
- [x] Migrate `TeamModal.tsx` hardcoded hex colors to CSS variables — 2026-05-28
- [x] Migrate `MemberModal.tsx` hardcoded hex colors to CSS variables — 2026-05-28
- [x] Verified `TimelineModal.tsx` CSS variable usage is consistent — 2026-05-28

**Sidebar & toolbar audit:**
- [x] Sidebar member/timeline rows: Badge usage, hover states, gear icon consistency verified — 2026-05-28
- [x] Gantt toolbar controls: Tailwind + CSS vars, consistent with modal footer patterns — 2026-05-28
- [x] No inconsistencies requiring fixes found — 2026-05-28

---

### Gantt Interaction & Activity Edit Polish (Phase 10.4.4)

**Schema (migration 016):**
- [x] Add `notes TEXT` column to `activities` (nullable) — 2026-05-29

**Go API:**
- [x] `Activity` model: add `Notes *string` field — 2026-05-29
- [x] `ActivityRepo.Update`: include `notes` in UPDATE SET — 2026-05-29
- [x] `handleUpdateActivity`: parse `notes` from PATCH body — 2026-05-29

**OpenAPI + types:**
- [x] Add `notes` to `Activity` schema and PATCH body — 2026-05-29
- [x] Regenerate TypeScript types — 2026-05-29
- [x] Add `notes` to `UpdateActivityInput` patch type in `useTeamActivities.ts` — 2026-05-29

**Gantt — resizable activity column:**
- [x] Label column drag handle on right edge; min 140px, max 400px; live resize — 2026-05-29

**Gantt — click-to-activate before drag:**
- [x] Unselected bars show `cursor: pointer`; drag/resize only starts when bar is selected — 2026-05-29
- [x] Resize handles (left/right edge) visible only on selected bars — 2026-05-29

**Gantt — bar drag updates sidebar dates live:**
- [x] `onBarDragProgress` callback fires during mousemove with current snapped dates — 2026-05-29
- [x] `DashboardPage` stores `liveDragDates` and passes to `ActivityDetailPanel` — 2026-05-29
- [x] `ActivityDetailPanel` shows live dates in date inputs without triggering saves — 2026-05-29
- [x] `onBarDragEnd` callback clears live dates when drag completes — 2026-05-29

**Gantt — finer-grained snap during drag:**
- [x] `snapDivisorFor(granularity)`: day→1, week→7, month→4, quarter→3, year→4 — 2026-05-29
- [x] `colFracToDate` interpolates fractional column positions for accurate date mapping — 2026-05-29
- [x] Drag mousemove uses `Math.round(x / step) * step` with finer step — 2026-05-29
- [x] `resolvedGranularity` prop passed from GanttView → GanttGrid — 2026-05-29

**Gantt — "Hide closed" moves to filter preset:**
- [x] Remove `hideClosed` checkbox and props from `GanttToolbar` — 2026-05-29
- [x] Add `'open'` preset to `FilterDropdown` ("Open only — Hide activities with a closed status") — 2026-05-29
- [x] Add `'open'` to `ActiveFilter` preset type in `FilterContext` — 2026-05-29
- [x] `GanttView` reads `activeFilter.id === 'open'` to activate closed-status filtering — 2026-05-29
- [x] Remove `hideClosed` state from `DashboardPage` — 2026-05-29

**Activity Edit Sidebar — layout and field changes:**
- [x] Remove "All day" checkbox — 2026-05-29
- [x] Remove human-readable date summary line — 2026-05-29
- [x] Move Description field directly below date pickers — 2026-05-29
- [x] Restyle Assigned To with bordered card style matching create panel — 2026-05-29
- [x] Status dropdown: replaced plain `<select>` with rich dropdown (color dot + name + CLOSED badge) — 2026-05-29
- [x] Remove "Identity" line from Classify section — 2026-05-29
- [x] Rename "Details" → "Advanced" — 2026-05-29
- [x] Add Notes textarea (multi-line, resizable) backed by new `notes` column — 2026-05-29

**Testing & verification:**
- [x] `golangci-lint run` clean — 2026-05-29
- [x] `go test ./...` passes — 2026-05-29
- [x] `pnpm --filter web lint` clean — 2026-05-29
- [ ] Manual: drag label column edge → width changes and persists during session
- [ ] Manual: click bar (unselected) → selects it; second drag moves/resizes it
- [ ] Manual: drag bar at week zoom → date tooltip shows day-level changes, not week-level
- [ ] Manual: drag bar at month zoom → snaps to week boundaries
- [ ] Manual: select "Open only" filter → closed-status activities hidden; clearing restores them
- [ ] Manual: edit panel shows only date pickers (no allDay, no date summary)
- [ ] Manual: description moves below dates; matches create panel layout
- [ ] Manual: assignees use bordered card style (colored border + tint when selected)
- [ ] Manual: status dropdown shows color dot + name; selection persists
- [ ] Manual: notes textarea saves and loads correctly
- [ ] Manual: bar drag → sidebar date inputs update live; stop drag → dates reset to server value

---

### Activity Tags, Parent & Progress Fields (Phase 10.4.5)
Replaces the three "coming soon" stubs in the activity edit panel with functional fields. Tags are normalized (team-scoped `tags` table). Parent and progress already had backend support; this phase adds the UI.

**Schema (migration 017):**
- [x] Create `tags` table: `id, team_id, name, color, created_by, created_at`; UNIQUE(team_id, name) — 2026-05-30
- [x] Rebuild `activity_tags`: drop old text-junction table, create normalized FK junction — 2026-05-30

**Go API:**
- [x] `Tag` model added to `models.go` — 2026-05-30
- [x] `Activity.TagIDs []string` field added (same `db:"-"` pattern as `AssignedMemberIDs`) — 2026-05-30
- [x] `TagRepo`: `Create`, `GetByID`, `ListByTeam`, `Update`, `Delete` — 2026-05-30
- [x] `ActivityRepo.SetTags` / `GetTags` — transaction pattern matching `SetAssignments` — 2026-05-30
- [x] `ActivityRepo.ListByTimeline`: batch-populates `TagIDs` via `sqlx.In` (same as `AssignedMemberIDs`) — 2026-05-30
- [x] `tag_handler.go`: `GET /teams/{id}/tags`, `POST /teams/{id}/tags`, `PATCH /tags/{id}`, `DELETE /tags/{id}` — 2026-05-30
- [x] `activity_handler.go`: `handleCreateActivity` and `handleUpdateActivity` accept `tagIds`; `setActivityArchive` populates `TagIDs` on response — 2026-05-30
- [x] `isUniqueConstraintError` helper added to `helpers.go` — 2026-05-30
- [x] `server.go`: `tags *db.TagRepo` field; tag routes registered — 2026-05-30
- [x] `main.go`: `db.NewTagRepo(database)` instantiated and passed to `NewServer` — 2026-05-30

**OpenAPI + types:**
- [x] `Tag` schema added to `openapi.yaml` — 2026-05-30
- [x] `tagIds` added to `Activity` schema and create/update request bodies — 2026-05-30
- [x] Regenerated TypeScript types — 2026-05-30

**Frontend:**
- [x] `useTags.ts`: `useTags`, `useCreateTag`, `useUpdateTag`, `useDeleteTag` hooks — 2026-05-30
- [x] `TagInput.tsx`: combobox with colored pills, autocomplete, create-on-the-fly — 2026-05-30
- [x] `ActivityDetailPanel`: Tags stub → `TagInput`; Parent stub → `<select>` from same-timeline activities; Progress stub → `<input type="range">`; tagIds/parentActivityId/percentComplete in state and save calls — 2026-05-30
- [x] `ActivityCreatePanel`: `TagInput` added (below Assignees); `tagIds` in create mutation — 2026-05-30
- [x] `GanttGrid`: progress fill overlay on bars (darker shade at `percentComplete%` width) — 2026-05-30
- [x] `vite.config.ts`: `/tags` proxy added — 2026-05-30

**Sample data:**
- [x] `sample_data/10_tags.sql`: 8 tags for Product Marketing team + activity_tag associations — 2026-05-30

**Tests:**
- [x] `tag_repo_test.go`: CRUD, unique constraint, SetTags/GetTags, ListByTimeline TagIDs population — 2026-05-30
- [x] `tag_handler_test.go`: create/list/update/delete happy paths, 409 duplicate, 404 not found, 403 non-member — 2026-05-30
- [x] All existing test files updated to pass `db.NewTagRepo(database)` to `NewServer` — 2026-05-30

**Testing & verification:**
- [x] `golangci-lint run` clean — 2026-05-30
- [x] `go test ./...` passes — 2026-05-30
- [x] `pnpm --filter web lint` clean — 2026-05-30
- [ ] Manual: create a tag in the activity detail panel; it appears in team tag list for future activities
- [ ] Manual: tag autocomplete shows existing team tags; typing a new name offers "Create" option
- [ ] Manual: tagged activity shows tag pills in the detail panel; pills persist across panel close/reopen
- [ ] Manual: set parent activity; verify it persists across reload
- [ ] Manual: drag the progress slider; Gantt bar shows progress fill; value persists
- [ ] Manual: create activity with tags from the create panel; tags appear in detail panel

---

### Filter Implementation (Phase 10.4.6)
Full filter system: filter definition language, client-side engine, all 6 presets wired, filter builder UI, team filter promotion, and management panel.

**Schema (migration 018):**
- [x] `ALTER TABLE saved_filters ADD COLUMN is_team_filter BOOLEAN NOT NULL DEFAULT 0` — 2026-05-30

**Backend:**
- [x] `SavedFilter` model: add `IsTeamFilter bool` — 2026-05-30
- [x] `SavedFilterRepo.Create`: include `is_team_filter` in INSERT — 2026-05-30
- [x] `SavedFilterRepo.Update`: include `is_team_filter` in UPDATE — 2026-05-30
- [x] `SavedFilterRepo.ListByTeamUser`: return user's own filters + all team filters (`is_team_filter = 1`) — 2026-05-30
- [x] `handleCreateSavedFilter`: accept `isTeamFilter` (admin-only to set true) — 2026-05-30
- [x] `handleUpdateSavedFilter`: admin can promote/demote; admin can edit name/def of existing team filters — 2026-05-30
- [x] `handleDeleteSavedFilter`: admin can delete team filters they don't own — 2026-05-30

**OpenAPI + types:**
- [x] Add `isTeamFilter` boolean to `SavedFilter` schema — 2026-05-30
- [x] Add `isTeamFilter` to `CreateSavedFilterJSONBody` and `PatchSavedFilterJSONBody` — 2026-05-30
- [x] Update `api_types.gen.go` manually with new fields — 2026-05-30
- [x] Regenerate TypeScript types (`pnpm --filter shared generate`) — 2026-05-30

**Frontend — filter engine:**
- [x] `lib/filterTypes.ts` — FilterDefinition type system (logic, conditions, operators per field type) — 2026-05-30
- [x] `lib/filterEngine.ts` — `matchesFilter(activity, filter, ctx)` pure function — 2026-05-30
- [x] `lib/presetFilters.ts` — `applyActiveFilter(activities, activeFilter, memberIdsByUserId, ctx)` — all 6 presets + member + saved filter kinds — 2026-05-30

**Frontend — GanttView wiring:**
- [x] Replace `closedStatusIds` prop with `timelineStatuses`, `savedFilters`, `tags` props — 2026-05-30
- [x] Derive `closedStatusIds`, `statusesByTimeline`, `memberIdsByUserId`, `currentUserMemberIds` inside GanttView — 2026-05-30
- [x] Replace old open-only filter with `applyActiveFilter` — makes all 6 presets + member + saved filters work — 2026-05-30

**Frontend — filter builder UI:**
- [x] `components/filters/FilterConditionRow.tsx` — field/op/value row with multi-select, text, number, date inputs — 2026-05-30
- [x] `components/filters/FilterEditor.tsx` — name input, AND/OR toggle, condition rows, Save/Delete/Cancel footer — 2026-05-30
- [x] `components/filters/FilterManagePanel.tsx` — My Filters + Team Filters sections with edit/delete/promote/demote — 2026-05-30

**Frontend — FilterDropdown updates:**
- [x] Partition saved filters into `teamFilters` and `myFilters` — 2026-05-30
- [x] Render "Team filters" section with real data (replacing stub) — 2026-05-30
- [x] Add "Manage filters" link at bottom of dropdown — 2026-05-30
- [x] Add `onOpenManager` prop — 2026-05-30

**Frontend — DashboardPage wiring:**
- [x] Add `useSavedFilters` and `useTags` hooks — 2026-05-30
- [x] Add `filterManageOpen` and `editingFilter` state — 2026-05-30
- [x] Wire `FilterEditor` and `FilterManagePanel` into `RightSidebar` — 2026-05-30
- [x] Pass `timelineStatuses`, `savedFilters`, `tags` to GanttView — 2026-05-30
- [x] Add `onOpenFilterManager` to `TopBar` — 2026-05-30
- [x] Update `useSavedFilters.ts`: add `isTeamFilter` to `UpdateSavedFilterInput` — 2026-05-30

**Tests:**
- [x] `lib/filterEngine.test.ts` — 20+ unit tests: each field type, each operator, AND/OR, edge cases, case-insensitive — 2026-05-30
- [x] `lib/presetFilters.test.ts` — 11 unit tests: each preset, member filter, saved filter delegation — 2026-05-30
- [x] `saved_filter_handler_test.go`: 5 new tests — team filter list includes team filters, admin can promote, non-admin cannot promote, admin can delete team filter, non-admin cannot — 2026-05-30
- [x] `migrations_test.go`: assert `is_team_filter` column exists after migration 018 — 2026-05-30
- [x] `golangci-lint run` clean; `go test ./...` all pass; `pnpm --filter web lint` clean; `pnpm --filter web build` clean — 2026-05-30

**Manual verification (Docker):**
- [ ] All 6 preset filters actually filter activities (open, upcoming, my, overdue, noassign, all)
- [ ] Member filter kind filters by assignee
- [ ] Filter builder: add/remove conditions, pick field/op/value for all supported fields, AND/OR toggle
- [ ] Save/load/edit/delete custom filters end-to-end
- [ ] Status conditions match by name across timelines
- [ ] Tag conditions match by tag name
- [ ] Team filter flag: admin promotes user filter → visible to all team members
- [ ] "Manage filters" panel accessible from dropdown
- [ ] `docs/log.md` Phase 10.4.6 entry written — 2026-05-30

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

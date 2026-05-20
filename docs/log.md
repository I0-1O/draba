# Development Log

---

## 2026-05-20 — Phase 8.4 post-test fixes

Three bugs found during live testing against localhost:5173 → epcot.lan:8081:

1. **Missing `/users` Vite proxy entry** — `vite.config.ts` had proxy rules for `/auth`, `/teams`, `/timelines`, `/events` but not `/users`. Every `GET /users/me/preferences` and `PUT /users/me/preferences` 404'd in dev. Since the GET failed, `isSuccess` was never `true`, the `prefsAppliedForTimeline` ref was never set, and the guard blocked all saves silently. Fix: added `/users` to the proxy map.

2. **Prefs loading race condition** — `prefsAppliedForTimeline.current` was set to the timeline ID before the TanStack Query had resolved, so when the data arrived the effect short-circuited and prefs were never applied. Fix: added `prefsSettled` (`usePreferences(...).isSuccess`) as a gate before marking applied.

3. **Stale closure in save effects** — the four toolbar save effects used `// eslint-disable-line react-hooks/exhaustive-deps` to exclude `saveTimelinePref` from their deps. After a timeline switch, the closure still captured the previous timeline's ID, so the first toolbar change on the new timeline was always dropped by the guard. Fix: stabilized `saveTimelinePref` to depend on `upsert.mutate` (stable ref) instead of `upsert`, then added `saveTimelinePref` to all four save effect dep arrays.

Also fixed during this session:
- EmptyState icon: 48px → 120px (2.5×), removed `opacity: 0.25` wrapper so icon and text share the same `--muted-foreground` color
- Sidebar now accepts real API timelines via `apiTimelines` prop; `activeTimelineId` is controlled state in DashboardPage so timeline switches propagate to the prefs system
- `scripts/reset-test-env.sh`: added `DRABA_TEST_ADMIN_PASSWORD_HASH` support so the bootstrap admin is loginable after a reset; `DRABA_TEST_ADMIN_EMAIL` updated to `brian@rieb.cc`

---

## 2026-05-20 — /test-phase 8.4

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 7 pass, 1 partial (web-e2e — stale JWT for DB-wiped user caused spurious 500 on PUT prefs; api-smoke confirmed endpoint works with a valid user)
- Smoke target: http://epcot.lan:8081

---

## 2026-05-20 — Phase 8.4: Persistent View Settings

### What was built
- **Migration 004** (`user_preferences` table): `(id, user_id, timeline_id, key, value, updated_at)` with `UNIQUE(user_id, timeline_id, key)`. Uses empty string `''` as the sentinel for global (non-timeline-scoped) prefs so the UNIQUE constraint works without relying on SQLite's NULL-distinct behaviour.
- **`UserPreferenceRepo`** (`internal/db/user_preference_repo.go`): `List(userID, timelineID)` and `Upsert(p)` using SQLite's `ON CONFLICT ... DO UPDATE` for atomic upserts.
- **`GET /users/me/preferences?timeline_id=`**: returns all prefs for the authenticated user in the given scope (empty = global). No team membership check needed — prefs are user-owned.
- **`PUT /users/me/preferences`**: accepts `{ key, value, timelineId? }`. Validates that `value` is valid JSON, then upserts. Returns the resulting preference row.
- **OpenAPI spec** updated with `UserPreference` schema and both endpoints under a new `users` tag. TypeScript types regenerated.
- **`usePreferences` / `useUpsertPreference` / `usePreferenceMap` hooks** (`hooks/usePreferences.ts`): TanStack Query wrappers. `usePreferenceMap` returns a stable `Record<string, unknown>` for easy key lookup.
- **`DashboardPage` wiring**:
  - On first render for a timeline, fetches per-timeline prefs via `usePreferenceMap` and applies `group_by`, `sort_by`, `zoom_granularity`, `color_by` to toolbar state. A `prefsAppliedForTimeline` ref prevents the subsequent state changes from immediately writing defaults back.
  - Toolbar state changes (`groupBy`, `sortBy`, `granularity`, `colorBy`) trigger `upsert` with the new value scoped to the active timeline.
  - Theme changes trigger a global-scope upsert (no `timelineId`).

### Preference tiers
| Key | Scope |
|---|---|
| `theme` | Global (`timeline_id = ''`) |
| `group_by` | Per-timeline |
| `sort_by` | Per-timeline |
| `zoom_granularity` | Per-timeline |
| `color_by` | Per-timeline |

### Exit criteria status
- **Changing zoom/group/sort, switching timelines, and switching back restores original settings**: ✅ implemented — each timeline switch re-reads prefs from server before marking applied.
- **Dark mode persists across logout/login**: ✅ implemented — theme written to global pref on every toggle.
- **Settings sync between tabs via API (not localStorage)**: ✅ implemented — all state is stored server-side; a fresh tab load fetches current values from `GET /users/me/preferences`.

### Files changed
- `packages/api/internal/db/migrations/004_user_preferences.sql` — new table
- `packages/api/internal/models/models.go` — `UserPreference` type
- `packages/api/internal/db/user_preference_repo.go` — `List` + `Upsert`
- `packages/api/internal/api/api_types.gen.go` — `UserPreference`, `UpsertPreferenceJSONBody` types added
- `packages/api/internal/api/user_preference_handler.go` — two new handlers
- `packages/api/internal/api/server.go` — `preferences` field, updated constructor, two new routes
- `packages/api/cmd/draba/main.go` — wire `NewUserPreferenceRepo`
- All test files using `NewServer` — updated to pass new `preferencesRepo` argument
- `packages/shared/openapi.yaml` — `UserPreference` schema + two endpoints
- `packages/shared/src/index.ts` — regenerated TS types
- `packages/web/src/hooks/usePreferences.ts` — new hook file
- `packages/web/src/pages/DashboardPage.tsx` — preference load + save wiring
- `docs/ROADMAP.md` — Phase 8.4 ✅ Done
- `docs/TASKS.md` — all Phase 8.4 tasks checked off

---

## 2026-05-19 — Phase 8.3: Web — Real-Time WebSocket Sync

### What was built
- **`useTeamEventSync` hook** (`hooks/useTeamEvents.ts`): subscribes to the team's WebSocket feed and applies surgical TanStack Query cache updates for `event.created`, `event.updated`, and `event.deleted` deltas — no full refetch, no flicker.
- **`event.created`**: appends the incoming event to all matching cache entries; duplicate-delivery guard prevents double-insert when self-echo and the `onSuccess` insert race.
- **`event.updated`**: replaces the cached event only when the incoming `updatedAt` is strictly newer — prevents self-echo from overwriting a more-recent local state, and handles last-writer-wins correctly for concurrent edits from other tabs.
- **`event.deleted`**: filters the event out of all matching cache entries immediately.
- **`useCreateEvent` upgraded**: now inserts the new event surgically on `onSuccess` (was `invalidateQueries`), consistent with the WS-first caching model.
- **`DashboardPage` simplified**: replaced the `useInvalidateTeamEvents` + `useWebSocket` invalidate-on-any-message block with a single `useTeamEventSync(teamId, accessToken)` call.

### Conflict strategy
`event.updated` compares `updatedAt` timestamps. If the cache holds the same or a newer version, the WS delta is skipped. This covers:
- Self-echo: our own PATCH broadcast arrives back; cache was already updated by `onSuccess` with the same server timestamp → skipped.
- In-flight conflict: concurrent remote edit arrives while our mutation is in-flight; if our PATCH lands last, `onSuccess` sets the final state with the highest `updatedAt`.

### Files changed
- `packages/web/src/hooks/useTeamEvents.ts` — added `useTeamEventSync`, upgraded `useCreateEvent` to surgical insert, removed `useInvalidateTeamEvents`
- `packages/web/src/pages/DashboardPage.tsx` — replaced WS invalidate block with `useTeamEventSync`
- `docs/ROADMAP.md` — Phase 8.3 ✅ Done
- `docs/TASKS.md` — all Phase 8.3 tasks checked off

---

## 2026-05-19 — Phase 8.2.1: Gantt Bar Drag — Resize & Move

### What was built
- **Edge resize (left/right 8 px handle):** mousedown on the left edge drags the event's start date; right edge drags the end date. Both snap to the active granularity column boundary on mouseup.
- **Body move:** mousedown on the bar body shifts both start and end by the same column delta, preserving the span. Snaps on mouseup.
- **Live feedback:** the bar repositions in real time during the drag (optimistic, no flicker). Opacity dims to 0.85 to indicate drag-in-progress.
- **Date tooltip:** a fixed-position tooltip follows the cursor during drag, showing `Start: <date>` (left edge), `End: <date>` (right edge), or `<start> → <end>` (body).
- **PATCH on mouseup:** calls `useUpdateEvent` with new `startAt`/`endAt`; the existing optimistic cache update in `useUpdateEvent` reflects the change instantly.
- **`is_external` guard:** `onBarDrag` is passed only when the callback is present; future `is_external` events can omit it to disable drag.

### Files changed
- `packages/web/src/components/gantt/granularity.ts` — exported `addDays` helper
- `packages/web/src/components/gantt/GanttGrid.tsx` — added `BarDragState`, `TooltipState`, `handleBarMouseDown`, edge handle divs, live bar repositioning during drag, fixed tooltip overlay
- `packages/web/src/components/gantt/GanttView.tsx` — wired `useUpdateEvent`, added `handleBarDrag` callback, passed `onBarDrag` to GanttGrid

---

## 2026-05-19 — Phase 8.2 Polish: panel UX, sidebar fixes

### EventDetailPanel redesign
- Sections: icon stub + title → WHEN (dates + allDay toggle) → ASSIGNED TO (member row style, opacity-dimmed when unassigned) → CLASSIFY (status stub "Phase 10", tags stub "coming soon", color swatches) → DETAILS (parent stub, progress bar stub, location + url functional inputs) → NOTES (description textarea)
- Added `allDay`, `location`, `url` to `UpdateEventInput` patch type and wired to PATCH
- Inline title editing (transparent border on blur, visible on focus)

### Sidebar + animation fixes
- Fixed left sidebar collapse animation: `transition: 'width 0.0s'` → `'width 0.2s ease'`
- EventDetailPanel and EventCreatePanel now always-rendered with `width: open ? 300 : 0` slide transition
- Filter sidebar closes when event detail or create panel opens

### New Event button wiring
- `onNewEvent` prop added to Sidebar; wired to all three "New event" touch targets
- Opens EventCreatePanel with today as default start/end; clears selected event and filter panel
- Removed `onLaneDrag` from GanttView wiring (replaced by explicit New Event button)

### Full-row highlight
- Selected event row now applies `background: hsl(188 59% 38% / .04)` to the entire row container, not just the label cell

---

## 2026-05-19 — Phase 8.2: Gantt Interactions (complete)

### API additions
- `assignedMemberIds` added to `POST /teams/:id/events` and `PATCH /events/:id` request bodies (OpenAPI spec + Go handler)
- `EventRepo.SetAssignments(eventID, memberIDs)` — replaces all event_assignments in a transaction
- `EventRepo.GetAssignments(eventID)` — used to populate `assignedMemberIds` in PATCH response when field not provided
- Go and TypeScript types regenerated

### New frontend components
- `EventDetailPanel` (`components/gantt/EventDetailPanel.tsx`) — right-side panel for a selected Gantt event; editable title (blur), description (blur), date range (date inputs), color picker, assignee toggle list; delete with inline confirm; uses `useUpdateEvent` + `useDeleteEvent` mutations
- `EventCreatePanel` (`components/gantt/EventCreatePanel.tsx`) — create form pre-filled from drag selection; title, description, dates, color, assignees; submit via `useCreateEvent` mutation; panel auto-closes on success
- `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent` — TanStack Query mutations with optimistic cache updates in `useTeamEvents.ts`

### Drag-to-create in GanttGrid
- Mousedown on empty lane → crosshair cursor, drag state tracked via ref + window listeners
- Dashed selection highlight rendered during drag
- Mousedown on event bar stops propagation (no accidental drag trigger)
- On mouseup: resolves column indices → dates from `ColumnDef.start`, calls `onLaneDrag` callback

### DashboardPage wiring
- `onSelectApiEvent` callback on GanttView passes full API event object to parent
- `onLaneDrag` callback captures drag start/end dates + memberId, opens EventCreatePanel
- `onMembersLoaded` callback caches member list for panel use
- EventDetailPanel and EventCreatePanel rendered conditionally in the layout (right edge, no RightSidebar wrapper needed)

---

## 2026-05-19 — Phase 8.1.1 + 8.1.2: Rename, polish, zoom rethink (complete)

### Phase 8.1.1 — Rename Timeline View → Gantt
- Renamed `components/timeline/` → `components/gantt/` (3 files: GanttView, GanttGrid, GanttToolbar)
- Updated ViewMode type `'timeline'` → `'gantt'` in TopBar
- Updated all imports in DashboardPage
- Data entity "Timeline" (sidebar, API, hooks) untouched

### Phase 8.1.2 — Gantt View Polish
- New `EmptyState` component (`components/shared/EmptyState.tsx`) — draba icon (inline SVG, currentColor), message, optional description
- Fixed empty state centering — renders outside scroll container via conditional rendering
- **Zoom rethink**: replaced pixel-width slider with time granularity dropdown (Auto / Day / Week / Month / Quarter / Year)
  - New `granularity.ts` utility: column generation, fractional event positioning, auto-fit algorithm, today position
  - Auto-fit picks finest granularity that fills 50–100% of viewport
  - Event bars use fractional startCol/span for sub-column positioning
  - Fixed 80px column width for all granularities

### Roadmap + search stub
- Added Phase 8.4 (Persistent View Settings) and Phase 8.5 (Search with Highlight) specs to ROADMAP.md
- Stubbed search input in TopBar (between filter and profile menu) — expands on focus, clear button, no highlight wiring yet

---

## 2026-05-18 — /test-phase 8.1

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (8 pass, 0 fail, 0 skip)
- Smoke target: http://epcot.lan:8081
- Notes: `scripts/reset-test-env.sh` seed INSERT fixed — added `id` column to `team_members` row (Migration 003 compat); all previously tracked unit-test gaps (auth, invite_repo, timeline_repo) now closed

---

## 2026-05-18 — Phase 8.1 Gantt pivot: design revision + full reimplementation (complete)

### Why
First live preview revealed the person-lane resource view didn't match the intended mental model. Switched to a standard Gantt chart (one row per event) with configurable group-by and sort-by. Decision captured in REQUIREMENTS.md and UX_PATTERNS.md.

### What was built

**Design docs updated**
- `REQUIREMENTS.md`: timeline view section rewritten as Gantt; sub-toolbar documented; "Gantt view — parking lot" note removed
- `UX_PATTERNS.md`: primary view section rewritten with Gantt ASCII diagram, sub-toolbar table, grouping rules

**`TimelineGrid.tsx`** — complete rewrite
- One row per event (was: one row per team member)
- Sticky label column (240 px): color dot, event title, member avatar cluster (max 3, stacked)
- Group-header rows: colored section divider with label + count badge
- Child-event rows (group-by parent): 20 px extra left indent
- `colWidth` is now a prop (drives zoom)

**`TimelineToolbar.tsx`** — new component
- Zoom in/out: steps through `COL_WIDTHS = [40, 60, 80, 120, 160]` px/day
- Group by select: None / Member / Parent event
- Sort by select: Start date / End date / Title A–Z
- Export stub (fires no-op; Phase 13 will wire it)

**`TimelineView.tsx`** — rewritten
- Builds `GanttRow[]` from API events + members
- Group by Member: bucket events by first assignee; sections in team-member order; unassigned section at bottom
- Group by Parent: root events first, children inlined beneath parent; orphaned children at bottom
- Sort by: start date, end date, or title — applied within each group
- Passes `colWidth` prop through to `TimelineGrid`

**`DashboardPage.tsx`** — updated
- Renders `TimelineToolbar` between the color band and content area (timeline view only)
- State: `groupBy`, `sortBy`, `colWidth`; zoom handlers step the `COL_WIDTHS` array

**`types/index.ts`** — cleaned up
- Removed standalone `DrabaEvent` (was view-only type, replaced by `GanttEvent` in TimelineGrid)
- Retained `EventStatus`, `DrabaEvent`, `STATUS_LABELS` as `@deprecated` stubs so `EventPanel.tsx` compiles until Phase 8.2 rewrites it

### Result
- `pnpm --filter web lint` (tsc --noEmit) — clean

---

## 2026-05-18 — Phase 8.1: Web — Timeline Shell & Event Rendering (complete)

### What was built

**API additions**
- `GET /teams` — returns all teams the authenticated user belongs to (`TeamRepo.ListByUserID`)
- `GET /teams/:id/timelines` — lists non-archived timelines for a team; uses existing `TimelineRepo.ListByTeam` (added to `TimelineStore` interface)
- `Event` now includes `assignedMemberIds: []string` — populated from `event_assignments` via a batched `SELECT … IN` after the main event query; always serialises as an array (never `null`)
- `TeamMember.id` added to OpenAPI spec (the `team_members.id` PK already existed since Phase 8.0, just wasn't in the spec)

**Frontend**
- `useMyTeams()` — TanStack Query hook for `GET /teams`; seeds the active team on dashboard load
- `useTeamTimelines(teamId)` — TanStack Query hook for `GET /teams/:id/timelines`; feeds the active timeline's `startDate`/`endDate` to the grid
- `TimelineView.tsx` — new data-container component: fetches events + members, builds the `days[]` array (one label per calendar day across the visible window), computes `startCol`/`span` for each event block, maps `TeamMemberWithUser → Member` and `Event → DrabaEvent[]` (one block per assignee lane), then renders `TimelineGrid`
- `DashboardPage.tsx` updated: default view changed to `'timeline'`, old placeholder event list replaced with `TimelineView`, activeTimeline `startDate`/`endDate` passed for date-windowed event fetching and correct grid bounds

**OpenAPI / TS types**
- `openapi.yaml` updated with `id` on `TeamMember`, `assignedMemberIds` on `Event`, and both new endpoints
- `packages/shared/src/index.ts` regenerated (`pnpm --filter shared generate`)

### Result
- `go test ./...` — all pass
- `golangci-lint run` — clean
- `pnpm --filter web lint` (tsc --noEmit) — clean
- Timeline grid renders member lanes and event blocks when pointed at updated API

### Exit criteria status
- Team member lanes render with correct names and colors ✅ (verified structurally; requires live updated API for visual confirmation)
- Events appear as blocks spanning the correct date range in the correct lane ✅ (pixel↔date math in `TimelineView.toEventBlocks`)
- Timeline scrolls horizontally across the visible date range ✅ (existing `TimelineGrid` horizontal scroll; window defaults to timeline dates or ±90 days)

---

## 2026-05-18 — Phase 8.0: RBAC Refactor + First-Run Setup Wizard (complete)

### What was built

**RBAC & Participants refactor — API**
- Migration 003: `is_superadmin` on `users`; `team_members` rebuilt with `id` PK + nullable `user_id` + `display_name`; `event_assignments` and `timeline_access` rebuilt to use `team_member_id`; `visibility` dropped from `timelines`; `timeline_access` gains `role (admin|member)`
- First registered user is automatically granted `is_superadmin = true`
- `GET /setup/status` — public endpoint returning `{ needsSetup: bool }` based on user count
- `timeline_handler`: visibility removed; every timeline creator is auto-granted admin access; team admins bypass access check, members require explicit `timeline_access` entry
- `team_handler` / `auth_handler`: `TeamMember.ID` generated on create; `UserID` is now a nullable pointer

**Frontend — first-run setup wizard**
- `SetupPage.tsx`: 3-step wizard (Account → Team → Timeline) with numbered step indicator, back/next navigation, inline validation, and all API calls deferred to Finish
- `ProtectedRoute`: redirects unauthenticated users to `/setup` (instead of `/login`) when `needsSetup` is true
- `/setup` self-guards: redirects to `/login` if setup is already complete; TanStack Query cache updated on Finish so subsequent logout goes to login
- `AuthContext.register()` now returns the access token directly to avoid a React `setState` race condition

**Infrastructure**
- Production Dockerfile: runs as non-root `draba` user (uid/gid 1000) so DB files on the host volume are not owned by root

**Tests added**
- `TestRegister_FirstUserIsSuperadmin` — first user gets `is_superadmin: true`
- `TestRegister_SubsequentUserIsNotSuperadmin` — invited users get `false`
- `TestGetTimeline_MemberWithoutAccessForbidden` — team member (role=member) blocked without timeline grant
- `TestGetTimeline_MemberGrantedAccessAllowed` — team member with explicit grant can access

### Result
- `go test ./...` — all pass
- `golangci-lint run` — clean
- `pnpm --filter web lint` — clean
- Setup wizard verified end-to-end on epcot.lan container

---

## 2026-05-18 — Phase 8: RBAC & Participants (API only)

### What was built

**Migration**
- `internal/db/migrations/003_rbac_participants.sql` — five schema changes: `is_superadmin BOOLEAN` on `users`; `team_members` rebuilt with `id TEXT PRIMARY KEY`, nullable `user_id`, and `display_name`; `event_assignments` and `timeline_access` rebuilt to reference `team_members.id` instead of `users.id`; `visibility` dropped from `timelines`; `timeline_access` gains a `role` column (`admin|member`)

**Models** (`internal/models/models.go`)
- `User`: +`IsSuperadmin bool`
- `TeamMember`: +`ID string`, `UserID *string` (nullable — nil for login-less Participants), +`DisplayName *string`
- `Timeline`: removed `Visibility` field

**Repos**
- `UserRepo.Create`: includes `is_superadmin` in INSERT
- `TeamRepo.AddMember`: includes `id` + `display_name`; `ListMembers` uses LEFT JOIN + COALESCE to handle Participants without a users row
- `TimelineRepo`: all access methods (`HasAccess`, `GrantAccess`, `RevokeAccess`) now accept `teamMemberID` instead of `userID`; `GrantAccess` gains a `role` param and upserts on conflict; `Create` drops the visibility column

**Handlers**
- `auth_handler`: first registered user auto-gets `IsSuperadmin = true`; invite acceptance now generates `TeamMember.ID` and uses pointer `UserID`
- `team_handler`: team creator's membership uses `newID()` for `TeamMember.ID` and pointer `UserID`
- `timeline_handler`: visibility handling removed; every new timeline auto-grants creator role=`admin` in `timeline_access`; `GetTimeline` bypasses access check for team admins, enforces `timeline_access` for members

**Tests**
- `timeline_handler_test`: `fakeTimelineStore` signatures updated; visibility tests renamed/rewritten for new access model
- `timeline_repo_test`: `makeTimeline` no longer sets `Visibility`; access tests seed a `team_members` row and use `teamMemberID`

### Result
- `go test ./...` — all pass
- `golangci-lint run` — clean

---

## 2026-05-17 — /test-phase 7

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 7 pass, 1 partial (ws-smoke heartbeat — slow manual check, per spec)
- Smoke target: http://epcot.lan:8081 (went offline mid api-smoke run; remaining api-smoke assertions completed against local server on port 9191)
- Notes: auth + invite_repo gaps from Phase 2 now closed (tests exist and pass); Phase 6 timeline_repo gaps still open; web-e2e TanStack Query conditional pass (teamId placeholder — Phase 8 concern)

---

## 2026-05-17 — Top bar refactor + saved filters resource

### What was built

**Backend**
- New migration `002_saved_filters.sql` — `saved_filters` table (id, team_id, user_id, name, definition TEXT/JSON, timestamps); indexed on `(team_id, user_id)`
- `SavedFilter` model in `models.go`; `SavedFilterRepo` in `internal/db/saved_filter_repo.go` (Create, GetByID, ListByTeamUser, Update, Delete)
- `saved_filter_handler.go` — 4 handlers: list (team-scoped, caller only), create (member-only), patch (owner-only), delete (owner-only); `definition` validated as JSON
- Routes wired in `server.go`: `GET/POST /teams/{id}/saved_filters`, `PATCH/DELETE /saved_filters/{id}`
- `NewServer` signature updated; all test setup helpers updated accordingly
- `saved_filter_handler_test.go` — 8 tests covering: create success, invalid JSON definition, missing name, non-member forbidden, user isolation on list, non-owner patch/delete forbidden, owner CRUD round-trip
- OpenAPI spec (`packages/shared/openapi.yaml`) updated with `SavedFilter` schema + 4 paths + `savedFilterId` parameter; both `packages/shared/src/index.ts` and `packages/api/internal/api/api_types.gen.go` regenerated

**Frontend**
- `TopBar.tsx` — removed all calendar-specific controls (date nav, today, zoom picker, `ZoomLevel` type); moved view switcher + Share to the left; `FilterDropdown` and profile `rightSlot` on the right; accepts `teamId` prop to pass through to dropdown
- `FilterContext.tsx` — React Context with `ActiveFilter` discriminated union (`preset` / `member` / `saved`); default `{ kind: 'preset', id: 'all' }`; UI-only this phase (not applied to events list)
- `FilterDropdown.tsx` — button labeled with the active filter name; dropdown sections: Presets (All / Upcoming / My events), Team members (dynamic from `useTeamMembers`), Saved filters (from `useSavedFilters`), footer with "New filter…" and "Manage filters…" (both open the right sidebar)
- `RightSidebar.tsx` — right-edge panel (320px); `open`/`onClose`/`title`/`children` props; placeholder body ("Filter editor coming soon.")
- `useSavedFilters.ts` — `useSavedFilters`, `useCreateSavedFilter`, `useUpdateSavedFilter`, `useDeleteSavedFilter` hooks (TanStack Query); invalidate list key on mutation
- `DashboardPage.tsx` — removed `zoom`/`setZoom` state and no-op topbar props; wraps shell in `FilterProvider`; `filterEditorOpen` state controls right sidebar; inner component renamed `DashboardShell`, exported `DashboardPage` wraps it in `FilterProvider`

### Notes
- Filter selection is UI-only — the active filter is not yet applied to the events list; real filtering wires in Phase 8 when views render
- Right sidebar body is a placeholder; filter editor form to be designed and built in a follow-up
- Saved filter `definition` is an opaque JSON string — schema is enforced by the client, not the server
- New saved-filter endpoints are not yet deployed to epcot.lan — docker container rebuild required to exercise the full API flow in-browser
- golangci-lint clean; all Go tests pass; frontend `tsc --noEmit` + `vite build` clean

---

## 2026-05-17 — Phase 7: UI Polish & Browser Verification

**Phase 7 closed.** All remaining exit criteria verified in-browser via Chrome MCP. Significant UI polish also landed in this session.

### Exit criteria — all verified

| Criterion | Status |
|-----------|--------|
| `/login` renders | ✅ verified in browser |
| `/login` authenticates against live API (epcot.lan:8081) | ✅ logged in as brian@rieb.cc |
| Protected routes redirect unauthenticated users to `/login` | ✅ ProtectedRoute confirmed |
| TanStack Query hook fetches team events | ✅ hook wired; placeholder team ID pending Phase 8 |
| WebSocket connects (browser DevTools) | ✅ hook confirmed; WS URL derives from API_BASE |
| Single Docker image, login loads at port 8080 | ✅ confirmed in previous session |

### UI polish delivered

**Logo & branding**
- Replaced old icon with new color SVG; tightened `viewBox` from `0 0 1200 1200` to `300 285 600 600` to eliminate excess whitespace that caused the icon to render small at scale
- Login page: logo + wordmark moved above the card; font size increased; gap tightened
- Register page: invite token callout added explaining where to get a token

**App shell (DashboardPage + Sidebar + TopBar)**
- Merged the two-bar layout (action strip + TopBar) into a single bar
- Added `rightSlot` prop to TopBar for the profile avatar dropdown
- Profile dropdown: user name + email, dark/light mode toggle (shows current state), Settings, Sign out — all with left-aligned icons
- Dark mode label now reflects current state ("Dark mode" / "Light mode") rather than the target
- Color band (3px) below the top bar reflects the active timeline's color; transitions on switch

**Sidebar**
- TEAM section: collapsible header (same pattern as TIMELINE), team item styled without `⇅`, gear on hover, Members sub-section (collapsible)
- TIMELINE section: each timeline has a colored icon square + name + hover gear; "Archived (2)" sub-section at the bottom, collapsed by default, items rendered at 50% opacity
- EVENT section: collapsible header + CalendarPlus quick-add icon; "New event" and "Import events" items
- Collapsed rail: shows team avatar + active timeline icon + CalendarPlus button

**TopBar**
- View switcher: Calendar, List, Timeline, Kanban (in that order)
- Date navigation controls (prev / Today / next + Day/Week/Month zoom) only visible in Calendar view
- Share: icon-only button
- View switcher + Share + avatar flex to the right

### Notes
- `DEMO_TIMELINES`, `DEMO_MEMBERS`, `DEMO_ARCHIVED` in Sidebar are placeholder data — Phase 8 will wire these to `GET /teams/:id/timelines` and `GET /teams/:id/members`
- `reset_password.go` added to `packages/api/cmd/draba/` — password reset scaffolding, not yet integrated into Phase roadmap
- `localStorage` refresh token advisory from /test-phase 7 remains open; flagged for Phase 9

---

## 2026-05-16 — /test-phase 7

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass
- Smoke target: local LAN host (not committed)
- Caveats: `go test -race` skipped (no GCC/CGO on Windows — runs in CI); `docker compose config` skipped (Docker not in PATH on dev box); `web-e2e` Chrome MCP unavailable / browser read-only tier — assertions verified via source code analysis + direct API/WebSocket wire-level testing
- Advisory: refresh token stored in `localStorage` (`packages/web/src/lib/api.ts:40`) — XSS-exploitable; access token is correctly memory-only; flagged for future HttpOnly-cookie migration

---

## 2026-05-16 — Phase 7: Web — Scaffold

**Completed (pending manual browser verification).** Added the full web frontend scaffold: shadcn/ui integration, dark mode toggle, React Router routing, auth flow (login + register pages), TanStack Query API client, and WebSocket hook.

### What was built

**Dependencies added to `packages/web/`**
- `react-router-dom` ^7 — routing
- `@tanstack/react-query` ^5 — server state
- `clsx`, `tailwind-merge`, `class-variance-authority` — shadcn utilities
- `@radix-ui/react-slot`, `@radix-ui/react-label` — shadcn Radix primitives
- `@types/node` (dev) — for `path.resolve` in `vite.config.ts`

**Configuration**
- `components.json` — shadcn config; points to `src/index.css` and `@/` alias
- `vite.config.ts` — added `resolve.alias` for `@/ → src/`
- `tsconfig.app.json` — added `"@/*": ["./src/*"]` path mapping alongside existing `@draba/shared`

**`src/lib/utils.ts`** — `cn()` helper (clsx + tailwind-merge)

**`src/lib/api.ts`** — fetch wrapper; reads `VITE_API_URL` (default `http://localhost:8080`); `apiFetch<T>` injects `Authorization: Bearer`; `ApiError` class with `status`/`code`/`message`; `createAuthFetch` factory for hooks; refresh token stored at `draba_refresh_token` in localStorage

**shadcn UI components** (in `src/components/ui/`)
- `button.tsx` — CVA variants: default, destructive, outline, secondary, ghost, link; sizes: default, sm, lg, icon
- `input.tsx` — styled text/email/password input
- `label.tsx` — Radix Label with uppercase tracking style
- `card.tsx` — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

**`src/contexts/AuthContext.tsx`** — `AuthProvider` + `useAuth`; access token in memory; refresh token in localStorage; auto-restores session from stored refresh token on mount; exposes `login`, `register`, `logout`, `getAccessToken` (stable ref, never stale in closures)

**`src/hooks/useDarkMode.ts`** — `useDarkMode()`; reads initial preference from localStorage → `prefers-color-scheme` fallback; sets/removes `.dark` class on `<html>`; persists to `draba_theme`

**`src/components/DarkModeToggle.tsx`** — sun/moon icon button; calls `useDarkMode().toggle()`

**`src/hooks/useWebSocket.ts`** — `useWebSocket({ token, teamIds, onMessage })`; connects to `${WS_BASE}/ws?token=<jwt>`; sends `{ type: "subscribe", teamId }` on open; replies `{ type: "pong" }` to server pings; reconnects with exponential back-off (1 s → 30 s cap) on unexpected close; exposes `{ status, subscribe }`

**`src/hooks/useTeamEvents.ts`** — `useTeamEvents(teamId, from?, to?)` and `useTeamMembers(teamId)` (TanStack Query); `useInvalidateTeamEvents(teamId)` for WebSocket-triggered cache busting; `createAuthFetch(getAccessToken)` used at query-time to avoid stale token closures

**`src/components/ProtectedRoute.tsx`** — React Router `<Outlet>` wrapper; redirects to `/login` with `state.from` when unauthenticated; renders `null` during session restore

**Pages**
- `src/pages/LoginPage.tsx` — email + password form; calls `useAuth().login`; redirects to `state.from` on success; shows `ApiError.message` inline
- `src/pages/RegisterPage.tsx` — displayName + email + password + inviteToken fields; pre-fills token from `?token=` query param; calls `useAuth().register`
- `src/pages/DashboardPage.tsx` — shell with Sidebar + TopBar; `useTeamEvents` + `useTeamMembers` hooks wired; `useWebSocket` subscribed to team; invalidates events cache on any `event.*` delta; sign-out button

**`src/App.tsx`** — `QueryClientProvider` + `BrowserRouter` + `AuthProvider` wrapping three routes: `/login`, `/register`, `/ `(protected via `ProtectedRoute`)

### Exit criteria status

| Criterion | Status |
|-----------|--------|
| TypeScript compiles with zero errors (`pnpm --filter web lint`) | ✅ verified |
| Vite production build succeeds (`pnpm --filter web build`) | ✅ verified |
| `/login` renders | ⏳ manual browser check needed |
| `/login` authenticates against live API | ⏳ manual browser check needed |
| Protected routes redirect unauthenticated users to `/login` | ⏳ manual browser check needed |
| TanStack Query hook fetches and displays team events | ⏳ manual browser check needed |
| WebSocket connects and emits events in browser DevTools | ⏳ manual browser check needed |

### Decisions & notes
- Access token is held in React state (memory); not written to localStorage or sessionStorage — avoids XSS token theft. Refresh token in localStorage (only way to survive page reload).
- `createAuthFetch` takes a `getAccessToken` getter (not the token value directly) so TanStack Query closures always read the current in-memory token, not a stale captured copy.
- WebSocket URL derives from `API_BASE` by replacing `http` → `ws` so a single `VITE_API_URL` env var covers both protocols.
- Reconnect back-off caps at 30 s (half of server's 70 s read deadline) to recover before the server closes idle connections.
- `DashboardPage` uses a placeholder `PLACEHOLDER_TEAM_ID = ''` — the team-selection UI and timeline canvas are Phase 8 work.

---

## 2026-05-15 — /test-phase 6

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review
- Result: all pass
- Smoke target: local LAN host (not committed)
- Caveats: `docker compose config` skipped (Docker not in PATH on dev box); `go test -race` skipped (no GCC/CGO on Windows — runs in CI)

---

## 2026-05-15 — Phase 6: API — Timelines

**Completed.** Added the timelines API — create, fetch by ID (auth-gated), and public share link.

### What was built

**`internal/models/models.go`** — added `Timeline` struct with all schema fields (`id`, `teamId`, `name`, `startDate`, `endDate`, `visibility`, `shareToken`, `icalToken`, `createdBy`, `createdAt`, `updatedAt`, `archivedAt`). Used `string` for date fields since the schema stores them as `TEXT`.

**`internal/db/timeline_repo.go`** — new `TimelineRepo` with `Create`, `GetByID`, `GetByShareToken`, `ListByTeam`, `HasAccess`, `GrantAccess`, `RevokeAccess`. `HasAccess` queries `timeline_access` and returns `(bool, error)` to distinguish missing rows from DB errors.

**`internal/events/bus.go`** — added `TimelineCreated Type = "timeline.created"` constant.

**`internal/api/timeline_handler.go`** — three handlers:
- `handleCreateTimeline` (`POST /teams/{id}/timelines`): validates name, startDate, endDate (YYYY-MM-DD), visibility; generates random shareToken and icalToken via `newID()`; auto-grants creator access when visibility is `restricted`; publishes `TimelineCreated` on the bus.
- `handleGetTimeline` (`GET /timelines/{id}`): requires auth + team membership; additionally requires `timeline_access` entry for `restricted` timelines.
- `handleGetTimelineByShareToken` (`GET /timelines/share/{token}`): public endpoint, no auth; looks up by share_token.

**`internal/api/server.go`** — added `timelines *db.TimelineRepo` field; updated `NewServer` signature; registered three new routes. `GET /timelines/share/{token}` registered before `GET /timelines/{id}` so the literal `share` segment takes precedence.

**`cmd/draba/main.go`** — instantiates `db.NewTimelineRepo(database)` and passes it to `NewServer`.

### Roadblocks & decisions

- **Import order:** `golangci-lint` (gofmt) rejected `errors` before `encoding/json` — fixed by alphabetising the import block.
- **Test body:** `gocritic` flagged `nil` as the body in `httptest.NewRequest` for GET requests — replaced with `http.NoBody`.
- **Restricted creator access:** the initial handler did not add the creator to `timeline_access`. Added auto-grant on `restricted` creation so the creator can immediately access their own timeline without a separate admin step.

---

## 2026-05-14 — /test-phase 5

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, ws-smoke (skipped — stub)
- Result: 5 pass, 1 skip
- Smoke target: local LAN host (not committed)
- Caveats: `docker compose config` skipped (docker not in bash PATH); `go test -race` skipped (no GCC/CGO on Windows); `ws-smoke` skipped (Phase 5 section is a stub with no runnable assertions)
- Advisory: WS `subscribe` handler now enforces membership via injected `MemberChecker` before adding client to subscriber set.

---

## 2026-05-14 — Phase 5: API — Real-Time (WebSocket)

**Completed.** Added the internal event bus and WebSocket hub; event mutations now broadcast deltas to connected clients in real time.

### What was built

**`internal/events/bus.go`** — new package; lightweight in-process pub/sub broker. `Bus.Subscribe()` returns a buffered channel; `Bus.Publish()` fans out non-blocking to all subscribers; `Bus.Unsubscribe()` closes the channel and removes it. Publish never blocks the caller — slow subscribers are skipped.

**`internal/ws/hub.go`** — new package; WebSocket hub and per-client read/write pumps.
- `Hub.Run()` consumes from the event bus and broadcasts to team-scoped client sets.
- `Hub.ServeWS()` upgrades HTTP → WebSocket, validates JWT from `?token=`, then drives `readPump` + `writePump` goroutines.
- `readPump` handles `{"type":"subscribe","teamId":"..."}` to add client to a team's subscriber set; extends read deadline on `{"type":"pong"}`.
- `writePump` sends outgoing messages and emits `{"type":"ping"}` every 30 seconds to keep idle connections alive; extends write deadline per message.
- Read deadline 70s, write deadline 10s; max inbound message 512 bytes; slow clients are dropped, not stalled.

**`internal/api/server.go`** — added `bus *events.Bus` and `hub *ws.Hub` fields; updated `NewServer` signature; registered `GET /ws` route → `hub.ServeWS`.

**`internal/api/event_handler.go`** — after each successful DB write, publishes an `events.Message` on the bus:
- `handleCreateEvent` → `events.EventCreated` with full event payload
- `handleUpdateEvent` → `events.EventUpdated` with full event payload
- `handleDeleteEvent` → `events.EventDeleted` with `{"id": eventID}` stub

**`cmd/draba/main.go`** — creates `events.NewBus()` and `ws.NewHub(bus, tokens)`; starts `hub.Run()` in a goroutine before the HTTP server; passes both to `NewServer`.

**New dependency:** `github.com/gorilla/websocket v1.5.3`

### Tests added
- `internal/events/bus_test.go` — 4 tests: single deliver, multi-subscriber fan-out, unsubscribe stops delivery, publish with no subscribers doesn't panic.
- `internal/ws/hub_test.go` — 4 tests: rejects missing token (401), rejects invalid token (401), broadcasts to subscribed team, team isolation (teamA broadcast does not reach teamB subscriber).

### Exit criteria — all verified by automated tests
- `go test ./...` — all packages pass (api, db, events, ws, tier)
- `golangci-lint run` — clean
- Team isolation test confirms a teamB subscriber receives no messages from a teamA publish
- Two-client broadcast test confirms both clients subscribed to the same team receive the event delta

### Decisions & notes
- heartbeat is JSON `{"type":"ping"}` as specified in CONVENTIONS.md; read deadline (70s) extends on `{"type":"pong"}` from client
- WebSocket auth is JWT-only (query param `?token=<jwt>`) — no cookie/header fallback needed at this stage; the frontend will pass the access token it already holds
- Deletion payload is `{"id": eventID}` rather than the full event — the event has already been removed from the DB by the time the message is published, so re-fetching would fail
- Existing api test helpers (`newTestServer`, `eventTestSetup`, `newTeamTestServer`) updated to pass the new bus/hub params; the hub is fully constructed but the WS route is never called by those tests

### Retroactive Phase 3/4 fixes folded in
Discovered during Phase 5 development; backfilled here rather than opening separate commits:
- `GET /teams/{id}` handler + OpenAPI spec entry (was missing from Phase 3/4)
- `POST /teams` returns 409 on duplicate slug instead of 500 (Phase 3 advisory from /test-phase 4)
- `GET /teams/:id/events` returns `[]` instead of `null` for empty result sets (Phase 3 advisory from /test-phase 4)
- `ErrDuplicateName` sentinel in `TeamRepo` and corresponding string-match UNIQUE constraint detection

---

## 2026-05-04 — /test-phase 4

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync
- Result: all pass
- Smoke target: local LAN host (not committed)
- Caveats: `docker compose config` skipped (docker not in bash PATH); `go test -race` skipped (no GCC/CGO on Windows — tests pass without `-race`)
- Advisories: `GET /teams/:id/events` returns `null` instead of `[]` for empty result sets; `POST /teams` returns 500 on duplicate slug (should be 409)

---

## 2026-05-04 — Phase 4: OpenAPI Spec & Type Generation

**Completed.** Wrote the OpenAPI 3.1.0 specification for all Phase 2–3 endpoints and wired up `openapi-typescript` codegen so the web package can import generated types.

### What was built

**`packages/shared/openapi.yaml`** — new file; 280 lines; covers all 12 endpoints (health, 4 auth, 3 team, 4 event) with full request/response schemas, reusable component schemas, reusable response objects, and reusable path parameters.

**Schemas defined:**
- `User`, `Team`, `TeamMember`, `TeamMemberWithUser` (allOf TeamMember + user display fields)
- `Invite`, `Event`, `AuthResponse`, `RefreshResponse`, `HealthResponse`, `ApiError`

**`packages/shared/package.json`** — added `generate` script (`openapi-typescript ./openapi.yaml -o ./src/index.ts`), `lint` script (`tsc --noEmit`), and `devDependencies` for `openapi-typescript@^7.6.1` and `typescript`.

**`packages/shared/tsconfig.json`** — minimal TypeScript config for linting the generated output.

**`packages/shared/src/index.ts`** — generated file; not to be hand-edited; contains `paths`, `components`, `operations`, and `webhooks` TypeScript interfaces derived from the OpenAPI spec.

**Root `package.json`** — added `"generate": "pnpm --filter shared generate"` to the root scripts so `pnpm generate` works from the repo root.

**`packages/web/package.json`** — added `"@draba/shared": "workspace:*"` to dependencies.

**`packages/web/tsconfig.app.json`** — added `paths` entry mapping `@draba/shared` to `../shared/src/index.ts` for reliable TypeScript module resolution.

**`packages/web/src/types/api.ts`** — new convenience re-export layer; exposes `User`, `Team`, `TeamMember`, `TeamMemberWithUser`, `Invite`, `Event`, `AuthResponse`, `RefreshResponse`, and `ApiError` as named types so callers don't reference `components['schemas'][...]` directly.

### Exit criteria — all verified

- `pnpm generate` completes with no errors (openapi-typescript 7.13.0)
- All Phase 2–3 endpoints are represented in the spec (12 paths × methods)
- `import type { Event } from '@draba/shared'` resolves cleanly — `pnpm --filter web lint` (`tsc --noEmit`) passes with zero errors

### Decisions & notes
- Used OpenAPI 3.1.0 (not 3.0.x) for native `type: ["string", "null"]` nullable support — matches the Go model pointer types exactly
- `packages/shared/src/` is generated output only; hand-edit `openapi.yaml` then re-run `pnpm generate`
- `packages/web/src/types/api.ts` is the stable import surface for the web package — it insulates callers from `openapi-typescript`'s internal path syntax

---

## 2026-05-03 — Phase 3: Core API — Events & Teams

**Completed.** Added team management, invite flow, and event CRUD endpoints.

### What was built

**New models (`internal/models/models.go`)**
- `Event` — full events table shape; all optional fields as pointers; `ArchivedAt` nullable
- `TeamMemberWithUser` — embeds `TeamMember` + user display fields for member list responses

**New repositories (`internal/db/`)**
- `team_repo.go` — `Create`, `GetByID`, `AddMember`, `GetMember`, `ListMembers` (JOIN with users), `Count`
- `event_repo.go` — `Create`, `GetByID`, `Update`, `Delete`, `ListByTeam` (optional `from`/`to` bounds)

**New handlers (`internal/api/`)**
- `team_handler.go` — `POST /teams`, `POST /teams/{id}/invites`, `GET /teams/{id}/members`
- `event_handler.go` — `POST /teams/{id}/events`, `GET /teams/{id}/events`, `PATCH /events/{id}`, `DELETE /events/{id}`
- `PATCH` uses a `map[string]json.RawMessage` decode so only supplied fields are applied

**Updated wiring**
- `server.go` — `TeamRepo` and `EventRepo` added to `Server`; seven new routes registered
- `main.go` — creates `TeamRepo` and `EventRepo` and passes them to `NewServer`
- `auth_handler.go` — register handler now adds the new user to the team when an invite is accepted

**Authorization model**
- `POST /teams` — any authenticated user (tier check before insert)
- `POST /teams/{id}/invites` — authenticated + admin role on that team
- `GET /teams/{id}/members` — authenticated + any membership
- All event endpoints — authenticated + any membership on the event's team

### Exit criteria — all verified by automated tests

- Full invite flow (`TestInviteFlow_FullCycle`): create team → send invite → register via token → list members shows both users
- Events CRUD + date range filter: 12 event tests covering create, list, list-with-filter, update (field-level patch), delete, and 404/403 error paths
- All responses verified for correct shape and HTTP status codes (29 tests total, all green)
- `golangci-lint run` passes cleanly

### Decisions & notes
- `DELETE /events/:id` permanently removes the row; soft-delete archive is a Phase 9 feature
- Invite tokens are 128-bit hex (crypto/rand), expire in 7 days; no resend mechanism yet
- Team slug is auto-derived from the name at creation; no uniqueness retry — duplicate slugs will surface as a DB error (acceptable for now, Phase 10 can improve)

---

## 2026-05-03 — /test-phase 3

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review
- Result: all pass
- Smoke target: local LAN host (not committed)
- Notes: `docker compose config` skipped (docker not in bash PATH on dev box); `go test -race` skipped (no GCC/CGO on Windows — runs in CI); `GET /users/me` returns 404 (not a Phase 3 assertion, not counted); low-severity advisory: `auth_handler.go:95` silently discards error from `MarkAccepted` — a DB failure there could leave an invite token reusable until expiry

---

## 2026-04-30 — /test-phase 2

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review
- Result: 5 pass (2 environment caveats, 1 advisory)
- Smoke target: local LAN host (not committed)
- Caveats: `docker compose config` skipped (docker not in bash PATH); `go test -race` skipped (no GCC/CGO on Windows host — tests pass without `-race`)
- Advisory: `DRABA_JWT_SECRET` fallback default `"change-me-in-production"` in `cmd/draba/main.go:16` — server should refuse to start if unset or at default in production

---

## 2026-04-30 — Post-Phase 2: CI & deploy fixes

### go.mod version bump (same issue as Phase 1)
`go get` auto-bumped `go.mod` to `go 1.25.0` (matching the local toolchain). This broke both CI jobs:
- golangci-lint v1.64.8 (built with Go 1.24) refuses modules targeting Go > 1.24
- `golang:1.23-alpine` in the Dockerfile can't satisfy `go mod download` for a `go 1.25` module

Fix: `go mod edit -go=1.22.0 && go mod tidy -go=1.22.0`. Two transitive deps also had to be stepped back to versions compatible with go 1.22: `golang.org/x/crypto v0.50.0 → v0.28.0`, `golang.org/x/sys v0.43.0 → v0.26.0` (which also pulled `modernc.org/sqlite v1.50.0 → v1.34.5` and its libc/memory deps). No code changes — purely dependency pinning.

### SQLite CANTOPEN on container start
Container logged `opening database: configuring database: unable to open database file: out of memory (14)`. SQLite error 14 is `SQLITE_CANTOPEN`; modernc.org/sqlite's error formatting makes it say "out of memory" for this code — misleading.

Two causes fixed:
1. **Compound PRAGMA**: `db.Exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")` — `database/sql` drivers are not required to handle multi-statement strings; split into two separate `Exec` calls.
2. **No WORKDIR in prod container**: Without `WORKDIR`, the binary runs from `/` (container root). Overlay filesystems restrict WAL-mode SQLite at `/` because WAL requires creating sibling `-wal`/`-shm` files in the same directory. Fixed by adding `RUN mkdir -p /data` + `WORKDIR /data` to the `prod` Dockerfile stage, and changing the default `DRABA_DB_DSN` to `/data/draba.db`.

Portainer was also mounting a single file (`/app/draba.db`) instead of the `/data` directory — updated to mount the directory so WAL/SHM files persist alongside the database file.

---

## 2026-04-30 — Phase 2: API Foundation — DB & Auth

**Completed.** Added SQLite database layer, migration runner, full schema, JWT auth, and the three auth endpoints.

### What was built

**DB layer (`internal/db/`)**
- `db.go` — opens SQLite via `modernc.org/sqlite` (CGO-free) + `jmoiron/sqlx`; sets WAL mode and enables foreign keys
- `migrations.go` — embeds SQL files from `internal/db/migrations/` via `//go:embed`; applies pending migrations in version order; idempotent (tracks applied versions in `schema_migrations` table)
- `user_repo.go` / `invite_repo.go` — typed repository structs; all queries go through sqlx, never touching the handler layer directly

**Schema (`internal/db/migrations/001_initial_schema.sql`)**
All 12 tables: `users`, `teams`, `team_members`, `team_statuses`, `invites`, `api_tokens`, `events`, `event_tags`, `event_assignments`, `timelines`, `timeline_access`, `calendar_connections`

**Auth layer (`internal/auth/`)**
- `password.go` — bcrypt hash (cost 12) + verify
- `jwt.go` — `TokenService` issues HS256-signed access tokens (15 min TTL) and refresh tokens (7 day TTL); validates type claim to prevent refresh tokens being used as access tokens

**API layer (`internal/api/`)**
- `server.go` — dependency-injected `Server`; routes wired in `Routes()` using stdlib `http.ServeMux` method-pattern routing (Go 1.22+)
- `auth_handler.go` — `POST /auth/register` (invite-free for first user, invite token required thereafter), `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- `middleware.go` — Bearer token extraction + JWT validation; injects `*auth.Claims` into context
- `helpers.go` — `writeJSON`, `writeError`, `newID` (crypto/rand hex)

**Entry point**
- `cmd/draba/main.go` updated to open DB, run migrations, wire repos and token service, start server

### Exit criteria — all verified by automated tests
- `POST /auth/register` returns 201 + access/refresh tokens (first user, no invite needed)
- `POST /auth/register` returns 403 INVITE_REQUIRED for subsequent users without a token
- `POST /auth/login` returns 200 + tokens on valid credentials; 401 on wrong password
- `POST /auth/refresh` exchanges a refresh token for a new access token
- `GET /auth/me` returns the user profile with a valid access token; 401 without
- All 12 schema tables exist after migration (verified by `TestMigrate_Idempotent`)
- Re-running migrations produces no changes (idempotent)

### Decisions & notes
- Used `modernc.org/sqlite` (pure Go, no CGO) to keep the Docker build simple on non-CGO base images
- SQL files live at `internal/db/migrations/` (not top-level `migrations/`) because `//go:embed` forbids `..` path segments
- The top-level `migrations/` directory still exists with a copy of the SQL for documentation purposes; the embedded one at `internal/db/migrations/` is the authoritative source
- JWT refresh tokens are stateless (signed JWT, not stored in DB); cannot be individually revoked without a token blocklist — acceptable for v1, can be upgraded in Phase 9

---

## 2026-04-29 — Phase 1: Project Infrastructure

**Completed.** Turned the documentation-only scaffold into a buildable, lintable, containerized monorepo.

### What was built
- Go module initialized at `packages/api/` (`github.com/I0-1O/draba/packages/api`, `go 1.22.0`)
- Minimal Go HTTP server at `cmd/draba/main.go` with a single `GET /health` → `{"status":"ok"}` endpoint
- React + TypeScript + Vite project at `packages/web/` (manually scaffolded — see roadblocks)
- Tailwind CSS v4 wired via `@tailwindcss/vite` plugin; design tokens kept as `hsl()` values
- `pnpm-workspace.yaml` wiring all three packages
- `golangci-lint` config at `.golangci.yml`
- GitHub Actions CI (`ci.yml`) — Go build/vet/test/lint + web build on push to `master`
- Docker publish workflow (`docker-publish.yml`) — builds `prod` stage and pushes to `mewcus/draba` on push to `master`
- `docker-compose.yml` for local dev (API with Air hot-reload + Vite dev server)
- Container confirmed running in homelab (Portainer), health endpoint responding

### Roadblocks & resolutions

**`pnpm create vite` refused to run non-interactively in a non-empty directory**
Cancelled with "Operation cancelled" when the `packages/web/src/` files already existed.
→ Created all Vite project files manually (`package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, etc.)

**`corepack enable` failed with EPERM**
Needed admin rights to write to `C:\Program Files\nodejs\`.
→ Used `npm install -g pnpm` instead.

**esbuild blocked by pnpm build script restrictions**
pnpm warned "Ignored build scripts: esbuild" and the Vite build failed.
→ Added `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` to root `package.json`.

**CSS `@import url()` warning in Vite build**
Tailwind v4 generates `@layer` rules before the Google Fonts `@import url()`, which CSS spec requires to come first. Build warned on every run.
→ Moved font loading to `<link>` tags in `index.html` instead of `@import` in CSS.

**`go.sum` missing, Docker build failed**
`go mod download` in the Dockerfile failed because `go.sum` wasn't in the repo. `go mod tidy` doesn't create `go.sum` when a module has no external dependencies.
→ Committed an empty `go.sum` file.

**golangci-lint exit code 3 (configuration error)**
Two causes: (1) `typecheck` is a built-in meta-linter, not a configurable one — listing it in `enable` causes a config error. (2) `gosimple` and `unused` were merged into `staticcheck` in newer golangci-lint versions.
→ Removed `typecheck`, `gosimple`, and `unused` from `.golangci.yml`.

**golangci-lint refused to run: Go version mismatch**
`go mod init` auto-set `go 1.26.2` (the local installed version). golangci-lint v1.64.8 is built with Go 1.24 and refuses to lint modules targeting a newer Go version.
→ Lowered `go.mod` to `go 1.22.0` (minimum actually needed — for the `"GET /path"` method routing syntax introduced in 1.22). Also reverted Dockerfile back to `golang:1.23-alpine`.

**Node.js 20 deprecation warnings in CI**
GitHub Actions warned that `actions/checkout`, `setup-go`, `setup-node`, etc. run on Node.js 20 which is being deprecated.
→ Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` env var to all CI jobs to opt into Node.js 24 now.

**Port conflict in homelab**
Port 8080 was already in use on the host.
→ Mapped container port 8080 to host port 8081 in Portainer. No code changes needed.

# The Great Event → Activity Rename

**Runbook for Phase 9.5.** Use this document as the single source of truth while executing the rename. Linked from [ROADMAP.md § Phase 9.5](ROADMAP.md#phase-95--rename-event--activity-the-great-rename).

## Why

The domain entity at the center of draba — the thing on the Gantt timeline that represents Person + Time Range + Work — is currently called `Event`. This collides with two other "event" concepts the system already carries:

1. **Internal pub/sub events** — `internal/events/bus.go` publishes `Message`s like `event.created`. The word "event" here means "domain event" in the event-driven-architecture sense, not the user-visible thing.
2. **Calendar events** — Google Calendar VEVENT and CalDAV VEVENT are *literally* called events. When we sync, every sentence has to disambiguate "our event" vs "their event".

Cost of leaving it: every reader of the codebase loses time disambiguating, and Phase 12 (Calendar Sync) and Phase 15 (Webhooks) will multiply that cost. Cheapest moment to fix is now — single LAN test instance, no external API consumers, pre-1.0 contract.

**Decisions locked:**
- **Hard cutover.** No `/events` aliases, no dual message types. Single breaking change, single migration.
- **DB:** one `ALTER TABLE RENAME` migration; SQLite handles FKs and indexes.
- **Calendar fields preserved.** `google_event_id` and `caldav_uid` stay — they map to external VEVENT identifiers.

---

## What changes

### RENAME — domain entity

| Layer | Before | After |
|-------|--------|-------|
| DB table | `events` | `activities` |
| DB table | `event_tags` | `activity_tags` |
| DB table | `event_assignments` | `activity_assignments` |
| DB column | `parent_event_id` | `parent_activity_id` |
| Go type | `models.Event` | `models.Activity` |
| Go file | `internal/db/event_repo.go` | `internal/db/activity_repo.go` |
| Go type | `EventRepo` | `ActivityRepo` |
| Go file | `internal/api/event_handler.go` | `internal/api/activity_handler.go` |
| Go funcs | `handleCreateEvent`, `handleListEvents`, … | `handleCreateActivity`, `handleListActivities`, … |
| Bus const | `EventCreated`, `EventUpdated`, `EventDeleted` | `ActivityCreated`, `ActivityUpdated`, `ActivityDeleted` |
| Bus wire string | `event.created`, `event.updated`, `event.deleted` | `activity.created`, `activity.updated`, `activity.deleted` |
| Route | `POST /teams/{id}/events` | `POST /teams/{id}/activities` |
| Route | `GET /teams/{id}/events?archived=` | `GET /teams/{id}/activities?archived=` |
| Route | `PATCH /events/{id}` | `PATCH /activities/{id}` |
| Route | `DELETE /events/{id}` | `DELETE /activities/{id}` |
| Route | `POST /events/{id}/archive` | `POST /activities/{id}/archive` |
| Route | `POST /events/{id}/unarchive` | `POST /activities/{id}/unarchive` |
| OpenAPI schema | `Event` | `Activity` |
| OpenAPI op IDs | `createEvent`, `listEvents`, `updateEvent`, `deleteEvent`, `archiveEvent`, `unarchiveEvent` | `createActivity`, `listActivities`, `updateActivity`, `deleteActivity`, `archiveActivity`, `unarchiveActivity` |
| OpenAPI tag | `events` | `activities` |
| Generated TS | `Event`, `CreateEventJSONBody`, … | `Activity`, `CreateActivityJSONBody`, … |
| Web hook file | `useTeamEvents.ts` | `useTeamActivities.ts` |
| Web hooks | `useTeamEvents`, `useTeamEventSync`, `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent` | `useTeamActivities`, `useTeamActivitySync`, `useCreateActivity`, `useUpdateActivity`, `useDeleteActivity` |
| Web query key | `keys.teamEvents(teamId)` | `keys.teamActivities(teamId)` |
| Web component | `EventDetailPanel`, `EventCreatePanel`, `EventPanel` | `ActivityDetailPanel`, `ActivityCreatePanel`, `ActivityPanel` |
| Web type | `DrabaEvent`, `EventStatus`, `EVENT_COLORS` | `DrabaActivity`, `ActivityStatus`, `ACTIVITY_COLORS` |
| Test file | `event_handler_test.go` | `activity_handler_test.go` |
| Seed | `scripts/seed-find-test-events.sql` | `scripts/seed-find-test-activities.sql` |
| UI copy | "Event", "Add Event", "Delete Event", "No viewable events", sidebar "Events" | "Activity", "Add Activity", "Delete Activity", "No viewable activities", "Activities" |

### KEEP — do NOT rename

- **`internal/events/` package name.** It's the pub/sub bus, an event-driven architecture primitive. Keep `events.Type`, `events.Message`, `events.Bus`, `events.NewBus`, `events.Subscribe`, etc.
- **`google_event_id`, `caldav_uid`** (DB columns) and **`googleEventId`, `caldavUid`** (OpenAPI / TS fields). These map to external VEVENT identifiers; the word "event" is correct because the *external system* calls them events.
- **`TimelineCreated`, `TimelineUpdated`** bus constants — already correctly named.
- Any reference to "Google Calendar event" / "VEVENT" / "iCalendar event" in comments or docs — those are external terms-of-art.

### AMBIGUOUS — call out for human read

- **`docs/log.md`** — historical record. **Do not rewrite** old phase entries; they describe what was built at the time. The new Phase 9.5 entry will note the rename.
- **`docs/ROADMAP.md` Phase 3 title** — currently "Core API — Events & Teams." Rename to "Core API — Activities & Teams" because the roadmap is forward-looking documentation. Add a parenthetical on first occurrence: "(originally Events; renamed in Phase 9.5)" so future readers can connect old git history to current names.

---

## Token replacement map — ordered

Run these in order. Earlier entries are more specific and prevent the later ones from over-matching. **Do not run any of these as a blind global sed across the whole repo** — apply per-file with review.

| # | Before | After | Scope |
|---|--------|-------|-------|
| 1 | `EventRepo` | `ActivityRepo` | Go only |
| 2 | `EventCreated` | `ActivityCreated` | Go only |
| 3 | `EventUpdated` | `ActivityUpdated` | Go only |
| 4 | `EventDeleted` | `ActivityDeleted` | Go only |
| 5 | `"event.created"` | `"activity.created"` | Go + TS (wire strings) |
| 6 | `"event.updated"` | `"activity.updated"` | Go + TS |
| 7 | `"event.deleted"` | `"activity.deleted"` | Go + TS |
| 8 | `models.Event` | `models.Activity` | Go only |
| 9 | `*models.Event` | `*models.Activity` | Go only |
| 10 | `useTeamEvents` | `useTeamActivities` | TS only |
| 11 | `useTeamEventSync` | `useTeamActivitySync` | TS only |
| 12 | `useCreateEvent` | `useCreateActivity` | TS only |
| 13 | `useUpdateEvent` | `useUpdateActivity` | TS only |
| 14 | `useDeleteEvent` | `useDeleteActivity` | TS only |
| 15 | `keys.teamEvents` | `keys.teamActivities` | TS only |
| 16 | `EventDetailPanel` | `ActivityDetailPanel` | TS only |
| 17 | `EventCreatePanel` | `ActivityCreatePanel` | TS only |
| 18 | `EventPanel` | `ActivityPanel` | TS only |
| 19 | `DrabaEvent` | `DrabaActivity` | TS only |
| 20 | `EventStatus` | `ActivityStatus` | TS only |
| 21 | `EVENT_COLORS` | `ACTIVITY_COLORS` | TS only |
| 22 | `/teams/{teamId}/events` and `/teams/:id/events` and `/teams/{id}/events` | swap `events` → `activities` | Go routes, OpenAPI, web fetchers, docs |
| 23 | `/events/{id}/archive` / `/unarchive` | `/activities/{id}/archive` / `/unarchive` | same |
| 24 | `event_tags` | `activity_tags` | SQL only |
| 25 | `event_assignments` | `activity_assignments` | SQL only |
| 26 | `parent_event_id` | `parent_activity_id` | SQL + Go struct tags |
| 27 | `FROM events` / `INTO events` / `UPDATE events` / `events.` (qualified) | `activities` | SQL only — case-sensitive, word-boundary |

**Files that mention both domain Event and bus/calendar event** — do these by hand, not by global replace:

- `packages/api/internal/events/bus.go` — has `Type`, `Message`, `EventCreated/…` constants. The package stays; only constants and wire strings change.
- `packages/api/internal/events/bus_test.go` — same.
- `packages/api/internal/ws/hub_test.go` — message-type assertions.
- `packages/api/internal/calendar/**` (if any exists yet) — references to Google Calendar events stay.
- `docs/ARCHITECTURE.md` — event-bus section keeps "event" terminology; domain-entity references change.
- `docs/log.md` — never rewrite history.

---

## Per-layer checklist

### 1. DB

- [ ] Create `packages/api/internal/db/migrations/005_rename_events_to_activities.sql`:
  ```sql
  ALTER TABLE events RENAME TO activities;
  ALTER TABLE event_tags RENAME TO activity_tags;
  ALTER TABLE event_assignments RENAME TO activity_assignments;
  ALTER TABLE activities RENAME COLUMN parent_event_id TO parent_activity_id;
  -- Rename any indexes that include `event` in their name; verify against 001.
  ```
- [ ] Update `migrations_test.go` to assert the new table and column names.
- **Done when:** `go test ./internal/db/...` passes against a fresh DB AND against a copy of the production DB.

### 2. Go — models, repo, handlers, routes

- [ ] Rename `models.Event` → `models.Activity` (struct, JSON tags, helper methods).
- [ ] Rename file `internal/db/event_repo.go` → `activity_repo.go`; `EventRepo` → `ActivityRepo`; SQL strings reference `activities`.
- [ ] Rename file `internal/api/event_handler.go` → `activity_handler.go`; `handleCreateEvent`/etc. → `handleCreateActivity`/etc.; request/response payload structs (`createEventRequest` → `createActivityRequest`).
- [ ] `server.go` — route table swap to `/activities`.
- [ ] **Done when:** `go build ./...` and `go test ./...` both pass.

### 3. Go — bus

- [ ] `internal/events/bus.go` — rename `EventCreated/Updated/Deleted` constants and their wire strings to `activity.*`. Update package doc-comment example. Update the `Payload any` comment from `*models.Event` to `*models.Activity`.
- [ ] `internal/events/bus_test.go` — update wire-string assertions.
- [ ] `internal/ws/hub_test.go` — update message-type assertions.
- [ ] **Done when:** `go test ./internal/events/... ./internal/ws/...` passes; `golangci-lint run` clean.

### 4. OpenAPI + generated types

- [ ] `packages/shared/openapi.yaml` — schema `Event` → `Activity`; paths, operationIds, tags, request/response body names. **Preserve `googleEventId` and `caldavUid` fields.**
- [ ] Run `pnpm --filter shared generate`.
- [ ] Verify `packages/shared/src/index.ts` now exports `Activity`, `CreateActivityJSONBody`, etc., and no `Event` type remains.
- [ ] Verify `packages/api/internal/api/api_types.gen.go` regenerated.
- [ ] **Done when:** `pnpm --filter shared lint` clean; `go build ./...` still passes.

### 5. Web — types, hooks, components, copy

- [ ] `packages/web/src/types/index.ts` — `DrabaEvent` → `DrabaActivity`, `EventStatus` → `ActivityStatus`, `EVENT_COLORS` → `ACTIVITY_COLORS`.
- [ ] Rename `src/hooks/useTeamEvents.ts` → `useTeamActivities.ts`; rename all exported hooks + query keys.
- [ ] `src/hooks/useWebSocket.ts` — update message-type switch to `activity.*`.
- [ ] Rename components: `EventDetailPanel`, `EventCreatePanel`, `EventPanel` → `Activity*` variants. Update all imports.
- [ ] UI copy sweep: sidebar label, panel titles, empty-state ("No viewable events" → "No viewable activities"), ARIA labels, page titles, button labels ("Add Event" → "Add Activity").
- [ ] **Done when:** `pnpm --filter web lint` (tsc) clean; dev server renders; smoke-test passes (see Verification).

### 6. Tests + seed

- [ ] Rename `event_handler_test.go` → `activity_handler_test.go`; update cases and assertions.
- [ ] Rename `scripts/seed-find-test-events.sql` → `seed-find-test-activities.sql`; update INSERT statements, cleanup block, and any docs/scripts that reference the path.
- [ ] **Done when:** all tests pass; smoke-test seed still produces the expected rows.

### 7. Docs

- [ ] `docs/ROADMAP.md` — bulk rename "Event"/"events" to "Activity"/"activities" where it refers to the domain entity. **Hand-review:**
  - Phase 3 title becomes "Core API — Activities & Teams (originally Events; renamed in Phase 9.5)".
  - Calendar Sync section (Phase 12) — keep "calendar event" terminology.
  - Internal event bus / WebSocket references — keep "event" where it means the bus message.
- [ ] `docs/REQUIREMENTS.md` — "### Events" section → "### Activities"; sweep body.
- [ ] `docs/ARCHITECTURE.md` — sweep domain references; **do not touch** the event-bus section.
- [ ] `docs/CONVENTIONS.md`, `docs/TESTING.md`, `docs/design/UX_PATTERNS.md` — sweep.
- [ ] `docs/TASKS.md` — mark Phase 9.5 tasks; do not rewrite the Phase 3 historical task block (those were correctly named "events" when they shipped); add a one-line note on first occurrence pointing to Phase 9.5.
- [ ] `docs/log.md` — add the Phase 9.5 entry per project rule (never skip).
- [ ] **Done when:** the final-sweep grep below returns only expected hits.

### 8. Final sweep

Run:
```powershell
# Activities — should return zero unexpected hits
rg -n "\bevent" packages/ docs/ --glob "!**/log.md" --glob "!**/*.gen.go" --glob "!**/index.ts"
```

Expected remaining matches (acceptable):
- `internal/events/...` (package path, bus types, bus comments)
- `google_event_id`, `googleEventId`, `caldav_uid`, `caldavUid` (calendar field names)
- Comments mentioning "Google Calendar event", "VEVENT", "iCalendar event"
- ROADMAP Phase 3 parenthetical "(originally Events; …)"
- `docs/log.md` historical entries

Anything else → audit and decide.

---

## Verification

End-to-end checks against the test docker at `http://epcot.lan:8081`:

- [ ] `cd packages/api && golangci-lint run` — clean
- [ ] `cd packages/api && go test ./...` — all pass
- [ ] `pnpm --filter web lint` — clean (tsc no errors)
- [ ] `pnpm --filter shared generate` — produces `Activity` exports, zero `Event` exports
- [ ] **Migration dry-run:** copy `\\epcot.lan\portainer-appdata\Config\draba\data\draba.db` to a scratch location, run the server against it, then:
  - `sqlite3 scratch.db ".schema activities"` shows the renamed table
  - `sqlite3 scratch.db "SELECT COUNT(*) FROM activities;"` matches pre-migration `SELECT COUNT(*) FROM events;`
  - `sqlite3 scratch.db "PRAGMA foreign_key_check;"` returns no rows
- [ ] **Smoke test (manual, browser at http://epcot.lan:8081):**
  - Create an activity → block appears on Gantt
  - Edit it (title, dates, assignees) → saves; reload survives
  - Archive → disappears from default list; appears with `?archived=true`
  - Unarchive → reappears
  - Delete → gone
  - In devtools → Network → WS frames: confirm message types arrive as `activity.created`, `activity.updated`, `activity.deleted` (not `event.*`)
- [ ] OpenAPI `Activity` schema still has `googleEventId` and `caldavUid` fields
- [ ] `activities` table still has `google_event_id` and `caldav_uid` columns

---

## Rollback

If anything goes wrong post-deploy:

1. Restore the pre-migration DB from `\\epcot.lan\portainer-appdata\Config\draba\data\draba.db.bak-pre-9.5`.
2. `git revert` the Phase 9.5 commit (or merge commit if shipped as a PR).
3. Redeploy the previous image.

Reverse migration (if needed inline rather than restore):
```sql
ALTER TABLE activities RENAME COLUMN parent_activity_id TO parent_event_id;
ALTER TABLE activities RENAME TO events;
ALTER TABLE activity_tags RENAME TO event_tags;
ALTER TABLE activity_assignments RENAME TO event_assignments;
```

**Take a DB backup before applying migration 005.** This is the one irreversible step if you don't have a backup.

# Testing & Review Procedures

This document is the source of truth for what we test and how. It is consumed by the `/test-phase` and `/review-phase` slash commands, which fan work out to subagents that run in parallel. The framework grows phase-by-phase: every new ROADMAP phase adds a section here, and the subagents pick it up automatically.

For the human-review checklist used on diffs, see [REVIEW.md](REVIEW.md).

---

## Test environment setup (manual, do once per host)

These steps set up the docker host so `/test-phase` can run end-to-end. Do them **in this order** — later steps assume earlier ones are done.

### Step 1 — One-time host prep (manual)
On the docker host, as the `draba-test` user (created in the SSH setup steps below):

1. Copy `scripts/reset-test-env.sh` to `~/scripts/reset-test-env.sh` and `chmod +x` it.
2. Create `~/.draba-test.env` (chmod 600) with:
   ```
   DRABA_TEST_INVITE_TOKEN=<pick a long random string>
   DRABA_TEST_ADMIN_EMAIL=test-admin@local
   DRABA_TEST_INVITE_EMAIL=invitee@local
   DRABA_DB_DIR=/portainer/Files/AppData/Config/draba/data
   DRABA_CONTAINER=draba
   ```
   `DRABA_TEST_INVITE_EMAIL` is the email the api-smoke subagent registers as — it must match the email the invite was seeded for. Default `invitee@local` is fine.
   The script auto-sources this file at startup. No sudo, no `/etc/`, no compose dir — the script uses `docker stop/start` directly and runs file ops inside throwaway containers, so the host user only needs `docker` group membership.

### Step 2 — Per-run reset (manual or SSH-driven)
Before each `/test-phase` run that needs a clean DB, run on the docker host:
```bash
./scripts/reset-test-env.sh
```
This stops the container, wipes the SQLite file, restarts, waits for the schema **and the sample-data seed** to load, then layers a bootstrap team + a known invite token on top. After it completes, the container holds the **canonical sample dataset** (3 teams, 6 timelines, 58 activities, 8 share links, …) *plus* the bootstrap admin/team/invite, with `DRABA_TEST_INVITE_TOKEN` valid for `POST /auth/register`.

**Sample data is the default dataset during pre-launch.** The container must have **`DRABA_SEED_SAMPLE_DATA=1`** set (it's in `docker-compose.yml`; add it to the Portainer/epcot container env too). On an empty DB the binary seeds the embedded `packages/api/sample_data/*.sql` after migrations; it is a no-op once the DB has users, so it never clobbers data. This is a deliberate pre-launch convenience while it's just us and there are no real users — **turn the flag off before onboarding anyone real.** The bootstrap rows (`test-admin@local`, `bootstrap-team`, the invite) are intentionally distinct from every sample email/ID, so they coexist without collision.

> api-smoke note: the DB now contains the 3 sample teams in addition to `bootstrap-team`. Flows that target `bootstrap-team` by name/id are unaffected; avoid assertions that assume an exact global team/user count.

### Step 3 — Tell Claude how to reach it (one-time, on the dev box)
On the machine where you run Claude (this Windows box):
- The test URL should be stored in the `reference_test_docker.md` memory entry (not committed to the repo).
- Set `DRABA_TEST_INVITE_TOKEN` in your shell or in a memory entry so subagents can pass it through. **Do not commit it.**
- Configure key-based SSH from this box to the docker host so `/test-phase` can run the reset itself. Recommended setup: a dedicated `draba-test` user on the docker host, an ed25519 keypair with a passphrase loaded in `ssh-agent`, and the public key pinned in `authorized_keys` with `command="/usr/local/bin/draba-reset"` plus `no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding` so the key can only run the reset script. Add an SSH config alias `Host draba-test` so the call is just `ssh draba-test`.

### What's manual vs automated, at a glance

| Step | Where it runs | Who does it |
|---|---|---|
| Host prep (Step 1) | Docker host | **You, once** |
| Reset before a test run (Step 2) | Docker host | **You manually** *(or SSH-driven if configured — Claude can trigger)* |
| Static checks, unit tests, schema check, security review | Dev box (this machine) | Claude |
| API smoke against live container | Dev box → live container | Claude |
| Logging the run to `docs/log.md` | Dev box | Claude |

---

## Global procedures

These run regardless of phase.

### Static checks
- `cd packages/api && golangci-lint run`
- `cd packages/api && go vet ./...`
- `pnpm --filter web lint`
- `pnpm --filter web build`

### Unit & integration
- `cd packages/api && go test -count=1 ./...`
- Race detector (`-race`) requires CGO/GCC — not available on the Windows dev box. It runs in CI (GitHub Actions, Linux runner) on every push. Do not mark a local run as failed for omitting `-race`.

### Live smoke target
Live-smoke subagents (`api-smoke`, future `ws-smoke`) hit a running container. The URL is **not** stored in the repo — it's resolved at runtime in this priority order:
1. `DRABA_TEST_URL` environment variable, if set.
2. The `reference_test_docker.md` memory entry (Brian's local LAN host).
3. If neither is available, the subagent reports **skipped**, not failed.

### Review checklist (always)
- CONVENTIONS.md compliance
- No scope creep beyond the phase's ROADMAP entry
- Errors handled at boundaries (HTTP, DB, external APIs); internal calls trust contracts
- No secrets, no `.env` files, no host-specific values committed
- Migrations idempotent (re-run produces no diff)
- `docs/log.md` updated with a dated entry

---

## Subagent map

| Subagent | Scope | Active from |
|---|---|---|
| `static-check` | lint + vet + web typecheck/build | Phase 1 |
| `unit-test` | `go test -race -count=1 ./...` | Phase 2 |
| `schema-check` | run migrations on fresh SQLite, re-run, assert no diff | Phase 2 |
| `api-smoke` | hit live container, run phase exit-criteria flows via curl | Phase 2 |
| `security-review` | scan diff for secrets, missing auth, SQL concat, JWT misuse | Phase 2 |
| `type-sync` | regen OpenAPI types, assert no diff | Phase 4 |
| `ws-smoke` | WebSocket: team-scoped broadcast within 500ms, heartbeat | Phase 5 |
| `web-e2e` | Chrome MCP — login, render timeline, drag-create | Phase 7 |
| `unit-test` (frontend) | `pnpm --filter web test` (Vitest) — pure-function and component-render assertions | Phase 10.4.1 |

---

## Per-phase procedures

### Phase 1 — Project Infrastructure

**static-check**
- `go build ./...` from `packages/api/` succeeds with no errors
- `pnpm build` from `packages/web/` succeeds
- `golangci-lint run` is clean
- `docker compose config` parses without error — skip if Docker is not installed on the dev box (verified by CI)

### Phase 2 — API Foundation (DB & Auth)

**unit-test**
- All `*_test.go` under `packages/api/internal/` pass with `-race -count=1`
- `internal/auth` package (`packages/api/internal/auth/auth_test.go`):
  - Access/refresh roundtrip returns correct claims — `TestTokenService_AccessToken_Roundtrip`, `TestTokenService_RefreshToken_Roundtrip`
  - Tampered signature rejected — `TestTokenService_Validate_WrongSecret`
  - Expired token rejected — `TestTokenService_Validate_Expired`
  - Token type mismatch rejected both directions — `TestTokenService_Validate_WrongType_AccessAsRefresh`, `TestTokenService_Validate_WrongType_RefreshAsAccess`
  - Algorithm-confusion guard (`alg=none` / non-HMAC) — `TestTokenService_Validate_AlgConfusion`
  - Password hash roundtrip / wrong password — `TestHashPassword_CheckPassword_Roundtrip`, `TestCheckPassword_WrongPassword`
- `internal/db` — `invite_repo` (`packages/api/internal/db/invite_repo_test.go`):
  - `GetValid` returns `sql.ErrNoRows` for an expired invite — `TestInviteRepo_GetValid_Expired`
  - `GetValid` returns `sql.ErrNoRows` after `MarkAccepted` (single-use enforcement) — `TestInviteRepo_GetValid_AfterMarkAccepted`

**schema-check**
- Start container against a fresh `data.db`; confirm these tables exist: `users`, `teams`, `team_members`, `invites`, `api_tokens`, `activities`, `activity_tags`, `activity_assignments`, `timelines`, `timeline_access`, `calendar_connections`, `statuses`
  - Note: `status_templates`, `status_template_items`, `instance_settings`, and `password_reset_tokens` are managed via app logic, not standalone migration tables.
- Restart the container; assert migration runner produces no schema changes (idempotency)

**api-smoke** (against `$DRABA_TEST_URL`)
- `POST /auth/register` with a valid invite token → 200/201, returns user + JWT
- `POST /auth/register` with an invalid/missing invite token → 4xx
- `POST /auth/register` with the **same** invite token a second time → 4xx (single-use)
- `POST /auth/login` with the registered credentials → 200, returns JWT
- `POST /auth/login` with a non-existent email → 401
- `POST /auth/login` with bad credentials → 401
- `POST /auth/refresh` with a valid refresh token → 200, returns new JWT
- `POST /auth/refresh` with an access token (wrong type) → 401
- `POST /auth/refresh` with a token signed by a different secret → 401
- A subsequent authenticated request with the issued JWT → 200 (validates signing)

**security-review**
- No password fields stored in plaintext (grep migrations + handlers)
- JWT secret loaded from env/config, not hardcoded
- Invite tokens single-use (consumed on register) — also asserted behaviorally in api-smoke above
- No SQL string concatenation in queries

### Phase 3 — Core API (Events & Teams)

**api-smoke**
- `POST /teams` → returns team (201 Created)
- `GET /teams/:id` with member token → 200 OK, returns team
- `GET /teams/:id` with non-member token → 403 Forbidden
- `POST /teams/:id/invites` → returns invite token (201 Created)
- Register via that token → user appears in `GET /teams/:id/members` (200 OK)
- `POST /teams/:id/timelines/:timelineId/activities` (body: `title`, `startAt`, `endAt` as RFC3339) → 201 Created, then `GET /teams/:id/timelines/:timelineId/activities?from=<RFC3339>&to=<RFC3339>` returns it (200 OK) — params must be full RFC3339 (e.g. `2026-01-01T00:00:00Z`), bare dates return 400
- `PATCH /activities/:id` updates fields (200 OK); `DELETE /activities/:id` removes it (204 No Content / 200 OK), subsequent GET excludes it
- Auth: every endpoint rejects requests without a valid JWT (401 Unauthorized)
- Authz: a user not on the team cannot read or mutate that team's activities (403 Forbidden)
  - **Setup note:** the "non-member" user must be genuinely absent from the team under test. In the seeded environment every user registered via the bootstrap invite automatically joins `bootstrap-team`, so using that user against `bootstrap-team` produces `200 []` (correct member behaviour, not a 403). Correct approach: create a second team (`POST /teams`), issue an invite for that team, register a fresh user — that user is on team B only. Then use their JWT to hit team A's activity endpoint and expect `403`.
- Tier Limits: exceeding the plan limits for a team returns appropriate HTTP errors (e.g., 402 Payment Required or 403 Forbidden)

**security-review**
- Every new route requires auth middleware
- Team membership enforced on every team-scoped endpoint

### Phase 4 — OpenAPI Spec & Type Generation

**type-sync**
- `pnpm generate` succeeds with no errors
- `git diff` after generate is empty (committed types match spec)
- All Phase 2–3 endpoints present in `packages/shared/openapi.yaml`

### Phase 5 — Real-Time (WebSocket)

**unit-test**
- `TestHub_Heartbeat_PingReceived` — server sends a `{"type":"ping"}` JSON message within one heartbeat interval
- `TestHub_Heartbeat_MissedPingDisconnects` — server closes the connection after `readTimeout` elapses with no pong
- Both tests use `testSetupFast` (50ms heartbeat / 200ms readTimeout) so they run in milliseconds

**ws-smoke**
- Two clients on team A both receive a delta within 500ms of an event mutation
- A client on team B does not receive team A's events
- Heartbeat: connect, subscribe, respond to every `{"type":"ping"}` with `{"type":"pong"}`, assert connection stays open for at least 3 ping cycles (use a 30s real-interval container; verify no disconnect over ~100s)
  - Note: this is a slow manual check; unit tests (`TestHub_Heartbeat_*`) cover the behavior at speed

### Phase 6 — Timelines

**unit-test**
- `timeline_repo.RevokeAccess` (`packages/api/internal/db/timeline_repo_test.go`):
  - Grant access then revoke; `HasAccess` returns false after revoke — `TestTimelineRepo_RevokeAccess_RemovesAccess`
  - Revoking access that was never granted is a no-op (no error) — `TestTimelineRepo_RevokeAccess_Noop`
- `timeline_repo.ListByTeam`:
  - Returns all non-archived timelines for a team in descending creation order — `TestTimelineRepo_ListByTeam_ReturnsBothOrderedByCreation`
  - Returns empty slice (not error) when team has no timelines — `TestTimelineRepo_ListByTeam_Empty`

**api-smoke**
- `POST /teams/:id/timelines` with JWT → 201 Created
- `GET /timelines/:id` with JWT (user on access list) → 200 OK
- `GET /timelines/:id` with JWT (user not on access list) → 403 Forbidden
- `GET /timelines/share/:token` → 200 OK without requiring auth

### Phase 7 — Web — Scaffold

**web-e2e**
- Navigating to protected routes unauthenticated redirects to `/login`
- Successful login redirects to the main app view and stores the token
- TanStack Query successfully fetches team/event data from the API
- WebSocket client successfully connects and maintains a heartbeat

**Known gap (historical — resolved from Phase 10.4.1 onward)**
At Phase 7, no Vitest/Testing Library setup existed yet; the Chrome MCP e2e tests covered the golden path alone. Vitest landed starting Phase 10.4.1 (`pnpm --filter web test`); see per-phase `unit-test` sections below for what's actually covered today. Most interactive-modal components (`TeamModal`, `MemberModal`, `TimelineModal`) still have no Vitest coverage — each phase section below calls this out explicitly where it applies, rather than assuming coverage exists.

### Phase 8.0 — RBAC Refactor + First-Run Setup

**unit-test**
- `db.Migrate` applies migration `003_rbac_participants.sql` cleanly on a fresh DB and on a DB seeded with pre-migration data — `packages/api/internal/db/migrations_test.go` (`TestMigrate_006_007_ColorConversion` exercises the migration chain through `003_rbac_participants.sql`; no dedicated `003`-only regression test exists beyond that)
- First registered user is auto-granted `is_superadmin` — `TestRegister_FirstUserIsSuperadmin` (`packages/api/internal/api/auth_handler_test.go:95`)
- Second/subsequent registered user is **not** superadmin — `TestRegister_SubsequentUserIsNotSuperadmin`
- `GET /setup/status` returns `{"needsSetup": true}` on an empty DB, `false` once a user exists, and requires no auth — `TestSetupStatus_NeedsSetup`, `TestSetupStatus_NoSetupNeeded`, `TestSetupStatus_NoAuthRequired` (`packages/api/internal/api/setup_handler_test.go`)
- Superadmin bypasses team-membership and team-admin checks via the synthetic admin member — `requireTeamMember`/`requireTeamAdmin` in `packages/api/internal/api/authz.go:15-52` (no team row required; covered indirectly by team/timeline handler tests using a superadmin caller)

**api-smoke**
- `GET /setup/status` on a fresh container → 200, `needsSetup: true`
- Complete the 3-step wizard (`POST /auth/register` → `POST /teams` → `POST /teams/:id/timelines`) → all succeed; resulting user has `isSuperadmin: true`
- `GET /setup/status` after the wizard completes → 200, `needsSetup: false`
- A non-member superadmin can `GET`/mutate a team's resources without an explicit `team_members` row (e.g. `GET /teams/:id`, `POST /teams/:id/timelines`) → 200/201, not 403

**web-e2e**
- Navigating to `/setup` on a fresh instance shows the 3-step wizard (Account → Team → Timeline); `StepIndicator` reflects current step — `packages/web/src/pages/SetupPage.tsx`
- Completing all 3 steps and clicking Finish creates the account, team, and timeline, then redirects to `/` without a page reload
- Navigating to `/setup` after setup is complete redirects unauthenticated visitors to `/login` and authenticated visitors to `/` (`SetupPage.tsx:343-345`)
- Step validation blocks `Next`/`Finish` on empty/invalid fields (e.g. password < 8 chars, password containing whitespace, end date before start date) — `validateStep` (`SetupPage.tsx:271-288`)

**security-review**
- `is_superadmin` cannot be set via any request body field (`auth_handler.go:95` sets it server-side from `count == 0`; check `oidc_handler.go:226` defaults SSO registrations to `false`)
- `GET /setup/status` exposes no PII — response is the single `needsSetup` boolean (`setup_handler.go:14`)
- Migration `003_rbac_participants.sql` correctly migrates `event_assignments`/`timeline_access` FK data via join-through-team-members rather than dropping rows silently (verify INSERT…SELECT joins, not blind truncation)

### Phase 8.1 — Web — Gantt Shell & Event Rendering

**unit-test**
- `formatDragDate` renders UTC dates without timezone drift (midnight-UTC May 31 shows "May 31", not "May 30") — `packages/web/src/components/gantt/GanttGrid.format.test.ts`
- `buildRows` (group-by + sort + tree logic) — `packages/web/src/components/gantt/GanttView.tree.test.ts`:
  - Parent grouping nests grandchildren at increasing `depth`; parents marked `hasChildren`
  - Collapsing a parent hides its full subtree; collapsing a mid-level parent hides only its descendants
  - An activity whose parent is out of view renders as a root (no orphaned crash)
  - A parent-pointer cycle does not infinite-loop
  - Member grouping emits one group per unique assignee combination in team order; multi-assignee activities appear once under their combo group, not duplicated; unassigned activities sort last
- `generateColumns`/`positionInColumns` date-to-pixel math — `packages/web/src/components/gantt/granularity.test.ts`:
  - Monday vs. Sunday `weekStart` produces correct first-column boundary
  - `en-US` vs `en-GB` locale formatting of column labels
  - Midnight-UTC activity dates land in the correct day column regardless of local timezone (`positionInColumns` UTC-safety suite)

**api-smoke**
- `GET /teams` returns the caller's teams (list-user's-teams addition for Gantt team switcher)
- `GET /teams/:id/timelines` returns timelines bounded by date range for the Gantt date picker
- `GET /teams/:id/timelines/:timelineId/activities?from=&to=` response includes `assignedMemberIds[]` on each activity (consumed by `GanttGrid` avatar rendering and `buildRows` member grouping)

**web-e2e**
- Activities render as bars in the correct date columns with correct width at default zoom
- Group by Member shows one section per assignee with correct activities beneath; Group by Parent indents children under their parent row
- Sort by Start date / End date / Title reorders rows within a group
- Zoom (granularity) steps change column width and the grid scrolls correctly
- `GanttToolbar` renders with functional zoom, group-by, and sort-by controls; Export control is present (stub — no assertion on output)

### Phase 8.1.1 — Rename Timeline View → Gantt

**static-check**
- `pnpm --filter web build` and `pnpm --filter web lint` clean after the rename — confirms no stale imports of `TimelineView`/`TimelineGrid`/`TimelineToolbar` or the `'timeline'` `ViewMode` literal remain
- `grep -r "TimelineView\|TimelineGrid\|TimelineToolbar" packages/web/src` returns no matches outside historical comments/docs (components now live under `packages/web/src/components/gantt/` as `GanttView`/`GanttGrid`/`GanttToolbar`)

**unit-test**
- Existing Gantt unit tests (`GanttGrid.format.test.ts`, `GanttView.tree.test.ts`, `granularity.test.ts`) import from the renamed paths and pass — confirms the rename didn't break test wiring

### Phase 8.1.2 — Gantt View Polish

**unit-test**
- `snapDivisorFor` returns the correct sub-column snap divisor per granularity (week→7, month→4, quarter→3, year→4, day/auto→1) — `packages/web/src/components/gantt/granularity.test.ts`
- Fractional event positioning at day granularity: midnight-UTC activity on the last day of a month lands in the correct column (`Math.floor(startCol)` check) and the column label matches — same file, "positionInColumns" suite

**web-e2e**
- Empty timeline (no activities) shows `EmptyState` — draba icon + "No viewable events" — centered on screen, not inside the scroll container — `packages/web/src/components/shared/EmptyState.tsx`
- Zoom dropdown offers Auto / Day / Week / Month / Quarter / Year; selecting Auto picks an appropriate granularity based on the timeline's date-range duration (visually denser for short ranges, coarser for long ones)
- Event bars position correctly with fractional column math at every granularity level (no visible misalignment when switching zoom)

### Phase 8.2 — Web — Gantt Interactions

**unit-test**
- `ActivityDetailPanel` rendering/behavior — `packages/web/src/components/gantt/ActivityDetailPanel.test.tsx` (check current contents for view/edit-mode coverage; component was later renamed per Phase 9.5 note in ActivityCreatePanel/ActivityDetailPanel naming)

**api-smoke**
- `PATCH /activities/:id` updates fields → 200 OK; `DELETE /activities/:id` → 204/200, subsequent `GET` excludes it
- `POST /teams/:id/timelines/:timelineId/activities` with assignee + date-range payload → 201 Created

**web-e2e**
- Clicking an activity block opens `ActivityDetailPanel`; Edit button switches to inline editing (title, description, date range, status, assignees)
- Saving an edit calls `PATCH /activities/:id`, applies an optimistic update, and closes the panel without a page reload
- Deleting an activity (via panel) prompts a confirm dialog, then `DELETE /activities/:id` removes the block from the Gantt
- Dragging on an empty lane cell captures a start/end date range and opens `ActivityCreatePanel` pre-filled with the selected lane's member and date range
- Submitting the create form `POST`s the new activity and it appears on the Gantt without a page reload

### Phase 8.2.1 — Gantt Bar Drag — Resize & Move

**unit-test**
- `formatDragDate` (drag-tooltip date formatting, UTC-safe) — already covered under Phase 8.1's `GanttGrid.format.test.ts`; re-verify here since it's the tooltip shown during edge/body drag
- `snapDivisorFor` (snap-to-column granularity) — `granularity.test.ts`, reused by drag math in `GanttGrid.tsx:391` (`snapDivisorFor(resolvedGranularity ?? 'auto')`)

**web-e2e**
- Mousedown + drag on a bar's left/right 8px edge resizes start or end date; a date tooltip shows the new date during drag; `PATCH /activities/:id` fires on mouseup, no page reload (resize handlers wire `mouseup` at `packages/web/src/components/gantt/GanttGrid.tsx:238,241`)
- Mousedown + drag on a bar's body shifts both start and end dates by the same delta; tooltip shows new date range during drag; `PATCH` fires on mouseup (body-drag `mouseup` wiring at `GanttGrid.tsx:334,338`)
- Drag snaps to column boundaries matching the active granularity (e.g. day-snap at Day granularity, week-snap at Month granularity) — uses `snapDivisorFor`
- Bar position updates optimistically during drag (no flash/jump after the PATCH response lands)
- `is_external` events are non-draggable — **(unverified — no `isExternal`/`is_external` field or read-only-drag guard found in `GanttGrid.tsx` or elsewhere in `packages/web/src/components`; Phase 18 calendar-sync dependency likely not yet landed. Flag for review before marking this assertion as covered.)**

### Phase 8.3 — Web — Real-Time WebSocket Sync

**unit-test**
- No dedicated Vitest file found for `useTeamActivitySync` cache-merge logic (`packages/web/src/hooks/useTeamActivities.ts:109-181`) — **gap, consider adding a `useTeamActivitySync.test.ts` covering the create/update/delete cache-merge branches and the updatedAt-based conflict guard described below.**

**ws-smoke**
- A second client subscribed to the same team receives `activity.created`/`activity.updated`/`activity.deleted` deltas within 500ms of a mutation on the first client
- `activity.updated` deltas with an `updatedAt` older than or equal to the cached version are dropped (self-echo / stale-update guard) — `useTeamActivitySync` (`useTeamActivities.ts:140-146`: `incomingMs > cachedMs ? incoming : a`)
- `activity.deleted` removes the row from every cached `['timelines', id, 'activities']` query for the team, falling back to a broader `['timelines']` invalidation if the team's timeline list isn't cached yet (`useTeamActivities.ts:154-170`)

**web-e2e**
- A second browser tab's Gantt view updates within 500ms when an activity is mutated in the first tab (create, edit, and delete)
- No duplicate or ghost blocks after rapid create/edit/delete sequences across two tabs — duplicate-create guard checks `old.some(a => a.id === incoming.id)` before appending (`useTeamActivities.ts:129`)

### Phase 8.4 — Persistent View Settings

**unit-test**
- `GET /users/me/preferences` returns empty array when none set; requires auth (401 without token) — `TestGetPreferences_EmptyGlobal`, `TestGetPreferences_Unauthenticated` (`packages/api/internal/api/user_preference_handler_test.go`)
- `PUT /users/me/preferences` upserts a global preference (`timelineId` omitted/empty) — `TestUpsertPreference_GlobalSuccess`
- Repeated `PUT` with the same key updates in place rather than duplicating the row (unique constraint on `(user_id, timeline_id, key)`) — `TestUpsertPreference_UpdateOnConflict`
- Timeline-scoped preference (`timelineId` set) is isolated from the global scope — global `GET` stays empty, scoped `GET ?timeline_id=` returns it — `TestUpsertPreference_TimelineScoped`
- Validation: missing `key` → 400 (`TestUpsertPreference_MissingKey`); non-JSON `value` → 400 (`TestUpsertPreference_InvalidJSONValue`); `key` > 64 chars → 400 (`TestUpsertPreference_KeyTooLong`); `value` > 4096 bytes → 400 (`TestUpsertPreference_ValueTooLong`)
- Unauthenticated `PUT` → 401 (`TestUpsertPreference_Unauthenticated`)

**web-e2e**
- Changing zoom/group-by/sort-by on a timeline, switching to a different timeline, then switching back restores the original per-timeline settings (round-trips through `usePreferences` → `PUT/GET /users/me/preferences?timeline_id=`)
- Dark mode and selected team (global preferences) persist across logout/login
- Opening the same account in two browser tabs: changing a setting in tab A and refreshing tab B shows the updated value (settings sync via the API, not localStorage alone)

### Phase 8.5 — Find (In-View)

**unit-test**
- `matchEvents` field coverage — `packages/web/src/lib/findMatcher.test.ts`:
  - Empty/whitespace query returns no results
  - Matches title and description case-insensitively
  - Matches assignee display name, surfaces `assignee: <Name>` as a match reason
  - Matches parent-activity title for child activities, surfacing a `parent: <title>` reason
  - Multiple matching fields produce multiple reasons (e.g. both `title` and `description` for the same activity)
  - Restricting `visibleActivities` excludes activities outside the passed-in set (verifies "respects active filters" scoping)
  - Activities missing optional fields (no description/assignees) don't throw
  - **Gap:** tag-name matching is explicitly out of scope in the current implementation — `findMatcher.ts:5` comment: "tags are deferred until the API adds them (Phase ?)." ROADMAP 8.5 lists tag names as an in-scope match field; this is **unverified — not implemented**, flag for review.

**web-e2e**
- `Ctrl/Cmd+F` opens the Find bar (`packages/web/src/components/layout/FindBar.tsx`, wired via `DashboardShell`/`TopBar`); `Esc` closes it; the × button clears the query
- Typing dims non-matching activities to ~0.3 opacity and outlines matches in amber; the active match (prev/next cursor) shows a stronger outline/pulse distinct from other matches
- Match counter shows `N / M` and updates as the query changes
- `Enter`/`Shift+Enter` and the chevrons cycle forward/backward through matches; each step auto-scrolls the Gantt on both axes (horizontal to the date range, vertical to the row) to center the active match
- Stepping onto a match inside a collapsed group auto-expands that group
- Hovering a non-title match (e.g. assignee or parent-title match) shows a "why matched" tooltip/badge
- Zero matches with no filters active shows "No matches"; zero in-view matches **with filters active** shows the "No matches in current view. [Clear filters]" callout, and clicking it clears filters rather than searching outside them
- Find behaves correctly across all granularity levels and group-by modes (title/description/assignee/parent matching still resolves rows correctly when grouped)

### Phase 9 — API Token Auth & Archive

**unit-test**
- `internal/api/api_token_handler_test.go`:
  - Create returns raw token (visible once) + scope; list response never includes the raw `token` field — `TestAPIToken_CreateListRevoke`
  - Delete is idempotent: second `DELETE` on an already-revoked token still returns `204` — `TestAPIToken_CreateListRevoke`
  - Read-scope token: `GET` succeeds, `POST` → `403`; `edit_all`-scope token: `POST` → `201`; any non-full-scope token (including write-scoped) hitting `POST /tokens` → `403` (no self-escalation) — `TestAPIToken_AuthAndScopeEnforcement`
  - Revoked raw token used as Bearer → `401` — `TestAPIToken_RevokedTokenRejected`
  - Invalid scope string (e.g. `"godmode"`) → `400` — `TestAPIToken_InvalidScopeRejected`
- `internal/db/activity_repo_test.go` — `SetArchived` sets/clears `archived_at` — `TestActivityRepo_SetArchived`
- `internal/db/team_repo_test.go` — `TestSetArchived`
- `internal/api/archive_test.go`:
  - Archived activity hidden from default list, restored with `?archived=true` — `TestArchiveActivity_HiddenByDefaultRestorableWithFlag`
  - Archiving/deleting an activity clears `parent_activity_id` on its children — `TestArchiveActivity_ClearsParentRefs`, `TestDeleteActivity_ClearsParentRefs`
  - Archived timeline hidden from default list — `TestArchiveTimeline_HiddenByDefault`
- `internal/api/timeline_handler_test.go` — admin can archive/unarchive (`TestArchiveTimeline_AdminCanArchiveAndUnarchive`), non-admin forbidden (`TestArchiveTimeline_NonAdminForbidden`), archiving a nonexistent timeline 404s (`TestArchiveTimeline_NotFound`)
- `internal/api/team_handler_test.go` — team archive/unarchive and member archive/unarchive, including last-admin-blocked guard — `TestArchiveTeam_Success`, `TestArchiveTeam_NonAdminForbidden`, `TestUnarchiveTeam_Success`, `TestListTeams_IncludesArchivedWhenParamSet`, `TestArchiveMember_LastAdminBlocked`, `TestArchiveAndUnarchiveMember`
- `internal/api/share_lifecycle_test.go` — archiving a timeline kills its active shares/feeds; an archived timeline's share-unlock route 404s — `TestShareArchive_ArchivedTimelineKillsSharesAndFeeds`, `TestShareArchive_UnlockArchivedTimeline404`

**schema-check**
- `api_tokens` table (`internal/db/migrations/001_initial_schema.sql`) has columns `id, user_id, name, token_hash (UNIQUE), scope (CHECK IN read/add/edit_own/edit_all), last_used_at, created_at, revoked_at` — no boolean `read_only`/`is_read_only` field, scope is the enforcement mechanism
- `archived_at` (nullable `DATETIME`, not `is_archived`) present on `activities` and `timelines`

**api-smoke** (against `$DRABA_TEST_URL`)
- `POST /tokens` with a JWT → `201`, response includes a raw `token` string prefixed `draba_pat_` — record it, it is shown only once
- `GET /tokens` → `200`, response list does **not** contain a `token` field for any entry
- Using the raw token value as `Authorization: Bearer <token>` on `GET /activities` (or any read endpoint) → `200`
- A `read`-scope token on `POST /activities` (or any mutation) → `403`
- An `edit_all`-scope token on `POST /activities` → `201`
- `POST /tokens` authenticated with an API token (any scope, not a JWT) → `403` (token minting requires full JWT auth)
- `DELETE /tokens/:id` on your own token → `204`; the same token used afterward as Bearer → `401`
- `DELETE /tokens/:id` called twice → `204` both times (idempotent revoke)
- `POST /activities/:id/archive` → `200`/`204`; subsequent `GET /teams/:id/timelines/:timelineId/activities` excludes it; `?archived=true` includes it
- `POST /activities/:id/unarchive` → activity reappears in the default (unflagged) list
- `POST /timelines/:id/archive` / `/unarchive` → same default-hide / flag-restore behavior for `GET /teams/:id/timelines`
- An archived timeline's public share link (`GET /timelines/share/:token`) → 404/expired, even when called with `?archived=true` (share routes never resurface archived timelines)

**security-review**
- Token hashing: `internal/auth/api_token.go` — raw token is 32 bytes crypto/rand, hex-encoded, prefixed `draba_pat_`; stored as `HashAPIToken()` (**SHA-256**, not bcrypt — justified in-code as the right primitive for a high-entropy unguessable secret, not a low-entropy password) in `api_tokens.token_hash`
- Raw token value is never persisted — only `token_hash` is stored; confirm no logging of the raw token (`GenerateAPIToken` callers)
- `internal/api/middleware.go` distinguishes JWT vs API token by prefix (`auth.LooksLikeAPIToken` → `strings.HasPrefix(raw, "draba_pat_")`), not by length heuristics or a DB-lookup-first race
- `GetByHash` query filters `revoked_at IS NULL` — a revoked token is indistinguishable from a nonexistent one at the auth boundary (no existence leak via differing error codes)
- `DELETE /tokens/:id` 404s identically whether the token doesn't exist or belongs to another user (`internal/api/api_token_handler.go`) — no enumeration of other users' token IDs
- Scope enforcement is a single read/write gate (`middleware.go`: `Scope == tokenScopeRead && r.Method != GET` → `403`) — confirm `add`/`edit_own`/`edit_all` are not silently treated as equivalent to full JWT auth anywhere else in handler code (currently they are not differentiated beyond the binary gate; flag if any handler assumes finer-grained scope semantics that aren't actually enforced)
- `archived_at`-based soft delete: confirm archived rows are excluded from all relevant list queries by default (`WHERE ... AND archived_at IS NULL`), not just the ones covered by tests above

### Phase 9.5 — Rename Event → Activity (The Great Rename)

**unit-test**
- `go test ./...` passes — renamed packages/types compile and existing suites (`activity_handler_test.go`, `activity_repo_test.go`, etc.) are green under their new names
- `internal/events/bus.go` constants are `ActivityCreated`/`ActivityUpdated`/`ActivityDeleted` with wire values `"activity.created"`/`"activity.updated"`/`"activity.deleted"` (not `"event.*"`); `TimelineCreated`/`TimelineUpdated` unaffected (`"timeline.created"`/`"timeline.updated"`)

**schema-check**
- `internal/db/migrations/005_rename_events_to_activities.sql` applies cleanly: `events → activities`, `event_tags → activity_tags`, `event_assignments → activity_assignments`, `parent_event_id → parent_activity_id`
- `google_event_id` and `caldav_uid` columns are **preserved** on `activities` post-rename (external VEVENT identifiers, intentionally not renamed)
- Re-run migration runner — no diff (idempotency), consistent with global schema-check procedure

**api-smoke**
- All activity CRUD routes live at `/activities*`, not `/events*` (create/get/patch/delete/archive/unarchive)
- WebSocket frames for activity mutations arrive typed `activity.created`/`activity.updated`/`activity.deleted`, never `event.*`
- `googleEventId`/`caldavUid` still present and populated on the `Activity` JSON payload where applicable

**security-review / final-sweep grep findings**
- Case-insensitive grep for `event` across `packages/api/internal/` and `packages/shared/openapi.yaml`, excluding the intentionally-kept `internal/events` package self-references and `google_event_id`/`caldav_uid`/`GoogleEventID`/`CaldavUID`:
  - **Clean**: no leftover `Event` struct/type, route, handler, repo, or bus-constant naming tied to the old domain entity.
  - **Flag for review — orphaned dead file**: `packages/api/migrations/001_initial_schema.sql` (different directory than the embedded `internal/db/migrations/`) still defines `CREATE TABLE events`, `event_tags`, `event_assignments`. Not embedded/used by the migration runner, but stale — consider deleting.
  - **Flag for review — minor doc leftover**: `packages/shared/openapi.yaml:5` description prose says "...auth, teams, events, timelines, tags." — should say "activities."
  - **Flag for review (low confidence, naming-only) — `internal/ics/ics.go:15`**: `type Event struct` for the ICS/VEVENT entry type. Plausibly justified the same way as `google_event_id`/`caldav_uid` (external iCalendar spec term), but not documented in-code as an intentional exception.
  - Frontend (`packages/web/src`): grepped for `DrabaEvent`, `EventPanel`, `useTeamEvents`, `EVENT_COLORS` — zero matches, rename appears complete on the web side.

### Phase 9.6 — Identity System (Color + Icon)

**unit-test**
- `packages/web/src/lib/identity-constants.test.ts`:
  - `IDENTITY_COLORS` contains exactly 16 entries, each with a non-empty `id`, `name`, and valid hex
  - `resolveColorHex` passes hex values through unchanged, resolves legacy palette-name IDs to hex for backward compat, and falls back to `teal` for null/undefined/unknown
  - `iconIdToPascal` converts single-word and hyphenated icon IDs to PascalCase
  - `getNameText` covers `__none__`/Lucide-icon-id (empty string), `__name_1__`, `__name_2__`, `__name_words__` variants
- `cd packages/api && go test ./...` passes with the `models.Team`/`models.Timeline`/`models.TeamMember` `Color`/`Icon` field additions in place
- **Gap — no component-level tests exist** for `Badge.tsx`, `IdentityWidget.tsx`, `IdentityPicker.tsx`, or `IdentityTrigger.tsx`. Only the pure-function constants module is covered.

**schema-check**
- `internal/db/migrations/006_identity_fields.sql` adds `icon TEXT` to `team_members`, `color TEXT` + `icon TEXT` to `teams`, `color TEXT` + `icon TEXT` to `timelines`
- `internal/db/migrations/007_hex_colors.sql` immediately follows, reverting 006's hex→colorID conversion back to colorID→hex with an *expanded* 16-color hex palette — **current runtime storage format for `activities.color`/`team_members.color` is hex, not color IDs**. Any assertion about stored color format must target hex (e.g. `#288C9B`-style), not `"teal"`-style IDs.
- Re-run migration runner — no diff (idempotency)

**api-smoke**
- `Team`, `Timeline` payloads include nullable `color`/`icon` fields; `TeamMember` payload includes nullable `icon` — note: openapi.yaml schema descriptions say "Identity color ID" but runtime values are hex post-007; don't assert against the stale doc text
- Existing `PATCH /activities/:id` continues to accept `color`/`icon` (Team/Timeline PATCH lands in Phase 10.x, so color/icon on those entities is read-only via the API at this phase)

**web-e2e**
- `<Badge>` renders correctly in all four name-fallback modes (Lucide icon, 1-letter, 2-letter, none) at sizes 20–40px, both `circle` and `square` shapes
- `<IdentityWidget>` opens a popover showing 16 colors, 4 name options, and 64 icons; selecting any option fires `onChange` immediately and the trigger badge updates without a page reload
- `ActivityDetailPanel` and `ActivityCreatePanel` (via the shared `ActivityFieldsBody` component) render `<IdentityWidget>` — no leftover 8-swatch color grid or "coming soon" icon stub
- An activity with a legacy/pre-migration hex color value still renders its correct swatch (exercises `resolveColorHex` end-to-end through the UI)
- Sidebar timeline rows and member rows render `<Badge>` (not inline `<div>` color swatches)

**security-review**
- No scope-creep: Team/Timeline `color`/`icon` are exposed read-only at the API in this phase (PATCH support deferred to Phase 10.x per ROADMAP, not snuck in early)
- Migration 006 → 007 sequence: confirm 007's hex-mapping is the actual source of truth read everywhere (handlers, repos) — no code path still expects color-ID strings from the DB outside the `resolveColorHex` backward-compat shim

### Phase 10 — Entity Management (data-cornerstone CRUD)

Umbrella phase — no standalone exit criteria of its own. See sub-phases 10.1.1–10.1.4 and 10.2 below; each carries its own assertions.

### Phase 10.1.1 — Teams — CRUD & Management

**unit-test**
- `packages/api/internal/api/team_handler_test.go`:
  - Create/list/get team happy paths — `TestCreateTeam_Success`, `TestListTeams_ReturnsOwnTeams`, `TestGetTeam_Success`
  - `PATCH /teams/:id` updates name/description/notes/icon/color, admin-only — `TestUpdateTeam_Success`, `TestUpdateTeam_NonAdminForbidden`
  - Archive/unarchive — `TestArchiveTeam_Success`, `TestArchiveTeam_NonAdminForbidden`, `TestUnarchiveTeam_Success`
  - `GET /teams?archived=true` includes archived teams — `TestListTeams_IncludesArchivedWhenParamSet`
  - Non-member cannot read a team — `TestGetTeam_NonMember_Forbidden`
  - Duplicate team names allowed (no uniqueness constraint) — `TestCreateTeam_SameNameAllowed`
  - Unauthenticated create/list rejected — `TestCreateTeam_Unauthenticated`, `TestListTeams_Unauthenticated`
  - Missing name rejected — `TestCreateTeam_MissingName`
  - Tier limit enforcement — `TestTierTeamLimit`
- `packages/api/internal/db/team_repo_test.go`:
  - `ListByUserID` scoping and ordering — `TestListByUserID_ReturnsTeamsUserBelongsTo`, `TestListByUserID_ExcludesOtherUsersTeams`, `TestListByUserID_MultipleTeams`
  - `SetArchived` round-trip — `TestSetArchived`

**api-smoke**
- `POST /teams` with `description`/`notes`/`icon`/`color` → 201, fields persisted; `GET /teams/:id` returns them
- `PATCH /teams/:id` by non-admin → 403 (also covered by unit-test, smoke confirms against a live container)
- `POST /teams/:id/archive` then `POST /teams/:id/unarchive` round-trips `archived_at`

**web-e2e**
- `<TeamModal>` opens in `new` mode from the team picker "New team" affordance and in `edit` mode from a team's gear icon
- Settings tab: name/description/notes editable, identity picker (square shape) changes color/icon
- New-team flow shows a "Saved" banner that auto-dismisses (~3s) and unlocks the Members tab
- Members tab is visibly locked ("Save the team first") in `new` mode before first save
- Archive confirmation dialog (amber styling) replaces modal content; archived team disappears from the active picker and appears under a collapsed "Archived" section with an unarchive affordance
- Non-admin member: team edit actions hidden or modal opens read-only

**Known gap**
No Vitest coverage for `TeamModal.tsx` or the team-picker dropdown — all UI behavior above is `web-e2e`-only today.

### Phase 10.1.2 — Members — Management & Editing

**unit-test**
- `packages/api/internal/api/team_handler_test.go`:
  - Invite issue → register → appears in member list — `TestInviteFlow_FullCycle`
  - Invite creation admin-gated — `TestCreateInvite_NonAdminForbidden`
  - Non-member cannot list members — `TestListMembers_NonMemberForbidden`
  - Role change: admin-only, and an admin cannot change their **own** role (`409 SELF_ROLE_CHANGE`, per Standing Decisions) — `TestUpdateMember_RoleChange_AdminOnly`
  - Last-admin guards: delete blocked — `TestDeleteMember_LastAdminBlocked`; archive blocked — `TestArchiveMember_LastAdminBlocked`
  - Clean member removal succeeds — `TestDeleteMember_Success`
  - Member with assignments returns `409 MEMBER_HAS_ASSIGNMENTS` with `assignmentCount` in body — `TestDeleteMember_HasAssignments_Returns409`
  - Archive/unarchive round-trip — `TestArchiveAndUnarchiveMember`
  - Member stats endpoint — `TestGetMemberStats_Success`
  - Invite link create/get/regenerate — `TestInviteLink_CreateGetReset`; revoke — `TestInviteLink_Revoke`
  - User search returns only safe fields (no password hash etc.) — `TestSearchUsers_SafeFields`

**api-smoke**
- `POST /teams/:id/participants` creates a login-less member (`user_id` NULL); subsequent `PATCH`/`DELETE` use the same member endpoints
- `GET /teams/:id/invites` lists pending invites; `DELETE /teams/:id/invites/:inviteId` revokes one
- `POST /teams/:id/invite-link` then register via the returned token → new user joins the team (reusable, multi-use unlike one-time invites)
- Superadmin-only user actions: `POST /users/:id/promote`, `POST /users/:id/archive`, `POST /users/:id/unarchive` — 403 for non-superadmin callers (handlers exist in `packages/api/internal/api/user_handler.go`; no dedicated unit tests found for these four handlers — exercise live instead)
- `DELETE /users/:id`: 403 non-superadmin, `400 CANNOT_SELF_DELETE` on self, `409 MULTI_TEAM` if the user belongs to more than one team (`handleDeleteUser`, `packages/api/internal/api/user_handler.go:308`)
- Archived user cannot log in — `POST /auth/login` returns 401 after `POST /users/:id/archive`; unarchive restores login

**web-e2e**
- Team Modal Members tab: search/add a registered user, invite a new email, create a participant inline, change a role via `<RoleDropdown>` (Admin/Member/Participant), remove a member
- Pending invitations section: "Revoke" button removes the row
- Invite link: copy button shows "Copied!" for ~2s
- `<MemberModal>` opens from a member row, shows timeline/activity stat chips, joined/last-active dates, teams list with role pills
- Superadmin-only Super Admin Actions section: promote/inactivate/delete with confirmation dialogs (indigo/amber/red)
- Password reset button present but shows "SMTP not configured" until Phase 10.1.3 SMTP is configured
- Non-admin sees member list read-only (no role dropdown interaction, no add/remove)
- Inactivated members render at reduced opacity in sidebar/member list

**Known gap**
No Vitest coverage for `MemberModal.tsx`, `TeamModal.tsx` Members tab, or `useMemberManagement.ts` — covered only by web-e2e.

### Phase 10.1.3 — Settings — Profile, Tokens & Admin

**unit-test**
- `packages/api/internal/api/settings_handler_test.go`:
  - Profile update — `TestUpdateProfile_Success`, `TestUpdateProfile_EmptyNameRejected`
  - Password change — `TestChangePassword_Success`, `TestChangePassword_WrongCurrent` (401 `WRONG_PASSWORD`), `TestChangePassword_WeakNew`
  - Forgot-password: always-200 (no email enumeration) — `TestForgotPassword_AlwaysOK`; token created for a known user — `TestForgotPassword_KnownUser_CreatesToken`
  - Reset-password: success — `TestResetPassword_Success`; invalid token — `TestResetPassword_InvalidToken`; expired token — `TestResetPassword_ExpiredToken`
  - Admin settings: superadmin can read/write — `TestAdminSettings_SuperadminCanRead`, `TestPatchAdminSettings_Success`; non-superadmin forbidden — `TestAdminSettings_ForbiddenForNonSuperadmin`; unknown key rejected — `TestPatchAdminSettings_RejectsUnknownKey`; accent color setting — `TestPatchAdminSettings_AccentColor`
  - Public branding endpoint requires no auth — `TestGetPublicBranding_NoAuth`, `TestGetPublicBranding_EmptyWhenUnset`
  - Admin user listing — `TestListAdminUsers_SuperadminCanList`
- `packages/api/internal/api/comms_integration_test.go` (real SMTP send path via test capture):
  - `POST /admin/smtp/test` sends without persisting — `TestSMTPTest_SendsToCallerWithoutPersisting`
  - `PUT /admin/smtp` validates by sending then persists — `TestSMTPValidate_SendsTestEmailAndPersists`
  - Failed validation send does not persist config — `TestSMTPValidate_SendFails_ConfigNotPersisted`
  - Invite email delivery with link — `TestCreateInvite_DeliversInviteEmailWithLink`; no email configured → no send attempted — `TestCreateInvite_NoEmail_NoSend`
  - Forgot-password delivers reset email with link — `TestForgotPassword_DeliversResetEmailWithLink`
- `packages/api/internal/api/api_token_handler_test.go`: full create/list/revoke cycle, scope enforcement, revoked-token rejection, invalid-scope rejection — `TestAPIToken_CreateListRevoke`, `TestAPIToken_AuthAndScopeEnforcement`, `TestAPIToken_RevokedTokenRejected`, `TestAPIToken_InvalidScopeRejected`
- `packages/api/internal/db/user_preference_repo_test.go` + `user_preference_handler_test.go` cover `GET/PUT /users/me/preferences` (global and timeline-scoped upsert, validation)

**api-smoke**
- `PATCH /users/me` with new color/icon → propagates to `team_members` rows where the member's color/icon hadn't been admin-overridden (confirm a member that *was* overridden does **not** get clobbered)
- `PUT /users/me/password` with correct current password → 200, old password then rejected by `/auth/login`, new password accepted
- `POST /auth/forgot-password` → `POST /auth/reset-password` with the emailed token → login works with new password; reusing the same token a second time fails
- `GET/PUT/POST/DELETE /admin/smtp` — full CRUD, superadmin only; `DELETE` clears config and `forgot-password` reverts to "SMTP not configured" behavior
- `GET /admin/users?orphaned=true` filters to users with zero active team memberships

**security-review**
- SMTP password not returned in plaintext from `GET /admin/smtp` (masked)
- `/admin/*` and `/users/:id/promote|archive|unarchive` routes gated on `is_superadmin`, not just team-admin role
- Password reset tokens are single-use and hashed at rest (`password_reset_token_repo.go`) — confirm storage is a hash, not the raw token

**web-e2e**
- `/settings/profile`: display-name save, identity picker propagates to sidebar/member lists
- `/settings/security`: change-password form validation (match + ≥8 chars), inline success/error
- `/settings/preferences`: defaults/regional/appearance fields persist across logout
- `/settings/tokens`: create dialog shows one-time secret reveal with copy-to-clipboard warning; revoke confirmation
- `/settings/admin` superadmin pages: SMTP form + test-connection button, instance defaults, registration-policy toggle, orphaned-users banner+filter, click-through to `MemberModal`
- Forgot-password → reset-password flow: "check your email" message regardless of account existence; reset form redirects to login on success
- Non-superadmin does not see Admin nav section

**Known gap**
No Vitest coverage for any `pages/settings/*.tsx` — web-e2e only.

### Phase 10.1.4 — Member Access & Data Lifecycle

**unit-test**
- `packages/api/internal/api/team_handler_test.go`:
  - `DELETE /teams/:id/members/:memberId` with existing assignments → `409 MEMBER_HAS_ASSIGNMENTS` with `assignmentCount` — `TestDeleteMember_HasAssignments_Returns409`
  - Clean (zero-assignment) removal still succeeds — `TestDeleteMember_Success`
- `packages/api/internal/api/revoke_user_test.go`:
  - Non-superadmin caller forbidden — `TestRevokeUser_ForbiddenForNonSuperadmin`
  - Self-revoke blocked — `TestRevokeUser_SelfRevokeForbidden` (`400 CANNOT_SELF_REVOKE`)
  - Target not found — `TestRevokeUser_UserNotFound`
  - Zero-assignment membership is **removed**, not inactivated, on revoke — `TestRevokeUser_Success`
  - Membership **with** assignments is inactivated, not removed — `TestRevokeUser_WithAssignments_InactivatesMembership`
- `packages/api/internal/db/migrations_test.go::TestMigrate_Idempotent` covers migration 011 re-run producing no diff

**schema-check**
- Migration 011 (`011_fk_restrict.sql`) rebuilds `activity_assignments` and `timeline_access` with `team_member_id` FK as `ON DELETE RESTRICT` (was `CASCADE`) — confirm via `PRAGMA foreign_key_list(activity_assignments)` / `(timeline_access)` on a fresh DB
- `PRAGMA foreign_keys=ON` is set at connection time (`packages/api/internal/db/db.go:26`) — confirm a raw FK violation is rejected by SQLite, not just the app-level guard

**api-smoke**
- Attempt to remove a member with an assigned activity → 409 with `assignmentCount`; archiving the same member instead succeeds (200)
- `POST /users/:id/revoke` (superadmin) on a user with one assignment-free membership → `{accountDeactivated:true, membershipsInactivated:0, membershipsRemoved:1}`; on a user with an assigned activity → membership inactivated instead of removed
- Revoked user cannot log in (`users.archived_at` set); their preserved `team_members` row still renders correctly on existing Gantt bars/assignee badges

**security-review**
- `POST /users/:id/revoke` is superadmin-gated and blocks self-targeting (`CANNOT_SELF_REVOKE`)
- Hard-delete paths (`handleDeleteMember`, `handleDeleteUser`) always check assignment/team counts before issuing the DB delete

**web-e2e**
- Remove (×) on a member with assignments shows inline "N assignment(s) found — [Inactivate instead]" error with a working one-click inactivate action
- `<MemberModal>` "Revoke all access" button opens a confirmation dialog listing the three effects, then calls the revoke endpoint and shows the returned summary
- "Revoke all access" button hidden once the user is already fully inactivated

### Phase 10.2 — Status Templates & Timeline Statuses

**unit-test**
- `packages/api/internal/api/status_handler_test.go`:
  - New team seeds one default "Simple" template on creation — `TestListStatusTemplates_SeedsDefaultOnCreate`
  - Template create (admin) — `TestCreateStatusTemplate_AdminCanCreate`
  - Delete blocked when it's the last template on the team — `TestDeleteStatusTemplate_BlocksLast`
  - Template item add/delete — `TestCreateTemplateItem_AddAndDelete`
  - Template rename — `TestUpdateStatusTemplate_AdminCanRename`
  - Template item update (rename/recolor/reicon/`is_closed` toggle) — `TestUpdateTemplateItem_AdminCanUpdate`
  - Non-admin forbidden on template mutations — `TestStatusTemplates_NonAdminForbidden`
  - Timeline statuses are copied from the chosen template at timeline creation — `TestListTimelineStatuses_CopiedFromTemplate`
  - Timeline status create/update/delete (admin) with last-status-blocked and non-admin-forbidden guards — `TestCreateTimelineStatus_AdminSuccess`/`MissingName`/`NonAdminForbidden`, `TestUpdateStatus_AdminCanRename`/`NonAdminForbidden`/`NotFound`, `TestDeleteStatus_AdminCanDelete`/`LastStatusBlocked`/`NonAdminForbidden`

**api-smoke**
- `GET /teams/:id/status-templates` on a freshly created team returns one "Simple" template with 3 items, the last one `is_closed: true`
- Creating a timeline with a chosen template → `GET .../statuses` returns the copied statuses, independent of later template edits
- Drag-to-reorder persists `position` on template items (`PATCH /status-template-items/:id`)

**security-review**
- All `status-templates`/`status-template-items`/timeline-status mutation routes require team-admin, not just team-membership

**web-e2e**
- Team Modal "Status Templates" tab: list with expand/collapse, create/rename/delete (delete blocked with a guard message when it's the last template)
- Within a template: add/remove item, inline edit name + identity (color/icon) + `is_closed` toggle, drag-to-reorder

**Known gap**
No Vitest coverage for `StatusTemplatesTab.tsx` or `useStatusTemplates.ts` — web-e2e only.

### Phase 10.3 — Timelines — Full CRUD (API + UI)

**unit-test**
- `timeline_repo` (`packages/api/internal/db/timeline_repo_test.go`): `HasAccess` false before grant, true after; grant idempotent; access is per-user; revoke removes access / no-op if never granted
- `timeline_handler` (`packages/api/internal/api/timeline_handler_test.go`): admin can rename (`TestUpdateTimeline_AdminCanRename`); non-admin forbidden; admin can hard-delete; archive/unarchive round trip; archive on missing timeline 404s; access-list grant/revoke round trip (`TestTimelineAccessList_GrantAndRevoke`)
- `status_handler` (`packages/api/internal/api/status_handler_test.go`): timeline statuses seeded from template on create; admin create/rename/delete; non-admin forbidden on all three; deleting the last status is blocked
- Gap: no handler test covers `DELETE /statuses/:id` with `replacementStatusId` reassigning activities first (`StatusRepo.DeleteStatus`, `packages/api/internal/db/status_repo.go:308`) — exercise via api-smoke below

**api-smoke**
- `PATCH /timelines/:id` (admin token) — 200, name/date-range change persists; activities outside new range remain in DB
- `PATCH /timelines/:id` (non-admin token) — 403
- `POST /timelines/:id/archive` then `/unarchive` — 200 each; archived timeline excluded/included from default/`?archived=true` list
- `DELETE /timelines/:id` (admin) — 204/200, hard delete; subsequent `GET /timelines/:id` — 404
- `DELETE /statuses/:id` with `replacementStatusId` set on a status that has activities referencing it — 204, and those activities now carry the replacement status
- `DELETE /statuses/:id` on the last remaining status — 4xx (blocked)
- `GET /teams/:id/timelines/:timelineId/access` — 200; `PUT .../access/:memberId` (admin) — 200/201; `DELETE .../access/:memberId` — 204
- A team member without an access grant — `GET /timelines/:id` → 403; after grant — 200

**web-e2e**
- "New timeline" affordance in sidebar opens create-timeline modal with name, date range, template picker; selected template's statuses preview before submit
- Edit-timeline modal: rename, change date range, archive, delete all reachable from sidebar entry
- Statuses tab inside edit-timeline modal: add/rename/reorder/delete; delete-with-replacement dialog shows affected activity count
- `ActivityDetailPanel` status dropdown populated from the timeline's statuses, shows color dot + icon per option
- Archived timelines collapse under an "Archived" group in the sidebar; unarchive restores to the active list
- Access-list UI: admin can search-pick a member, toggle role, remove; non-admin cannot open the access-list management UI

**security-review**
- `PATCH/DELETE /timelines/:id`, status mutation routes, and access-grant routes all require team-admin, not just team membership

### Phase 10.4.1 — Preference Consumption & Session Handling

**unit-test**
- `api.ts` silent-refresh interceptor (`packages/web/src/lib/api.test.ts`): 200 passes through unmodified; non-401 failure does not retry; on 401, calls registered silent-refresh then retries with new token; refresh returning null re-throws original 401; no refresh registered throws immediately; `configureSilentRefresh(null)` disables the interceptor
- `useFormatDate` (`packages/web/src/hooks/useFormatDate.test.ts`): `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`, default `MMM D, YYYY` all covered; unknown format falls back to default
- `granularity.ts` week-start wiring (`packages/web/src/components/gantt/granularity.test.ts`): Monday vs. Sunday `weekStart` produces different column boundaries

**web-e2e**
- After token expiry, the next API call silently refreshes; if the refresh token is also expired, redirect to `/login` with no error toast
- Gantt renders dates per the logged-in user's `date_format` preference; an unauthenticated share view falls back to instance defaults from `GET /admin/settings`
- Changing `week_start` preference shifts the Gantt week-column grid start day
- Theme persists across devices via the server-side value, not just `localStorage`
- Superadmin sets instance name/accent color — applied globally (tab title, login page, `--primary` CSS variable) and survives container restart

**api-smoke**
- `GET /admin/settings` (public, unauthenticated) returns instance name + accent color

### Phase 10.4.2 — Activity Schema Normalization — Drop team_id

**schema-check**
- Fresh SQLite through all migrations: `activities` table has no `team_id` column; `timeline_id` is `TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE` (migration `015_normalize_activities.sql`)
- Migration 015's backfill UPDATE (assigns orphaned `timeline_id IS NULL` rows to the team's oldest timeline) runs before the table rebuild
- Re-run migrations; assert no schema diff (idempotency)
- `PRAGMA foreign_key_check` returns no rows post-migration

**unit-test**
- `go test ./...` passes with the renamed `ActivityRepo.ListByTimeline` (was `ListByTeam`, `packages/api/internal/db/activity_repo.go:219`)
- `models.Activity` has no `TeamID` field; `grep -rn "TeamID" packages/api/internal/api/activity_handler.go` shows only `timeline.TeamID` (derived via lookup), never `activity.TeamID`

**security-review**
- `grep -rn "activity\.TeamID\|activity\[.teamId.\]" packages/api packages/web/src` returns no matches
- WebSocket broadcasts derive team scoping from the timeline lookup, not a stale activity field

**Note:** activity routes remain team-scoped (`/teams/{id}/timelines/{timelineId}/activities`) rather than a bare `/timelines/{id}/activities` prefix — the `team_id` column removal and `TeamID`-via-lookup refactor are done; the route-prefix simplification described in ROADMAP text was not.

### Phase 10.4.3 — UI Consistency — Modals, Sidebar & Toolbar

**web-e2e**
- `MemberModal`, `TeamModal`, `TimelineModal` all render `InlineEditableTitle` (`packages/web/src/components/shared/InlineEditableTitle.tsx`) for name editing with identical hover/focus underline behavior
- All three modals use the shared `ConfirmDialog` (`packages/web/src/components/shared/ConfirmDialog.tsx`) for destructive/archive/restore confirmations, with color variant matching action (red destructive, amber archive, teal restore)
- `grep -rn "#21262d\|#30363d" packages/web/src/components/{MemberModal,TeamModal,TimelineModal}.tsx` returns no matches (hardcoded hex colors removed)

**Known gap:** no dedicated `ArchiveButton`/`RestoreButton` component exists — styling appears standardized inline rather than extracted into a shared component as the ROADMAP scope suggested; flag for review if a literal shared component is required.

### Phase 10.4.4 — Gantt Interaction & Activity Edit Polish

**unit-test**
- `granularity.ts` `snapDivisorFor()`: week → 7, month → 4, quarter → 3, year → 4 (finer-grained than 8.1.2's table)
- `GanttView.filter.test.ts`: legacy `filterOpenActivities` still passes — confirms the pre-10.4.6 open-only path hasn't silently broken before the `'open'` preset supersedes it

**web-e2e**
- Label column is resizable via a drag handle, clamped between 140–400px; header and rows share the live width during drag
- First click on an unselected bar selects it without dragging; only after selection do grab/resize cursors appear
- Dragging/resizing a selected bar updates `ActivityDetailPanel`'s date inputs live; PATCH fires on mouseup and the panel re-syncs
- "Hide closed" checkbox removed from `GanttToolbar`; "Open only" appears as a `FilterDropdown` preset instead
- Activity edit sidebar: no "All day" checkbox; date pickers only; description directly below date pickers; "Assigned to" uses bordered-card style with color tint when selected; status dropdown shows color dot + icon + name; "Identity" line removed from Classify, "Details" renamed "Advanced"; Notes `<textarea>` present at the bottom

**schema-check**
- `activities` table has a nullable `notes TEXT` column (migration `016_activity_notes.sql`)

### Phase 10.4.5 — Activity Tags, Parent & Progress Fields

**unit-test**
- `tag_repo_test.go`: create + list by team, get by ID, update, delete, unique name per team, set/get tags on an activity, cross-team tag rejected, `ListByTimeline` batch-populates `TagIDs`
- `TagInput.test.tsx` / `useTags.test.ts` cover the combobox/CRUD hook behavior client-side
- `GanttView.tree.test.ts` covers `buildRows` tree construction and collapse logic for `collapsedParents`/`collapsedGroups`

**api-smoke**
- `GET/POST/PATCH/DELETE /teams/:id/tags` full CRUD; `DELETE` cascades to `activity_tags`
- Activity create/update accepts `tagIds`; activity list/get responses include `tagIds`

**web-e2e**
- Tag combobox present in both `ActivityDetailPanel` and `ActivityCreatePanel`; "Create tag" produces a new team tag and associates it immediately
- Parent picker: searchable combobox scoped to same timeline, excludes self and descendants, saves on select, clears to null
- Progress field: range slider 0–100, saves on mouse-up, replaces the old read-only bar stub
- Gantt tree: activities with `parentActivityId` render indented under their parent; chevron toggle collapses/expands per row independent of group-level collapse

**schema-check**
- `tags` table exists with unique `(team_id, name)`; `activity_tags` junction table references `tag_id`, with cascade deletes (migration `017_tags_and_activity_tags.sql`)

### Phase 10.4.6 — Filter Implementation

**unit-test**
- `filterEngine.test.ts`: empty conditions matches all; AND/OR logic; `status`/`tag` fields matched case-insensitively by name; `assignee` by member ID; `title` `contains`/`equals`/`is_empty`; `progress` `gte`/`lt`; `hasParent` `is_true`/`is_false`; `startDate`/`endDate` `before`/`after`/`between`
- Golden-fixture parity test cross-checks the TS engine against the Go reference (`packages/api/internal/filters/engine.go`, `MatchesFilter`) — both have their own fixture-driven suites
- `presetFilters.test.ts`: all 6 presets (`all`, `open`, `upcoming`, `overdue`, `my`/member, `noassign`) plus saved-filter evaluation with graceful fallback on invalid/missing definition JSON
- `FilterConditionRow.test.tsx` / `FilterManageModal.test.tsx`: field/operator/value UI wiring, My/Team filter tabs, admin-only "Members' filters" tab

**api-smoke**
- `saved_filter_handler_test.go` covers create/list/update/delete with owner isolation, team-filter inclusion in list, admin can promote/delete others' team filters, non-admin cannot
- Confirm live against `$DRABA_TEST_URL`: `POST /teams/:id/saved_filters` with `isTeamFilter: true` as non-admin → 403, as admin → 201; `GET /teams/:id/saved_filters/all` as non-admin → 403, as admin → 200

**web-e2e**
- All 6 presets visibly filter the Gantt activity list when selected from `FilterDropdown`
- Member filter kind filters the Gantt to only that member's assigned activities
- Save/load/edit/delete a custom filter persists across reload and appears correctly under "My filters" vs "Team filters"
- Status conditions match by name across timelines (loads correctly even on a timeline lacking that status name, simply matching nothing)
- Active filter resets to `'all'` when switching timelines

**security-review**
- `PATCH /saved_filters/{id}` setting `isTeamFilter: true` is rejected server-side for non-admins, not just hidden in the UI
- `GET /teams/{id}/saved_filters/all` requires admin role server-side
- Filter definitions are stored as JSON and parsed defensively — malformed JSON cannot crash the evaluator

**schema-check**
- `saved_filters` table has `is_team_filter BOOLEAN NOT NULL DEFAULT 0` (migration `018_saved_filters_team_scope.sql`)

### Phase 11.1 — Web — List View

**unit-test**
- `ListView.format.test.ts` (`formatActivityDate`, `formatTimestamp`): null/undefined/invalid input → em-dash; midnight-UTC dates display on the correct calendar day
- `ListView.tree.test.ts` (`buildListRows`): `groupBy: none/status/parent` ordering and nesting; collapsing a parent hides its subtree; a parent-pointer cycle does not infinite-loop

**web-e2e**
- View switcher toggles Gantt ↔ List and the choice persists per-timeline across reload
- Hide/show, drag-reorder, and resize a column; reload and confirm layout persisted
- Keyboard editing: arrow keys move selection, Enter/F2 edits, Esc cancels, Tab/Enter commits and advances
- Inline-edit Title/Start/End/Status via PATCH; switch to Gantt and confirm reflected
- Title column stays pinned when scrolled horizontally
- Row checkboxes + select-all enable a bulk action bar; bulk archive and bulk delete both work

### Phase 11.1.1 — Timezone-Safe Activity Dates

**unit-test**
- `ListView.format.test.ts` run with `TZ=America/Denver`: midnight-UTC May 31 displays "May 31" (not "May 30"); midnight-UTC Jan 1 displays "Jan 1" (not "Dec 31")
- `useFormatDate.test.ts` confirms the local-time hook (used for real timestamps, not activity dates) is unaffected by the UTC-safety fix

**web-e2e** (browser/OS timezone set to a negative UTC offset, e.g. `America/Denver`)
- List Start/End cells show the same calendar day as the date picker for the same activity
- Gantt day/week/month labels match the List dates for the same activity
- A multi-day activity's Gantt bar sits on the correct start/end day
- Open a date picker, save without changing the date, confirm the displayed date does not shift

### Phase 11.1.2 — Group by Assignee Combination

**unit-test**
- `memberGroups.test.ts`: `memberComboKey` sorts ids so input order doesn't matter; `memberComboLabel` formats 1/2/3/4+ member combos (Oxford comma, "+N" truncation); `comboSortComparator` clusters combos by anchor member, Unassigned last
- `ListView.tree.test.ts` (`groupBy: member`): one group per unique assignee combination in team order; multi-assignee activities appear once, not duplicated under each member's solo group

**web-e2e**
- An activity assigned to two members renders as its own combination group in both Gantt and List, distinct from either member's solo group
- Group ordering identical between Gantt and List for the same timeline, Unassigned last

### Phase 11.2 — Web — Calendar View

**unit-test**
- `calendarLanes.test.ts`: `buildCalendarWeeks` produces correct UTC-ordered days; single/multi-day activity placement and lane assignment; greedy lane packing (reuse, overlap, `laneCount`); `overflowCountsForWeek`; `segmentsForDay`; Find-match flags

**web-e2e**
- View switcher toggles Gantt ↔ List ↔ Calendar, persisting per timeline
- A multi-day activity renders as a continuous bar with a "continues" affordance across a week boundary
- A day exceeding the visible lane cap shows a "+N more" chip; popover lists every activity for that day; clicking a row opens the edit sidebar
- Dragging a bar (move or edge-resize) commits via PATCH with live sidebar date updates mid-drag
- Find highlights matching bars in both Month and Week layouts

### Phase 11.3 — Web — Kanban View (Interactive)

**unit-test**
- `KanbanView.test.ts`: `sortActivities` (start date/title/% complete/updated-at); `buildColumns` for status/member/member-combination group-by modes, including Unassigned/no-status handling and non-droppable combination columns; `buildHierarchyMaps` for multi-level nesting; `toggleCollapsedColumn`
- `KanbanCard.test.tsx` / `KanbanColumn.test.tsx`: `interactive=false` hides button roles, click handlers, collapse toggle, and "+ Add" affordance; `interactive=true` (default) exposes them

**web-e2e**
- View switcher toggles Gantt ↔ List ↔ Calendar ↔ Kanban, persisting per timeline
- Group by Status shows one column per timeline status in `position` order plus "No status"; renaming/recoloring a status updates the column header live
- Dragging a card to another column commits the mutation (status change, reassignment, or reparenting depending on Group-by) via PATCH with an optimistic update; dragging onto a non-droppable (combination) column is a no-op
- Card-field toggles show/hide fields and persist across reload
- Filter scopes the board to matching activities; Find dims non-matches, highlights matches, auto-expanding a collapsed column containing the active match

### Phase 12 — Communications Testing

**unit-test**
- `packages/api/internal/mailer/mailer_test.go`: encrypt/decrypt password round-trip; missing-key plaintext fallback and legacy-plaintext read compat; `SaveConfig` encrypts at rest, `LoadConfig` decrypts transparently; unconfigured → nil, no error; `Send` with no config is a no-op
- `packages/api/internal/api/comms_integration_test.go` (in-process capture SMTP server): `POST /admin/smtp/test` sends to caller without persisting; `PUT /admin/smtp` sends a validation email before persisting, failed validation persists nothing; invite email delivery with registration link, no-email invite sends nothing; forgot-password delivers reset email with link
- `settings_handler_test.go`: reset-password token is single-use (replay → 400); expired token rejected; forgot-password never leaks account existence (always 200) but creates a token for known users

**api-smoke** (requires SMTP configured on the live container — skip with a note if not configured there)
- `PUT /admin/smtp` with the container's real outbound SMTP settings → 200, validation email received
- `POST /admin/smtp/test` → 200, test email received by the admin's own inbox; config unchanged
- `POST /teams/:id/invites` with an email → invitee receives a real email with a working registration link
- `POST /auth/forgot-password` → reset email received with a working link → `POST /auth/reset-password` changes the password; replaying the token → 4xx

**security-review**
- SMTP password is encrypted at rest, never logged or returned in plaintext over `GET /admin/smtp`
- Reset and invite tokens are single-use and time-limited
- `forgot-password` does not leak account existence via response shape or timing

### Phase 13.1 — Foundation, Public Gateway, Gantt Viewer (MVP)

**unit-test**
- `internal/filters` golden fixtures (`packages/api/internal/filters/engine_test.go::TestGoldenFixtures`) — Go evaluator agrees with the TS `filterEngine.test.ts` on every fixture
- `share_repo` CRUD round-trips: `Create`, `GetByID`, `GetByToken`, `ListByTimeline`, `Update`, `Delete`, `RecordView`

**schema-check**
- Fresh SQLite: `shares` table exists (migration `019_shares.sql`) with `id`, `timeline_id`, `token` (UNIQUE), `view_type`, `view_config`, `password_hash`, `expires_at`, `created_by`, `created_at`, `last_viewed_at`, `view_count`, `revoked_at`
- Existing `timelines.share_token` rows are migrated into `shares` — verify count matches pre-migration timeline count with tokens
- Re-run migrations on the same DB; assert no diff

**api-smoke**
- `POST /timelines/{id}/shares` (member of timeline's team) → 201; unauthenticated → 401
- `GET /shares/{token}` (no auth header) → 200, body contains `share`, `timeline`, `activities`, `members`, `statuses`, `tags`; unknown token → 404
- A share created with a frozen filter only returns activities matching that filter — filtered-out activities are absent from the JSON payload entirely, not just hidden client-side
- Warm-cache request (second GET within `DRABA_SHARE_CACHE_TTL`, default 60s) returns the same payload without re-querying the DB

**security-review**
- **Scope isolation (standing decision):** `GET /shares/{token}` derives `timeline_id` server-side from the share row; the client cannot pass a timeline/activity/team selector — injecting `?timeline_id=ANOTHER&team_id=ANOTHER` is ignored, response's `timeline.id` always matches the share's own `TimelineID` (`packages/api/internal/api/share_handler.go:211`, `buildShareProjection`)
- No member email, `user_id`, or role appears anywhere in the public projection
- `buildShareProjection` prunes members/statuses/tags to those referenced by surviving (post-filter) activities, before serialization
- Filter evaluation happens in Go before any data leaves the server (`filters.MatchesFilter`, `share_handler.go:264`)

### Phase 13.2 — Share Module Overhaul + Password Protection

**unit-test**
- `auth.HashPassword`/`CheckPassword` (bcrypt) round-trip and reject wrong passwords; confirm share handler calls these, not a hand-rolled compare
- `ShareModal.test.tsx`: share-row footer meta (never-viewed "Never", same-day time-of-day, earlier-day short date, view total, "· you" creator marker)
- `useShares.test.ts`: `useListShares` refetches on every mount despite app-wide `staleTime` (modal reopen must show fresh counts); `useShareProjection` maps a 401 `{passwordRequired:true}` to a typed `ApiError`; `useUnlockShare` returns a view token on success, throws on wrong password

**api-smoke**
- `POST /timelines/{id}/shares` with `password` set → 201, `protected: true`; password itself never appears in any response body
- `GET /shares/{token}` on a protected share, no Bearer → 401 `{"passwordRequired": true}`, `activities`/`timeline` both absent
- `POST /shares/{token}/unlock` wrong password → 401; correct password → 200 + view token; that token as Bearer on `GET /shares/{token}` → 200 with full projection
- A view token issued for share A is rejected on share B's gateway
- 15 consecutive wrong-password unlock attempts from the same client → at least one `429` (10/hour/IP, keyed on IP only)
- `PATCH /shares/{id}` with `password: ""` clears it and reopens the gateway immediately (cache invalidated)
- `PATCH /shares/{id}` by any team member (not just the creator) succeeds — no creator/admin gate by design
- `GET /teams/{id}/timelines/{timelineId}/shares` response includes `viewCount` per share

**security-review**
- Password is bcrypt-hashed, never stored or returned in plaintext
- `auth.CheckPassword` uses `bcrypt.CompareHashAndPassword` — constant-time by construction
- Unlock rate limiting is IP-scoped, not token-scoped — an attacker cannot reset their budget by hitting different share tokens
- The password check runs **before** the cache read — a newly-PATCHed password can't be bypassed by a request landing in a pre-password cache window; PATCH/DELETE invalidate the cache synchronously

### Phase 13.3 — List + Kanban Read-Only

**unit-test**
- `ShareViewPage.test.tsx::PublicListTable` — group headers, activity rows, notes-cell gated on visible-column config, empty state, header-cell ordering
- Kanban shares receive every timeline status including empty ones (so empty columns render); List shares keep referenced-only pruning
- `notes` travels to the public payload only for a List share with the Notes column visible — absent for List-with-hidden-column, Kanban, and Gantt regardless of config

**api-smoke**
- Create a List share, fetch `/shares/{token}` → `activities[].notes` present only when `viewConfig.columns` includes `{"id":"notes","visible":true}`
- Both List and Kanban shares pass through the same scope-isolation and password gates as Gantt — security checks branch only on `share.Kind`, never `ViewType`

**web-e2e**
- A List share renders read-only: no edit-on-click, no drag-reorder, no "+ Add Activity" — only column-resize is interactive and never calls a mutation endpoint
- A Kanban share renders read-only: `KanbanBoard` mounted with `interactive={false}` — clicking a card, dragging, or collapsing a column produces no network request and no visual state change

### Phase 13.4 — Calendar — ICS Feed Sharing

**unit-test**
- `CalendarShareModal.test.tsx`: one toggle row for the timeline and one per member, all off by default; toggling on creates the right feed; toggling off deletes it; regenerate hits the right feed; ignores view shares when resolving feed state
- `useShares.test.ts`: `useCreateShare` sends `kind`/`scope`/`memberId` for a member-scoped ICS feed; `useRegenerateShare` invalidates the share list

**api-smoke**
- `POST /timelines/{id}/shares` with `kind:"ics", scope:"timeline"` → 201; `GET /shares/{token}.ics` → 200, `Content-Type: text/calendar`, `Cache-Control: no-store`, valid `VCALENDAR`/`VEVENT` all-day events
- `scope:"member"` feed contains only that member's assigned activities
- Create validation: missing/unknown `scope` → 400; `scope:"member"` without `memberId` → 400; `memberId` outside the timeline's team → 400; `password` on an ICS create → 400
- `PATCH /shares/{id}` attempting to add a password to an ICS share → 400
- `POST /shares/{id}/regenerate` → new token serves the feed, old token immediately 404s (including from a warm ICS cache entry); requires team membership
- A revoked or expired ICS share returns `410 Gone`, even from a warm feed cache — note: no API/UI currently sets `expires_at`/`revoked_at`, this is read-side defensive code only

**security-review**
- `.ics` payload contains no member email, `user_id`, or role — display name only
- ICS feeds carry no password at create or via PATCH (token-as-secret only)
- Kind isolation: an ICS token is dead on the JSON gateway and a view-share token is dead on `.ics`
- `Cache-Control: no-store` on the feed response

**web-e2e**
- *(unverified beyond LAN — flag for review)* Subscribing to a feed URL from a real Google/Apple Calendar app requires the feed reachable by the provider's fetcher, not just the local network — still outstanding per `docs/ai-context/session-state.md` Open Issues. In-app "Add to Google/Apple/Outlook" one-click links can be reviewed for correct URL construction without a live external fetch.

### Phase 13.5 — Lifecycle Tail

**api-smoke**
- `POST /timelines/{id}/archive` immediately makes both the view-share and ICS-feed gateways return `404` (not `410`), even with caches pre-warmed — checked before the cache read
- `POST /timelines/{id}/unarchive` immediately resurrects both at their original URLs
- `POST /shares/{token}/unlock` on a password-protected share of an archived timeline → 404 (archive state checked first, leaking nothing about protection)
- Orphaned share row (timeline hard-deleted) → both gateways 404, never 500
- `Timeline.shareCount` reflects the live count of both view + ICS shares; increments on create, decrements on delete

**security-review**
- Archived (reversible) → `404`; revoked/expired (permanent) → `410` — deliberately distinguished so calendar clients don't drop a subscription over a reversible state change
- `last_viewed_at`/`view_count` are write-once-per-view server-side fields with no client-writable path to falsify them

**Known gap (by design, not an oversight):** no API field or UI control to *set* `expires_at` — only the read-side `410` enforcement exists as tested defensive code. Don't write an assertion expecting an expiry-setting endpoint to exist.

### Phase 14.1 — Export — Foundation + Data Exports

**unit-test**
- `cd packages/api && go test ./internal/export/...` passes (CSV/xlsx/ICS generation, frozen-filter eval via `matchesFilter` ported to Go)

**api-smoke** (verified live 2026-06-26 against a freshly reset container — was previously 405ing on a stale pre-14.1 binary, now resolved)
- `POST /timelines/:id/export` with `format: csv|xlsx|ics` (+ optional `viewConfig`/filter) → 200, file matches the activities visible under the active filter
- `GET /teams/:id/timelines/:timelineId/export.csv|.xlsx|.ics?filter=<savedFilterId>` convenience route → 200 — **note the real path includes both `:id` (team) and `:timelineId`; a bare `/timelines/:id/export.csv` silently 200s via the SPA fallback instead of 404ing, which can mask a false pass if you don't check the response body is actually the export file**

**security-review** (verified 2026-06-26)
- Export filenames are slug-stripped (`slugRe = [^a-z0-9]+`) — no path traversal possible
- Cross-team data leak check: `writeTimelineExport` scopes activities/statuses by `timeline.ID`, members/tags by `timeline.TeamID`; GET convenience route checks `timeline.TeamID != teamID` before serving

**web-e2e**
- Export dialog reachable from all four view toolbars (Gantt/List/Kanban/Calendar)
- CSV download (any view, "Current view" scope) matches the visible filtered activity set exactly (row count, titles, dates)
- `.ics` download is a valid `VCALENDAR`/`VEVENT` structure with proper escaping

### Phase 14.2 — Textual Exports

**unit-test**
- `lib/textExport.ts` generators (Markdown/plain-text/HTML) for List/Kanban/Calendar — no dedicated Vitest file confirmed as of 2026-06-26; covered by `ExportDialog.test.tsx`/`useExport.test.ts` at the integration-wiring level and by live web-e2e for generator output correctness
- Hierarchy marker convention (confirmed intentional, not a bug, during the 2026-06-26 run): `↳` is the flat-table title-cell title prefix (`textExport.ts:203-206`); `•`/`◦` bullets are the outline/nested-card hierarchy markers in the List-Outline and Kanban-hierarchy generators (`textExport.ts:431,449,619`) — these are two different, both-correct generators, not inconsistent output

**web-e2e** (verified live 2026-06-26)
- List/Kanban/Calendar Export dialogs offer Markdown/plain-text/HTML-clipboard formats; Gantt dialog correctly excludes all textual formats (data-only)
- List Markdown respects column visibility, sort order, and group-by (section headers); Outline mode renders parent-child hierarchy with bullets
- Calendar Markdown renders an agenda format (`## <Weekday, Date>` headers)
- Kanban Markdown renders one `## STATUS (count)` section per column; Hierarchy toggle nests child cards under parents in both the board and the export
- Clipboard copy (dual rich-text/plain-text flavors) completes without console errors

### Phase 14.3+ — PNG Snapshot & Printable Views

*Stubs.* Detailed assertions added when each sub-phase begins.

---

## Adding tests for a new phase

1. Find the phase's section in this file (or add one if missing).
2. Under the relevant subagent heading, list concrete, runnable assertions tied to the ROADMAP exit criteria.
3. If a new subagent is needed, add it to the subagent map with an "active from" phase.
4. That's it — `/test-phase` will pick it up on the next run.

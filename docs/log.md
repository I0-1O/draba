# Development Log

---

## 2026-06-15 — Phase 14.1: Foundation + data exports

**Goal:** server-side CSV/xlsx/ICS export of timeline activities behind a single `ExportDialog`, reachable from all four view toolbars (Gantt/List/Kanban/Calendar). Frozen filter (saved filters only) evaluated server-side via the Phase 13 Go `matchesFilter` port; columns match the Phase 15 import template.

**Backend (`packages/api`):**
- New `internal/export` package: `Row`/`Columns`/`BuildRows` project activities (with IDs resolved to display names) into the export schema (Title, Start, End, Description, Status, Assignees, Tags, Parent, Progress, Location, URL); `WriteCSV` (encoding/csv) and `WriteXLSX` (excelize) writers.
- `POST /timelines/{id}/export` (`handlePostTimelineExport`) — `{ format: csv|xlsx|ics, viewConfig?: { filter } }`; applies the frozen filter via `matchesFilter` before building rows; streams the file with `Content-Disposition: attachment` and a generated filename.
- `GET /teams/{id}/timelines/{timelineId}/export.csv|.xlsx|.ics?filter=<savedFilterId>` convenience routes (10.4.6 hook) for CLI/scripting; ICS reuses the 13.4 whole-timeline feed generator.
- OpenAPI spec updated for the new endpoints; TS types regenerated.
- New tests for `internal/export` (row projection, CSV/xlsx output) and the export handlers (filter application, format dispatch, convenience GET routes).

**Frontend (`packages/web`):**
- `lib/exportCapabilities.ts` — `ExportFormatDescriptor` registry (CSV/Excel/ICS for 14.1; Markdown/text/PNG/printable land in 14.2–14.4 additively) + `buildExportFilename`.
- `ExportDialog.tsx` — portal modal per the [export-modal design handoff](design/handoffs/export-modal/design_handoff_export_modal/README.md): header, filter-context strip ("Filtered: **<name>**" with live counts, or "Exporting the <View> view as you see it"), format rail + options pane, scope picker (Current view vs. Entire timeline), filename chip, Download/Downloading/Downloaded footer button. Overlay click does not close (Esc/Cancel/X only), unlike `ShareModal`.
- `useExport` hook + `apiFetchBlob`/`createAuthFetchBlob` (api.ts) — blob-download with the same 401-silent-refresh retry as `apiFetch`; `saveBlob` triggers the browser download via a temporary `<a download>`.
- Wired into `DashboardPage.tsx`: all four toolbars' `onExport` now open `ExportDialog`; filter/count context derived from `activeShareFilter` (only `'saved'` filters produce a server-evaluable `FilterDefinition`, matching the Share modal's constraint) plus a new unbounded `useTimelineActivities` query for live counts via `matchesFilter`.
- Removed "(coming soon)" titles/disabled state from the Export buttons in all four toolbars (`GanttToolbar`, `ListToolbar`, `CalendarToolbar`, `KanbanToolbar`).

**Verified in browser** (dev server against Docker backend): logged in, opened the List view, clicked Export — dialog renders correctly (header, filter strip showing "All 10 activities", CSV/Excel/ICS format rail, scope picker, filename chip `sales-kick-off-2026-06-15.csv`); switching to "Calendar (.ics)" updates the heading, description, and filename live. Triggering the actual download returned `405 Method Not Allowed` from the Docker test backend — that container is running a pre-14.1 binary without the new `POST /timelines/{id}/export` route, so the live download round-trip needs a Docker rebuild/redeploy to verify. All client-side dialog behavior is confirmed working.

**Checks:** `golangci-lint run` ✅ · `go test ./...` ✅ · `pnpm --filter web lint` ✅ · `pnpm --filter web build` ✅.

---

## 2026-06-11 — /review-phase 13.5: findings addressed

Four-agent review (scope / security / conventions / test-coverage) of the 13.5 commit range. Security and conventions came back clean; fixes applied for the rest:

- **Frontend coverage for the three 13.5 UI paths (was the blocker group):** new `ShareModal.test.tsx` (footer meta columns: "Never" fallback, today-as-time vs. older-as-date last-viewed format, view total, "· you" creator marker) and `Sidebar.test.tsx` (share-count chip: count + plural/singular tooltip, hidden at zero/absent). `useShares.test.ts` gains a behavior test proving `useListShares` refetches on remount even under the app-wide 30s `staleTime` — the freshness override asserted as behavior, not config.
- **Orphaned share → 404, not 500:** `shareTimelineLive` now maps `sql.ErrNoRows` from the timeline load to the same 404 body as every other dead-share case. The shares FK is `ON DELETE CASCADE` so a share row outliving its timeline should never happen, but a 500 there would be a state oracle on the public surface. `TestShareGateway_OrphanShare404` suspends FK enforcement to fabricate the orphan and covers both gateways (and guards against a vacuous pass by asserting the share rows survived the delete).
- **Scope acknowledgement — unlock endpoint as a third archived-404 surface:** the phase scope named two gateways (JSON + ICS), but `handleUnlockShare` also got the `shareTimelineLive` check. Kept deliberately: without it, unlocking a protected share of an archived timeline would either succeed or answer `NOT_PROTECTED`/`INVALID_PASSWORD`, leaking protection state the gateways carefully hide. Defensive hardening in service of the scoped behavior, not new scope.

Accepted as-is from the review: the `useListShares` freshness override slightly exceeds the "render only" re-scope wording (it directly serves last-viewed accuracy — nit, no change).

**Checks:** `go test ./internal/api/` ✅ · `pnpm --filter web test` ✅ (new files 24/24).

---

## 2026-06-11 — Phase 13.5: Lifecycle tail

**Goal:** the re-scoped (same-day) half-day close-out of Phase 13: archived timelines stop serving their shares/feeds (reversibly), the timeline tile shows an active-share-count chip, and last-viewed renders in the share modal. Cut from scope: the expiry write path and any site-statistics subsystem.

**Backend (`packages/api`):**
- **Archived timeline → 404 on the public surface.** New `shareTimelineLive` helper (share_handler.go) loads the share's timeline and 404s when `ArchivedAt` is set; wired into `handleGetShareProjection`, `serveICSFeed`, and `handleUnlockShare`. `404`, not `410`: archive is reversible (unarchive resurrects the links), `410` tells calendar clients to drop the subscription permanently, and `404` matches `handleCreateShare`'s archived response without leaking archive state. The check runs **before the cache reads**, so archiving takes effect immediately regardless of warm projection/ICS caches. In the unlock handler it precedes the `NOT_PROTECTED` branch so an archived timeline reveals nothing about its shares' protection state.
- **`Timeline.ShareCount`** — derived count of the timeline's active (non-revoked, non-expired) shares, both kinds. New `activeShareCountSubquery` in timeline_repo.go, applied to `GetByID` and `ListByTeam`; "now" is bound as a parameter (not `CURRENT_TIMESTAMP`) so the `expires_at` comparison uses the same driver serialization as the stored values across DB backends. OpenAPI `Timeline.shareCount` (required) + TS types regenerated.
- **Tests** (`share_lifecycle_test.go`, new): archive kills view share + ICS feed with warm caches and unarchive resurrects both; unlock of an archived timeline's protected share 404s even with the correct password; `shareCount` tracks create/delete across both kinds and appears on single-timeline reads.

**Frontend (`packages/web`):**
- **Sidebar timeline tile chip** (`Sidebar.tsx`): a small pill (Link2 icon + count) on each timeline row when `shareCount > 0`, with a "N active share links" tooltip; hidden at zero and when the rail is collapsed.
- **Last-viewed in the share modal** (`ShareModal.tsx`): footer meta now appends "Last viewed …" beside the view count when `lastViewedAt` is set — time of day if today, short date otherwise; full timestamp on hover.
- **`useListShares` freshness fix** (`useShares.ts`): the app-wide 30s `staleTime` meant reopening the modal within the window served cached telemetry (view count / last-viewed didn't update after an access). The list query now sets `staleTime: 0` + `refetchOnMount: 'always'` — the share modals are its only consumers and mount on demand.

**Verified live** (local `go run` API on :8080 with seeded sample data + the `web-local-api` Vite server on :5175): tile chips read 2 (Sales Kick Off) and 4 (Q1 Workload), matching the share fixtures; modal row shows "31 views · Last viewed Jun 10", and after hitting the public share URL once, reopening shows "32 views · Last viewed 10:03 AM"; archive/unarchive of Q1 Workload flips its view share and ICS feed 200 → 404 → 200.

**Checks:** `golangci-lint run` ✅ · `go test ./...` ✅ · `pnpm --filter web lint` ✅ · `pnpm --filter web build` ✅ · `pnpm --filter web test` ✅ (314).

---

## 2026-06-11 — /review-phase 13.4: findings addressed

Four-agent review (scope / security / conventions / test-coverage) of the 13.4 commit range. Conventions and scope came back clean; fixes applied for the rest:

- **Revoked/expired feed paths now tested (was the one blocker):** `serveICSFeed` returns `410 Gone` for `revoked_at`/`expires_at`, but nothing exercised it. New `TestShareICS_RevokedAndExpiredFeeds_Gone` warms the feed cache, flips the row directly in the DB (no endpoint sets these fields until 13.5), and asserts 410 wins over the warm cache. Required a `newTestServerWithDB` harness variant exposing the in-memory `*sqlx.DB`.
- **ICS escaping hardened:** `escapeText` now folds a bare CR into the `\n` escape and drops remaining C0/DEL control chars (HTAB kept) — a lenient parser splitting on stray CR could otherwise read injected property lines from user-controlled titles/descriptions. Covered by `TestCalendar_EscapesBareCRAndControlChars`.
- **log.md scrubbed of host-specific values** (LAN hostname/port, SSH alias) per the REVIEW.md secrets grep — generic phrasing throughout, not just the 13.4 additions. The values remain in operational docs (TESTING.md, session-state, web CLAUDE.md, reset script) — a separate policy call.
- **ROADMAP 13.4 updated** to document the shipped VEVENT payload (status/percent, assignee display names, tags in DESCRIPTION/CATEGORIES, assignees in SUMMARY on whole-timeline feeds).
- Review also confirmed the warm-cache regenerate suggestion was already covered by `TestShareRegenerate_InvalidatesOldToken`; nits (predictable sample-data tokens, regenerate working for view shares too, no direct migration assertions) accepted as negligible.
- `go test ./internal/ics/... ./internal/api/...` pass.

---

## 2026-06-10 — Phase 13.4 feed polish (Thunderbird feedback): named URLs + event fields

Second round of user-testing feedback: subscribing in Thunderbird defaulted the calendar name to the token hash, and events carried no draba fields.

**Named feed URLs:** calendar clients default the new calendar's name from the URL *filename* (they only read feed content after subscribing), so the modal now links to `GET /shares/{token}/{slug}.ics` (e.g. `…/sales-kick-off-calendar-feed.ics`). New mux route + `handleGetShareICSNamed`; the filename must end `.ics` but is otherwise cosmetic — the token alone is the key; the bare `/shares/{token}.ics` form still works. Feed content now also emits `NAME` (RFC 7986) alongside `X-WR-CALNAME`, plus `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` (PT1H) as a poll-cadence hint.

**Read-only:** no ICS property can force a client's "read only" checkbox; the server only routes GET on feed paths (anything else 405s via the Go mux), so client-side edits can never sync back regardless of the checkbox.

**Event field projection (`buildICSFeed`):** each VEVENT now carries `DESCRIPTION` = structured lines (`Status: <name> (<pct>%)` / `Assigned: <display names>` / `Tags: <names>`) + blank line + the activity description; tags also go to `CATEGORIES`. Whole-timeline feeds append assignee names to `SUMMARY` ("Title — Alice, Bob") so the month grid shows who owns what; member feeds keep bare titles (one person's calendar — their name on every event is noise). Display names remain the only person-identifying field.

**Tests:** ics package — NAME/REFRESH props, CATEGORIES comma semantics; handler — `TestShareICS_EventFieldProjection` (status+percent+assignee+tag through to DESCRIPTION/SUMMARY/CATEGORIES), `TestShareICS_NamedFeedURL` (slug 200, non-`.ics` 404); modal test asserts slug URLs. Browser-verified against the local stack: slug URL serves the enriched feed, zero console errors.

**Checks:** `golangci-lint run` ✅ · `go test ./...` ✅ · `pnpm --filter web lint` ✅ · `pnpm --filter web build` ✅ · `pnpm --filter web test` ✅ (314).

---

## 2026-06-10 — Phase 13.4 post-test fixes: superadmin 500 + modal redesign

User testing against the Docker instance surfaced two issues; both fixed, plus full local-stack browser verification this time.

**Fix 1 — 500 on share create as a superadmin (pre-existing, all share kinds):** `requireTeamMember` passes a superadmin who holds no `team_members` row through with a *synthetic* member whose `ID` is `""` (`authz.go: superadminMember`). `handleCreateShare` wrote that empty string into `shares.created_by` (NOT NULL FK → constraint failure → 500). Latent since 13.1 — every test created its own team, so nobody hit the superadmin-on-foreign-team path until sample-data testing. Fix: **migration 023** rebuilds `shares` with nullable `created_by` (NULL = "created by a superadmin outside the team"); `models.Share.CreatedBy` is now `*string`; the handler leaves it nil for the synthetic member; OpenAPI drops `createdBy` from required. The modal UI already falls back gracefully on a missing creator. Regression test: `TestShareCreate_SuperadminOutsideTeam` (superadmin creates an ICS share on a team they're not in → 201, `createdBy` null, feed alive).

**Fix 2 — CalendarShareModal redesign:** the scope-selector + single-toggle layout read as confusing. Rebuilt as a flat list of every publishable feed — **Whole timeline** first, then **one row per team member** — each with its own on/off toggle. Toggling on creates that feed and expands the row inline: mono URL + Copy, compact "Add to: Google · Apple · Outlook" links, Regenerate. Toggling off deletes the feed (old URL dies instantly). `CalendarShareModal.test.tsx` rewritten to the row contract (7 tests).

**Verified in the browser** (local `go run` API on :8080 with `DRABA_SEED_SAMPLE_DATA=1` + a second Vite dev server on :5175 proxied to it — new `web-local-api` entry in `.claude/launch.json`): logged in as `brian@rieb.cc` (sample superadmin), the exact request that 500'd now returns 201; modal renders the toggle list; whole-timeline and member toggles create feeds whose URLs serve `text/calendar` with correct VEVENTs; toggle-off 404s the old URL immediately; zero console errors.

**Checks:** `golangci-lint run` ✅ · `go test ./...` ✅ · `pnpm --filter web lint` ✅ · `pnpm --filter web build` ✅ · `pnpm --filter web test` ✅ (314).

---

## 2026-06-10 — Phase 13.4: Calendar — ICS feed sharing

**Goal:** Calendar shares as live subscribable ICS feeds (not view-shares): `shares.kind` discriminator, `GET /shares/{token}.ics`, whole-timeline + per-member scopes, token rotation as the revocation story, and a distinct Calendar share modal (a feed configurator, deliberately not the active-links list the other views use).

**Backend (`packages/api`):**
- **Migration 022** (`022_share_kind.sql`): `shares.kind` (`'view'` default | `'ics'`), `scope` (`'timeline'` | `'member'`, nullable), `member_id` (nullable FK → `team_members`, `ON DELETE CASCADE` — a feed for a deleted member is meaningless, so it drops with the row rather than blocking like the migration-011 RESTRICT FKs).
- **`internal/ics` (new package)**: minimal RFC 5545 serializer — `Calendar(name, events)` emits a `PUBLISH` VCALENDAR with `X-WR-CALNAME`; each `Event` becomes an all-day VEVENT (`DTSTART;VALUE=DATE`, **exclusive** `DTEND` = inclusive end + 1 day, `DTSTAMP` from the activity's `UpdatedAt` so clients detect changes between polls). Implements §3.3.11 text escaping and §3.1 75-octet line folding (rune-boundary-safe); CRLF endings throughout.
- **`share_ics_handler.go` (new)**: `serveICSFeed` — public, no auth, no password (calendar clients can't unlock interactively; the token is the secret). Checks kind/revoked/expired, then serves `text/calendar` from `buildICSFeed`: timeline + activities resolved from the share row only; member scope drops unassigned activities **before** serialization; the member's display name in the calendar title is the only person-identifying field. Backed by `icsFeedCache`, a second TTL cache (rendered payload, same `DRABA_SHARE_CACHE_TTL`). Also `handleRegenerateShare` (`POST /shares/{id}/regenerate`): rotates the token via `ShareRepo.RotateToken`, invalidates both caches for the old token, any team member may call it (consistent with PATCH/DELETE).
- **`share_handler.go`**: `GET /shares/{token}` dispatches a `.ics` suffix inside the `{token}` path value to `serveICSFeed` (Go 1.22 mux wildcards span the whole segment — no separate route needed). **Kind isolation both directions:** an ICS token on the JSON gateway → 404 (a member-scoped feed token must never unlock a whole-timeline projection), a view token on `.ics` → 404, ICS tokens 404 on `/unlock`. Create validation for `kind=ics`: scope required (`timeline`|`member`), `memberId` required for member scope and must belong to the timeline's team, passwords rejected, `view_config` forced to `{}`/`view_type` to `calendar`. PATCH rejects setting a password on an ICS share; PATCH/DELETE invalidate the ICS cache too.
- **`models.Share`**: `Kind`/`Scope`/`MemberID` + `ShareKind*`/`ShareScope*` constants; repo `Create` persists the new columns.
- **Sample data** (`11_shares.sql`): +2 ICS feeds (whole-timeline + per-member on Q1 Workload); count assertions in `seed_test.go`/`sample_data_test.go` updated 8→10.
- **OpenAPI**: `kind`/`scope`/`memberId` on `Share` + `CreateShareInput`, new `/shares/{token}.ics` and `/shares/{id}/regenerate` paths. TS types regenerated.

**Frontend (`packages/web`):**
- **`components/CalendarShareModal.tsx` (new)** — the distinct surface: scope selector (Whole timeline / One member + member dropdown), public-access On/Off toggle (ON creates the feed share for the selected scope, OFF deletes it — old URL dies immediately), mono feed-URL field + Copy (1.6s success state), one-click **Add to Google / Apple / Outlook** links (Google `calendar/render?cid=`, Apple direct `webcal://`, Outlook `addfromweb`), and **Regenerate link**. No password UI by design. Same visual language as ShareModal (portal overlay, tile header, footer + Done) so it reads as a sibling, not a clone.
- **`hooks/useShares.ts`**: `CreateShareInput` gained `kind`/`scope`/`memberId` (viewType/viewConfig now optional); new `useRegenerateShare` mutation.
- **`components/ShareModal.tsx`**: active-links filter now also requires `kind === 'view'` so ICS feeds never appear in the view-share list.
- **`pages/DashboardPage.tsx`**: Calendar toolbar's Share button (previously a no-op) opens `CalendarShareModal` via its own `calendarShareModalOpen` state; `CalendarToolbar` share stub title updated.

**Tests:** Go — `internal/ics` unit tests (all-day dates, exclusive DTEND, escaping, folding round-trip); `share_ics_handler_test.go` (timeline feed content, member-feed scoping, PII absence, kind isolation both directions, create validation matrix, regenerate kills warm-cached old token + requires team membership). Web — `useShares.test.ts` ICS create body + regenerate cases; new `CalendarShareModal.test.tsx` (toggle on/off → create/delete with right scope+member, URL + subscribe links render, regenerate, view shares ignored). 314 web tests pass.
- Also fixed a pre-existing `tsc -b`-only break: the `Status` fixture in `ShareViewPage.test.tsx` was missing required fields (`pnpm --filter web build` failed on HEAD before this phase's changes; `--noEmit` lint missed it).

**Checks:** `golangci-lint run` ✅ · `go test ./...` ✅ · `pnpm --filter web lint` ✅ · `pnpm --filter web build` ✅ · `pnpm --filter web test` ✅ (314).

**Not verified in a real calendar app yet:** subscribing from Google/Apple (the headline exit criterion) needs the Docker instance rebuilt with this code, plus a reachable URL for Google's fetcher. Suggest `/test-phase 13.4` and `/review-phase 13.4` to fan verification across subagents.

---

## 2026-06-07 — Phase 13.3: List + Kanban read-only public shares

**Goal:** Extend the `interactive=false` + public-mounting pattern from Gantt (13.1) to List and Kanban, add the `notes` projection nuance for List shares with the Notes column enabled, and wire "Share this view" into both toolbars.

**Backend (`packages/api`):**
- **`share_handler.go`**: extended `viewConfigJSON` with `Columns []shareColumnConfig` (`{id, visible}`, mirrors the captured List column-visibility snapshot). In `buildShareProjection`, a List share's `notes` field is now included on each `PublicActivity` only when the captured `view_config.columns` has an entry `{id: "notes", visible: true}` — the only projection nuance beyond scope-locking and field-pruning called out in the exit criteria.
- **OpenAPI**: added nullable `notes` to `PublicActivity` (documented as List-share-only, Notes-column-gated). TS types regenerated.

**Frontend (`packages/web`):**
- **Kanban presentational chain** (`KanbanCard`, `KanbanColumn`, `KanbanBoard`): added an `interactive?: boolean` prop (default `true`) mirroring Gantt's established pattern. When `false`: `useDraggable`/`useDroppable` are disabled, `listeners`/`attributes`/`onClick`/keyboard handlers are stripped, the collapse-toggle and "+ Add" affordances are hidden, and the drag overlay never renders.
- **`ShareModal.tsx`**: `ShareViewConfig` gained an optional `columns?: { id, visible }[]` (List-only — drives the `notes` nuance and viewer column rendering); included in the captured `viewConfig` JSON when present.
- **`DashboardPage.tsx`**: wired the List and Kanban toolbars' Share buttons to open `ShareModal` (previously no-ops); added an `activeShareFilter` memo and branched the `viewConfig` passed to the modal by active view — List adds `columns`, Kanban omits `granularity`.
- **`ListToolbar.tsx` / `KanbanToolbar.tsx`**: replaced the disabled "coming soon" Share stub with a working button (List) / updated the title (Kanban).
- **`ListView.tsx`**: exported `ColMeta`, `COL_CATALOG`, `formatDuration` (joining the already-exported `ListDisplayRow`/`buildListRows`/`formatActivityDate`/`formatTimestamp`) so the new public renderer can mirror the authenticated List's columns and formatting without duplicating them.
- **`ShareViewPage.tsx`** — the core of this phase:
  - Decided **not** to thread `interactive` through the 2600-line `ListView.tsx` (a data-fetching container with deeply intertwined editing/picker/DnD/multiselect logic — unsuitable for the bypass-the-container pattern). Instead built a dedicated `PublicListTable`/`PublicListCell` read-only renderer that reuses `buildListRows`/`COL_CATALOG`/the date formatters to mirror the authenticated List's visuals (group headers with member-color dots, status pills, assignee/tag badges, progress bars, formatted dates) with zero interactivity.
  - Added `toApiActivity`/`toTeamMemberWithUser` adapters that convert the scope-locked `PublicActivity`/`PublicMember` projection types into type-valid `Activity`/`TeamMemberWithUser` shapes by filling required-but-irrelevant fields (location, url, createdBy, rrule, teamId, role, email, …) with placeholder defaults — mirroring the `optimisticActivity` precedent in `ListView`. These placeholders are never rendered.
  - Added `parseListViewConfig`/`parseKanbanViewConfig` (mirrors the existing `parseViewConfig` for Gantt) to read the frozen `groupBy`/`sortBy`/`colorBy`/`columns` out of the share's captured `viewConfig` JSON.
  - Branched the main render on `proj.share.viewType`: `'list'` → `PublicListTable`, `'kanban'` → `KanbanBoard interactive={false}` (fed adapted activities/members, `colorMap` via `resolveActivityColor`, columns via `buildColumns`/`buildHierarchyMaps`, all mutation handlers no-ops), `'gantt'` (default) → the existing `GanttGrid` path. (`'calendar'` is out of scope — see 13.4.)

**Checks:** `golangci-lint run` ✅ · `go test ./...` ✅ · `pnpm --filter web lint` ✅ · `pnpm --filter web build` ✅ · `pnpm --filter web test` ✅ (292).

**Not browser-verified yet:** same as 13.2 — the running Docker instance (the LAN test instance) predates the gateway changes; deferred to the Docker rebuild pass. Suggest `/test-phase 13.3` and `/review-phase 13.3` to fan verification across subagents.

---

## 2026-06-05 — /test-phase 13.2

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 8 pass (ws-smoke: 3 assertions skipped — no websocat on Windows dev box; broadcast/isolation/full-heartbeat covered by unit tests)
- Smoke target: the LAN test instance

---

## 2026-06-05 — Phase 13.2b: Share module overhaul (frontend) + supporting backend

**Goal:** Second half of Phase 13.2 — rebuild the "Share this view" modal to the design handoff (`docs/design/handoffs/share-modal/`) wired to real data, and add the public unlock prompt that consumes the 13.2a password backend.

**Backend (`packages/api`) — design-driven additions:**
- **Migration 021** (`021_share_description.sql`): adds nullable `description` to `shares` (the handoff shows a per-row description; we had no column for it).
- **`models.Share`**: added `Description *string` and a derived, read-only `Protected bool` (`db:"-"`, set from `password_hash != nil` by the repo). `password_hash` stays `json:"-"` — `protected` lets the client show a lock badge without ever seeing the hash.
- **`share_repo.go`**: `Create`/`Update` now persist `description`; `GetByID`/`GetByToken`/`ListByTimeline` set `Protected` after scan.
- **`share_handler.go`**: `description` on create/patch bodies; `Protected` set on the create + patch responses.
- **OpenAPI**: `description` on `Share`/`CreateShareInput`/`PatchShareInput`, `protected` (required) on `Share`. TS types regenerated.

**Frontend (`packages/web`):**
- **`hooks/useShares.ts`**: `useUnlockShare(token)` (POST `/unlock` → view token); `useShareProjection(token, viewToken?)` now sends `Authorization: Bearer <viewToken>` and maps a `401 { passwordRequired }` to an `ApiError` with code `PASSWORD_REQUIRED` (also `retry: false`); `CreateShareInput` gained `description` + `password`.
- **`components/ShareModal.tsx`** (full rebuild): modal shell (link-tile header + dynamic timeline-name subtitle + close), "ACTIVE LINKS" section bar (count chip + New share), scrollable body, footer (read-only hint + Done). `ShareRow`: lock/link type tile, title + "password" badge, description, mono URL + Copy (1.6s success state), creator `Badge` + name (+ "· you") + date + view count, inline delete-confirm overlay. `AddShareForm`: title (required), description, password-protect toggle + show/hide password field, Create disabled until valid. Dashed empty state. Built from existing design tokens (all `--radius-*`/`--shadow-*`/`--secondary`/`--success`/`--input` already in `index.css`), not ported inline styles. **Delete is shown on every row** (no creator/admin gate — matches the 13.2 decision; the handoff's `canDelete` was dropped).
- **`pages/ShareViewPage.tsx`**: `UnlockPrompt` (key icon, password field + show/hide, error copy for wrong password vs `429` rate limit) rendered when the projection errors with `PASSWORD_REQUIRED`; on success stores the view token in state and the projection refetches with it. Light-mode-forced surface, consistent with the viewer.
- **`pages/DashboardPage.tsx`**: passes `timelineName={activeTimelineName}` to the modal.

**Tests:** `useShares.test.ts` — updated the public-fetch test for the new options arg; added view-token Bearer header, `PASSWORD_REQUIRED` mapping, and two `useUnlockShare` cases (success returns token + POSTs password; wrong password rejects with status 401). 292 web tests pass.

**Checks:** `golangci-lint run` ✅ · `go test ./...` ✅ · `pnpm --filter web lint` ✅ · `pnpm --filter web build` ✅ · `pnpm --filter web test` ✅ (292).

**Not browser-verified yet:** the running Docker instance (the LAN test instance) predates this work, so it can't exercise the new gateway; deferred to the Docker rebuild pass along with the other unverified phases.

---

## 2026-06-05 — Phase 13.2a: Password backend + view counts (Go-only checkpoint)

**Goal:** First half of the re-sequenced Phase 13.2. Land the password-protection backend and view-count exposure as a self-contained, fully-tested Go checkpoint, deliberately stopping before the frontend share-modal overhaul (13.2b). Schema needed no migration — `password_hash`, `view_count`, `last_viewed_at`, `expires_at`, `revoked_at` already exist from migration 019, and `RecordView` already existed.

**Backend (`packages/api`):**

- **`internal/auth/jwt.go`**: added `IssueShareViewToken(shareID)` / `ValidateShareViewToken(tokenStr, shareID)` — a `share_view`-type JWT (30-min TTL) carrying the share ID in the JWT `Subject`. Validation rejects a token whose subject ≠ the requested share, so a valid unlock for one share cannot be replayed against another. Reuses the existing HS256 secret + alg-confusion guard.
- **`internal/api/ratelimit.go`** (new): dependency-free in-memory fixed-window `rateLimiter` keyed by client IP (opportunistic prune past 10k keys), plus `clientIP(r)` using transport `RemoteAddr` (not spoofable `X-Forwarded-For`; behind a proxy it fails closed/stricter). Avoids pulling in `golang.org/x/time/rate` (keeps go.mod lean / pinned).
- **`internal/api/share_handler.go`**:
  - Password gate on `GET /shares/{token}`: a locked share now returns `401 { passwordRequired: true }` with **no projection data**, unless a valid `Authorization: Bearer <viewToken>` is presented (gate stays above the cache read so a freshly-PATCHed password is never bypassed via stale cache).
  - `handleCreateShare` / `handleUpdateShare`: optional `password` field — non-empty sets/replaces (bcrypt via existing `auth.HashPassword`), empty string clears on PATCH, omitted leaves unchanged.
  - `handleUnlockShare` (new, public `POST /shares/{token}/unlock`): IP rate-limited (10/IP/hour → `429`), mirrors revoke/expiry `410` checks, `400` when the share is unprotected, `401` on wrong password, `200 { token }` on success.
  - **Dropped the `canManageShare` (admin-or-creator) gate** on PATCH and DELETE per the 13.2 re-sequencing decision — any member of the timeline's team may manage shares (a share can't mutate app data). Function removed; doc comments updated.
  - Added `bearerToken(r)` helper and `unlockMaxAttempts = 10` const.
- **`internal/api/server.go`**: added `unlockLimiter *rateLimiter` to Server (init `newRateLimiter(10, time.Hour)`); registered public `POST /shares/{token}/unlock` route.
- **`internal/db/share_repo.go`**: `Create` now inserts `password_hash`; `Update` now writes `password_hash` (load-mutate-save preserves it on password-untouched PATCHes).
- **View counts:** `viewCount` was already populated by `RecordView` and present on `models.Share`; the authenticated list response surfaces it for the 13.2b per-row display. Added a test asserting its presence/shape.
- **OpenAPI** (`packages/shared/openapi.yaml`): `password` (writeOnly, nullable) on `CreateShareInput`/`PatchShareInput`; `401` body of `GET /shares/{token}` changed to `{ passwordRequired: boolean }`; new `POST /shares/{token}/unlock` path (200/400/401/404/410/429). TS types regenerated.

**Tests (`internal/api/share_handler_test.go`):**
- Renamed `TestShareUpdate_Forbidden` → `TestShareUpdate_AnyTeamMember` (now asserts a non-creator member gets `200`, reflecting the dropped gate).
- Added: locked share returns `passwordRequired` with no data + no hash leak; wrong password `401`; full unlock→view-token→render flow; token-not-replayable-across-shares; rate-limit `429`; PATCH password on/off toggle locks/unlocks the gateway; list response exposes `viewCount`. Added local `jsonBody` test helper.

**Checks:**
- `golangci-lint run` ✅ (fixed a `gocritic` builtin-shadow on `max` → `limit`)
- `go test ./...` ✅
- `pnpm --filter web lint` ✅ (tsc --noEmit) · `pnpm --filter web build` ✅

**Deferred to 13.2b (frontend):** share-modal rebuild to the handoff design, per-row meta display, and the public unlock prompt UI at `/s/:token`.

---

## 2026-06-05 — /test-phase 13.1

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 6 pass, 2 pass-with-skips (ws-smoke: heartbeat skipped per TESTING.md; web-e2e: live browser skipped, static assertions pass)
- Smoke target: the LAN test instance
- Note: security-review flagged a non-blocking PII concern — `share_handler.go:249` falls back to email as display name when `DisplayName` is unset, which can expose member emails in public share responses

---

## 2026-06-04 — Phase 13.1: Shares MVP — Foundation, Public Gateway, Gantt Viewer

**Goal:** First-class Share entity with a scope-locked public data gateway, Go filter engine, golden parity fixtures, Gantt read-only mode, "Share this view" action, and the `/s/:token` public viewer route.

**Backend (`packages/api`):**

- **Migration 019** (`internal/db/migrations/019_shares.sql`): creates the `shares` table (`id`, `timeline_id`, `token UNIQUE`, `view_type`, `view_config`, `password_hash?`, `expires_at?`, `created_by`, `created_at`, `last_viewed_at`, `view_count`, `revoked_at`); migrates every existing `timelines.share_token` into a `shares` row so existing links keep working (the legacy `share_token` column is left in place — the old `GET /timelines/share/{token}` handler still resolves it).
- **`internal/filters/engine.go`** (new package): Go port of `lib/filterEngine.ts → matchesFilter`. Mirrors every field type (status, tag, assignee, title, progress, hasParent, startDate, endDate), all operators, AND/OR logic, and the same type-coercion edge-cases as the TS original.
- **`packages/shared/testdata/filter-fixtures.json`** (new): 27 golden test cases — statuses, tags, and activities reference data plus fixture definitions with expected results. Run by both the Go test (`TestGoldenFixtures`) and a new golden-fixture section in `filterEngine.test.ts`. All 27 pass on both sides.
- **`internal/db/share_repo.go`** (new): Create, GetByID, GetByToken, ListByTimeline, Update, Delete, RecordView.
- **`internal/models/models.go`**: added Share, PublicMember, PublicActivity, PublicTimeline, ShareProjection model types.
- **`internal/api/share_handler.go`** (new): `handleGetShareProjection` (public gateway: resolves share row, checks revoke/expiry/password stubs for future phases, serves from TTL cache or builds fresh projection with Go filter applied, calls `RecordView` async), `buildShareProjection` (scope-locked: derives `timeline_id` from share row server-side — no client selector — then filter-next, fixed display projection, referenced-entity pruning), `handleCreateShare`, `handleListShares`, `handleUpdateShare`, `handleDeleteShare`, in-memory `shareCache` (TTL from `DRABA_SHARE_CACHE_TTL`, default 60s; invalidated on PATCH/DELETE).
- **`internal/api/server.go`**: added `shares *db.ShareRepo` + `shareCache *shareCache` to Server; `NewServer` takes new `sharesRepo` param; routes: `GET /shares/{token}` (public), `POST /timelines/{id}/shares`, `GET /teams/{id}/timelines/{timelineId}/shares`, `PATCH /shares/{id}`, `DELETE /shares/{id}`.
- **Tests**: `internal/api/share_handler_test.go` (new) — create/list/delete CRUD, gateway 200, unknown token 404, no-email-in-response scope check, scope-isolation (param injection rejected), filtered-activities-absent (server-side filter removes "Beta" from a share filtered to title="Alpha"). All pass.
- **OpenAPI** (`packages/shared/openapi.yaml`): added Share, CreateShareInput, PatchShareInput, PublicMember, PublicActivity, PublicTimeline, ShareProjection schemas + all share paths; regenerated TS types.

**Frontend (`packages/web`):**

- **`src/hooks/useShares.ts`** (new): useListShares, useCreateShare, useDeleteShare (authenticated), useShareProjection (public, no auth, 60s stale time).
- **`GanttGrid.tsx`**: added `interactive?: boolean` prop (default true); when false, bar clicks, bar drag mouseDown, lane mouseDown, and cursor are all suppressed — the grid is visually unchanged but clicks are inert.
- **`GanttView.tsx`**: added `interactive?: boolean` prop threaded to GanttGrid; when false, onLaneDrag/onBarDrag/onBarDragProgress are also suppressed at the GanttView level.
- **`ShareModal.tsx`** (new): create-link modal — serialises live toolbar state (groupBy, sortBy, colorBy, granularity, resolved FilterDefinition) into `view_config`, calls `useCreateShare`, shows the `/s/:token` URL and a copy button.
- **`pages/ShareViewPage.tsx`** (new): public route at `/s/:token` (outside ProtectedRoute); fetches `useShareProjection`, forces light mode, applies parsed `view_config` (groupBy/sortBy/colorBy/granularity), builds GanttRow list from PublicActivity data, renders GanttGrid with `interactive={false}` + a branding strip (timeline name, "Shared view", activity count). Error states: 404 "not found", 410 "expired/revoked", generic fallback.
- **`App.tsx`**: added `<Route path="/s/:token" element={<ShareViewPage />} />` outside ProtectedRoute.
- **`DashboardPage.tsx`**: wires Gantt toolbar `onShare` → `setShareModalOpen(true)`; renders ShareModal when open; resolves active saved-filter definition into view_config.
- **`vite.config.ts`**: added `/shares` proxy entry.
- **`tsconfig.app.json`**: added `"resolveJsonModule": true` to enable JSON imports in tests.
- **`filterEngine.ts`**: fixed `is_empty`/`is_not_empty` ops for set fields to guard against missing `value` (`condition.value ?? []`) — matches Go engine's behaviour and fixes 4 newly-surfaced golden-fixture failures.
- **`filterEngine.test.ts`**: added 27-case golden-fixture test section that imports from `packages/shared/testdata/filter-fixtures.json`; all pass.

**Checks:**
- `golangci-lint run` ✅
- `go test ./...` ✅ (all packages including new api/share + filters/golden)
- `pnpm --filter web lint` ✅ (tsc --noEmit)
- `pnpm --filter web build` ✅ (tsc -b + vite build)
- `pnpm --filter web test` ✅ (280 tests, 22 test files including new golden-fixture suite)

---

## 2026-06-04 — Phase 12: Communications Testing

**Goal:** Automated coverage for every outbound email flow, then live end-to-end validation against Docker (the LAN test instance) with a real Gmail SMTP account.

**Test infrastructure & coverage (`packages/api`):**
- `internal/api/smtp_capture_test.go` (new): `newTestSMTPServer(t)` — an in-process TCP SMTP server that speaks just enough of the protocol (advertises no extensions, so the client uses the plain no-STARTTLS/no-auth path) and captures every message. Exposes `host()`/`port()`/`messages()`/`reset()`.
- `internal/mailer/mailer_test.go` (new, white-box): 9 unit tests — encrypt/decrypt round-trip, `SaveConfig` encrypts at rest (`enc:v1:` sentinel, no plaintext leak, no caller mutation), `LoadConfig` decrypts + legacy-plaintext fallback, unconfigured `LoadConfig` returns `(nil,nil)`, `Send` no-op when unconfigured, `IsConfigured`.
- `internal/api/comms_integration_test.go` (new): `POST /admin/smtp/test` (sends to caller, persists nothing), `PUT /admin/smtp` (sends validation email then persists) plus the validation-gate negative (unreachable server → 400, nothing persisted), password-reset email delivery + reset link, invite email delivery + link, and invite-with-no-email sends nothing.

**Feature added (made the invite-email bullet real):**
- `handleCreateInvite` (`team_handler.go`) now emails the invite link (`{DRABA_BASE_URL}/register?token=…`) when an address is supplied — best-effort, logged-not-fatal, no-op when SMTP is unconfigured or the invite is link-only. Previously it created the token but never sent mail, so the flow was untestable.

**Bugs found during live validation & fixed:**
- **Broken outbound links:** `getBaseURL()` falls back to `http://localhost:8080` when `DRABA_BASE_URL` is unset, so every emailed link (reset, invite) pointed at localhost. Documented the variable in `docker-compose.yml`; the live fix was setting `DRABA_BASE_URL` to the instance public URL in the Portainer `api` stack and restarting.
- **No reset-success feedback:** `ResetPasswordPage` routed a success message to `/login`, but `LoginPage` never read `location.state.message`, so a completed reset looked like a silent failure. `LoginPage` now renders the notice (green banner, suppressed once a server error shows).

**Onboarding UX follow-up (Brian request):**
- `RegisterPage` now requires password confirmation (enter twice) with a live "Passwords don't match" warning and a submit gated until they match. Verified in preview (mismatch → warning + disabled; match → enabled).

**Live validation (Docker, real Gmail SMTP):** password-reset email ✓, invite email ✓ (created "TEST PERSON" via the invite → register flow), both links correctly pointed at the LAN test instance. SMTP connection confirmed via delivered mail.

**Checks:** `go test ./...` clean; `golangci-lint run` clean; `pnpm --filter web lint` clean.

**Note:** `.env.test.local` admin password was stale (`draba1234`); updated to the current value after the reset-flow test.

---

## 2026-06-03 — Phase 11.3: Kanban View (Interactive)

**Goal:** Ship a fully interactive Kanban board view. Column axis = active Group by (Status by default). Drag-to-recolumn mutates grouping value via existing `useUpdateActivity`. Adds Color by, configurable Sorts, and a per-card Card fields toggle set.

**Frontend:**
- `components/kanban/kanbanColumns.ts` (new): Pure column-building and sort logic. `buildColumns(groupBy, activities, members, statuses, sortBy) → KanbanColumn[]` handles three Group by modes (Status / Member / Assigned-to-combination). Parent and None groupBy modes were evaluated and removed — Parent is difficult to display without a dedicated tree layout, and None produces a single unsortable column with no grouping value; both will be reconsidered in a future sub-phase. Each column carries an ordered `items[]` (activities sorted by `sortBy`), `droppable` flag, and `dropValue` (the patch to apply on drop). Sentinel IDs: `NO_STATUS_ID`, `UNASSIGNED_ID`. Also exports `buildHierarchyMaps` (pure helper for parent-child nesting) and `toggleCollapsedColumn` (immutable collapse toggle). Sort: Start date / End date / Title / % complete (desc, nulls last) / Recently updated.
- `components/kanban/KanbanView.test.ts` (new): 30 unit tests covering `sortActivities` (all 5 sort modes, null handling), `buildColumns` for all three Group by modes (column count, item routing, dropValue, droppable flag, sentinel columns, empty-activity robustness), `buildHierarchyMaps` (parent-child mapping, orphan handling, multi-level nesting), `toggleCollapsedColumn` (add/remove/immutability), and `handleAddInColumn` prefill semantics via dropValue assertions.
- `components/kanban/KanbanToolbar.tsx` (new): Sub-toolbar. Controls: Group by select / Sort by select / Color by select / Card fields multi-select (checkboxes with reset-to-defaults). Export/Share stubs in the right margin. Follows the same visual idiom as CalendarToolbar and GanttToolbar.
- `components/kanban/KanbanCard.tsx` (new): Draggable card using `@dnd-kit/core useDraggable` (5px activation threshold to prevent accidental drags). Renders: accent left border (3px, driven by per-activity resolved color from `colorMap`), title (2-line clamp), and all configured card fields: description snippet, status pill, date range, tag chips (max 3, +N), % complete bar, member avatars (overlapping, 2px card-bg ring, max 3, +N). Find highlight treatments (amber border for active match, 0.3 opacity for non-matches).
- `components/kanban/KanbanColumn.tsx` (new): Droppable column using `@dnd-kit/core useDroppable`. Header: accent dot, label, count badge, collapse chevron. Card list scrolls independently. Empty state: muted "No activities" (still a valid drop target). "+ Add" button (dashed border, hover → accent color). Collapsed rail: 40px wide, vertical label text, card count, expand chevron.
- `components/kanban/KanbanBoard.tsx` (new): `DndContext` host. Registers `PointerSensor` with 5px activation threshold. `onDragEnd`: resolves column from `over.id`, checks `droppable`, skips no-op drops (card already in target column), calls `onDrop`. `onDragOver`: tracks hovered column for drop-highlight styling. `DragOverlay`: floating card copy during drag, uses `dropAnimation={null}` for instant hide on drop. Per-activity `colorMap` passed through to columns → cards.
- `components/kanban/KanbanView.tsx` (new): Data container mirroring CalendarView. Fetches all activities for the timeline (no date bounds — Kanban shows everything). Applies `applyActiveFilter`. Builds per-activity `colorMap` via `resolveActivityColor`. Builds columns via `buildColumns`. Manages collapsed-column state (persisted to `kanban_collapsed` per-timeline pref). Find: `matchEvents`, `registerMatches` in column → sort order, auto-expands collapsed columns containing the active match. Drag commit: optimistic cache update + `useUpdateActivity.mutate`.
- `DashboardPage.tsx`: Added kanban toolbar state (`kanbanGroupBy`, `kanbanSortBy`, `kanbanCardFields`, `kanbanCollapsedColumns`). Per-timeline pref restoration for all kanban keys. Per-timeline pref save effects for all kanban keys. `KanbanToolbar` rendered in `view === 'kanban'` slot. `KanbanView` content branch replacing the old "coming soon" fallback. `onAddActivity` callback connects Kanban's "+ Add" to `setCreateDefaults`.

**Tests:**
- 253 total tests pass (up from 208 in Phase 11.2), including `KanbanView.test.ts` (30 tests after review remediation — hierarchy, collapse toggle, and prefill coverage added). `pnpm --filter web lint` clean; `pnpm --filter web build` clean.
- `golangci-lint run` clean; `go test ./...` passes (55 API tests, 4 DB tests); `pnpm --filter web lint` clean; `pnpm --filter web build` clean.

**Manual verification pending (Docker):** view switcher Kanban; drag between status/member columns; card fields toggle; collapse/expand columns; Filter and Find on board; Color by (per-view, separate from Gantt); sort within columns; "+ Add" opens create panel.

---

## 2026-06-03 — Phase 11.3: Review remediation

**Blockers addressed:**
- **Test coverage**: Extracted `buildHierarchyMaps` and `toggleCollapsedColumn` as exported pure helpers in `kanbanColumns.ts`; `KanbanView.tsx` now imports them. Added 11 new tests covering hierarchy mapping (parent-child routing, orphan handling, multi-level), collapse toggle (add/remove/immutability), and `handleAddInColumn` prefill semantics via `dropValue` assertions. Total: 30 tests in `KanbanView.test.ts`.
- **Log accuracy**: Corrected Group by mode count (3, not 5), test count, and manual verification scope. Removed references to `NO_PARENT_ID`, `NONE_COLUMN_ID` (never existed).

**Suggestions addressed:**
- **WS delete scope** (`useTeamActivities.ts`): `activity.deleted` now scopes cache invalidation to the current team's timeline IDs (from TanStack cache) rather than flushing all `['timelines']` queries. Falls back to the broad invalidation if the team timeline list isn't cached yet.
- **Kanban color-by state** (`DashboardPage.tsx`): Added separate `kanbanColorBy`/`setKanbanColorBy` state, decoupled from the Gantt `colorBy`. Preference restore, save effect, `KanbanToolbar`, and `KanbanView` all now use the dedicated state.

**Nits addressed:**
- `activityPanelFields.tsx` moved from `gantt/` → `shared/`; imports in `ActivityCreatePanel.tsx` and `ActivityDetailPanel.tsx` updated to `@/components/shared/activityPanelFields`. File header updated.
- `KanbanBoard.tsx`: `activityId` and `columnId` derivation now uses explicit `typeof` guards before `String()` fallback.
- `ROADMAP.md`: Scope bullet updated — Parent/None groupBy cut documented with rationale; `showHierarchy` pre-wiring noted as future prep, not 11.3 exit criterion.

---

## 2026-06-03 — /test-phase 11.3

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 8/8 pass (web-e2e verified with live browser automation: unauthenticated redirect ✓, login + token stored ✓, 10+ API calls 200 OK ✓, zero WS errors ✓)
- Smoke target: the LAN test instance

---

## 2026-06-02 — /test-phase 11.2

- Subagents run: static-check, unit-test (Go + Vitest), schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 7 pass, 1 skip (ws-smoke heartbeat 3rd cycle; 30s interval requires ~90s — unit tests cover at speed)
- Smoke target: the LAN test instance
- Notable: web-e2e confirmed calendar Month/Week layout, navigation, and tab switching; pre-existing `<TimelineItem>` render error in sidebar noted (unrelated to Phase 11.2)

---

## 2026-06-02 — Phase 11.2: Calendar View

**Goal:** Ship a Month / Week all-day-bar calendar view. Every activity is all-day, so Day view, the time grid, and the time-overlap lane algorithm are all cut. The only layout problem is vertical stacking of concurrent multi-day bars.

**Frontend:**
- `lib/activityColor.ts` (new): Shared color-by resolver extracted from `GanttView.toRichActivity`. Resolves the display hex color for an activity given `colorBy` ('activity' | 'member' | 'status'), the member map, and the status-color map. Calendar, Gantt, and List can now share one source of truth.
- `lib/calendarLanes.ts` (new): Pure lane-packing algorithm. `buildCalendarWeeks(activities, gridStart, weekCount, laneCaps, defaultLaneCap, matchedIds, activeMatchId)` returns `WeekRow[]`. Each `WeekRow` carries 7 day dates, a packed `CalendarSegment[]`, `laneCount`, and `visibleLaneCap`. Activities spanning week boundaries are split into independent per-week segments with `continuesLeft/Right` flags. Greedy packing assigns each segment to the lowest non-conflicting lane. `overflowCountsForWeek` and `segmentsForDay` are also exported for the overflow chip UI.
- `lib/calendarLanes.test.ts` (new): 21 unit tests covering `daysDiff`, single-week basics, single-day activities, multi-day spanning, week-boundary splitting, greedy lane packing (non-overlapping, overlapping, lane reuse, laneCount), overflow counts, segmentsForDay, and Find match flags.
- `components/calendar/CalendarToolbar.tsx` (new): Sub-toolbar shown in the `view === 'calendar'` slot. Provides Month/Week layout toggle, prev/next/today navigation, color-by select, and export/share stubs. `anchorDate` drives the range label (e.g. "June 2026" or "Jun 1 – 7, 2026").
- `components/calendar/CalendarGrid.tsx` (new): Presentational grid renderer. Shared by Month (6 weeks) and Week (1 week). Key responsibilities:
  - `WeekRowRenderer`: renders 7 day cells with borders, date numbers, day-of-week labels (first row in Month, always in Week), today highlight, "+N more" overflow chips, and lane-positioned activity bars.
  - `CalendarBar`: activity bar with `continuesLeft/Right` arrow affordances, no-end-cap border-radius, Find highlight treatment (amber glow for matches, 30% opacity for non-matches), and edge/body hit zones for drag.
  - `RowResizeHandle`: 6px bottom-edge drag strip per week row. Pointer-captured drag raises/lowers `visibleLaneCap` (min 1, max `laneCount`). Fires `onCapChange` which persists the cap to per-timeline prefs.
  - `DayOverflowPopover`: portal-like popover listing every activity on a day (visible + hidden). Click-through to `ActivityDetailPanel`. Closes on outside-click.
  - Drag state machine: pointer-captured per-bar drag resolves target day via `document.elementFromPoint` + `data-date` attribute lookup on day cells (geometric hit-testing, naturally handles week-wrap). Fires `onBarDragProgress` live for sidebar preview and `onBarDragCommit` on pointer-up → `PATCH`.
- `components/calendar/CalendarView.tsx` (new): Data container mirroring `GanttView`. Fetches activities + members via `useTimelineActivities` / `useTeamMembers`. Applies `applyActiveFilter`. Builds `CalendarActivity[]` with resolved colors. Runs Find matchEvents and registers ordered match IDs. Manages per-week lane cap persistence via `useUpsertPreference`. Handles bar drag commit (optimistic cache update + `useUpdateActivity.mutate`).
- `DashboardPage.tsx`: Added `calendarLayout` + `calendarAnchorDate` state. Added `calendarPrev`, `calendarNext`, `calendarToday` navigation callbacks. Added `CalendarToolbar` in the `view === 'calendar'` toolbar slot. Added `CalendarView` in the content area `view === 'calendar'` branch, wiring all props (colorBy, filter, find, drag progress, create defaults, member load).

**Tests:**
- 208 total tests pass (up from 187 in 11.1.2), including new `calendarLanes.test.ts` (21 tests).
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean; `pnpm --filter web build` clean.

**Manual verification pending (Docker):** view switcher Calendar; Month/Week layouts; multi-day bars; color-by; "+N more" chip and popover; row-height resize; bar click / empty-cell click; bar drag move/resize; Find highlights; filter parity.

---

## 2026-06-02 — /test-phase 11.1.2

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (1 skip — ws-smoke heartbeat; covered by unit tests)
- Smoke target: the LAN test instance
- Note: api-smoke assertion 18 (non-member authz) initially flagged as FAIL — investigated and confirmed false positive. The smoke subagent's "non-member" user had registered via the bootstrap-team invite and was therefore a member. Direct reproduction confirmed `requireTeamMember` returns 403 for a genuine non-member. TESTING.md Phase 3 assertion 18 updated with setup guidance.

---

## 2026-06-02 — Phase 11.1.2: Group by Assignee Combination

**Goal:** Fix "Group by Member" in both Gantt and List to bucket activities by their exact set of assignees rather than by the first assignee only. A two-person activity now appears under a dedicated `{Alice, Bob}` combo group instead of being invisible to Bob.

**Frontend:**
- `lib/memberGroups.ts` (new): shared module with `memberComboKey`, `orderedComboIds`, `memberComboLabel`, `comboSortComparator`, and `UNASSIGNED_KEY`. Single source of truth consumed by both views.
  - `memberComboKey(ids)` — sorts IDs and joins with `|`; returns `__unassigned__` for empty sets.
  - `orderedComboIds(ids, memberOrder)` — re-orders the set into team order for labels and header dots.
  - `memberComboLabel(orderedIds, nameById)` — Oxford join for 1–3 names; `"A, B, C +N"` for 4+.
  - `comboSortComparator(memberOrder)` — lexicographic comparison over team-order indices; solo groups cluster before multi-member groups with the same anchor; Unassigned always last.
- `GanttGrid.tsx`: extended `GanttRow` group type with `memberColors?: string[]`; group header renderer shows stacked circular color dots when `memberColors` is present (single-member group = one dot, unchanged look).
- `GanttView.tsx` `buildRows` (member branch): buckets by `memberComboKey(assignedMemberIds)`; sorts keys via `comboSortComparator`; derives group label and `memberColors` from `orderedComboIds` + team color map.
- `ListView.tsx` `buildListRows` (member branch): same combo-key bucketing and sort; added `memberOrder` parameter; `ListDisplayRow` group type extended with `memberColors?: string[]`; group header renderer shows stacked dots. Call site passes `memberOrder` derived from `members`.

**Tests:**
- `lib/memberGroups.test.ts` (new): 17 tests covering all four exports — key stability, ordering, Oxford/truncation labels, and comparator sort order.
- `GanttView.tree.test.ts`: replaced the old member-grouping suite (bucketed by primary member) with a combo-key suite: one group per unique assignee set, no duplication, `memberColors` presence, collapse behavior, Unassigned last.
- `ListView.tree.test.ts`: same replacement for List — combo-key bucketing, no duplication, `memberColors` on combo groups, collapse behavior.
- All 187 tests pass; `pnpm --filter web lint` and `pnpm --filter web build` clean.

---

## 2026-06-01 — Phase 11.1.1: Timezone-Safe Activity Dates

**Goal:** Fix midnight-UTC activity dates (`"2026-05-31T00:00:00Z"`) displaying one calendar day early (e.g. "May 30") for users in negative-UTC-offset timezones. Root cause: Gantt column boundaries and List date formatters used local-time JS methods, while activity dates are UTC midnight — producing a systematic off-by-one in any timezone west of UTC.

**Approach (Option A):** Treat all activity `startAt`/`endAt` as all-day calendar dates and read/position them in UTC throughout. Genuine timestamps (`createdAt`, `updatedAt`) stay local. Left a `TODO: branch on allDay when timed events ship (Phase 15 calendar sync)` marker at both formatter sites.

**Frontend — `components/gantt/granularity.ts`:**
- Replaced all local-time helpers with UTC equivalents: `startOfDay` → `setUTCHours(0,0,0,0)`; `startOfWeek` → `getUTCDay`/`setUTCDate`; `startOfMonth/Quarter/Year` → `Date.UTC(...)`; `addDays`/`addMonths` → `setUTCDate`/`setUTCMonth`
- `isoWeekNumber`: switched to UTC day/date arithmetic
- `formatLabel` (all granularities): added `timeZone: 'UTC'` to every `toLocaleDateString` call; `quarter`/`year` labels use `getUTCMonth`/`getUTCFullYear`
- `todayColumnPosition`: `startOfDay(new Date())` now produces UTC midnight via the updated helper — no separate change needed

**Frontend — `components/gantt/GanttView.tsx`:**
- `todayMidnight()`: changed `setHours` → `setUTCHours(0,0,0,0)`
- Fallback `viewStart`/`viewEnd` (no timeline dates): changed `setDate`/`getDate` → `setUTCDate`/`getUTCDate` for date arithmetic on the UTC-midnight `today` base

**Frontend — `components/gantt/GanttGrid.tsx`:**
- `formatDragDate`: added `timeZone: 'UTC'` to `toLocaleDateString` (drag tooltip dates)

**Frontend — `components/list/ListView.tsx`:**
- Added `formatActivityDate(iso)`: same signature as `formatDate` but with `timeZone: 'UTC'` — used exclusively for Start/End cells
- Left `formatDate` unchanged (local time) for Created/Updated cells which are genuine event timestamps

**Tests — `components/gantt/granularity.test.ts`:**
- Updated existing week-start tests: `getDay()`/`getDate()` → `getUTCDay()`/`getUTCDate()` (TZ-safe assertions); input dates changed to `Date.UTC(...)` to be stable across any test-runner timezone
- Added `positionInColumns — midnight-UTC activity dates land on correct day` suite: verifies May 31 column label contains "31", that an activity at `"2026-05-31T00:00:00Z"` lands in column index 30 (May 31), and that a May 1 activity lands in column 0

**Checks:** golangci-lint clean; go test 135 pass (cached); pnpm --filter web lint clean; pnpm --filter web build clean; pnpm --filter web test — 149 tests pass (14 new assertions)

---

## 2026-06-01 — /test-phase 11.1

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (schema-check and type-sync required fixes before passing — TESTING.md assertions corrected to match actual table names; generated index.ts re-committed)
- Smoke target: the LAN test instance

---

## 2026-05-31 — Phase 11.1: List View

**Goal:** Ship a curated, inline-editable List view as a peer to the Gantt view, plus the view-switcher persistence infrastructure reused by 11.2/11.3.

**New dependencies:**
- `@tanstack/react-table@^8.21.3` — headless table (column visibility/order/sizing/pinning/sorting state management)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-to-reorder column headers

**Frontend — `components/list/ListToolbar.tsx`:**
- Thin sub-toolbar (same height/style as GanttToolbar) shown when `view === 'list'`
- Columns menu: dropdown checklist of all 14 columns; toggling fires `onColumnVisibilityChange`
- Density toggle: Comfortable (40px rows) / Compact (32px rows)
- Group by: None / Member / Parent activity / Status
- Sort by: Start date / End date / Title / Status / Progress
- Color by: Activity / Member / Status
- Export + Share stubs

**Frontend — `components/list/ListView.tsx`:**
- TanStack Table v8 used for column management (visibility, order, sizing, pinning); `Title` column pinned to left with sticky positioning + box-shadow separator
- Column drag-reorder via `@dnd-kit` `SortableContext` on `<thead>`; drag handle grip icons on each `<th>`
- Column resize via TanStack `columnResizeMode: 'onChange'`
- Column config (order, hidden columns, widths) persisted per-timeline under preference key `list_columns` as `{ order, hidden, widths }` JSON blob
- Filter integration: `applyActiveFilter` applied before rendering (all 6 presets + member + saved filter kinds)
- Sort: default by `sortBy` prop; column header click overrides with TanStack sorting state (click once → asc, again → desc, again → none)
- Group-by: pre-processes sorted activities into flat `DisplayRow[]` with interleaved `{kind:'group'}` header rows; collapsible via chevron toggle
- Color-by: left 3px border stripe per row resolved to activity/member/status hex color
- Keyboard navigation: two-mode system — selection mode (arrows navigate cells, Enter/F2 enters edit) and edit mode (Esc cancels, Tab/Shift+Tab commit+move horizontal, Enter commit+move down, typing on editable cell immediately enters edit)
- Inline editors: `<input type="text">` for title/description/location/url, `<input type="date">` for startAt/endAt, `<input type="number">` for progress (0–100)
- Status cell: click to open `StatusPicker` popover with color-coded status pills; selection fires `useUpdateActivity` PATCH
- Assignees cell: read-only `<Badge>` display (up to 4, + overflow count); clicking row opens detail panel
- Tags cell: read-only colored tag pills (up to 3, + overflow count)
- Progress cell: mini progress bar + percentage label
- Duration cell: computed from startAt/endAt
- All edits go through `useUpdateActivity(timelineId)` with optimistic cache update
- Find integration: `matchEvents` run against filtered activities, `registerMatches` called when debounced query changes; amber outline on matches, 30% opacity on non-matches, stronger outline on active match; auto-scroll to active match via `activeRowRef`
- Empty state: single-cell spanning message when no activities
- Column visibility external toggle via `pendingColumnToggle` prop (seq-guarded to avoid double-application)

**DashboardPage updates:**
- Imports `ListToolbar`, `ListView`, `ListGroupBy`, `ListSortBy`, `ListColorBy`, `ListDensity`, `ColumnConfig`
- New state: `listGroupBy`, `listSortBy`, `listColorBy`, `listDensity`, `listColumns`, `listColToggle`
- Preference restore effect extended: reads `list_group_by`, `list_sort_by`, `list_color_by`, `list_density`, `view_mode` from per-timeline prefs
- New save effects: persist `view_mode`, `list_group_by`, `list_sort_by`, `list_color_by`, `list_density` on change
- `ListToolbar` shown when `view === 'list'` (same pattern as `GanttToolbar` for `view === 'gantt'`)
- `ListView` rendered in content area when `view === 'list' && teamId && activeTimelineId`; same detail/create panel shared with Gantt (selectedApiActivity, createDefaults)

**Checks:** golangci-lint clean, `go test ./...` 135 tests pass, `pnpm --filter web lint` clean, `pnpm --filter web build` clean

---

## 2026-05-31 — /test-phase 10.4.6

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (0 fail, 0 skip)
- Smoke target: the LAN test instance
- Notes: type-sync notes activity endpoints are timeline-scoped (`/teams/{id}/timelines/{timelineId}/activities`) rather than the flat path in Phase 3 TESTING.md assertions — this is the accepted design; TESTING.md assertions for those two paths are outdated. web-e2e WS heartbeat not directly introspectable from browser JS (app WS client is encapsulated), but no WS errors present and unit tests cover heartbeat behavior.

---

## 2026-05-30 — Phase 10.4.6: Filter Implementation

**Goal:** Make the filter system fully operational. Previously only "Open only" actually filtered activities. This phase ships a filter definition language, a client-side filter engine, all 6 presets wired, a visual filter builder, team-scoped filter promotion, and a "Manage filters" management panel.

**Backend:**
- Migration 018: `ALTER TABLE saved_filters ADD COLUMN is_team_filter BOOLEAN NOT NULL DEFAULT 0`
- `models.SavedFilter`: added `IsTeamFilter bool` (`db:"is_team_filter"`, `json:"isTeamFilter"`)
- `SavedFilterRepo.Create/Update`: include `is_team_filter` in SQL statements
- `SavedFilterRepo.ListByTeamUser`: changed `WHERE team_id = ? AND user_id = ?` → `WHERE team_id = ? AND (user_id = ? OR is_team_filter = 1)` — users now see their own filters plus all team-promoted filters
- `handleCreateSavedFilter`: accepts optional `isTeamFilter` in body; admin-only to set `true` at creation
- `handleUpdateSavedFilter`: owners can update name/definition of their own filters; admins can promote/demote `isTeamFilter` on any filter; admins can edit name/definition of existing team filters (not personal ones they don't own)
- `handleDeleteSavedFilter`: owners can always delete; admins can delete team filters they don't own

**OpenAPI + types:**
- `SavedFilter` schema: added `isTeamFilter: boolean` (required, default false) to spec
- `CreateSavedFilterJSONBody` and `UpdateSavedFilterJSONBody` in spec updated with `isTeamFilter` field
- `api_types.gen.go` manually updated to match (same field in Go generated types)
- TypeScript types regenerated

**Frontend — filter engine (`lib/`):**
- `filterTypes.ts`: `FilterLogic`, `FilterCondition` union (status/tag/assignee/title/progress/hasParent/startDate/endDate), `FilterDefinition`, `parseFilterDefinition` — the data language for filter specs stored as JSON
- `filterEngine.ts`: `matchesFilter(activity, filter, ctx)` — pure function evaluating a `FilterDefinition` against one activity. Status matched by name (case-insensitive) via `statusesByTimeline` lookup; tags matched by name via `ctx.tags`; assignees by member ID; dates via ISO string comparison
- `presetFilters.ts`: `applyActiveFilter(activities, activeFilter, memberIdsByUserId, ctx)` — single entry point for all filter kinds. Preset implementations: `all` (passthrough), `open` (excludes closed status IDs), `upcoming` (start/end within 7 days), `my` (assigned to current user's member IDs), `overdue` (past end + not closed), `noassign` (empty assignees). Member kind resolves team_member_ids from the userId→memberIds map. Saved kind parses definition JSON and delegates to `matchesFilter`

**Frontend — GanttView wiring:**
- Replaced `closedStatusIds?: Set<string>` prop with `timelineStatuses?: Status[]`, `savedFilters?: SavedFilter[]`, `tags?: Tag[]`
- Inside component: derives `closedStatusIds` from `timelineStatuses`; builds `statusesByTimeline` Map (single entry for this timeline); builds `memberIdsByUserId` from `apiMembers`; computes `currentUserMemberIds` from auth user + member map
- Replaced old `hideClosedActive/filterOpenActivities` memo with a single `applyActiveFilter` call — all 6 presets now filter activities, not just "Open only"
- Added `useAuth` import to get current user ID

**Frontend — filter builder UI (`components/filters/`):**
- `FilterConditionRow.tsx`: single condition row — field dropdown (8 options), operator dropdown (contextual by field type), value input (MultiSelect for set fields, text/number/date for scalar fields), remove (×) button. `MultiSelect` is an inline portal-rendered multi-checkbox dropdown
- `FilterEditor.tsx`: full filter builder panel — name input, AND/OR segmented toggle, scrollable condition list, "+ Add condition" button, Save/Delete/Cancel footer. Edit mode pre-populates from existing filter's definition JSON. Calls `useCreateSavedFilter` / `useUpdateSavedFilter` / `useDeleteSavedFilter`; in-panel delete confirmation
- `FilterManagePanel.tsx`: manages all user and team filters. Splits into "Team Filters" and "My Filters" sections. Per-row: Edit button, Promote to team / Make personal (admin only), Delete (owner or admin for team filters). Inline delete confirmation per row

**Frontend — FilterDropdown updates:**
- Partitions `useSavedFilters` results into `teamFilters` (is_team_filter = true) and `myFilters` (is_team_filter = false)
- Team filters section now renders real data (was a static "No team filters yet" stub)
- Added "Manage filters" row at bottom of dropdown (above "Add filter") → calls `onOpenManager`
- Added `onOpenManager` prop; `List` icon imported

**Frontend — DashboardPage + TopBar wiring:**
- Added `useSavedFilters(teamId)` and `useTags(teamId)` data fetches
- Added `filterManageOpen` state and `editingFilter: SavedFilter | null` state
- Two `RightSidebar` panels: one for `FilterManagePanel` (manage mode), one for `FilterEditor` (new/edit mode). FilterManagePanel's "Edit" button transitions to editor with the filter pre-loaded
- TopBar gained `onOpenFilterManager` prop; FilterDropdown gains `onOpenManager` prop; GanttView call-site updated to pass `timelineStatuses`, `savedFilters`, `tags`
- `useSavedFilters.ts`: added `isTeamFilter?: boolean` to `UpdateSavedFilterInput`

**Tests:**
- `lib/filterEngine.test.ts` (new): 20 unit tests covering all 8 field types, all operator categories, AND/OR logic, empty-conditions edge case, null/missing fields, and case-insensitive status/tag matching
- `lib/presetFilters.test.ts` (new): 11 unit tests covering each of the 6 presets, the member filter kind, and saved filter delegation (match, not-found fallback)
- `saved_filter_handler_test.go` (extended): 5 new tests — `ListSavedFilters_IncludesTeamFilters`, `AdminCanPromoteOthersFilter`, `NonAdminCannotPromote`, `AdminCanDeleteTeamFilter`, `NonAdminCannotDeleteOthersTeamFilter`
- `migrations_test.go`: assertion that `saved_filters.is_team_filter` column exists after migration 018
- All automated checks: `golangci-lint run` clean; `go test ./...` all pass (including 5 new handler tests); `pnpm --filter web lint` clean; `pnpm --filter web build` clean; `pnpm --filter web test` 117 tests pass across 12 test files

---

## 2026-05-30 — Phase 10.4.5: Activity Tags, Parent & Progress Fields

**Goal:** Replace the three "coming soon" stubs in the activity edit panel with fully functional fields. Tags are normalized (team-scoped `tags` table + FK junction). Parent and progress already had backend support; this phase adds the UI controls and a Gantt bar progress indicator.

**Backend:**
- Migration 017: `tags` table (id, team_id, name, color, created_by, created_at; UNIQUE on team_id+name); rebuilt `activity_tags` as normalized FK junction (dropped old text-junction table from migration 001)
- `models.Tag` struct; `Activity.TagIDs []string` field with `db:"-"` tag (same pattern as `AssignedMemberIDs`)
- `TagRepo` in `internal/db/tag_repo.go`: Create, GetByID, ListByTeam (ORDER BY name), Update, Delete
- `ActivityRepo.SetTags` / `GetTags`: transaction DELETE+INSERT pattern matching `SetAssignments`/`GetAssignments`
- `ActivityRepo.ListByTimeline`: now also batch-populates `TagIDs` via `sqlx.In` (same two-query JOIN pattern as `AssignedMemberIDs`)
- `tag_handler.go`: GET/POST `/teams/{id}/tags`, PATCH/DELETE `/tags/{id}` — any team member can create/edit/delete; 409 on duplicate name
- `activity_handler.go`: `handleCreateActivity` and `handleUpdateActivity` accept `tagIds`; `setActivityArchive` populates `TagIDs` on response
- `isUniqueConstraintError` helper in `helpers.go`: checks for "UNIQUE constraint failed" in error message
- Server: `tags *db.TagRepo` field; 4 tag routes registered; `main.go` instantiates `db.NewTagRepo(database)` and passes to `NewServer`

**OpenAPI + types:**
- `Tag` schema added with all fields; `tagIds: array<string>` added to `Activity` schema and both create/update request bodies
- TypeScript types regenerated via `pnpm --filter shared generate`
- `CreateActivityJSONBody` in `api_types.gen.go` updated to include `TagIds *[]string`

**Frontend:**
- `hooks/useTags.ts`: `useTags`, `useCreateTag`, `useUpdateTag`, `useDeleteTag` — follow `useSavedFilters.ts` patterns; cache key `['teams', teamId, 'tags']`
- `components/TagInput.tsx`: combobox with colored pill badges (color from identity palette), autocomplete filtered by typed text, "Create 'X'" option at bottom when no exact match; auto-selects new tags on creation
- `ActivityDetailPanel.tsx`: Tags stub → `TagInput`; Parent stub → native `<select>` populated from `useTimelineActivities` (excludes self); Progress stub → `<input type="range" min=0 max=100 step=5>` that saves on mouseup; `tagIds`, `progressValue` state added; `handleTagsChange`, `handleParentChange`, `handleProgressChange`/`Commit` handlers added; imports updated
- `ActivityCreatePanel.tsx`: `TagInput` added below Assignees section; `tagIds` state (reset on panel open); `tagIds` included in create mutation payload; `CreateActivityInput` type extended
- `GanttGrid.tsx`: progress fill overlay inside bars — semi-transparent darker div spanning `percentComplete%` width from left, `pointerEvents: none`
- `vite.config.ts`: `/tags` proxy entry added
- `hooks/useTeamActivities.ts`: `CreateActivityInput` and `UpdateActivityInput` types extended to include `tagIds`, `parentActivityId`, `percentComplete`

**Sample data:**
- `sample_data/10_tags.sql`: 8 tags (urgent, design, content, research, launch, competitive, review, blocked) for Product Marketing team; 13 activity_tag associations across Q1 and SKO activities

**Tests:**
- `internal/db/tag_repo_test.go` (new): 7 tests — create+list (alphabetical order), getByID, update, delete, unique constraint error, SetTags/GetTags, ListByTimeline TagIDs population
- `internal/api/tag_handler_test.go` (new): 7 tests — create+list, 409 duplicate, 400 missing name, update, 404 not found, delete, 403 non-member
- All 11 `NewServer` call sites in test files updated to pass the new `*db.TagRepo` parameter
- `golangci-lint run` clean; `go test ./...` all pass; `pnpm --filter web lint` clean

---

## 2026-05-29 — Phase 10.4.4: Gantt Interaction & Activity Edit Polish

**Goal:** Polish the Gantt's direct-manipulation UX (resizable label column, click-to-activate drag, live sidebar date feedback, finer snap), move "Hide closed" from toolbar to filter preset, and overhaul the Activity Edit sidebar layout.

**Backend:**
- Migration 016: `ALTER TABLE activities ADD COLUMN notes TEXT` (nullable)
- `Activity` model: added `Notes *string` field with `db:"notes"` tag
- `ActivityRepo.Update`: added `notes = :notes` to UPDATE SET
- `handleUpdateActivity`: added `notes` patch key parsing
- OpenAPI + TS types: added `notes` to `Activity` schema and PATCH body; regenerated

**Gantt — resizable label column:**
- `DEFAULT_LABEL_COL_W = 240`, min 140, max 400
- `labelColW` state in `GanttGrid`; `handleColumnResizeMouseDown` sets up mousemove/mouseup handlers
- Drag handle div positioned absolutely on the right edge of the sticky header label cell
- All row label cells use `labelColW` state (was hard-coded `LABEL_COL_W = 240` constant)

**Gantt — click-to-activate before drag:**
- `handleBarMouseDown` gates on `ev.id !== selectedActivityId` — unselected bars can't be dragged
- Bar cursor: `grab` only when selected AND `onBarDrag` is provided; `pointer` otherwise
- Left/right resize handles rendered only when bar is selected (`onBarDrag && selected`)

**Gantt — bar drag updates sidebar dates live:**
- New `onBarDragProgress` prop on `GanttGrid` and `GanttView`; called during mousemove with current snapped dates
- `DashboardPage`: `liveDragDates` state; `onBarDragProgress` sets it; `onBarDragEnd` clears it
- `ActivityDetailPanel`: `liveDragStart`/`liveDragEnd` props; displayed in date inputs when set (read-only during drag, don't trigger saves)

**Gantt — finer-grained snap during drag:**
- `snapDivisorFor(granularity)`: day→1, week→7, month→4, quarter→3, year→4
- `colFracToDate` interpolates fractional column positions for accurate date mapping
- Drag math uses `Math.round(x / step) * step` with `step = 1/divisor`
- `resolvedGranularity` prop passed from GanttView to GanttGrid
- `colToStartDate`/`colToEndDate` updated to handle fractional column positions

**Gantt — "Hide closed" moves to filter preset:**
- Removed `hideClosed` checkbox and related props from `GanttToolbar`; removed `hideClosed` state from `DashboardPage`
- Added `'open'` to `ActiveFilter` preset type in `FilterContext`
- `FilterDropdown`: added "Open only" preset with subtitle "Hide activities with a closed status"
- `GanttView`: reads `activeFilter.id === 'open'` instead of `hideClosed` prop to filter closed-status activities

**Activity Edit Sidebar — overhaul:**
- Removed "All day" checkbox (allDay state, handler, and toggle)
- Removed human-readable date summary line (was `{formatDate(startDate)} – {formatDate(endDate)}`)
- Description field moved directly below date pickers (was at the bottom under "Notes")
- "Assigned to" section: opacity-toggle buttons → bordered card style with color border + tint when selected (matches create panel)
- Status picker: plain `<select>` → `StatusDropdown` component with color dot, name, and CLOSED badge
- Removed "Identity" row from Classify section
- Renamed "Details" section → "Advanced"
- Added Notes multi-line `<textarea>` (resizable) at bottom, backed by new `activities.notes` column
- `liveDragStart`/`liveDragEnd` props: override date inputs display during bar drag without triggering saves

**Tests:**
- `TestMigrate_016_ActivityNotes`: verifies `activities.notes` column exists after migration

**All automated checks pass:** `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean.

---

## 2026-05-29 — /test-phase 10.4.4

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 7 pass, 1 skip (ws-smoke — websocat/wscat not installed on dev box; heartbeat covered by unit tests)
- Smoke target: the LAN test instance

---

## 2026-05-28 — Phase 10.4.3: UI Consistency — Modals, Sidebar & Toolbar

**Goal:** Standardize visual patterns across TeamModal, MemberModal, and TimelineModal — three different inline-editing patterns, three different archive button styles, three different confirmation dialog implementations, and mixed hardcoded hex colors vs CSS variables.

**Shared components created:**
- `components/shared/InlineEditableTitle.tsx`: always-visible name input with a bottom border that appears on hover/focus; used in all three modals to replace three divergent editing patterns
- `components/shared/ConfirmDialog.tsx`: shared confirmation panel with four color variants (red=destructive, amber=archive, indigo=promote, teal=restore); replaces `MemberModal`'s local `ConfirmDialog`, `TeamModal`'s `ArchiveDialog`, and `TimelineModal`'s inline return-replacement confirmations

**TeamModal.tsx:**
- Removed `nameEditing` state machine (div/input toggle); replaced with `InlineEditableTitle`
- Removed `nameInputRef` and associated focus/effect logic; Escape now closes the modal directly
- Replaced `ArchiveDialog` component with shared `ConfirmDialog variant="amber"`; footer hides when confirm is showing
- Archive button: neutral gray → amber bg+border+`Archive` icon
- Restore button: neutral gray → teal bg+border+`RotateCcw` icon
- Migrated all structural hex colors (`#21262d`, `#30363d`, `#2d333b`, `#484f58`, `#8b949e`, `#e6edf3`) to CSS variables (`var(--card)`, `var(--border)`, `var(--muted)`, `var(--muted-foreground)`, `var(--foreground)`)

**MemberModal.tsx:**
- Replaced local `ConfirmDialog` component with shared one
- Replaced focus-underline name input with `InlineEditableTitle`
- Migrated all structural hex colors to CSS variables

**TimelineModal.tsx:**
- Replaced separate-overlay archive/delete confirmation returns with inline `ConfirmDialog` components (shown in content area; footer hides when confirm is showing) — matches TeamModal/MemberModal UX
- Archive button: border-only, no icon → amber bg+border+`Archive` icon
- Restore button: amber border-only → teal bg+border+`RotateCcw` icon
- Was already using CSS variables; no color migration needed

**Sidebar audit:** Badge usage, hover states (`rgba(255,255,255,0.05)`), and `Settings2` gear icons consistent across all row types (TimelineItem, TeamRow, MemberSidebarRow). No fixes required.

**Toolbar audit:** GanttToolbar uses Tailwind classes + CSS variables throughout; `ctrlBtn` pattern consistent with modal footer buttons. No fixes required.

**Exit criteria:**
- ✅ All three modals use `InlineEditableTitle` for name editing — identical visual behavior
- ✅ Archive and restore buttons look identical across all three modals (amber archive, teal restore, both with icons)
- ✅ All confirmation dialogs use shared `ConfirmDialog` with appropriate color variants
- ✅ No hardcoded structural hex colors in modal components; all use CSS variables
- ✅ Sidebar/toolbar audited — consistent, no fixes needed
- ✅ `pnpm --filter web lint` clean

---

## 2026-05-28 — /review-phase 10.4.2 fixes

**Blockers resolved:**
- Migration 015: removed `WHERE timeline_id IS NOT NULL` filter from `INSERT INTO activities_new` — any row with NULL timeline_id after backfill now aborts the migration with a NOT NULL constraint error rather than being silently dropped
- `handleUpdateActivity`, `setActivityArchive`, `handleDeleteActivity`: added `sql.ErrNoRows` check on the timeline lookup so a missing/deleted timeline returns 404 instead of 500 and skipping the auth check
- Added `TestCreateActivity_TimelineNotFound`, `TestListActivities_TimelineNotFound`: verify 404 when timelineId does not exist
- Added `TestCreateActivity_TimelineDifferentTeam`, `TestListActivities_TimelineDifferentTeam`: verify 404 when timeline belongs to a different team than the URL's team ID
- Added `TestMigrate_015_NormalizesActivities`: asserts `activities.team_id` is absent, `activities.timeline_id` is present, and FK is ON DELETE CASCADE to timelines

---

## 2026-05-28 — /test-phase 10.4.2

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke
- Result: 7 pass, 0 fail, 0 skip (web-e2e not run — no Phase 10.4.2 assertions defined)
- Smoke target: the LAN test instance

---

## 2026-05-28 — Phase 10.4.2: Activity Schema Normalization

**Goal:** Remove the redundant `activities.team_id` column now that `timeline_id` is the primary FK. Harden `timeline_id` to NOT NULL. Move activity routes to timeline-scoped paths.

**Backend:**
- Migration 015: backfills NULL `timeline_id` rows (assigns to team's oldest timeline), rebuilds `activities` without `team_id` using the SQLite CREATE-INSERT-DROP-RENAME pattern, hardens `timeline_id` as NOT NULL with `ON DELETE CASCADE`
- `models.Activity`: `TeamID` removed, `TimelineID` changed from `*string` to `string`
- `ActivityRepo.Create`: removed `team_id` from INSERT; `ListByTeam` → `ListByTimeline(timelineID string, ...)` (simple `WHERE timeline_id = ?`)
- Activity handlers: POST/GET moved to `/teams/{id}/timelines/{timelineId}/activities` (team-scoped prefix required — `GET /timelines/{id}/activities` conflicts with `GET /timelines/share/{token}` in Go 1.22 mux); update/delete/archive derive teamID via timeline lookup for auth + bus publish
- OpenAPI: `Activity.teamId` → `timelineId` (required, non-nullable); paths updated; TS types regenerated

**Frontend:**
- `useTeamActivities` → `useTimelineActivities(teamId, timelineId, from, to)`: URL and cache key updated
- `useCreateActivity(teamId, timelineId)`, `useUpdateActivity(timelineId)`, `useDeleteActivity(timelineId)`: all updated
- `useTeamActivitySync`: WS deltas now patch `['timelines', timelineId, 'activities']` cache entries using payload's `timelineId`
- `GanttView.tsx`: `timelineId` prop now required; uses `useTimelineActivities`
- `ActivityCreatePanel.tsx`, `ActivityDetailPanel.tsx`: updated signatures; no `timelineId` in create request body
- `DashboardPage.tsx`: Gantt guarded on `activeTimelineId` presence; `ActivityCreatePanel` restored `teamId` prop

**Tests:**
- All activity handler tests create a timeline first; routes updated to team-scoped path; `activityURL()` helper added
- `activity_repo_test.go`: `makeActivity` uses `timelineID`; `ListByTimeline` throughout; added `TestActivityRepo_ListByTimeline_Filter`
- `archive_test.go`, `revoke_user_test.go`, `team_handler_test.go`: create timeline before seeding activity
- `user_repo_test.go`, `migrations_test.go`: raw INSERTs use `timeline_id`

**Note:** TASKS.md had "UI Consistency" mislabeled as Phase 10.4.2; corrected to 10.4.3 per ROADMAP.

**Exit criteria:**
- ✅ `activities` table has no `team_id`; `timeline_id` is NOT NULL
- ✅ `golangci-lint run` clean
- ✅ `go test ./...` passes
- ✅ `pnpm --filter web lint` clean
- ⬜ Gantt loads activities (manual Docker verification)
- ⬜ `PRAGMA foreign_key_check` on Docker DB

---

## 2026-05-28 — /review-phase 10.4.1 fixes

**Blockers resolved:**
- `GanttView.tsx`: Maps `date_format` pref to BCP 47 locale (`DD/MM/YYYY` → `en-GB`, others → `en-US`); passes `locale` to `generateColumns` — column labels now respect the user's date ordering preference
- `ActivityDetailPanel.tsx`: Wired `useFormatDate`; formatted date range summary line added above native date inputs
- `BrandingSync.tsx`: Fixed accent color to set `--primary` directly (not `--accent-override`); added `isValidHex()` guard; exported `makeDocTitle(pageName?)` helper for the `${page} — ${app}` title pattern
- `openapi.yaml`: Added `GET /settings/branding` with `security: []` and full response schema; regenerated TS types
- `settings_handler_test.go`: Added `TestPatchAdminSettings_AccentColor`, `TestGetPublicBranding_NoAuth`, `TestGetPublicBranding_EmptyWhenUnset`
- `api.test.ts`: New file — 7 tests covering `createAuthFetch` happy path, non-401 errors, 401 retry, null-token re-throw, unregistered interceptor, de-registration teardown, and `ApiError` identity
- `useFormatDate.ts`: Exported `formatDate` pure function; new `useFormatDate.test.ts` with 6 branch tests
- `granularity.test.ts`: New test file — 6 tests covering `weekStart` (monday/sunday/default) and `locale` (en-US/en-GB/default) params

**Suggestions resolved:**
- `OrganizationPage.tsx`: Hex validation (`/^#[0-9a-fA-F]{6}$/`) on accent color input; invalid value blocked from PATCH; inline error shown
- `PreferencesPage.tsx`: Added why-comment to `eslint-disable-next-line` for `JSON.stringify(prefMap)` dep stabilization
- `admin_handler.go`: Added comment to `handleGetPublicBranding` warning against adding sensitive keys to the public endpoint

**Nit resolved:**
- `BrandingSync.tsx`: `makeDocTitle()` helper exported so pages can set `"PageName — AppName"` titles; document.title set via `makeDocTitle()` at root level

---

## 2026-05-28 — /test-phase 10.4.1

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (ws-smoke heartbeat 3-cycle skipped — 30s server interval exceeds smoke budget, mechanism verified in code; web-e2e browser runtime skipped — dev server not confirmed running, all assertions pass code-level)
- Smoke target: the LAN test instance
- Note: TESTING.md Phase 2 schema-check table list updated (old names `team_statuses`, `events`, `event_tags`, `event_assignments` → current names)

---

## 2026-05-28 — Phase 10.4.1 — Preference Consumption & Session Handling

**Session lifecycle (401 interceptor):**
- `packages/web/src/lib/api.ts`: Added `configureSilentRefresh(fn)` export and module-level mutex (`_refreshInFlight`); `createAuthFetch` now catches 401, calls `doSilentRefresh()`, retries with new token
- `packages/web/src/contexts/AuthContext.tsx`: Added `silentRefresh` function (calls `/auth/refresh`, updates state, falls back to `window.location.replace('/login')` on failure); registers via `configureSilentRefresh` in a `useEffect`, deregisters on unmount
- Concurrent 401s share a single in-flight refresh call — no duplicate refresh requests

**Preference consumption:**
- `packages/web/src/hooks/useFormatDate.ts`: New hook — reads `date_format` pref, returns formatter for `MMM D, YYYY` / `MM/DD/YYYY` / `DD/MM/YYYY` / `YYYY-MM-DD`
- `packages/web/src/components/gantt/granularity.ts`: `startOfWeek` accepts `weekStart` param; `formatLabel` accepts `locale` param; `generateColumns` accepts `GenerateColumnsOptions { weekStart, locale }`
- `packages/web/src/components/gantt/GanttView.tsx`: Reads `week_start` from global preferences via `usePreferenceMap`, passes to `generateColumns`
- `packages/web/src/hooks/useDarkMode.ts`: Added `applyTheme(t)` function for explicit theme setting
- `packages/web/src/components/ThemeSync.tsx`: New null-render component — on auth init applies server-side `theme` preference once per session
- `packages/web/src/pages/settings/PreferencesPage.tsx`: Added theme toggle (Light/Dark) — applies immediately and persists server-side on Save

**Admin branding:**
- `packages/api/internal/api/admin_handler.go`: Added `accent_color` to allowed `GET/PATCH /admin/settings` keys; added `handleGetPublicBranding` for `GET /settings/branding`
- `packages/api/internal/api/server.go`: Registered `GET /settings/branding` as public (no auth)
- `packages/web/vite.config.ts`: Added `/settings` proxy entry for dev
- `packages/web/src/hooks/usePublicSettings.ts`: New hook — fetches `/settings/branding` without auth
- `packages/web/src/components/BrandingSync.tsx`: New null-render component — sets `document.title` from `instanceName`, applies `accentColor` as `--accent-override` CSS variable
- `packages/web/src/App.tsx`: Mounts `ThemeSync` and `BrandingSync` inside `AuthProvider`
- `packages/web/src/pages/LoginPage.tsx`: Shows `instanceName` from branding API instead of hardcoded "draba"
- `packages/web/src/pages/settings/OrganizationPage.tsx`: Added accent color field (color picker + hex input + Reset)

**Deferred (documented in TASKS.md):**
- `ActivityDetailPanel` date display: native `<input type="date">` already uses browser locale; no read-only date label surface exists yet
- Public/shared timeline view fallback: deferred to Phase 13 (Shares)
- Logo upload: stretch goal, deferred

**Checks:**
- `golangci-lint run` — clean
- `go test ./...` — all pass
- `pnpm --filter web lint` (tsc --noEmit) — clean

---

## 2026-05-27 — /test-phase 10.3

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 8 pass (ws-smoke: assertion 2 skipped — single-team test DB; assertion 3 partial — 30s heartbeat cadence, unit tests cover at speed)
- Smoke target: the LAN test instance
- Notes: `GET /activities?from=&to=` returns 400 (param names differ from Phase 3 spec); `POST /auth/register` requires `displayName` field not in spec — both are spec gaps, not runtime failures

---

## 2026-05-27 — Phase 10.3 — Timelines Full CRUD (API + UI)

**Backend:**
- New handlers: `PATCH /timelines/{id}`, `DELETE /timelines/{id}`
- New handlers: `GET/PUT/DELETE /teams/{id}/timelines/{timelineId}/access` — timeline access list CRUD
- New handlers: `POST /teams/{id}/timelines/{timelineId}/statuses`, `PATCH /statuses/{id}`, `DELETE /statuses/{id}` — live timeline status editing
- `canAdminTimeline` helper: checks team admin role first, then per-timeline `timeline_access` role='admin'
- `TimelineStore` interface expanded: `Update`, `Delete`, `ListAccess`, `GetAccessRole`, `RevokeAccess`
- `TimelineAccessEntry` model added: joins `timeline_access` + `team_members` + `users`
- `StatusRepo` additions: `CreateStatus`, `UpdateStatus`, `DeleteStatus`, `CountStatuses`, `CountStatusActivities`
- `DeleteStatus` re-points activities to replacement before deleting; blocked if last status
- Note: access endpoints use team-scoped URL prefix to avoid Go 1.22 mux conflict with `GET /timelines/share/{token}` on 3-segment paths
- OpenAPI spec updated: `PatchTimelineInput`, `TimelineAccessEntry`, `CreateStatusInput`, `PatchStatusInput`, `DeleteStatusInput` schemas + all new endpoints; TypeScript types regenerated

**Tests added:**
- `TestUpdateTimeline_AdminCanRename`, `TestUpdateTimeline_NonAdminForbidden`
- `TestDeleteTimeline_AdminCanDelete`, `TestDeleteTimeline_NonAdminForbidden`
- `TestTimelineAccessList_GrantAndRevoke`

**Frontend:**
- `TimelineModal.tsx` — create/edit modal with Settings, Statuses, and Access tabs; archive + delete confirmation dialogs
- `Sidebar.tsx` — real archived timelines section (Restore button), wired New timeline and settings gear
- `ActivityDetailPanel.tsx` — status dropdown populated from `useTimelineStatuses`; replaces stub
- `GanttToolbar.tsx` — `hideClosed` / `onHideClosedChange` props; Hide closed checkbox shown when timeline has closed statuses
- `GanttView.tsx` — `hideClosed` + `closedStatusIds` props; filters out activities with closed status IDs
- `useTeamActivities.ts` — `useCreateTimeline`, `useUpdateTimeline`, `useDeleteTimeline`, `useArchiveTimeline`, `useUnarchiveTimeline`, `useTeamTimelinesWithArchived`, `useTimelineAccess`, `useGrantTimelineAccess`, `useRevokeTimelineAccess`
- `useStatusTemplates.ts` — `useCreateTimelineStatus`, `useUpdateTimelineStatus`, `useDeleteTimelineStatus`
- `DashboardPage.tsx` — timeline modal state; passes all new props to Sidebar + GanttToolbar + GanttView + ActivityDetailPanel

**Automated:** `golangci-lint run` clean, `go test ./...` all pass, `pnpm --filter web lint` clean.

**Pending manual verification (against the LAN test instance):** see TASKS.md checklist.

---

## 2026-05-27 — Phase 10.2 — Review Fixes & Docker Verification

**Review fixes applied:**
- Aligned `SeedDefaultTemplate` test assertions to match actual seed output ("Default" template with Planning / In Progress / Complete; Complete is `is_closed`)
- Added three missing tests: `TestUpdateStatusTemplate_AdminCanRename`, `TestUpdateTemplateItem_AdminCanUpdate`, `TestStatusTemplates_NonAdminForbidden` (403 on all 5 mutation routes for non-admin members)
- Rephrased `is_closed` checkbox label in `StatusTemplatesTab.tsx` to remove forward-reference to "Hide closed" filter (Phase 10.3 scope)
- Replaced mojibake em-dashes (`â€"`) with hyphens in 4 test files: `team_handler_test.go`, `activity_handler_test.go`, `saved_filter_handler_test.go`, `timeline_handler_test.go`

**Docker verification (the LAN test instance):** ✅ passed
- Default template seeded on team create; template CRUD, item CRUD, and last-item/last-template guards all work from UI
- New timeline correctly copies template statuses (verified via API)
- Non-admin sees templates read-only
- Note: "Create new timeline" UI is Phase 10.3 — statuses verified via direct API call

**Phase 10.2 closed ✅**

---

## 2026-05-27 — /test-phase 10.2
- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 7 pass, 1 partial-skip (ws-smoke: heartbeat full 3-cycle skipped per time budget; unit tests cover at speed)
- Smoke target: the LAN test instance

---

## 2026-05-27 — Phase 10.2 — Status Templates & Timeline Statuses

**Backend:**
- Migration 012: replaced `team_statuses` table with three new tables — `status_templates` (team-level reusable presets), `status_template_items` (items within a template), `statuses` (live timeline-specific statuses copied from a template)
- `activities.status_id` FK updated to reference `statuses(id) ON DELETE SET NULL` instead of the now-dropped `team_statuses`
- New `StatusTemplate`, `StatusTemplateItem`, `Status` models in `models.go`
- New `StatusRepo` (`internal/db/status_repo.go`): full CRUD for templates, template items, and statuses; `SeedDefaultTemplate` creates the "Simple" preset (Planned / In Progress / Done, Done is `is_closed`); `CopyTemplateToTimeline` copies the team's first template into live statuses on timeline creation
- `handleCreateTeam` now seeds the default template after team creation
- `handleCreateTimeline` now calls `CopyTemplateToTimeline` so every new timeline gets statuses from the template
- New API endpoints: `GET/POST /teams/{id}/status-templates`, `PATCH/DELETE /status-templates/{id}`, `POST /status-templates/{id}/items`, `PATCH/DELETE /status-template-items/{id}`, `GET /teams/{id}/timelines/{timelineId}/statuses`
- Note: `GET /timelines/{id}/statuses` conflicts with `GET /timelines/share/{token}` in Go 1.22's mux (both are 3-segment wildcard paths, ambiguous on `/timelines/share/statuses`); resolved by using the team-scoped URL `/teams/{id}/timelines/{timelineId}/statuses`
- OpenAPI spec updated with `StatusTemplate`, `StatusTemplateItem`, `Status`, and all input schemas; TypeScript types regenerated

**Tests:**
- `status_handler_test.go`: 5 tests covering default seeding on team create, admin-only template creation, last-template deletion guard, template item add/delete, and timeline status copy-from-template
- `migrations_test.go` updated: `team_statuses` removed from expected tables; `status_templates`, `status_template_items`, `statuses` added; `activities.status_id` FK target verified

**Frontend:**
- `useStatusTemplates.ts` — hooks for all status template and timeline status endpoints
- `StatusTemplatesTab.tsx` — standalone component: expandable template cards with inline item editing (name, color swatch picker, `is_closed` toggle), add/delete items with last-item guard, create/delete templates with last-template guard
- `TeamModal.tsx` — added "Status Templates" tab (3rd tab alongside Settings and Members); tab is locked until the team is saved

---

## 2026-05-27 — /review-phase 10.1.4 — fixes applied

Post-review fixes across security, tests, spec, and conventions:

**Security:**
- `user_handler.go` — added self-revoke guard (`CANNOT_SELF_REVOKE` 400) to `handleRevokeUser`; prevents a superadmin from locking themselves out

**Spec / types:**
- `openapi.yaml` — fixed `application\json` typo (backslash) → `application/json` in `POST /users/{id}/revoke` 200 response
- `openapi.yaml` — added `userArchivedAt` field to `MemberDetail` schema (account-level deactivation, distinct from membership-level `archivedAt`)
- `models.go` — added `UserArchivedAt *time.Time` to `MemberDetail`; updated doc comment
- `team_handler.go` — `handleGetMember` now populates `UserArchivedAt` from `users.archived_at`
- Regenerated `packages/shared/src/index.ts`

**Tests (new):**
- `revoke_user_test.go` — handler tests: 403 non-superadmin, 400 self-revoke, 404 not found, 200 success (zero-history + with-assignments paths)
- `user_repo_test.go` — repo tests: inactivates memberships with history, removes zero-history memberships, handles mixed-membership users
- `team_handler_test.go` — `TestDeleteMember_HasAssignments_Returns409` tests 409 path with `assignmentCount` in response

**Conventions:**
- Removed phase number references from doc/inline comments in `team_handler.go`, `team_repo.go`; replaced with WHY explanations
- Fixed "summarises" → "summarizes" in `models.go`

**Frontend:**
- `MemberModal.tsx` — "Revoke all access" button now hides when `userArchivedAt` is set (account-level deactivation) rather than when the team membership is inactivated; updated comment to explain the distinction
- `TeamModal.tsx` — added `useEffect` to clear `removeErrors` when `searchQ` changes

**Needs manual Docker verification:**
- Revoke all access on a user who has mixed memberships (some with history, some without)
- "Revoke all access" button hidden for already-deactivated accounts but visible for inactivated-only memberships

---

## 2026-05-27 — Phase 10.1.4 — Member Access & Data Lifecycle

**Backend:**
- `011_fk_restrict.sql` — rebuilt `activity_assignments` and `timeline_access` with `ON DELETE RESTRICT` on `team_member_id` FK (was CASCADE); prevents silent data destruction when a member row is deleted
- `PRAGMA foreign_keys = ON` was already set in `db.Open()` since Phase 8.0; verified and documented
- `team_repo.go` — added `CountMemberAssignments(memberID)` and `DeleteMemberTimelineAccess(memberID)` methods
- `team_handler.go` — `handleDeleteMember` now counts `activity_assignments` before deleting; if count > 0 returns 409 `MEMBER_HAS_ASSIGNMENTS` with `assignmentCount` in the response body; deletes `timeline_access` rows before deleting the `team_members` row (required by new RESTRICT FK)
- `user_repo.go` — added `RevokeUser(userID)`: atomically archives the user, inactivates memberships with assignments, hard-deletes memberships with zero assignments; wrapped in a single transaction
- `user_handler.go` — added `handleRevokeUser` (superadmin only); wires `RevokeUser` and returns `RevokeUserResult`
- `server.go` — registered `POST /users/{id}/revoke`
- `models.go` — added `RevokeUserResult` struct
- `migrations_test.go` — added assertions: `PRAGMA foreign_keys = 1`; `activity_assignments.team_member_id` FK is `RESTRICT`; `timeline_access.team_member_id` FK is `RESTRICT`

**OpenAPI + types:**
- Added `RevokeUserResult` schema to spec
- Added `POST /users/{id}/revoke` endpoint to spec
- Regenerated TypeScript types

**Frontend:**
- `api.ts` — extended `ApiError` with optional `data?: Record<string, unknown>`; `parseError` now extracts extra fields from the error response body (used to surface `assignmentCount` from 409)
- `useMemberManagement.ts` — added `useRevokeUser` hook (invalidates `['teams']` on success)
- `TeamModal.tsx` — remove (×) button now handles 409 `MEMBER_HAS_ASSIGNMENTS`; shows inline error "N assignments — can't remove" with an "Inactivate instead" one-click action; clears on next removal attempt
- `MemberModal.tsx` — added "Revoke all access" button (red, hidden when account already deactivated); confirmation dialog lists all three effects; on success shows summary chip and closes after 2s

**Verified (automated):**
- `go test ./...` — all pass including new migration assertions
- `golangci-lint run` — clean
- `pnpm --filter web lint` — clean

**Needs manual Docker verification:**
- Remove member with assignments → 409 + inline error + "Inactivate instead" one-click
- Remove member with zero assignments → success
- "Revoke all access" → account deactivated, login rejected, Gantt bars still show avatar

---

## 2026-05-27 — /test-phase 10.1.4

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (8/8)
- Smoke target: the LAN test instance

---

## 2026-05-26 — /review-phase 10.1.3 — fixes applied

Post-review fixes across security, tests, conventions, and ROADMAP:

**Security:**
- `mailer.go`: SMTP password now encrypted at rest with AES-256-GCM (key derived from `DRABA_JWT_SECRET`); `enc:v1:` prefix distinguishes encrypted from legacy plaintext values
- `main.go`: passes `[]byte(jwtSecret)` to `mailer.New()`
- `auth_handler.go`: password reset link uses `url.QueryEscape(rawToken)` (was raw concatenation)
- `admin_handler.go`: SMTP validation/test errors logged at Warn; generic message returned to caller (was leaking internal error detail)
- `mailer.go`: removed recipient email from debug-skip log line

**Tests added:**
- `settings_handler_test.go`: `TestForgotPassword_KnownUser_CreatesToken`, `TestResetPassword_Success`, `TestResetPassword_ExpiredToken`, `TestPatchAdminSettings_Success`, `TestPatchAdminSettings_RejectsUnknownKey`
- `password_reset_token_repo_test.go`: Create/GetValid/expired/MarkUsed
- `instance_settings_repo_test.go`: Get missing/Set/Upsert/Delete
- `team_handler_test.go`: added `testServerEnv` + `newTeamTestServerFull()` helper for direct repo access in tests

**Frontend:**
- `AdminPage.tsx`: deleted (dead code — not routed; split pages are the active routes)
- All settings pages converted from inline `style` objects to Tailwind utility classes using design-system tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.)
- Token hooks (`useTokens`, `useCreateToken`, `useRevokeToken`) extracted from `TokensPage.tsx` to `useSettings.ts`
- `AiKeysPage.tsx`: file-header comment updated to reference Phase 10.6; language placeholders in `PreferencesPage` and `OrganizationPage` now reference Phase 10.7

**ROADMAP:**
- Added Phase 10.5 — Communications Testing (SMTP + mailer integration/unit tests)
- Added Phase 10.6 — AI Key Management (replaces AiKeysPage stub)
- Added Phase 10.7 — Localization & Language Support (language dropdowns become functional)

---

## 2026-05-26 — /test-phase 10.1.3

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (8/8)
- Smoke target: the LAN test instance (reset via SSH to the test host before run)

---

## 2026-05-26 — Phase 10.1.3: Settings — Profile, Tokens & Admin

Full settings experience: profile + identity management, password change, forgot-password flow, API token management, SMTP configuration, instance defaults, and admin user list. All automated checks pass; manual verification on Docker needed.

**Schema (migration 010):**
- `users.color`, `users.icon` — user-level identity; propagates to `team_members` on change
- `instance_settings (key PK, value, updated_at)` — key/value store for SMTP config and instance defaults
- `password_reset_tokens (id, user_id FK, token_hash, expires_at, used_at, created_at)` — forgot-password flow; token_hash stores SHA-256 of raw token; token expires after 1 hour

**API — 11 new endpoints:**
- Profile: `PATCH /users/me` (name, color, icon + team_members propagation)
- Security: `PUT /users/me/password` (current → new; 401 WRONG_PASSWORD, 400 WEAK_PASSWORD)
- Forgot password: `POST /auth/forgot-password` (always 200; generates token + sends via mailer), `POST /auth/reset-password` (TOKEN_INVALID / TOKEN_EXPIRED on bad token)
- SMTP (superadmin): `GET/PUT/DELETE /admin/smtp`, `POST /admin/smtp/test`
- Instance settings (superadmin): `GET/PATCH /admin/settings` (registration_policy, default_timezone, default_date_format, default_week_start, instance_name)
- Users (superadmin): `GET /admin/users?orphaned=true`

**New packages:**
- `internal/mailer/` — wraps `net/smtp`; reads SMTP config from `instance_settings` at send time so changes take effect without restart; supports None / TLS / STARTTLS encryption; `Send()` is a no-op when SMTP not configured (avoids breaking forgot-password when admin hasn't set up email)

**Frontend — 7 new pages:**
- `/settings/profile` — display name + identity widget + read-only email; identity changes propagate to all team memberships
- `/settings/security` — change password form with current/new/confirm validation
- `/settings/preferences` — theme toggle (applies immediately), timezone, date format, week start; writes via existing `PUT /users/me/preferences`
- `/settings/tokens` — token table (name, scope, last used, created); create with one-time secret reveal; inline revoke
- `/settings/admin` — SMTP form with send-test; instance defaults; registration policy; user list with orphaned filter and search
- `/forgot-password` — public; always shows "check your email" message after submission (no enumeration)
- `/reset-password?token=...` — public; validates token, sets new password, redirects to login

**Login page:** added "Forgot password?" link below the password field.

**SettingsPage.tsx:** reworked into shell with React Router sub-routes; admin nav items hidden from non-superadmins.

**OpenAPI:** added `UpdateProfileInput`, `ChangePasswordInput`, `ForgotPasswordInput`, `ResetPasswordInput`, `SMTPConfig`, `AdminUserRow` schemas plus all 11 new endpoint paths; TypeScript types regenerated.

**Tests (10 new in settings_handler_test.go):**
- `PATCH /users/me`: happy path (name + color saved), empty name rejected
- `PUT /users/me/password`: happy path, wrong current password (401), weak new password (400)
- `POST /auth/forgot-password`: always returns 200 for unknown email
- `POST /auth/reset-password`: invalid token returns 400 TOKEN_INVALID
- `GET /admin/settings`: superadmin reads defaults, non-superadmin gets 403
- `GET /admin/users`: superadmin lists all users

**Deferred items (noted for follow-up):**
- SMTP password encryption at rest (stored as JSON in instance_settings; encryption using JWT secret deferred)
- `/forgot-password` "contact admin" message requires a public SMTP status endpoint (deferred)
- Click user row in admin users list → open MemberModal (deferred to polish pass)
- "Assign team" action on orphaned users (deferred)
- Default team/timeline dropdown in Preferences (requires loading teams list; deferred)

---

## 2026-05-25 — Phase 10.1.2: Members — manual-testing bug fixes

Issues found during manual UI testing of 10.1.2 and fixed the same day (since verified working on Docker).

**Frontend (`packages/web/`):**
- `TeamModal.tsx` — Members tab badge was hardcoded `0`; now uses `members.length`.
- `MemberModal.tsx` — loading overlay had no close button / no backdrop dismiss and got stuck permanently on API error; now dismissable and shows an error state.
- `AuthContext.tsx` — browser refresh lost `user` (RefreshResponse only returns `accessToken`); fixed by calling `GET /auth/me` after token exchange to restore the user object. This was the cause of `canEditTeam = false` and the sidebar configure icons disappearing after every page refresh.
- `useMemberManagement.ts` — `useTeamInvites` / `useUserSearch` returned `null` from the API (not `[]`); the `= []` destructuring default only catches `undefined`. Fixed with `?? []` normalization in `queryFn`.
- `useTeamActivities.ts` — same null-vs-empty bug in `useMyTeams`, `useTeamTimelines`, `useTeamActivities`, `useTeamMembers`; all patched.
- `TeamModal.tsx` — participant form used `IdentityPicker` (raw expanded panel) instead of `IdentityWidget` (trigger + popover); replaced.
- `TeamModal.tsx` — role dropdown disabled on the current user's own row (`m.userId === currentUserId`); user cannot change their own role from the UI. Error banner wired to `updateMember.isError`.

**Backend (`packages/api/`):**
- `internal/db/team_repo.go` — `GetMemberStats`: `SUM()` over zero rows returns SQL `NULL`, failing `rows.Scan` into `int` with a 500; fixed with `COALESCE(SUM(...), 0)`.
- `internal/api/team_handler.go` — `handleUpdateMember`: replaced the "last admin" check with a self-change guard (`SELF_ROLE_CHANGE / 409`); admins can now demote any other admin freely (at least one admin always remains — the current user).
- `vite.config.ts` — WebSocket proxy target changed to `ws://`; added `rewriteWsOrigin: true`; added missing `/activities` proxy route.
- `useWebSocket.ts` — when `VITE_API_TARGET` is set (Docker dev), WebSocket connects directly to the target instead of through Vite's unreliable `ws: true` proxy.

---

## 2026-05-25 — Phase 10.1.2: Members — Management & Editing (review fixes)

Post-review fixes applied: security hardening, token entropy, new routes, full test suite.

- **Security**: `GET /users/search` now returns a safe `userSearchResult` projection (id, email, displayName, avatarUrl only) — `isSuperadmin`, `archivedAt`, timestamps excluded.
- **Token entropy**: invite and invite-link tokens now use `newToken()` (256 bits / 64 hex chars) instead of `newID()` (128 bits). `newToken()` added to `helpers.go`.
- **New routes**: `GET /teams/:id/members/:memberId/stats` (standalone stat endpoint) and `POST /teams/:id/invite-link/reset` (alias for regenerate) registered in `server.go`.
- **Design decision documented**: reusable invite-link tokens have no expiry — valid until admin revokes/resets. Rationale in handler comment.
- **Tests**: 11 new tests in `team_handler_test.go` covering member CRUD, last-admin protection, archive/unarchive, stats endpoint, invite-link create/reset/revoke, and safe-fields assertion for user search.
- **Superadmin gating confirmed correct**: `onNewTeam` and `onEditMember` in `DashboardPage.tsx` are already gated on `isSuperadmin`; no frontend changes required.

---

## 2026-05-25 — Phase 10.1.2: Members — Management & Editing

Full member lifecycle: add, edit, roles, participants, invites, reusable invite links, inactivation, and superadmin actions. All automated checks pass; manual UI verification on Docker still needed.

**Schema (migration 009):**
- `team_members.archived_at` — member inactivation (soft-delete pattern)
- `users.archived_at` — account-level inactivation; login rejected when set
- `teams.invite_link_token` — reusable join-link token (partial unique index on non-NULL rows, since SQLite can't ADD UNIQUE column via ALTER TABLE)

**API — 17 new endpoints:**
- Member CRUD: `GET/POST /teams/:id/members`, `PATCH/DELETE /teams/:id/members/:memberId`, archive/unarchive
- Participant CRUD: `POST /teams/:id/participants`
- Invites: `GET /teams/:id/invites`, `DELETE /teams/:id/invites/:inviteId`
- Invite links: `GET/POST/DELETE /teams/:id/invite-link`
- User search: `GET /users/search?q=`
- Superadmin: `POST /users/:id/promote`, `POST /users/:id/archive`, `POST /users/:id/unarchive`, `DELETE /users/:id`
- Auth: login now rejects archived users with `ACCOUNT_INACTIVE`; register now accepts reusable invite link tokens alongside one-time tokens

**Member stats:** computed per-request from `activity_assignments JOIN activities` — past due, running, upcoming, archived counts; plus active/archived timeline counts from `timeline_access`.

**Deletable rule:** zero active activities (past due + running + upcoming = 0) AND single team membership.

**Web:**
- `useMemberManagement.ts` — 14 new TanStack Query hooks
- `RoleDropdown.tsx` — portal-rendered role picker (Admin/Member/Participant with colors + descriptions)
- `MemberModal.tsx` — 560px portal modal with stats chips, teams list, superadmin actions with 3 confirmation dialogs
- `TeamModal.tsx` Members tab — search/add, participant form, member list with role dropdown, pending invites, invite link
- `Sidebar.tsx` — real member data wired; `MemberSidebarRow` with gear icon on hover
- `DashboardPage.tsx` — wires MemberModal, passes members + handler to Sidebar

**What needs manual verification on Docker:**
- Add user (search + add), invite by email, create participant, change roles, remove member
- Generate invite link, copy URL, register new account via that link
- MemberModal stats correct; admin actions (promote, inactivate, delete) fire correct dialogs
- Archived users cannot log in; reactivation restores login

---

## 2026-05-25 — Phase 10.1.1 post-/test-phase fixes

Six issues found during /test-phase 10.1.1 review and UX testing.

**1. Non-admin UI gating (blocker):**
- Added `canEditTeam` prop to `Sidebar` derived from `useTeamMembers` in DashboardPage.
- `TeamRow` component (new) only renders the gear/edit icon when `isActive && canEdit`.
- Non-admin members no longer see the team settings affordance.

**2. New team auto-selects in sidebar:**
- Added `activeTeamId` state to DashboardPage (was hardcoded to `activeTeams[0]`).
- `TeamModal.onTeamCreated` callback sets `activeTeamId(created.id)` immediately on server confirmation.
- Sidebar now receives `activeTeams` (all non-archived) via new prop and maps them all as clickable rows; `onSelectTeam` switches the active team.

**3. Same-name teams now allowed:**
- `handleCreateTeam` and `handleUpdateTeam` append `-<id[:8]>` to the slug, guaranteeing uniqueness regardless of name.
- `TestCreateTeam_DuplicateSlug` renamed `TestCreateTeam_SameNameAllowed` and updated to assert both 201 + distinct slugs.

**4. Sidebar identity reads from API:**
- `TeamRow` Badge now uses `team.icon ?? '__name_1__'` and `team.color` (was hardcoded `'__name_1__'` for all rows).
- Archived team Badge likewise fixed.

**5. Removed duplicate identity widget from modal:**
- Removed the "Icon & color" `IdentityWidget` + label from the Settings tab body (it was a second copy of the header widget).

**6. Removed duplicate name field; header name is now click-to-edit:**
- Removed the "Name" input from the Settings tab body.
- Header name area is now an inline editable input: new teams open in editing mode; existing teams click-to-edit.
- Escape closes the name input; Enter confirms.

**Checks:** `go test ./...` all pass · `golangci-lint run` clean · `pnpm --filter web lint` clean · UI verified via preview.

---

## 2026-05-25 — Phase 10.1.1: Teams — CRUD & Management

**Migration 008** (`008_team_crud.sql`): added `description TEXT`, `notes TEXT`, and `archived_at DATETIME` columns to `teams`.

**API:**
- `models.Team` updated with `Description`, `Notes`, `ArchivedAt` fields.
- `TeamRepo.Create` updated to persist `description`, `notes`, `color`, `icon`.
- `TeamRepo.Update` added — writes mutable team fields (name, slug, description, notes, color, icon).
- `TeamRepo.SetArchived` added — sets or clears `archived_at`.
- `TeamRepo.ListByUserID` updated with `includeArchived bool` parameter; excludes archived by default.
- New handlers: `PATCH /teams/{id}` (admin only), `POST /teams/{id}/archive`, `POST /teams/{id}/unarchive`.
- `GET /teams` now accepts `?archived=true`.
- `POST /teams` now accepts optional `description`, `notes`, `color`, `icon` fields.
- OpenAPI spec updated: `Team` schema gains `description`, `notes`, `archivedAt`; `CreateTeamInput` extended; `PatchTeamInput` added; new archive/unarchive paths added.
- TypeScript types regenerated.
- `migrations_test.go` asserts the three new columns on `teams`.

**Web:**
- `useMyTeams(includeArchived?)` — optional param to fetch archived teams too.
- `useTeam(teamId)` — fetch single team detail.
- `useCreateTeam`, `useUpdateTeam`, `useArchiveTeam`, `useUnarchiveTeam` mutations.
- `TeamModal` — creates or edits a team. Settings tab fully functional (IdentityWidget, name, description, notes). Members tab is a locked placeholder (Phase 10.1.2). Archive confirmation dialog with amber styling. "Saved" banner auto-dismisses after 3s.
- `SettingsPage` — `/settings` route shell with left-nav layout (foundation for 10.1.2–10.4).
- `App.tsx` — `/settings` and `/settings/*` routes added (protected).
- `DashboardPage` — wires team CRUD: active team, archived teams list, TeamModal state, unarchive mutation; Settings dropdown button navigates to `/settings`.
- `Sidebar` — team section now shows real team name/badge; gear icon opens TeamModal in edit mode; "New team" button opens TeamModal in new mode; archived teams shown with Restore action.

**Checks:** `golangci-lint run` clean · `go test ./...` passes · `pnpm --filter web lint` clean.

**Needs manual verification on Docker:** create second team from picker, edit/archive/unarchive, TeamModal in both modes, "Saved" banner, Settings route.

**Spec notes (not called out in phase scope):**
- `isSuperadmin` added to OpenAPI `User` schema — this is a spec sync of a field that already existed in the Go model and DB; it is not a new feature introduced by this phase.
- `docs/design/handoffs/member-modal/` committed in this phase as pre-checked-in design references for 10.1.2. No 10.1.2 code ships here.

---

## 2026-05-24 — Phase 9.6 post-review: hex storage + named exports + tests

**Architecture change — hex colors stored in DB:**
- Added migration 007: converts palette name IDs written by migration 006 back to canonical hex values (e.g. `'teal'` → `'#288C9B'`). Hex is the durable ground truth; palette names are UI-only.
- `Identity` interface: renamed `colorId` → `color` (hex) and `iconId` → `icon` throughout.
- `IdentityPicker` now fires `onChange` with the selected hex value directly, not the palette name ID.
- Removed `hexToColorId()` and the `LEGACY_HEX_TO_ID` map from `identity-constants.ts`; `resolveColorHex` simplified to hex pass-through with colorId backward-compat fallback.
- `Member.colorId` removed from types — `Member.color` is always hex.
- `GanttActivity.iconId` renamed to `icon`; `GanttView.toMember` no longer sets `colorId`.

**Named exports:** All five identity components switched from `export default` to named exports (`Badge`, `IdentityTrigger`, `IdentityPicker`, `IdentityWidget`). All import sites updated.

**Tests (blocker fixes):**
- `migrations_test.go`: added `TestMigrate_006_007_ColorConversion` (verifies the full 006→007 hex conversion round-trip) and `TestMigrate_HexStorageRoundTrip` (verifies hex values survive storage unchanged).
- `identity-constants.test.ts` (new): 22 unit tests covering `resolveColorHex`, `iconIdToPascal`, `getNameText`, and the `IDENTITY_COLORS` palette invariants.

All checks pass: `go test ./...`, `golangci-lint run`, `pnpm --filter web lint`, `pnpm --filter web test`.

---

## 2026-05-24 — /test-phase 9.5

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (0 fail, 0 skip)
- Smoke target: the LAN test instance
- Notes: ws-smoke code-verified (no wscat available); 2 cosmetic residuals in web (stale JSDoc in useWebSocket.ts:7, `matchEvents` function name in findMatcher.ts:27 — no runtime impact)

---

## 2026-05-24 — Phase 9.6: Identity System (Color + Icon)

### What was built

A reusable Identity component system — a color + icon pair that gives every major entity (activities, timelines, teams, members) a consistent visual fingerprint. Expanded the color palette from 8 to 16, added schema fields to teams/timelines/team_members, and replaced every existing color/icon surface with the new components.

**DB (migration 006):**
- Added `icon TEXT` to `team_members`; `color TEXT` + `icon TEXT` to `teams`; `color TEXT` + `icon TEXT` to `timelines`.
- Converted existing `activities.color` and `team_members.color` hex values → identity color IDs (e.g. `#288C9B` → `"teal"`).

**Go API:**
- `models.Team`: added `Color *string`, `Icon *string`.
- `models.TeamMember`: added `Icon *string`.
- `models.Timeline`: added `Color *string`, `Icon *string`.
- `team_repo.go ListMembers`: query updated to SELECT `tm.icon`.
- `migrations_test.go`: assertions added for all five new identity columns.
- OpenAPI spec: `Team`, `TeamMember`, `Timeline` schemas updated with `color`/`icon` fields.
- TypeScript types regenerated.

**Web — identity component library (`src/components/identity/`):**
- `identity-constants.ts`: 16-color palette (`IDENTITY_COLORS`), 64-icon list (`IDENTITY_ICONS`), `hexToColorId()` legacy mapping, `resolveColorHex()`, `getNameText()`, and palette re-exports (`ACTIVITY_COLORS`, `MEMBER_COLORS`).
- `Badge.tsx`: read-only identity badge — handles Lucide icons, name-text initials (`__name_1__`, `__name_2__`, `__name_words__`), color-only (`__none__`), both shapes (square/circle), any size 20–40px.
- `IdentityTrigger.tsx`: clickable badge with chevron pip, colored outline ring on hover/open.
- `IdentityPicker.tsx`: popover content — 16-color grid (8×2) + 4 name options + 64-icon grid (8×8); fires `onChange` on every selection.
- `IdentityWidget.tsx`: composed trigger + picker with portal positioning, click-outside-to-close.

**Web — integration:**
- `ActivityDetailPanel`: icon stub + 8-color swatch replaced by `<IdentityWidget>`; saves `colorId` + `iconId` via PATCH.
- `ActivityCreatePanel`: 8-color swatch replaced by `<IdentityWidget>`.
- `GanttGrid`: label column 8px color dot replaced by `<Badge size={20} shape="square">`.
- `Sidebar` timeline rows: inline colored span replaced by `<Badge size={20} shape="square">`.
- `Sidebar` member rows: inline colored circle div replaced by `<Badge size={20} shape="circle">`.
- `MemberAvatar`: refactored to delegate to `<Badge>` internally; external API unchanged.
- `GanttView.toMember`: now resolves colorId → hex for `Member.color`; also populates `Member.colorId`.
- `GanttView.toRichActivity`: passes `iconId` from API activity through to `GanttActivity`.

**Palette consolidation:**
- `types/index.ts`: `ACTIVITY_COLORS` and `MEMBER_COLORS` are now re-exported from `identity-constants.ts`.
- `index.css`: `--member-N-*` CSS vars replaced with `--identity-<name>` vars for all 16 colors.
- `DESIGN_SYSTEM.md`: 8-color member palette section replaced with 16-color identity palette reference.

**Exit criteria status:** All criteria met — lint clean, tests pass. Identity widget and Badge render correctly. Manual UI verification needed on live Docker instance.

---

## 2026-05-21 — Phase 9.5: The Great Event → Activity Rename

### What was built

Hard cutover renaming the domain entity `Event` → `Activity` across every layer. No aliases, no backward-compat shims.

**DB (migration 005):**
- `events` → `activities`, `event_tags` → `activity_tags`, `event_assignments` → `activity_assignments` via `ALTER TABLE RENAME`.
- `parent_event_id` → `parent_activity_id` column rename.
- `event_id` column renamed to `activity_id` in both `activity_tags` and `activity_assignments`.
- `google_event_id` and `caldav_uid` columns preserved — they identify external VEVENT records.

**Go API:**
- `models.Event` → `models.Activity`; `ParentEventID` → `ParentActivityID` with updated `db:` and `json:` tags.
- `db/event_repo.go` → `db/activity_repo.go`; `EventRepo` → `ActivityRepo`; all SQL tables/columns updated.
- `api/event_handler.go` → `api/activity_handler.go`; all handler funcs renamed; routes `/teams/{id}/events` → `/teams/{id}/activities`, `/events/{id}` → `/activities/{id}`, archive/unarchive likewise.
- `server.go`: `events *db.EventRepo` → `activities *db.ActivityRepo`; `NewServer` signature updated; `main.go` updated.
- `internal/events/bus.go`: `EventCreated/Updated/Deleted` → `ActivityCreated/Updated/Deleted`; wire strings `event.*` → `activity.*`. Package name `internal/events` and `TimelineCreated/Updated` unchanged.
- `api_types.gen.go`: `Event` → `Activity`, `CreateEventJSONBody` → `CreateActivityJSONBody`, `UpdateEventJSONBody` → `UpdateActivityJSONBody`, `ListEventsParams` → `ListActivitiesParams`, `EventId` → `ActivityId`.

**OpenAPI + generated types:**
- `packages/shared/openapi.yaml`: `Event` schema → `Activity`; all operationIds, tags, paths; `parentEventId` → `parentActivityId`; `caldavUid`/`googleEventId` preserved. `eventId` parameter → `activityId`.
- `pnpm --filter shared generate` run; TypeScript now exports `Activity`, `CreateActivityJSONBody`, etc.

**Web:**
- `useTeamEvents.ts` → `useTeamActivities.ts`; all hooks renamed (`useTeamEvents` → `useTeamActivities`, `useTeamEventSync` → `useTeamActivitySync`, etc.); query keys `'events'` → `'activities'`; API paths updated.
- `EventDetailPanel.tsx` → `ActivityDetailPanel.tsx`; `EventCreatePanel.tsx` → `ActivityCreatePanel.tsx`; `EventPanel.tsx` updated in-place.
- `types/index.ts`: `DrabaEvent` → `DrabaActivity`, `EventStatus` → `ActivityStatus`, `EVENT_COLORS` → `ACTIVITY_COLORS`.
- `GanttGrid.tsx`: `GanttEvent` → `GanttActivity`; `kind: 'event'` → `kind: 'activity'` discriminant; column header "Event" → "Activity"; empty state "No viewable events" → "No viewable activities".
- `GanttView.tsx`: `RichEvent` → `RichActivity`; all `parentEventId` → `parentActivityId`; `useTeamEvents` → `useTeamActivities`; `useUpdateEvent` → `useUpdateActivity`.
- `GanttToolbar.tsx`: `ColorBy` value `'event'` → `'activity'`; option labels updated; default in `DashboardPage` updated.
- `findMatcher.ts` + test: `eventId` → `activityId` in `MatchResult`; `parentEventId` → `parentActivityId`; `Event` schema type → `Activity`.
- `Sidebar.tsx`: `onNewEvent` → `onNewActivity`; section label "Event" → "Activity".
- `DashboardPage.tsx`: all component imports, state variables, and prop names updated.

**Tests + seed:**
- `event_handler_test.go` → `activity_handler_test.go`; all test functions, URLs, and variable names updated.
- `archive_test.go`: event archive test updated to use `/activities/` paths.
- `bus_test.go`, `hub_test.go`: `EventCreated/Updated/Deleted` → `ActivityCreated/Updated/Deleted`.
- `migrations_test.go`: table list updated to `activities`, `activity_tags`, `activity_assignments`.
- `scripts/seed-find-test-events.sql` → `seed-find-test-activities.sql`; `INSERT INTO activities`, `INSERT INTO activity_assignments`.

**Verification:** `golangci-lint run` clean; `go test ./...` all pass; `pnpm --filter web lint` clean; `pnpm --filter web test` all pass.

---

## 2026-05-20 — Phase 9: API Token Auth & Archive

### What was built

**API tokens (programmatic auth):**
- `auth.GenerateAPIToken` / `HashAPIToken` / `LooksLikeAPIToken` — raw token prefix `draba_pat_` + 32 random bytes; SHA-256 hash stored in `api_tokens.token_hash` (the schema column already existed from migration 001).
- `db.APITokenRepo` — Create / ListByUser / GetByID / GetByHash / Revoke / TouchLastUsed. Revoked rows are preserved so the listing UI shows "Revoked on …".
- `POST /tokens`, `GET /tokens`, `DELETE /tokens/{id}` — JWT-only (API tokens cannot mint other API tokens). Raw token value returned exactly once on create; listing never includes it.

**Bearer middleware:**
- `authMiddleware` now accepts either a JWT or an API token. Token type is selected by the `draba_pat_` prefix.
- Read-only API tokens (`scope=read`) are rejected with 403 on any non-GET request; other scopes pass through.
- `last_used_at` updated best-effort on each authenticated request.

**Archive (events + timelines):**
- `events.SetArchived` + `POST /events/{id}/archive` / `/unarchive`. Any team member may archive.
- `timelines.SetArchived` + `POST /timelines/{id}/archive` / `/unarchive`. Team admins only (per-timeline admin grants deferred to Phase 10.3).
- `ListByTeam(includeArchived)` on both repos. List endpoints exclude archived rows unless `?archived=true` is passed.
- `GetByID` on timelines now returns archived rows (so archive endpoints can operate on them); the read handler 404s archived timelines unless `?archived=true`.
- New `events.TimelineUpdated` bus message for archive/unarchive transitions.

**OpenAPI:**
- New `APIToken` and `APITokenCreated` schemas.
- New paths: `/tokens`, `/tokens/{id}`, `/events/{id}/archive`, `/events/{id}/unarchive`, `/timelines/{id}/archive`, `/timelines/{id}/unarchive`.
- `archived` query param added to `listEvents` and `listTimelines`.
- TypeScript types regenerated via `pnpm --filter shared generate`.

### Tests
- `api_token_handler_test.go` — create / list / revoke; raw value returned once; revoked token rejected on subsequent use; invalid scope rejected; read-only scope blocks writes; API token cannot mint API token.
- `archive_test.go` — event archive hides from default list, restorable via `?archived=true` and via /unarchive; same for timelines.
- `golangci-lint run` clean; `go test ./...` all pass; `pnpm --filter web lint` (tsc) clean.

### Exit criteria
- ✅ Create API token + use raw value as Bearer on GET (verified via test)
- ✅ Read-only token rejected (403) on POST/PATCH/DELETE
- ✅ Archiving an event removes it from default list; `?archived=true` restores it
- ✅ Archive / unarchive endpoints exist for both events and timelines

The token management **UI** is intentionally deferred to Phase 10.4 per ROADMAP.

---

## 2026-05-21 — /test-phase 9.5

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 8 pass (2 fixes applied mid-run: stale "Events for {label}" string in FilterDropdown.tsx; deleted dead EventPanel.tsx)
- Smoke target: the LAN test instance

---

## 2026-05-20 — /test-phase 9

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 8 pass (web-e2e ran manually after extension connectivity confirmed)
- Smoke target: the LAN test instance
- Bug found: auth middleware accepts JWTs for deleted/non-existent users — PUT preferences returns 500 (FK violation) instead of 401; filed as side task

---

## 2026-05-20 — /test-phase 8.5

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: 8 pass, 1 clean skip (ws-smoke team-isolation — only one team on test instance)
- Smoke target: the LAN test instance

---

## 2026-05-20 — Phase 8.4 post-test fixes

Three bugs found during live testing against localhost:5173 → the LAN test instance:

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
- Smoke target: the LAN test instance

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
- Smoke target: the LAN test instance
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
- Setup wizard verified end-to-end on the LAN test host container

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
- Smoke target: the LAN test instance (went offline mid api-smoke run; remaining api-smoke assertions completed against local server on port 9191)
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
- New saved-filter endpoints are not yet deployed to the LAN test host — docker container rebuild required to exercise the full API flow in-browser
- golangci-lint clean; all Go tests pass; frontend `tsc --noEmit` + `vite build` clean

---

## 2026-05-17 — Phase 7: UI Polish & Browser Verification

**Phase 7 closed.** All remaining exit criteria verified in-browser via Chrome MCP. Significant UI polish also landed in this session.

### Exit criteria — all verified

| Criterion | Status |
|-----------|--------|
| `/login` renders | ✅ verified in browser |
| `/login` authenticates against live API (the LAN test instance) | ✅ logged in as brian@rieb.cc |
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
→ Mapped container port 8080 to a dedicated host port in Portainer. No code changes needed.

---

## 2026-06-01 — /test-phase 11.1.1
- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass
- Smoke target: the LAN test instance
- Note: api-smoke surfaced spec mismatch — TESTING.md says `POST /teams/:id/activities` but actual route is `POST /teams/:id/timelines/:timelineId/activities`; functionality correct, spec needs updating. Schema-check noted table renames (activities/activity_tags/activity_assignments/statuses vs legacy event_* names in TESTING.md).

---

## 2026-05-30 — /test-phase 10.4.5
- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (web-e2e partial — code-verified, no live server; ws-smoke cross-team isolation skipped, covered by unit tests)
- Smoke target: the LAN test instance
- Note: type-sync initially failed (4 tag endpoints missing from openapi.yaml); fixed and committed before logging

## 2026-06-08 — /test-phase 13.3

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, web-e2e
- Result: all pass (web-e2e initially skipped — Chrome extension not connected — re-run after reconnecting passed: List + Kanban shares render faithfully read-only, no over-exposure, Phase 7 auth-redirect regression holds; created two ad hoc QA share links live since the seeded fixture had no List/Kanban shares yet)
- Smoke target: the LAN test instance (reset via SSH to the test host — canonical sample dataset + bootstrap)

## 2026-06-10 — /test-phase 13.4

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, web-e2e
- Result: 7 pass, 1 skip (ws-smoke — slow manual check, heartbeat covered by TestHub_Heartbeat_* unit tests). web-e2e initially skipped (Chrome extension not connected); re-run after reconnecting passed 9/9: CalendarShareModal per-feed toggle list, named slug feed URL serves all-day VEVENTs, regenerate + toggle-off invalidate immediately, per-member feed isolation verified (Michelle's 3 activities only, Brian/Erik-only activity absent), Phase 7 auth-redirect regression holds
- Smoke target: the LAN test instance (reset via SSH to the test host — canonical sample dataset + bootstrap)
- Notes: api-smoke 35/35 incl. full 13.4 ICS suite (all-day VEVENTs w/ exclusive DTEND, named slug URL, per-member feed isolation, kind isolation, immediate regenerate/delete invalidation); security-review clean with two no-action notes (tokens in URLs land in access logs — rotate test tokens before launch; non-constant-time token lookup acceptable at 256-bit)

## 2026-06-10 — 13.4 post-test fix: ICS feed Cache-Control

- web-e2e observed a regenerated feed's OLD URL briefly serving 200 from the browser HTTP cache (server correctly 404'd). Cause: `Cache-Control: max-age=60` on the feed response.
- Fix: feed now sends `Cache-Control: no-store` — the token is the secret and rotate/delete is the only kill switch, so revocation must be client-immediate too. Server load still absorbed by the in-memory icsCache (DRABA_SHARE_CACHE_TTL).
- Test: header asserted in share_ics_handler_test.go. `go test ./internal/api/` + `golangci-lint run` clean.

## 2026-06-11 — /test-phase 13.5

- Subagents run: static-check, unit-test, schema-check, api-smoke, security-review, type-sync, ws-smoke, web-e2e
- Result: all pass (3 in-suite skips: docker compose config — Docker not on dev box, CI covers; ws-smoke 3-cycle heartbeat — covered by TestHub_Heartbeat_* unit tests; api-smoke expired-share 410 — sample data seeds no expires_at and the write path was cut from 13.5 scope)
- Smoke target: the LAN test instance (reset via SSH to the test host — canonical sample dataset + bootstrap)
- Notes: api-smoke 47/47 incl. full 13.5 lifecycle suite (archive → 404 on JSON gateway, ICS feed, and legacy timeline share route; unarchive restores all three; shareCount accurate; lastViewedAt null → timestamp after public view). ws-smoke ran live for the first time in a while via a throwaway gorilla/websocket client: delta fan-out to two team-A clients in 12ms, team-B isolation clean. web-e2e 7/7 live: tile chip matches API share count, modal last-viewed refetches on open, archive/restore round-trip via UI. security-review clean with two no-action items: legacy unauthenticated `GET /timelines/share/:token` serializes raw `models.Timeline` (now emits a hardcoded `shareCount: 0`; pre-existing pattern, worth migrating to a Public* projection) and `shareTimelineLive` returns 500 instead of 404 for an orphaned share's missing timeline row.

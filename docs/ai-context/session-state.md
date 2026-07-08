# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-07-08 (Phase 16.1 built — backup engine/manager + the four non-schedule `/admin/backup*` endpoints; all automated checks pass. Entry in log.md. Next: 16.2 scheduler.)

---

## Phase Status

**All phases through 10.4.6 are complete and automated-checks-pass.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), 10.4.1–10.4.5 polish, and 10.4.6 Filter Implementation. Phases through 10.4.5 are Docker-verified; 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, and 12 are awaiting Docker verification.

**Phase 13 (13.1–13.5) is fully built and passes all automated checks.** 13.1 Shares MVP, 13.2 modal overhaul + password, 13.3 List + Kanban read-only, 13.4 Calendar ICS feeds, and 13.5 lifecycle tail (archived timeline → shares/feeds `404`, reversible; `Timeline.shareCount` chip on the tile; last-viewed in the modal + `useListShares` refetch-on-open). 13.5 was additionally verified live against a local seeded API. Awaiting Docker verification as a batch. Detail in [log.md](../log.md).

**Phase 14 (Export — all sub-phases 14.1–14.4) is done and fully verified.** 14.1 data exports and 14.2 textual exports are Docker-verified (2026-06-26); 14.3 PNG snapshot (isolated always-light `PresentationFrame` iframe) and 14.4 printable views + HTML save are live-verified against the Docker-backed API in dark mode (2026-07-01); the 2026-07-02 /review-phase follow-up closed the review's gaps. Full detail in [log.md](../log.md).

**Phase 15.1 (Import — server) and 15.2 (Import wizard — web) are built and pass all automated checks (2026-07-03).** 15.1: pure `internal/importer` tolerance-contract package + stateless two-pass endpoint + template routes; passed a full `/test-phase 15.1` run. 15.2: the 4-step wizard (`components/import/`), `useImport` hooks, sidebar wiring — live-verified end-to-end against the test Docker API (messy CSV: synonym auto-map, forced mapping step, MDY/DMY question, row-scoped errors, tag opt-in re-run, commit + immediate board update). The live test surfaced and fixed a 15.1 contract bug (nil issue slices → JSON `null`; server now emits `[]`, client guards `?? []`). **The test Docker container predates the fix — rebuild before 15.3 verification.** Detail in [log.md](../log.md).

**Phase 16.1 (Backup — engine, manager, manual backup + status/history API) is built and passes all automated checks (2026-07-08).** New `internal/backup` package (`Engine` seam + `sqliteEngine`: `VACUUM INTO` hot copy verified with `PRAGMA integrity_check` on the copy; `Manager`: temp→verify→rename, TryLock concurrency guard, keep-last-N sweep, directory-scan history — filename is the record); `DRABA_BACKUP_DIR` (default `/data/backups`, unwritable = loud warn + `writable:false` in status, not fatal); superadmin-only `GET /admin/backup/status` (health ok/stale/critical, `schedule:null` until 16.2), `POST /admin/backup` (`409 BACKUP_IN_PROGRESS`), `GET /admin/backup/history`, `DELETE /admin/backup/{filename}` (pattern match = traversal guard). OpenAPI + TS types regenerated (incl. `BackupSchedule` for 16.2). Detail in [log.md](../log.md).

| Next phase | Scope | Plan |
|------------|-------|------|
| **16.2** | Backup scheduler (presets, injected clock, first background goroutine scheduler in the codebase), schedule GET/PUT + `instance_settings` persistence, default-on daily 02:00 / keep-14, `backup.completed`/`backup.failed` bus events + SMTP failure consumer, `main.go` wiring. | [docs/plans/phase-16-backup.md](../plans/phase-16-backup.md) §16.2 |
| **15.3** | Import hardening: messy-file corpus e2e (European semicolon CSV, native Excel dates, mixed formats, duplicate second run, 1,000-row file), Docker rebuild + `/test-phase 15`, TESTING.md Phase 15 assertions (start paying down the missing Phase 9–14 sections), dedicated `mapping.go` fixtures. | [docs/plans/phase-15-import.md](../plans/phase-15-import.md) §15.3 |

**Phase 13 back-half re-sequenced (2026-06-05):** 13.2 = share-modal overhaul + password (pulled forward); 13.3 = List + Kanban read-only; 13.4 = Calendar **ICS feed** sharing (whole-timeline or per-member, token-as-secret, no password/filter — a different model from view-shares); 13.5 = lifecycle tail (expiry, tile chip). The handoff design lives in [`docs/design/handoffs/share-modal/`](../design/handoffs/share-modal/design_handoff_share_modal/README.md). See [ROADMAP re-sequencing note](../ROADMAP.md#phase-13--shares--multi-share-views-with-passwords) and [plan §13.2 overhaul](../plans/phase-13-shares.md#the-share-module-overhaul-132).

---

## Open Issues

The test Docker container runs a pre-15.2 binary whose import responses marshal empty issue lists as JSON `null` — the web client guards against it, but rebuild the container before 15.3's `/test-phase 15` run (which also picks up the wizard for e2e).

Manual verification items for 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, 12, and 13.1–13.5 tracked in TASKS.md — 13.4's headline item (subscribe from a real Google/Apple calendar) additionally needs the feed URL reachable by Google's fetcher, not just the LAN. Phase 14 (14.1–14.4) is fully live-verified — no longer open. A formal `/test-phase` Docker-container run (like 14.1–14.3 got) hasn't happened for 14.4 specifically; the live dev-server-against-Docker-API verification done 2026-07-01 is a reasonable substitute but worth a follow-up `/test-phase 14.4` if gaps show up later.

`docs/TESTING.md` has no Phase 9–14 section yet — backfill needed (Phase 14.1/14.2 assertions were sourced from ROADMAP.md exit criteria for the 2026-06-26 run as a stopgap; 14.4 has no assertions documented at all yet). Its Phase 2/5/6 "tracked gap" unit-test notes are also stale (gaps are closed). Its Phase 14 convenience-export route example doesn't match the real path shape (`/teams/:id/timelines/:timelineId/export.csv`, not `/timelines/:id/export.csv`).

(Process backlog — e.g. revisiting `repomap.md` generation vs. Graphify after Phase 13 lands — now lives in the [TASKS.md Parking Lot](../TASKS.md#parking-lot), where it stays visible across sessions instead of aging out of this snapshot.)

---

## App & Infrastructure Notes

- **Docker test URL:** `http://epcot.lan:8081` (no TLS)
- **Dev UI:** `localhost:5173` — set `VITE_API_TARGET=http://epcot.lan:8081` in `packages/web/.env.local` to point at Docker
- **DB:** `\\epcot.lan\portainer-appdata\Config\draba\data\draba.db`
- **Bootstrap admin:** `brian@rieb.cc` (full credentials in `.env.test.local`, gitignored)
- **go.mod at `go 1.25.0`** — required by `go-oidc/v3 v3.18.0`. CI uses golangci-lint v2.12.2 (v1 refused Go 1.25 targets). If adding a dependency, `go mod tidy` may bump this further — check after running tidy.
- **repomap.md:** Grep it for targeted symbol lookups; never Read it wholesale (1.3 MB, exceeds the Read tool limit).

---

## Standing Decisions

- **Role-change semantics:** the guard is "can't change your *own* role," not "can't remove the last admin." An admin may demote any other admin; they cannot demote themselves. This guarantees at least one admin always exists (the current user).
- **Member removal guard:** hard-deleting a `team_members` row is blocked with `409 MEMBER_HAS_ASSIGNMENTS` when the member has `activity_assignments`; the UI offers "Inactivate instead." `activity_assignments` and `timeline_access` FKs use `ON DELETE RESTRICT` (migration 011).
- **Team-scoped status/activity/access routes** (e.g. `POST /teams/{id}/timelines/{timelineId}/statuses`) exist to avoid the Go 1.22 mux conflict with `/timelines/share/{token}`.
- **Statuses are per-timeline live rows** copied from a team `status_template` at timeline creation; `status_id` is `ON DELETE SET NULL`.
- **Share scope isolation:** `GET /shares/{token}` derives `timeline_id` server-side from the share row; the client cannot pass a timeline/activity/team selector. The Go filter runs before any data leaves the server.
- **Sample data is the default dev/test dataset (pre-launch).** `DRABA_SEED_SAMPLE_DATA=1` makes the binary seed the embedded `packages/api/sample_data/*.sql` (incl. 8 shares) into an empty DB after migrations — no-op once users exist. `scripts/reset-test-env.sh` (used by `/test-phase`) relies on this, then layers the bootstrap admin/team/invite on top. **Turn the flag off before any real users exist.** Detail in docs/TESTING.md.

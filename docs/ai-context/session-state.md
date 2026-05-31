# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-05-30 (Filter UI overhaul: unified modal, "My events" removed, sidebar panels replaced; all automated checks pass; Docker verification pending)

---

## Phase Status

**All phases through 10.4.5 are complete and Docker-verified.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), and the 10.4.1–10.4.5 polish series.

**Phase 10.4.6 — Filter Implementation:** complete and checked. Filter UI overhauled post-phase: "My events" preset removed; dropdown height uncapped; "Add filter" entry removed; `FilterManagePanel` + `FilterEditor` sidebars replaced by a single `FilterManageModal`; applying a filter now closes the activity detail panel; switching timelines resets filter to "all"; new admin API endpoint `GET /teams/{id}/saved_filters/all` added. All automated checks pass (golangci-lint, go test, pnpm lint, pnpm build, 116 frontend tests).

| Next phase | Scope | Plan |
|------------|-------|------|
| **10.5** | Communications Testing | see ROADMAP.md |

---

## Open Issues

None — 10.4.6 automated checks all pass. Manual filter verification items tracked in TASKS.md under Phase 10.4.6.

---

## App & Infrastructure Notes

- **Docker test URL:** `http://epcot.lan:8081` (no TLS)
- **Dev UI:** `localhost:5173` — set `VITE_API_TARGET=http://epcot.lan:8081` in `packages/web/.env.local` to point at Docker
- **DB:** `\\epcot.lan\portainer-appdata\Config\draba\data\draba.db`
- **Bootstrap admin:** `brian@rieb.cc` (full credentials in `.env.test.local`, gitignored)
- **go.mod pinned at `go 1.22.0`** — golangci-lint v1.64.8 refuses newer targets; `go mod tidy` silently bumps it, so always re-check after running tidy.
- **repomap.md:** Grep it for targeted symbol lookups; never Read it wholesale (1.3 MB, exceeds the Read tool limit).

---

## Standing Decisions

- **Role-change semantics:** the guard is "can't change your *own* role," not "can't remove the last admin." An admin may demote any other admin; they cannot demote themselves. This guarantees at least one admin always exists (the current user).
- **Member removal guard:** hard-deleting a `team_members` row is blocked with `409 MEMBER_HAS_ASSIGNMENTS` when the member has `activity_assignments`; the UI offers "Inactivate instead." `activity_assignments` and `timeline_access` FKs use `ON DELETE RESTRICT` (migration 011).
- **Team-scoped status/activity/access routes** (e.g. `POST /teams/{id}/timelines/{timelineId}/statuses`) exist to avoid the Go 1.22 mux conflict with `/timelines/share/{token}`.
- **Statuses are per-timeline live rows** copied from a team `status_template` at timeline creation; `status_id` is `ON DELETE SET NULL`.

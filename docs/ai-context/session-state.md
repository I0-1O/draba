# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-06-02 (Phase 11.1.2 Group by Assignee Combination: combo-key grouping in both Gantt and List; all automated checks pass; Docker verification pending)

---

## Phase Status

**All phases through 10.4.6 are complete and automated-checks-pass.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), 10.4.1–10.4.5 polish, and 10.4.6 Filter Implementation. Phases through 10.4.5 are Docker-verified; 10.4.6, 11.1, 11.1.1, and 11.1.2 are awaiting Docker verification.

**Phase 11.1.2 — Group by Assignee Combination:** complete and checked (2026-06-02). Ships:
- `lib/memberGroups.ts` (new): `memberComboKey`, `orderedComboIds`, `memberComboLabel`, `comboSortComparator`, `UNASSIGNED_KEY` — shared by Gantt and List
- `GanttGrid.tsx`: `GanttRow` group type extended with `memberColors?: string[]`; stacked color dots in group headers
- `GanttView.tsx` `buildRows`: buckets by combo key over `assignedMemberIds`; groups sorted in team-anchor order; `memberColors` on every group row
- `ListView.tsx` `buildListRows`: same combo-key bucketing; `memberColors` on group rows; stacked dots in group header renderer
- 187 tests pass including new `memberGroups.test.ts` (17 tests) and updated tree suites

| Next phase | Scope | Plan |
|------------|-------|------|
| **11.2** | Calendar View | see ROADMAP.md |

---

## Open Issues

None surfaced. Manual verification items for 10.4.6, 11.1, 11.1.1, and 11.1.2 tracked in TASKS.md.

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

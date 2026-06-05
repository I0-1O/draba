# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-06-04 (Phase 12 Communications Testing: outbound-email test harness + coverage; invite-email send wired up; base-URL and reset-feedback bugs fixed; register password-confirm added; validated live on Docker with real Gmail SMTP)

---

## Phase Status

**All phases through 10.4.6 are complete and automated-checks-pass.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), 10.4.1–10.4.5 polish, and 10.4.6 Filter Implementation. Phases through 10.4.5 are Docker-verified; 10.4.6, 11.1, 11.1.1, 11.1.2, and 11.2 are awaiting Docker verification.

**Phase 11.3 — Kanban View (Interactive):** complete and checked (2026-06-03). Ships:
- `components/kanban/kanbanColumns.ts` (new): pure `buildColumns()` for Status/Member/Combination/Parent/None; sort comparators; sentinel IDs
- `components/kanban/KanbanView.test.ts` (new): 32 unit tests for `buildColumns` and `sortActivities`
- `components/kanban/KanbanToolbar.tsx` (new): Group by / Sort by / Color by / Card fields multi-select
- `components/kanban/KanbanCard.tsx` (new): draggable card (useDraggable); per-activity accent border (colorBy); configurable fields; Find highlight
- `components/kanban/KanbanColumn.tsx` (new): droppable column (useDroppable); header; collapse rail; empty state; "+ Add"
- `components/kanban/KanbanBoard.tsx` (new): DndContext host; drag overlay; drop semantics per groupBy; no-op guard
- `components/kanban/KanbanView.tsx` (new): data container; applyActiveFilter; colorMap; buildColumns; Find matches + auto-expand; drag commit; pref persistence
- `DashboardPage.tsx`: kanban toolbar state + pref restore/save; KanbanToolbar + KanbanView wired
- 247 tests pass including new KanbanView.test.ts (32 tests)

**Phase 12 — Communications Testing:** complete and validated live (2026-06-04). Outbound-email test harness (`newTestSMTPServer`) + mailer unit tests + integration tests for SMTP test/validate, password reset, and invite email. Wired invite email into `handleCreateInvite` (the flow previously never sent mail). Fixed two bugs surfaced in live validation: unset `DRABA_BASE_URL` → localhost links in email (now documented + set on Docker), and missing reset-success feedback on `LoginPage`. Added password-confirm to `RegisterPage`. All checks pass; verified end-to-end on Docker with real Gmail SMTP.

| Next phase | Scope | Plan |
|------------|-------|------|
| **13.1** | Shares MVP — public gateway + read-only Gantt viewer | [plan](../plans/phase-13-shares.md) · [ROADMAP §13.1](../ROADMAP.md#phase-131--foundation-public-gateway-gantt-viewer-mvp) |

**Roadmap rearranged 2026-06-04:** the pre-sharing priorities (Shares → Export → Import) moved to the front of the tail. New order: **13** Shares · **14** Export · **15** Import · **16** Backup & Restore · **17** Global Search · **18** Webhooks · **19** AI Key Management · **20** Calendar Sync · **21** Localization. Phase 13 (Shares) is split into sub-phases **13.1** (foundation + public data gateway + Gantt viewer — the MVP) → **13.2** (other views read-only) → **13.3** (passwords) → **13.4** (lifecycle/management). Full design in [docs/plans/phase-13-shares.md](../plans/phase-13-shares.md). Key decision: **live cached data + read-only SPA, server-side Go filter, view-driven field projection — no Chromium** (the Chromium/PDF question is deferred to Phase 14 Export).

---

## Open Issues

None surfaced. Manual verification items for 10.4.6, 11.1, 11.1.1, 11.1.2, and 11.2 tracked in TASKS.md.

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

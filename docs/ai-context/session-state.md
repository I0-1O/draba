# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-06-05 (Phase 13 back-half re-sequenced: 13.2 share-modal overhaul + password, 13.3 List+Kanban, 13.4 Calendar ICS feed, 13.5 lifecycle tail; handoff design committed to docs/design/handoffs/share-modal/)

---

## Phase Status

**All phases through 10.4.6 are complete and automated-checks-pass.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), 10.4.1–10.4.5 polish, and 10.4.6 Filter Implementation. Phases through 10.4.5 are Docker-verified; 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, and 12 are awaiting Docker verification.

**Phase 13.1 — Shares MVP:** automated checks pass (2026-06-04). Awaiting Docker verification.
- Migration 019: `shares` table + token migration (existing `timelines.share_token` rows → `shares` rows)
- `internal/filters` package: Go port of `matchesFilter`; 27 golden fixtures in `packages/shared/testdata/filter-fixtures.json` pass both the Go test and the new TS golden-fixture section
- `GET /shares/{token}` scope-locked public gateway (TTL cache, filter-first, no-PII projection)
- Share CRUD: `POST /timelines/{id}/shares`, `GET /teams/{id}/timelines/{timelineId}/shares`, `PATCH/DELETE /shares/{id}`
- GanttGrid + GanttView: `interactive={false}` prop suppresses all clicks/drag
- ShareModal: create link, snapshot view config, copy URL to clipboard
- ShareViewPage at `/s/:token` (public, outside ProtectedRoute) + branding strip
- filterEngine.ts: fixed `is_empty`/`is_not_empty` null-value guard (golden fixture surfaced it)

| Next phase | Scope | Plan |
|------------|-------|------|
| **13.2** | Share module overhaul + password protection (modal rebuild to the handoff design, fused with bcrypt password/unlock; view counts in-modal; delete no longer permission-gated) | [plan](../plans/phase-13-shares.md#132--share-module-overhaul--password-protection) · [ROADMAP §13.2](../ROADMAP.md#phase-132--share-module-overhaul--password-protection) |

**Phase 13 back-half re-sequenced (2026-06-05):** 13.2 = share-modal overhaul + password (pulled forward); 13.3 = List + Kanban read-only; 13.4 = Calendar **ICS feed** sharing (whole-timeline or per-member, token-as-secret, no password/filter — a different model from view-shares); 13.5 = lifecycle tail (expiry, tile chip). The handoff design lives in [`docs/design/handoffs/share-modal/`](../design/handoffs/share-modal/design_handoff_share_modal/README.md). See [ROADMAP re-sequencing note](../ROADMAP.md#phase-13--shares--multi-share-views-with-passwords) and [plan §13.2 overhaul](../plans/phase-13-shares.md#the-share-module-overhaul-132).

---

## Open Issues

None surfaced. Manual verification items for 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, 12, and 13.1 tracked in TASKS.md.

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
- **Share scope isolation:** `GET /shares/{token}` derives `timeline_id` server-side from the share row; the client cannot pass a timeline/activity/team selector. The Go filter runs before any data leaves the server.

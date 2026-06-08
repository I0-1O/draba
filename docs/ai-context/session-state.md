# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-06-07 (Phase 13.3 complete — List + Kanban read-only public shares; all automated checks pass. Awaiting Docker verification.)

---

## Phase Status

**All phases through 10.4.6 are complete and automated-checks-pass.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), 10.4.1–10.4.5 polish, and 10.4.6 Filter Implementation. Phases through 10.4.5 are Docker-verified; 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, and 12 are awaiting Docker verification.

**Phase 13.1 — Shares MVP**, **13.2 — share-modal overhaul + password**, and **13.3 — List + Kanban read-only** all pass automated checks. Awaiting Docker verification. Detail in [log.md](../log.md).

**Phase 13.3 — List + Kanban read-only (2026-06-07):** `interactive=false` threaded through `KanbanCard`/`KanbanColumn`/`KanbanBoard` (mirrors Gantt's pattern — drag/click/affordances inert). `ShareViewPage.tsx` now branches on `proj.share.viewType`: List gets a new dedicated `PublicListTable`/`PublicListCell` renderer (reuses `buildListRows`/`COL_CATALOG`/date formatters from `ListView` rather than threading `interactive` through its 2600-line container), Kanban gets `<KanbanBoard interactive={false}>` fed adapted data, Gantt keeps the existing `GanttGrid` path. `toApiActivity`/`toTeamMemberWithUser` adapters convert the scope-locked `PublicActivity`/`PublicMember` projection types into full API shapes with placeholder defaults (precedented by `optimisticActivity`). Backend: `notes` is now included on `PublicActivity` only for List shares whose captured `view_config.columns` has the Notes column visible. "Share this view" wired into the List and Kanban toolbars.

| Next phase | Scope | Plan |
|------------|-------|------|
| **13.4** | Calendar — ICS feed sharing: `shares.kind` discriminator, `GET /shares/{token}.ics`, distinct Calendar share modal, whole-timeline + per-member feeds | [plan §13.4](../plans/phase-13-shares.md#134--calendar--ics-feed-sharing) · [ROADMAP §13.4](../ROADMAP.md#phase-134--calendar--ics-feed-sharing) |

**Phase 13 back-half re-sequenced (2026-06-05):** 13.2 = share-modal overhaul + password (pulled forward); 13.3 = List + Kanban read-only; 13.4 = Calendar **ICS feed** sharing (whole-timeline or per-member, token-as-secret, no password/filter — a different model from view-shares); 13.5 = lifecycle tail (expiry, tile chip). The handoff design lives in [`docs/design/handoffs/share-modal/`](../design/handoffs/share-modal/design_handoff_share_modal/README.md). See [ROADMAP re-sequencing note](../ROADMAP.md#phase-13--shares--multi-share-views-with-passwords) and [plan §13.2 overhaul](../plans/phase-13-shares.md#the-share-module-overhaul-132).

---

## Open Issues

None surfaced. Manual verification items for 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, 12, 13.1, 13.2, and 13.3 tracked in TASKS.md.

**Revisit after Phase 13 — commit/CI process:** drop the automated `repomap.md` generation (the AI-context lookup step doesn't appear to depend on it day-to-day) and look into incorporating Graphify into its place. Not yet scoped — just a flag to come back to once the Phase 13 sub-phases land.

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
- **Sample data is the default dev/test dataset (pre-launch).** `DRABA_SEED_SAMPLE_DATA=1` makes the binary seed the embedded `packages/api/sample_data/*.sql` (incl. 8 shares) into an empty DB after migrations — no-op once users exist. `scripts/reset-test-env.sh` (used by `/test-phase`) relies on this, then layers the bootstrap admin/team/invite on top. **Turn the flag off before any real users exist.** Detail in docs/TESTING.md.

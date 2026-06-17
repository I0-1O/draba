# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-06-17 (Phase 14.1 complete; OIDC/SSO community PR merged to master.)

---

## Phase Status

**All phases through 10.4.6 are complete and automated-checks-pass.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), 10.4.1–10.4.5 polish, and 10.4.6 Filter Implementation. Phases through 10.4.5 are Docker-verified; 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, and 12 are awaiting Docker verification.

**Phase 13 (13.1–13.5) is fully built and passes all automated checks.** 13.1 Shares MVP, 13.2 modal overhaul + password, 13.3 List + Kanban read-only, 13.4 Calendar ICS feeds, and 13.5 lifecycle tail (archived timeline → shares/feeds `404`, reversible; `Timeline.shareCount` chip on the tile; last-viewed in the modal + `useListShares` refetch-on-open). 13.5 was additionally verified live against a local seeded API. Awaiting Docker verification as a batch. Detail in [log.md](../log.md).

**Phase 14.1 (Export — Foundation + data exports) is built and passes all automated checks.** `POST /timelines/:id/export` (CSV/xlsx/ICS, frozen-filter eval via `matchesFilter`) + convenience `GET .../export.csv|.xlsx|.ics?filter=`; `ExportDialog` wired into all four view toolbars. Browser-verified for dialog rendering/format switching; the actual download 405s against the current Docker test backend (pre-14.1 binary) — needs Docker rebuild to verify the live round-trip. Detail in [log.md](../log.md).

| Next phase | Scope | Plan |
|------------|-------|------|
| **14.2** | Textual exports (client): Markdown (GFM table / Kanban section-per-column / Calendar agenda list), plain text, copy-to-clipboard with `text/plain` + `text/html` flavors | [docs/plans/phase-14-export.md](../plans/phase-14-export.md) |

**Phase 13 back-half re-sequenced (2026-06-05):** 13.2 = share-modal overhaul + password (pulled forward); 13.3 = List + Kanban read-only; 13.4 = Calendar **ICS feed** sharing (whole-timeline or per-member, token-as-secret, no password/filter — a different model from view-shares); 13.5 = lifecycle tail (expiry, tile chip). The handoff design lives in [`docs/design/handoffs/share-modal/`](../design/handoffs/share-modal/design_handoff_share_modal/README.md). See [ROADMAP re-sequencing note](../ROADMAP.md#phase-13--shares--multi-share-views-with-passwords) and [plan §13.2 overhaul](../plans/phase-13-shares.md#the-share-module-overhaul-132).

---

## Open Issues

Manual verification items for 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, 12, and 13.1–13.5 tracked in TASKS.md — 13.4's headline item (subscribe from a real Google/Apple calendar) additionally needs the feed URL reachable by Google's fetcher, not just the LAN. 14.1's `POST /timelines/:id/export` 405s on the Docker test backend (stale pre-14.1 binary) — rebuild/redeploy the container, then re-test the download from `ExportDialog` (CSV/Excel/ICS, both scopes).

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

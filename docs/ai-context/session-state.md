# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-06-10 (Phase 13.4 complete + three post-test fix rounds: superadmin-create 500 (migration 023, nullable `shares.created_by`), modal as per-feed toggle list, named feed URLs `/shares/{token}/{slug}.ics` for client default-naming, and VEVENT field projection (status/assignees/tags/progress in DESCRIPTION + CATEGORIES, assignees in timeline-feed SUMMARY). Browser-verified locally. Awaiting Docker rebuild + real-calendar-app verification.)

---

## Phase Status

**All phases through 10.4.6 are complete and automated-checks-pass.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), 10.4.1–10.4.5 polish, and 10.4.6 Filter Implementation. Phases through 10.4.5 are Docker-verified; 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, and 12 are awaiting Docker verification.

**Phase 13.1 — Shares MVP**, **13.2 — share-modal overhaul + password**, **13.3 — List + Kanban read-only**, and **13.4 — Calendar ICS feeds** all pass automated checks. Awaiting Docker verification. Detail in [log.md](../log.md).

**Phase 13.4 — Calendar ICS feed sharing (2026-06-10):** `shares.kind` discriminator (`view`|`ics`, migration 022) with `scope` (`timeline`|`member`) + `member_id`. New `internal/ics` package (RFC 5545 all-day VEVENTs, exclusive DTEND, escaping/folding) served at `GET /shares/{token}.ics` (the `.ics` suffix arrives inside the mux `{token}` wildcard and is dispatched in `handleGetShareProjection`). Kinds isolated both directions (ICS token → 404 on the JSON gateway and vice versa); no password on feeds — `POST /shares/{id}/regenerate` rotates the token instead. Frontend: new `CalendarShareModal` (scope selector, public On/Off toggle = create/delete, feed URL + Copy, Add to Google/Apple/Outlook, Regenerate) wired to the Calendar toolbar — deliberately a different surface from ShareModal.

| Next phase | Scope | Plan |
|------------|-------|------|
| **13.5** | Lifecycle tail: optional expiry → `410 Gone`, active-share-count chip on the timeline tile, last-viewed in the 13.2 modal | [plan §13.5](../plans/phase-13-shares.md#135--lifecycle-tail) · [ROADMAP §13.5](../ROADMAP.md#phase-135--lifecycle-tail) |

**Phase 13 back-half re-sequenced (2026-06-05):** 13.2 = share-modal overhaul + password (pulled forward); 13.3 = List + Kanban read-only; 13.4 = Calendar **ICS feed** sharing (whole-timeline or per-member, token-as-secret, no password/filter — a different model from view-shares); 13.5 = lifecycle tail (expiry, tile chip). The handoff design lives in [`docs/design/handoffs/share-modal/`](../design/handoffs/share-modal/design_handoff_share_modal/README.md). See [ROADMAP re-sequencing note](../ROADMAP.md#phase-13--shares--multi-share-views-with-passwords) and [plan §13.2 overhaul](../plans/phase-13-shares.md#the-share-module-overhaul-132).

---

## Open Issues

None surfaced. Manual verification items for 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, 12, 13.1, 13.2, 13.3, and 13.4 tracked in TASKS.md — 13.4's headline item (subscribe from a real Google/Apple calendar) additionally needs the feed URL reachable by Google's fetcher, not just the LAN.

(Process backlog — e.g. revisiting `repomap.md` generation vs. Graphify after Phase 13 lands — now lives in the [TASKS.md Parking Lot](../TASKS.md#parking-lot), where it stays visible across sessions instead of aging out of this snapshot.)

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

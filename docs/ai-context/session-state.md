# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short. Per-phase implementation detail lives in [docs/log.md](../log.md); this file is a current-state snapshot only._

**Last updated:** 2026-07-02 (/review-phase 14.4 follow-up — CalendarGrid `interactive=false` gating tests, print-CSS content + injection tests, HTML export now inlines same-origin stylesheets / absolutizes font links at serialize time (`saveFramePresentationHtml` is async), ShareViewPage's force-light effect extracted to tested `hooks/useForceLightDocument.ts`. Two new parking-lot items: pre-launch host-value repo scrub; theme-mode classification refactor. Phase 14 remains fully done.)

---

## Phase Status

**All phases through 10.4.6 are complete and automated-checks-pass.** That covers Identity (9.6), Teams/Members/Settings (10.1.x), Status Templates (10.2), Timelines CRUD (10.3), 10.4.1–10.4.5 polish, and 10.4.6 Filter Implementation. Phases through 10.4.5 are Docker-verified; 10.4.6, 11.1, 11.1.1, 11.1.2, 11.2, 11.3, and 12 are awaiting Docker verification.

**Phase 13 (13.1–13.5) is fully built and passes all automated checks.** 13.1 Shares MVP, 13.2 modal overhaul + password, 13.3 List + Kanban read-only, 13.4 Calendar ICS feeds, and 13.5 lifecycle tail (archived timeline → shares/feeds `404`, reversible; `Timeline.shareCount` chip on the tile; last-viewed in the modal + `useListShares` refetch-on-open). 13.5 was additionally verified live against a local seeded API. Awaiting Docker verification as a batch. Detail in [log.md](../log.md).

**Phase 14.1 (Export — Foundation + data exports) is built, passes all automated checks, and is now Docker-verified (2026-06-26).** `POST /timelines/:id/export` (CSV/xlsx/ICS, frozen-filter eval via `matchesFilter`) + convenience `GET /teams/:id/timelines/:timelineId/export.csv|.xlsx|.ics?filter=`; `ExportDialog` wired into all four view toolbars. The previous 405 (stale pre-14.1 binary) is resolved — live api-smoke and browser e2e both confirm CSV/xlsx/ics downloads succeed and match the filtered activity set. Detail in [log.md](../log.md).

**Phase 14.2 (Textual exports) is built, passes all automated checks, and is now Docker-verified (2026-06-26 /test-phase run).** `lib/textExport.ts` with pure generators for Markdown, plain text, and HTML (clipboard flavor) across all three text-capable views (List/Kanban/Calendar). `ExportDialog` extended with client-side format dispatch and dual-flavor clipboard copy. `exportCapabilities.ts` extended with `verb`/`clientSide` fields; Gantt view remains data-only (confirmed live — dialog excludes textual formats). Post-ship bug fix applied 2026-06-17: list generators now respect column visibility, sort order, group-by (section headers), and parent-child hierarchy; kanban generators now render children nested under parents when hierarchy is on. Hierarchy marker is `↳` in flat-table title cells vs. `◦`/`•` bullets in outline/nested-card generators — two different, both-correct conventions (confirmed during live e2e review, not a bug).

**Phase 14.3 (PNG snapshot) was redesigned 2026-06-30 onto an isolated, always-light `PresentationFrame` iframe**, fixing two dark-mode bugs (flicker from toggling the live page's `.dark` class; a half-dark capture where kanban column boxes/Gantt left rail couldn't resolve theme `var()`s). `components/export/PresentationFrame.tsx` renders `CleanSnapshot` into a same-origin iframe that copies the parent's stylesheets/fonts and never carries `.dark`. Live-verified 2026-07-01 (Kanban + Gantt PNG downloads in dark mode inspected pixel-for-pixel: fully light, full extent, correct header, no flicker).

**Phase 14.4 (Printable views + HTML save) reuses the 14.3 `PresentationFrame` as the shared surface** — `iframe.contentWindow.print()` (`lib/printExport.ts`) and `contentDocument` serialization (`lib/htmlExport.ts`), both via a shared `components/export/presentationHeader.ts` header inserted only for the instant of the call. Per-view `@media print` CSS lives in `components/export/printStyles.ts`, injected (inertly, except when actually printing) by each `Clean*Snapshot`. Calendar joined the shared surface via new `CleanCalendarSnapshot` + an `interactive` prop on `CalendarGrid` (previously PNG-only, rasterizing the live content area). The two remaining "force light" implementations (ShareViewPage's toggle, PresentationFrame's structural light) collapsed into `lib/presentationTheme.ts#forceLightDocumentElement`. Live-verified against the real Docker-backed API in dark mode: Calendar PNG/HTML/Print and Kanban HTML inspected directly, no errors. **Phase 14 (all sub-phases) is now done.** A /review-phase follow-up (2026-07-02) closed the review's gaps: gating tests for `CalendarGrid`'s `interactive` prop, print-CSS content/injection tests, HTML-export stylesheet inlining (saved `.html` no longer carries dead relative `<link>`s), and ShareViewPage's force-light effect extracted to `hooks/useForceLightDocument.ts` (tested). Detail in [log.md](../log.md).

| Next phase | Scope | Plan |
|------------|-------|------|
| **15** | Import — Tabular. CSV/Excel import with a mandatory preview + validation pass before any rows are written; the round-trip companion to Phase 14 export. No plan doc yet — start from the ROADMAP scope. | [docs/ROADMAP.md#phase-15--import--tabular](../ROADMAP.md#phase-15--import--tabular) |

**Phase 13 back-half re-sequenced (2026-06-05):** 13.2 = share-modal overhaul + password (pulled forward); 13.3 = List + Kanban read-only; 13.4 = Calendar **ICS feed** sharing (whole-timeline or per-member, token-as-secret, no password/filter — a different model from view-shares); 13.5 = lifecycle tail (expiry, tile chip). The handoff design lives in [`docs/design/handoffs/share-modal/`](../design/handoffs/share-modal/design_handoff_share_modal/README.md). See [ROADMAP re-sequencing note](../ROADMAP.md#phase-13--shares--multi-share-views-with-passwords) and [plan §13.2 overhaul](../plans/phase-13-shares.md#the-share-module-overhaul-132).

---

## Open Issues

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

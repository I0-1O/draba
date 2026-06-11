# Phase 13 — Shares — Public Read-Only View Links

**UI name:** "Share" (toolbar action in every view, alongside Export).

**Status:** 🟢 Reviewed — scope settled (2026-06-04). This plan supersedes the ROADMAP §13 summary and the original "Phase 16 — Shares" umbrella spec. The product decision is **read-only public links over live (cached) data**, not point-in-time snapshots and not pixel renders.

---

## What we're actually building

A **Share** is a first-class entity: one timeline can have many shares, each one a frozen pairing of `{ view type + view config + optional password + optional expiry }`. Visiting a share's link drops a **non-logged-in** viewer into **exactly the view the sharer was looking at** — same group-by, sort, color-by, and filter — rendered **read-only** (no toolbars, menus, drag, reorder, recolor, or edit) and **forced to light mode**. They can scroll/pan the view and open nothing else.

The core mental model: *"share what I'm seeing, as a link, that anyone can open and look at but not touch."*

### Decisions locked in the design discussion (2026-06-04)

1. **Live data, cached — not snapshots, not pixels.** The viewer renders the real React view from a JSON projection that is rebuilt at most every TTL (default 60s, configurable to a couple minutes). No websockets on the public path; no headless-browser/Chromium rendering (that conversation is deferred to Phase 14 Export).
2. **The primary boundary is record *scope*, not field-level minimization.** The risk we harden against is a viewer reaching records *outside the shared view* — another timeline, another team, archived rows, or anything reachable by tampering. The gateway derives `timeline_id` from the share row **server-side** and accepts **no client selector** (no timeline/activity/team id, no scope-widening query params); the activity query is hard-scoped to that one timeline + the frozen filter. Within a record we ship a **fixed display projection** of the standard activity fields (incl. description). The one **conditional** field is `notes`: included only when the view actually renders it — i.e. a **List share whose `view_config` has the Notes column enabled** — and omitted everywhere else. The constant exclusion is **cross-entity PII / internals**: member email/role/`user_id`, the timeline access list, other timelines, team internals. Members always project to `{ id, displayName, color, icon }`.
3. **The frozen filter is evaluated server-side, in Go, at projection-build time.** Because the projection must contain *only visible* activities, filtered-out rows must never reach the browser — so the filter runs before the JSON is built. This requires a Go port of `matchesFilter`. Drift between the TS and Go evaluators is neutralized by a **shared golden-fixture suite** both must pass in CI (one source of truth, two executors). *(Considered and shelved: embedding the TS engine via `goja` — pure-Go, single implementation, zero drift — but a bounded pure-function port + parity fixtures is simpler to own. Revisit if the filter grammar grows.)*
4. **The filter is snapshotted as a resolved `FilterDefinition`, not a reference.** At share-creation the active filter (preset / member / saved) is resolved into a concrete definition stored in `view_config`. A later edit or deletion of the source saved filter must **not** mutate or break existing shares — the whole point is a frozen presentation.
5. **Read-only = the real view components in `interactive=false` mode**, not separate viewer components (which would visually drift from "exactly what I'm seeing"). The cost is per-view chrome-stripping — accepted. **Clicking an activity is inert in every view** — no detail popover, no drill-down. Shares are static web snapshots: you scroll and look, nothing opens.
6. **Password is a fast-follow, not v1.** An unguessable token is the v1 floor. (Re-sequenced 2026-06-05: pulled forward into 13.2, fused with the share-module overhaul — see sub-phases.)

---

## Reused infrastructure (do not rebuild)

| Concern | Existing asset | Notes |
|---|---|---|
| Existing public token | `timelines.share_token` (NOT NULL UNIQUE), `handleGetTimelineByShareToken` (`GET /timelines/share/{token}`), `TimelineRepo.GetByShareToken` | Returns the timeline row only — no activities/members. We **migrate** each timeline's existing token into a `shares` row, then deprecate the column. |
| Filter evaluation (TS) | `matchesFilter` (`lib/filterEngine.ts`), `applyActiveFilter` (`lib/presetFilters.ts`) | The Go port mirrors `matchesFilter`; the golden fixtures pin parity. |
| View components | `GanttView`, `ListView`, `CalendarView`, `KanbanView` | Rendered in `interactive=false` mode by the public viewer. |
| Color resolution | `resolveActivityColor` (`lib/activityColor.ts`) | Identical hues to authed views. |
| Member-combination grouping | `lib/memberGroups.ts` | Reused for group-by member-combination in shared views. |
| Identity display | `Badge`, `resolveColorHex` (`components/identity/`) | Member/status/tag chips in the read-only surface. |
| View-config source | per-timeline preference map (group/sort/color/filter/visible-columns) | "Share this view" snapshots the **current live toolbar state** into `view_config`. |
| Theme | existing theme provider | Public viewer forces `light` regardless of system/localStorage. |

---

## The public data gateway (the heart of 13.1)

`GET /shares/{token}` → a single aggregate, built in Go, cached per-token with a TTL:

```jsonc
{
  "share":    { "viewType": "gantt", "viewConfig": { … }, "createdAt": "…" },
  "timeline": { "id", "name", "color", "icon", "startDate", "endDate" },
  "members":  [ { "id", "displayName", "color", "icon" } ],   // never email/role/userId
  "statuses": [ { "id", "name", "color", "icon", "isClosed", "position" } ],
  "tags":     [ { "id", "name", "color" } ],
  "activities": [ /* only rows passing the frozen filter; only view-rendered fields */ ]
}
```

**Build rules:**
- **Scope-locked, no client selector (the primary boundary).** The endpoint takes *only* the share `token`. `timeline_id` is read from the share row server-side; the client cannot pass a timeline/activity/team id or any scope-widening query param. The activity query is hard-scoped: `WHERE timeline_id = <share.timeline_id> AND archived_at IS NULL`. No share-reachable endpoint returns a record by arbitrary id, lists timelines, or resolves other tokens. A share token can reach **exactly one timeline's filtered records and nothing else** — that invariant is the thing the tests defend.
- **Filter next.** Resolve `view_config.filter` (a frozen `FilterDefinition`) and evaluate it in Go against that timeline's non-archived activities. Only passing rows continue.
- **Fixed display projection.** Emit the standard user-facing activity fields (title, dates, description, `statusId`, `assignedMemberIds`, `tagIds`, `parentActivityId`, progress). `notes` is the one **conditional** field — included only for a **List share with the Notes column enabled** in `view_config`, omitted otherwise. The FK references (`statusId` etc.) point into the already-projected `members`/`statuses`/`tags`, which carry no PII.
- **Members/statuses/tags are pruned to those referenced** by the surviving activities (smaller payload, less incidental exposure). Members project to `{ id, displayName, color, icon }` only — never email/role/`user_id`.
- **Cache:** in-memory `map[token]{ builtAt, payload }`; rebuild when `now - builtAt > TTL`. TTL via `DRABA_SHARE_CACHE_TTL` (default `60s`). Invalidate on share `PATCH`/`DELETE`. No DB hit on a warm cache.
- **Status codes:** `200` payload · `404` unknown token · `410 Gone` revoked/expired (13.4) · `401 { passwordRequired: true }` locked (13.3, no data leakage).

---

## Schema

New migration (next available number — **018 was the last**, in Phase 10.4.6; confirm before writing):

```sql
CREATE TABLE shares (
  id            TEXT PRIMARY KEY,
  timeline_id   TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,          -- unguessable, URL-safe
  view_type     TEXT NOT NULL,                 -- gantt | list | calendar | kanban
  view_config   TEXT NOT NULL,                 -- JSON: group/sort/color/filter(def)/visible-columns/card-fields
  password_hash TEXT,                          -- nullable (13.3)
  expires_at    DATETIME,                      -- nullable (13.4)
  created_by    TEXT NOT NULL REFERENCES team_members(id),
  created_at    DATETIME NOT NULL,
  last_viewed_at DATETIME,
  view_count    INTEGER NOT NULL DEFAULT 0,
  revoked_at    DATETIME                       -- nullable (13.4)
);
```

**Token migration:** for every existing timeline, insert one `shares` row `{ view_type: 'gantt', view_config: <defaults>, token: timelines.share_token }` so existing links keep working. `timelines.share_token` is `NOT NULL UNIQUE`, so it can only be **dropped in a follow-up migration** once all UI/handler references move to `shares`; until then keep it and stop minting new per-timeline tokens.

---

## API

| Method + path | Auth | Purpose |
|---|---|---|
| `POST /timelines/{id}/shares` | member | Create share; body = `{ viewType, viewConfig, password?, expiresAt? }` |
| `GET /timelines/{id}/shares` | creator + admins | List shares for a timeline |
| `PATCH /shares/{id}` | creator + admins | Rename / set-clear password / extend expiry / revoke |
| `DELETE /shares/{id}` | creator + admins | Hard delete |
| `GET /shares/{token}` | **public** | The gateway above |
| `POST /shares/{token}/unlock` | **public** | (13.2) password → short-lived view JWT |

OpenAPI: add `Share`, `ShareViewConfig`, `CreateShareInput`, `PatchShareInput`, `PublicShareProjection` schemas; regenerate TS types.

---

## Read-only view mode

Thread an `interactive: boolean` (default `true`) through each view + its toolbar, sourced from a `ShareViewContext` when mounted under `/s/:token`. When `false`:
- Toolbar, menus, and the "Share"/"Export" actions are not rendered.
- Bars/cards/rows are non-draggable; **clicks are inert in every view** — no `ActivityPanel`, no read-only popover, no drill-down. Static snapshots.
- No create affordances ("+ Add", empty-cell create, drag-to-create).
- Theme forced to light.

The public viewer route `/s/:token` lives **outside** `ProtectedRoute`: fetch `GET /shares/{token}`, mount the matching view in `interactive=false` with `view_config` applied, render a slim branding strip (team name · "Shared view" · last-updated). Find/keyboard-nav are out of scope for the public surface in v1.

---

## Sub-phases

### 13.1 — Foundation, public gateway, Gantt viewer (MVP)
The whole data-leak surface is confronted here so 13.2–13.4 ride on a proven-safe gateway.
- `shares` schema + repo + token migration (existing per-timeline tokens preserved).
- Go filter evaluator (`internal/filters` mirroring `matchesFilter`) + **shared golden-fixture suite** (`packages/shared/testdata/filter-fixtures.json`) run by both `filterEngine.test.ts` and a Go test.
- `GET /shares/{token}` gateway: scope-locked query (token → server-derived `timeline_id`, no client selector), filter-next, fixed display projection, referenced-entity pruning, TTL cache.
- `POST/GET /timelines/{id}/shares`, `PATCH/DELETE /shares/{id}`.
- Gantt `interactive=false` mode (no chrome, no drag, no edit, forced light).
- "Share this view" in the Gantt toolbar → snapshot live toolbar state (incl. resolved filter definition) → create → copy URL.
- `/s/:token` public route + branding strip.

**Exit criteria:**
- Create a share from a filtered/grouped/colored/sorted Gantt; open `/s/:token` in a fresh/incognito session (no login) and see **exactly** that configuration, read-only, light mode, with **inert clicks**.
- **Scope isolation holds:** a share token resolves to exactly its timeline's filtered records; tampering (passing another timeline/activity/team id, or scope-widening params) cannot widen the result; there is no share-reachable by-id or list-timelines endpoint.
- Filtered-out activities are **absent from the network payload** (verified in devtools), as are member emails, `user_id`s, roles, the access list, and other timelines.
- The Go and TS filter evaluators agree on every golden fixture (CI).
- Existing `timelines.share_token` links still resolve (migrated into `shares`).
- Warm-cache requests hit no DB; TTL refresh picks up an activity edit within the window.
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` + `test` pass.

### 13.2 — Share module overhaul + password protection
> **Re-sequenced 2026-06-05.** Password (formerly 13.3) is pulled forward and fused with the modal rebuild because the [handoff design](#the-share-module-overhaul-132) bakes a password toggle into its create form. The modal is also the management surface, so it absorbs most of the old 13.4 "Manage shares" work.

- Rebuild the "Share this view" modal to the handoff (active-links list, create form with title / optional description / optional password toggle, copy with success state, inline delete-confirm, empty state, footer hint). Build from existing components + design tokens — do **not** port the prototype's inline styles.
- Per-row meta: creator avatar + name, created date, **view count**.
- `password_hash` (bcrypt) on create/patch; `GET /shares/{token}` returns `401 { passwordRequired: true }` when locked (no data).
- `POST /shares/{token}/unlock` → short-lived view JWT scoped to that share's `view_config` snapshot; rate-limit unlock attempts (N/IP/hour); public unlock prompt at `/s/:token`.
- **Delete is not permission-gated** — a share is a read-only projection that can't mutate app data, so the handoff's `canDelete = isAdmin || creator` rule is dropped; any team member who can manage the timeline may remove any of its shares.

**Exit:** modal matches the handoff; one timeline hosts multiple named shares each showing creator/date/view-count; wrong password rejected + rate-limited; correct password yields the view; the unlock token cannot be replayed against a different share; a locked share leaks no data; delete kills the link immediately.

### 13.3 — List + Kanban read-only
- `interactive=false` for List and Kanban + public mounting per `view_type`.
- Per-view read-only polish (the "little uplift" each view needs to read cleanly without chrome); clicks inert here too.
- "Share this view" (the 13.2 modal) in both toolbars.
- Projection nuance: `notes` included only when a List share has the Notes column enabled.

**Exit:** a share created from List or Kanban renders faithfully, read-only, with inert clicks; a List share exposes exactly its enabled columns; the same scope-locked gateway serves both with no per-view data path. (Calendar is **not** here — see 13.4.)

### 13.4 — Calendar — ICS feed sharing
> **A different model from the other views.** A Calendar share is not a frozen view config — it's a **subscribable ICS feed**. People consume a shared calendar by subscribing in their own app, which is also the product's native posture (the app is the source of truth; calendars are read projections). This is the on-ramp to Phase 20 Calendar Sync.

- **Share unit = a calendar feed**, scoped to the **whole timeline** (every activity → VEVENT) or a **single member's timeline** (their assigned activities). Both ship here.
- **No view semantics** — no filter / group-by / color-by. "Give me the whole timeline (I'll slice it in my calendar app) or just person X."
- **Token is the secret; no password.** Calendar clients can't do interactive unlock on a subscription URL. Revocation = regenerate the link (rotate token) or toggle public access off.
- **A distinct modal** (not the active-links list): public-access On/Off toggle, scope selector (whole timeline vs. a member), feed URL, Copy, one-click Add to Google / Apple / Outlook, Regenerate link.
- **Live data, all-day events.** Served current (short cache, no frozen snapshot — apps poll on their own cadence). All-day VEVENTs via `DTSTART;VALUE=DATE` start→end (Phase 11.1.1 dates). No PII beyond member display name.
- **Schema lean:** reuse `shares` with a `kind` discriminator (`view` | `ics`); ICS rows carry `scope` (`timeline` | `member`) + nullable `member_id`, no `view_config` / filter / password. Serve via `GET /shares/{token}.ics` (`text/calendar`) + a `webcal://` variant.

**Exit:** subscribing to a timeline feed in a real calendar app shows its activities as all-day events; a per-member feed shows only that member's; toggling off / regenerating immediately invalidates the old URL; the `.ics` payload carries no email / `user_id` / role and no other timelines.

### 13.5 — Lifecycle tail
> **Re-scoped 2026-06-11.** Most of the original tail shipped piecemeal during 13.1–13.4: `expires_at` exists and both gateways already return `410 Gone` past it (tested); `view_count` / `last_viewed_at` are recorded async on every JSON-gateway hit and ICS fetch; the modal already renders the view count. Remaining work is a half-day close-out.

- **Archived timeline kills its shares.** Existing shares keep serving today after a timeline is archived — neither gateway checks `timeline.ArchivedAt`. Both the JSON gateway and ICS feed must return `404` for shares of an archived timeline. `404`, not `410`: archive is reversible (unarchive resurrects the links), `410` makes calendar clients drop the subscription for good, and `404` matches `handleCreateShare`'s existing archived-timeline response without leaking archive state.
- Active-share-count chip on the timeline tile.
- Last-viewed surfaced in the 13.2 modal row beside the view count (already in the authenticated list response — render only).

**Cut:** the expiry write path (no `expiresAt` on create, no UI; read-side enforcement stays as defensive code) and any site-statistics subsystem — the per-share counters answer "is this link being used," and richer analytics has a clean later path as a `share.viewed` event-bus consumer. Caveat: ICS `view_count` counts poller fetches (feed-alive signal), not human views.

**Exit:** archiving a timeline immediately 404s its share links and ICS feeds, and unarchiving restores them; the timeline tile shows an accurate active-share count; last-viewed renders in the modal and updates on access.

---

## The share module overhaul (13.2)
Source design: [`docs/design/handoffs/share-modal/`](../design/handoffs/share-modal/design_handoff_share_modal/README.md) (design reference, **not** production code — recreate with the codebase's React + Tailwind v4 + shadcn/ui + lucide-react and existing tokens). Single modal, several internal states:
- **Shell:** header (link-icon tile, "Share this view", dynamic timeline-name subtitle, close), section bar ("ACTIVE LINKS" eyebrow + count chip + "New share"), scrollable body, footer (role hint + Done).
- **Share row:** type tile (lock if protected / link if not), title (+ "password" badge), description, mono URL field + Copy (1.6s success state), creator avatar + name + date + view count; inline delete-confirm overlay.
- **Add form (inline):** title (required), description (optional), password-protect block with a toggle switch + show/hide password sub-field; Create disabled until title non-empty AND (password off OR password set).
- **Empty state:** dashed container + "Create share link".
- **Divergence from the handoff:** drop the `canDelete = isAdmin || creator` permission gate (see 13.2). Wire to the real API (`POST` create, `DELETE`, `GET` list) instead of the prototype's in-memory mocks.

---

## Open questions
None outstanding for v1. Resolved 2026-06-04:
- **`notes`** — shown only when a List share has the Notes column enabled; omitted otherwise.
- **View counts** — visible to the creator **and** team admins (not creator-private).
- **TTL** — fixed at **60s** (`DRABA_SHARE_CACHE_TTL` default).

Resolved 2026-06-05 (re-sequencing):
- **Password ordering** — pulled forward into 13.2 (fused with the modal overhaul), no longer a standalone 13.3.
- **Delete permissions** — not gated; shares can't mutate data, so any timeline manager may delete any share.
- **Calendar shares** — ICS feed (whole-timeline or per-member), not a view-share; token-as-secret, no password, no filter/group-by/color-by.

## Non-goals (v1)
- **Click-to-detail / drill-down on the public surface** — clicks are inert; shares are static snapshots.
- Websocket/live updates on the public surface (cache TTL only).
- Find / global search / keyboard nav on the public viewer.
- Pixel/PDF snapshot shares (that's the Chromium conversation, deferred to Phase 14).
- Editing or any mutation through a share link.
- **Calendar view-shares** — Calendar is ICS-only (13.4); there is no `interactive=false` Calendar web-share.
- **Password on ICS feeds** — calendar clients can't unlock interactively; the token is the secret.

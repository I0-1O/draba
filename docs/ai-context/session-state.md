# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short._

**Last updated:** 2026-05-25

---

## Phase Status

| Phase | Scope | Automated | Manual |
|-------|-------|-----------|--------|
| 9.6 | Identity System | ✅ | ⬜ needs Docker verification |
| 10.1.1 | Teams CRUD | ✅ | ⬜ needs Docker verification |
| 10.1.2 | Members Management | ✅ | ⬜ needs Docker verification |
| 10.1.3 | Settings — Profile, Tokens & Admin | ⬜ not started | — |
| 10.1.4 | Member Access & Data Lifecycle | ⬜ not started | — |

Next phase to build: **10.1.3** — Settings (profile + identity, security, preferences, API tokens, forgot-password, SMTP config, instance defaults, orphaned users admin view). See ROADMAP.md for full spec.

---

## Bug Fixes Applied This Session (not yet in log.md)

These were found during manual testing of 10.1.2 and fixed 2026-05-25:

**Frontend (packages/web/):**
- `TeamModal.tsx` — Members tab badge hardcoded `0`; now uses `members.length`
- `MemberModal.tsx` — loading overlay had no close button / no backdrop dismiss; stuck permanently on API error; now dismissable and shows error state
- `AuthContext.tsx` — browser refresh lost `user` (RefreshResponse only returns `accessToken`); fixed by calling `GET /auth/me` after token exchange to restore user object; this caused `canEditTeam = false` and sidebar configure icons to disappear after every page refresh
- `useMemberManagement.ts` — `useTeamInvites` and `useUserSearch` returned `null` from API (not `[]`); destructuring default `= []` only catches `undefined`; fixed with `?? []` normalization in `queryFn`
- `useTeamActivities.ts` — same null-vs-empty bug in `useMyTeams`, `useTeamTimelines`, `useTeamActivities`, `useTeamMembers`; all patched
- `TeamModal.tsx` — participant form used `IdentityPicker` (the raw expanded panel) instead of `IdentityWidget` (the trigger+popover); replaced
- `TeamModal.tsx` — role dropdown now disabled on the current user's own row (`m.userId === currentUserId`); user cannot change their own role from the UI
- `TeamModal.tsx` — error banner wired to `updateMember.isError` to surface silent role-change failures

**Backend (packages/api/):**
- `internal/db/team_repo.go` — `GetMemberStats`: `SUM()` on zero rows returns SQL `NULL`; `rows.Scan` into `int` fails with 500; fixed with `COALESCE(SUM(...), 0)`
- `internal/api/team_handler.go` — `handleUpdateMember`: replaced "last admin" check with self-change guard (`SELF_ROLE_CHANGE / 409`); admins can now demote any other admin freely
- `vite.config.ts` — WebSocket proxy target changed to `ws://` protocol; added `rewriteWsOrigin: true`; added missing `/activities` proxy route
- `useWebSocket.ts` — when `VITE_API_TARGET` is set (Docker dev), WebSocket now connects directly to the target instead of through Vite's unreliable `ws: true` proxy

---

## Known Open Issues

- **Participants in sidebar**: data flow looks correct (ListMembers LEFT JOINs participants, sidebar renders all apiMembers) — needs manual verification that newly created participants appear without page reload
- **Role changes**: backend and frontend fixed; needs manual verification that promote/demote actually persists across reload
- **WebSocket in dev**: `ws: true` Vite proxy fixed; verify connection is established after login (was failing before this session)

---

## App & Infrastructure Notes

- **Docker test URL:** `http://epcot.lan:8081` (no TLS)
- **Dev UI:** `localhost:5173` — use `VITE_API_TARGET=http://epcot.lan:8081` in `packages/web/.env.local` to point at Docker
- **DB:** `\\epcot.lan\portainer-appdata\Config\draba\data\draba.db`
- **Bootstrap admin:** `brian@rieb.cc` (see `.env.test.local` for full credentials, gitignored)
- **go.mod pinned at `go 1.22.0`** — golangci-lint v1.64.8 refuses newer targets; `go mod tidy` silently bumps it; always check after running tidy

---

## Recent Decisions

- **Role change semantics (2026-05-25):** Changed from "can't remove last admin" to "can't change own role." An admin can demote any other admin; they cannot demote themselves. This invariant guarantees at least one admin always exists (the current user).
- **Member removal guard (deferred to 10.1.4):** Hard-deleting a `team_members` row when the member has `activity_assignments` is currently unguarded. SQLite FK enforcement may not be on. This is the primary concern for 10.1.4.
- **repomap.md usage:** Use Grep on it for targeted symbol lookups; do not read it wholesale (1.3 MB, exceeds Read tool limit).

---

## Manual Verification Checklist for 10.1.2 (against epcot.lan:8081)

- [ ] Add user via search + add
- [ ] Invite user by email
- [ ] Create participant (no login) — verify appears in sidebar without refresh
- [ ] Change member role (promote to admin, demote back) — verify persists
- [ ] Remove member with zero assignments — verify success
- [ ] Remove member with assignments — currently no guard (10.1.4 work); may fail with FK error or silently orphan rows
- [ ] Generate invite link → copy → register new account via that URL
- [ ] MemberModal: stats chips show correct counts
- [ ] MemberModal (superadmin): promote, inactivate, delete all show correct dialogs
- [ ] Inactivated user: attempt login → should fail with ACCOUNT_INACTIVE
- [ ] Browser refresh: sidebar configure icons should still appear (AuthContext fix)
- [ ] WebSocket: open two tabs, create activity in one, verify it appears in the other within 500ms

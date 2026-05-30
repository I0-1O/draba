# draba — Session State

_Updated after each significant work session. Read this first to orient — it is intentionally short._

**Last updated:** 2026-05-29 (Phase 10.4.4 built — all automated checks pass)

---

## Phase Status

| Phase | Scope | Automated | Manual |
|-------|-------|-----------|--------|
| 9.6 | Identity System | ✅ | ⬜ needs Docker verification |
| 10.1.1 | Teams CRUD | ✅ | ⬜ needs Docker verification |
| 10.1.2 | Members Management | ✅ | ⬜ needs Docker verification |
| 10.1.3 | Settings — Profile, Tokens & Admin | ✅ | ⬜ needs Docker verification |
| 10.1.4 | Member Access & Data Lifecycle | ✅ | ⬜ needs Docker verification |
| 10.2 | Status Templates & Timeline Statuses | ✅ | ✅ Docker verified |
| 10.3 | Timelines — Full CRUD (API + UI) | ✅ | ⬜ needs Docker verification |
| 10.4.1 | Preference Consumption & Session Handling | ✅ | ⬜ needs Docker verification |
| 10.4.2 | Activity Schema Normalization | ✅ | ⬜ needs Docker verification |
| 10.4.3 | UI Consistency — Modals, Sidebar & Toolbar | ✅ | ⬜ needs Docker verification |
| 10.4.4 | Gantt Interaction & Activity Edit Polish | ✅ | ⬜ needs Docker verification |
| 10.4.5 | Activity Tags, Parent & Progress Fields | ⬜ | ⬜ |
| 10.4.6 | Filter Implementation | ⬜ | ⬜ |

Next phase to build: **10.4.5** — Activity Tags, Parent & Progress Fields.
Detailed plans: [docs/plans/phase-10.4.5.md](../plans/phase-10.4.5.md), [docs/plans/phase-10.4.6.md](../plans/phase-10.4.6.md).

---

## Phase 10.4.4 — Gantt Interaction & Activity Edit Polish (2026-05-29 — not yet Docker-verified)

**Backend:**
- Migration 016: `activities.notes TEXT` nullable column added
- `Activity` model + `ActivityRepo.Update` + `handleUpdateActivity` all handle `notes`
- OpenAPI `Activity` schema and PATCH body include `notes`; TS types regenerated

**Gantt — resizable label column:**
- `labelColW` state in GanttGrid (default 240, min 140, max 400); drag handle on right edge of header
- All label cells use live `labelColW` value

**Gantt — click-to-activate before drag:**
- Bar drag/resize only fires when `ev.id === selectedActivityId`; resize handles visible only on selected bars
- Unselected bars show `cursor: pointer`; selected bars show `cursor: grab` / `ew-resize`

**Gantt — live sidebar dates during drag:**
- `onBarDragProgress(activityId, newStart, newEnd)` fires in mousemove; `onBarDragEnd()` fires on mouseup
- DashboardPage stores `liveDragDates`; ActivityDetailPanel shows them in date inputs without triggering saves

**Gantt — finer-grained snap:**
- `snapDivisorFor(granularity)`: day→1, week→7, month→4, quarter→3, year→4
- `colFracToDate` maps fractional column positions to Dates; `colToStartDate`/`colToEndDate` updated
- `resolvedGranularity` prop threaded from GanttView → GanttGrid

**"Hide closed" → Filter preset:**
- `hideClosed` checkbox removed from GanttToolbar; `hideClosed` state removed from DashboardPage
- `FilterDropdown`: new "Open only" preset; `FilterContext` PresetId includes `'open'`
- GanttView reads `activeFilter.id === 'open'` for closed-status filtering

**ActivityDetailPanel overhaul:**
- Removed: allDay checkbox, date summary line, Identity row in Classify, old Notes/description layout
- Added: description directly under dates; bordered-card assignees; `StatusDropdown` with color dot; "Advanced" section; Notes textarea; `liveDragStart`/`liveDragEnd` props

---

## Phase 10.4.3 — UI Consistency — Modals, Sidebar & Toolbar (2026-05-28 — not yet Docker-verified)

**Shared components created:**
- `components/shared/InlineEditableTitle.tsx`: always-input with bottom border on hover/focus; replaces three divergent name-editing patterns
- `components/shared/ConfirmDialog.tsx`: four color variants (red, amber, indigo, teal); replaces MemberModal's local ConfirmDialog, TeamModal's ArchiveDialog, TimelineModal's inline confirmation panels

**TeamModal.tsx:**
- Removed `nameEditing` state machine; replaced with `InlineEditableTitle`
- Archive confirm: `ArchiveDialog` → shared `ConfirmDialog variant="amber"` (inline in content area, footer hidden during confirm)
- Archive button: neutral gray → amber bg+border+Archive icon
- Restore button: neutral gray → teal bg+border+RotateCcw icon
- All structural hex colors migrated to CSS variables

**MemberModal.tsx:**
- Local `ConfirmDialog` → shared component
- Name input replaced with `InlineEditableTitle`
- All structural hex colors migrated to CSS variables

**TimelineModal.tsx:**
- Archive/delete confirmations: separate full overlays → inline `ConfirmDialog` in content area (footer hidden during confirm)
- Archive button: border-only, no icon → amber bg+border+Archive icon
- Restore button: amber border-only → teal bg+border+RotateCcw icon

**Sidebar audit:** Consistent — Badge usage, hover states, gear icons all uniform across row types. No changes needed.

**Toolbar audit:** GanttToolbar uses Tailwind + CSS variables consistently. No changes needed.

---

## Phase 10.4.2 — Activity Schema Normalization (2026-05-28 — not yet Docker-verified)

**Backend:**
- Migration 015: backfill NULL `timeline_id` rows, rebuild `activities` without `team_id`, `timeline_id` now NOT NULL with CASCADE
- `models.Activity`: `TeamID` field removed; `TimelineID` changed from `*string` to `string`
- `ActivityRepo.Create`: removed `team_id` from INSERT
- `ActivityRepo.ListByTeam` → `ListByTimeline(timelineID string, ...)`: simple `WHERE timeline_id = ?` query
- `handleCreateActivity`, `handleListActivities`: moved to `POST/GET /teams/{id}/timelines/{timelineId}/activities` (team-scoped prefix to avoid Go 1.22 mux conflict with `/timelines/share/{token}`)
- `handleUpdateActivity`, `handleDeleteActivity`, `handleArchive/Unarchive`: derive `TeamID` from timeline lookup for auth + bus publish
- OpenAPI: `Activity` schema replaces `teamId` with `timelineId` (required); endpoints updated to team-scoped path; TS types regenerated

**Frontend:**
- `useTeamActivities` → `useTimelineActivities(teamId, timelineId, from, to)`: URL `/teams/${teamId}/timelines/${timelineId}/activities`; cache key `['timelines', timelineId, 'activities']`
- `useCreateActivity(teamId, timelineId)`, `useUpdateActivity(timelineId)`, `useDeleteActivity(timelineId)`: cache keys updated
- `useTeamActivitySync`: WS updates now target `['timelines', incoming.timelineId, 'activities']` cache entries
- `GanttView`: `timelineId` prop now required (was optional); uses `useTimelineActivities`
- `ActivityCreatePanel`: `teamId` prop restored (needed for URL); no `timelineId` in request body
- `ActivityDetailPanel`: `timelineId` prop is now required (was optional)

**Tests:**
- `activity_repo_test.go`: all tests seed a timeline; `makeActivity` uses `timelineID`; `ListByTeam` → `ListByTimeline`; added `TestActivityRepo_ListByTimeline_Filter`
- `activity_handler_test.go`: `activityTestSetup` creates timeline; all routes updated; `activityURL` helper added
- `archive_test.go`, `revoke_user_test.go`, `team_handler_test.go`: create timeline before activity; use new routes
- `user_repo_test.go`, `migrations_test.go`: raw activity INSERTs use `timeline_id`

**Note:** TASKS.md had UI Consistency labeled as Phase 10.4.2; corrected to 10.4.3 per ROADMAP.

---

## Phase 10.4.1 — Preference Consumption & Session Handling (2026-05-28 — not yet Docker-verified)

**Backend:**
- `admin_handler.go`: Added `accent_color` to `GET/PATCH /admin/settings` allowed keys
- `admin_handler.go`: Added `handleGetPublicBranding` → `GET /settings/branding` (public, no auth) — returns `instanceName` + `accentColor`
- `server.go`: Registered `GET /settings/branding` without auth middleware
- `vite.config.ts`: Added `/settings` proxy

**Frontend:**
- `lib/api.ts`: 401 interceptor + in-flight mutex in `createAuthFetch`; `configureSilentRefresh` registered by AuthProvider
- `contexts/AuthContext.tsx`: `silentRefresh` callback — calls `/auth/refresh`, updates state; on failure clears tokens + redirects to `/login`
- `hooks/useDarkMode.ts`: Added `applyTheme(t)` for explicit theme application
- `hooks/useFormatDate.ts`: New hook — reads `date_format` pref, returns formatter function
- `hooks/usePublicSettings.ts`: New hook — fetches `/settings/branding` without auth
- `components/ThemeSync.tsx`: Null-render — applies server `theme` pref once after auth initializes
- `components/BrandingSync.tsx`: Null-render — sets `document.title` from `instanceName`, applies `--accent-override` CSS var from `accentColor`
- `components/gantt/granularity.ts`: `startOfWeek` / `periodStart` / `formatLabel` / `generateColumns` parameterized for `weekStart` and `locale`
- `components/gantt/GanttView.tsx`: Reads `week_start` pref via `usePreferenceMap`, passes to `generateColumns`
- `App.tsx`: Mounts `ThemeSync` + `BrandingSync` inside `AuthProvider`
- `pages/LoginPage.tsx`: Shows `instanceName` from branding API (falls back to "draba")
- `pages/settings/OrganizationPage.tsx`: Added accent color field (color picker + hex input + Reset)
- `pages/settings/PreferencesPage.tsx`: Added theme toggle (Light/Dark) — applies immediately + saves server-side

**Deferred:**
- `ActivityDetailPanel` date format: native `<input type="date">` uses browser locale; no read-only label surface yet
- Public/shared timeline view fallback: Phase 13
- Logo upload: stretch, deferred

---

## Timeline UI Bug Fixes (2026-05-27 — not yet Docker-verified)

**Backend:**
- Migration 013: `description TEXT` and `notes TEXT` added to `timelines`
- `Timeline` model: added `Description *string`, `Notes *string`
- `timeline_repo.go`: `Create` INSERT and `Update` SET include description/notes/color/icon
- `timeline_types.go`: replaced generated `CreateTimelineJSONBody` with custom `createTimelineBody` (adds color, icon, description, notes, templateId); added description/notes to `PatchTimelineJSONBody`
- `timeline_handler.go`: `handleCreateTimeline` and `handleUpdateTimeline` handle all new fields
- `status_repo.go`: `CopyTemplateToTimeline` accepts optional `templateID *string`
- OpenAPI + TS types regenerated

**Frontend (13 issues fixed):**
1. Sidebar icon: `timelines` map now stores `t.icon ?? null`; `TimelineItem` passes real icon to `Badge`
2. Active timeline name/color: no longer stale state — derived from `activeTimeline` object (live from query cache)
3. Template picker: shows all templates as clickable cards; `selectedTemplateId` sent to API
4. Access tab removed from TimelineModal (all team members have access to all timelines)
5. Name edit moved to modal header (editable inline input next to IdentityWidget)
6. Description and Notes textarea fields added to Settings tab
7. Clicking outside modal no longer closes it (overlay click handler removed)
8. Archived timelines in sidebar show gear icon (opens edit modal) instead of inline "Restore" button; modal shows "Restore" button when `timeline.archivedAt` is set
9. Settings gear on timelines gated behind `canEditTeam`; `canEdit` prop on `TimelineItem`
10. Add-status form shows IdentityWidget + is_closed checkbox before submission
11. `PATCH /statuses/{id}` 404 fixed: added `/statuses` to Vite proxy
12. `DELETE /statuses/{id}` 404 fixed: same proxy fix
13. After creating a timeline it becomes active — derived color/name fix handles this automatically

---

## Phase 10.3 — Timelines Full CRUD (2026-05-27 — not yet Docker-verified)

**Backend:**
- `PATCH /timelines/{id}` — rename, date range, color, icon; `canAdminTimeline` checks team admin or per-timeline access role='admin'
- `DELETE /timelines/{id}` — hard delete (team admin only); cascades to statuses and timeline_access
- `GET/PUT/DELETE /teams/{id}/timelines/{timelineId}/access` — access list CRUD (team-scoped prefix to avoid Go 1.22 mux conflict with `GET /timelines/share/{token}`)
- `POST /teams/{id}/timelines/{timelineId}/statuses`, `PATCH /statuses/{id}`, `DELETE /statuses/{id}` — live timeline status editing; delete guards last status and prompts for replacement when activities reference it
- `TimelineStore` interface: added `Update`, `Delete`, `ListAccess`, `GetAccessRole`, `RevokeAccess`
- `TimelineAccessEntry` model added; `StatusRepo` additions: `CreateStatus`, `UpdateStatus`, `DeleteStatus`, `CountStatuses`, `CountStatusActivities`
- OpenAPI: `PatchTimelineInput`, `TimelineAccessEntry`, `CreateStatusInput`, `PatchStatusInput`, `DeleteStatusInput`; TypeScript types regenerated

**Frontend:**
- `TimelineModal.tsx` — create/edit modal (Settings + Statuses + Access tabs); archive + delete confirmation dialogs
- `Sidebar.tsx` — real archived timelines from API; New timeline wired; settings gear wired to edit modal
- `ActivityDetailPanel.tsx` — status dropdown replaces stub; reads `useTimelineStatuses`
- `GanttToolbar.tsx` — Hide closed toggle (shown when timeline has at least one closed status)
- `GanttView.tsx` — filters out closed-status activities when `hideClosed` is true
- Hooks: `useCreateTimeline`, `useUpdateTimeline`, `useDeleteTimeline`, `useArchiveTimeline`, `useUnarchiveTimeline`, `useTimelineAccess`, `useGrantTimelineAccess`, `useRevokeTimelineAccess`, `useCreateTimelineStatus`, `useUpdateTimelineStatus`, `useDeleteTimelineStatus`

---

## Phase 10.2 — Status Templates & Timeline Statuses (✅ Done — 2026-05-27)

**Backend:**
- Migration 012: replaced `team_statuses` with `status_templates` + `status_template_items` + `statuses`; rebuilt `activities` table so `status_id` references `statuses(id) ON DELETE SET NULL`
- New `StatusRepo` with full CRUD + `SeedDefaultTemplate` + `CopyTemplateToTimeline`
- `handleCreateTeam` seeds "Default" template (Planning / In Progress / Complete, Complete is `is_closed`)
- `handleCreateTimeline` copies team's first template into live `statuses` rows
- Endpoints: `GET/POST /teams/{id}/status-templates`, `PATCH/DELETE /status-templates/{id}`, `POST /status-templates/{id}/items`, `PATCH/DELETE /status-template-items/{id}`, `GET /teams/{id}/timelines/{timelineId}/statuses`
- Note: statuses endpoint is team-scoped (not `/timelines/{id}/statuses`) to avoid Go 1.22 mux conflict with `/timelines/share/{token}`

**Frontend:**
- `useStatusTemplates.ts` hooks for all status endpoints
- `StatusTemplatesTab.tsx` — expandable template cards with inline item editing, color picker, is_closed toggle, add/delete with guards
- `TeamModal.tsx` — "Status Templates" tab (3rd tab, locked until team saved)

---

## Phase 10.1.4 Implemented + Post-Review Fixes (2026-05-27 — not yet Docker-verified)

**Backend:**
- Migration 011: rebuilt `activity_assignments` and `timeline_access` with `ON DELETE RESTRICT` on `team_member_id` FK (was CASCADE)
- `CountMemberAssignments`, `DeleteMemberTimelineAccess` added to `team_repo.go`
- `handleDeleteMember` now guards removal: 409 `MEMBER_HAS_ASSIGNMENTS` if count > 0; deletes `timeline_access` first for clean removals
- `RevokeUser(userID)` in `user_repo.go`: atomic transaction — archive user + inactivate/remove all memberships
- `handleRevokeUser` handler + `POST /users/{id}/revoke` route (superadmin only); self-revoke blocked with `CANNOT_SELF_REVOKE`
- `RevokeUserResult` model + OpenAPI schema + regenerated TS types
- `MemberDetail` now includes `UserArchivedAt` (account-level deactivation, separate from membership `archivedAt`)

**Tests (post-review additions):**
- `revoke_user_test.go`: 403/400/404/200 handler paths + assignment-history path
- `user_repo_test.go`: RevokeUser transaction — inactivate-with-history, remove-zero-history, mixed-memberships
- `team_handler_test.go`: `TestDeleteMember_HasAssignments_Returns409`

**Frontend:**
- `ApiError` extended with `data?: Record<string, unknown>`; `parseError` extracts extra response fields
- `useRevokeUser` hook added to `useMemberManagement.ts`
- `TeamModal.tsx`: remove button handles 409 with inline "N assignments — can't remove" error + "Inactivate instead" one-click action
- `MemberModal.tsx`: "Revoke all access" button + confirmation dialog in Super Admin Actions; shows result summary before closing

---

## Phase 10.1.3 Implemented (2026-05-26 — not yet Docker-verified)

**Backend:**
- Migration 010: `users.color`, `users.icon`; `instance_settings` table; `password_reset_tokens` table
- `PATCH /users/me` — profile update with identity propagation to `team_members`
- `PUT /users/me/password` — password change (WRONG_PASSWORD, WEAK_PASSWORD)
- `POST /auth/forgot-password`, `POST /auth/reset-password` — full forgot-password flow
- `internal/mailer/` — net/smtp wrapper; reads config from `instance_settings`; Send() is no-op when unconfigured
- `GET/PUT/POST/DELETE /admin/smtp` — SMTP config management (superadmin only)
- `GET/PATCH /admin/settings` — instance defaults (registration_policy, timezone, date format, week start, instance name)
- `GET /admin/users?orphaned=true` — all users with team counts (superadmin only)

**Frontend:**
- `SettingsPage.tsx` — Account section (Profile, Security, Preferences, API Tokens); Organization section (superadmin only): Organization, Communication, Users, AI Keys
- `AuthContext.tsx` — added `patchUser()` so profile updates propagate to the auth user object instantly
- `useSettings.ts` — `useUpdateProfile` now calls `patchUser` on success; fixes profile changes not reflected until page reload
- `DashboardPage.tsx` — top-right user button now renders `Badge` with user's color/icon instead of plain initials
- `/settings/profile` — name + IdentityWidget + read-only email (Save button was already present)
- `/settings/security` — password change form
- `/settings/preferences` — theme (instant), language stub, timezone, date format, week start; explicit Save button
- `/settings/tokens` — token table, create (one-time secret reveal), inline revoke
- `/settings/organization` — organization name, registration policy, system defaults (language stub, timezone, week start)
- `/settings/communication` — SMTP/email configuration
- `/settings/users` — all-users table with orphaned filter
- `/settings/ai` — AI/LLM API key stubs (Anthropic, OpenAI, Gemini, custom)
- `/settings/admin/*` — redirects to `/settings/organization` (backwards compat)
- Teams section removed from settings nav (managed via main app)
- `/forgot-password`, `/reset-password` — public pages for the forgot-password flow
- Login page: "Forgot password?" link added

**Deferred:**
- SMTP password encryption at rest
- `/forgot-password` "contact admin" message (needs public SMTP status endpoint)
- Click admin user row → MemberModal
- Default team/timeline dropdowns in Preferences

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

## Manual Verification Checklist for 10.4.4 (against epcot.lan:8081)

- [ ] Drag label column right edge → width changes live (min 140, max 400); other rows resize too
- [ ] Click unselected bar → selects it (no drag happens); click selected bar drag handle → drag works
- [ ] Drag bar at week zoom → tooltip shows day-level dates; snap is to individual days not weeks
- [ ] Drag bar at month zoom → tooltip shows week-level dates
- [ ] Select "Open only" in Filter dropdown → closed-status activities disappear from Gantt; switch to "All activities" → restored
- [ ] Open activity edit panel → no allDay checkbox, no date summary line above pickers
- [ ] Description field appears directly under date pickers
- [ ] Assigned to rows have colored border + tint when selected (matches create panel)
- [ ] Status dropdown shows color dot + name; opens with "— No status —" option at top; CLOSED badge on closed statuses
- [ ] No "Identity" row in Classify section; "Details" renamed to "Advanced"
- [ ] Notes textarea at bottom; type and blur → value persists across panel close/reopen
- [ ] Drag a bar → date inputs in edit panel update live; release → dates sync to server value
- [ ] `PRAGMA foreign_key_check` on activities table after migration returns no rows

## Manual Verification Checklist for 10.1.4 (against epcot.lan:8081)

- [ ] Remove a member who has activity assignments → 409; inline error "N assignments — can't remove" appears beneath the member row
- [ ] Click "Inactivate instead" from the inline error → member becomes inactive; error clears
- [ ] Remove a member with zero assignments → success (member removed immediately)
- [ ] Superadmin: open MemberModal for an active user → "Revoke all access" button visible in Super Admin Actions
- [ ] Click "Revoke all access" → confirmation dialog shows the three effects
- [ ] Confirm → user cannot log in; result summary chip shows counts; modal closes after 2s
- [ ] Gantt bars that were assigned to the revoked/inactivated member still show their avatar/name (data preserved)
- [ ] "Revoke all access" button hidden for already-deactivated accounts

## Manual Verification Checklist for 10.1.3 (against epcot.lan:8081)

- [ ] Profile: change display name → visible in sidebar and team member lists after reload
- [ ] Profile: change identity color/icon → propagated to team memberships; visible on Gantt bars
- [ ] Security: change password → old password rejected, new password works on login
- [ ] Preferences: change timezone/date format/week start → values persist across logout/login
- [ ] Preferences: toggle theme → applies immediately; persists across reload
- [ ] Tokens: create token → secret shown once → copy → `curl -H "Authorization: Bearer <token>" /auth/me` returns 200; revoke → rejected
- [ ] Preferences: language stub visible and disabled; Save button saves timezone/date/week_start
- [ ] Organization: set org name → reload login page → name appears in browser tab; toggle registration policy
- [ ] Communication: configure SMTP → "Send test email" arrives; save → reload → config persists
- [ ] Users: view all users; filter to orphaned; search by name/email
- [ ] AI Keys: stub page visible (no save functionality yet)
- [ ] Profile: update name/color/icon → topbar Badge updates immediately (no reload needed); go back to settings → change still shown
- [ ] Forgot password (with SMTP): request reset → email arrives → click link → set new password → login works with new password; old fails
- [ ] Forgot password (without SMTP): request reset → API returns 200; no email sent (check mailer logs)
- [ ] Non-superadmin: admin nav items not visible; direct navigation to /settings/admin redirects

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

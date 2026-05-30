# Phase 10.4.6 — Filter Implementation

**Detailed implementation plan. See [ROADMAP.md](../ROADMAP.md) for scope summary and exit criteria.**

**Depends on:** Phase 10.4.5 (tags must exist for tag-based filtering)

---

## Filter Definition Schema

The `saved_filters.definition` column stores an opaque JSON string. The client interprets it; the server validates it's valid JSON. This section defines the structure.

**New file:** `packages/web/src/lib/filterTypes.ts`

```typescript
type FilterLogic = 'and' | 'or'

// Operator types by field category
type StringOp = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty'
type SetOp = 'in' | 'not_in' | 'is_empty' | 'is_not_empty'
type NumberOp = 'equals' | 'not_equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'is_empty' | 'is_not_empty'
type BoolOp = 'is_true' | 'is_false'
type DateOp = 'before' | 'after' | 'between' | 'is_empty' | 'is_not_empty'

type FilterCondition =
  | { field: 'status'; op: SetOp; value: string[] }           // status NAMES, case-insensitive
  | { field: 'tag'; op: SetOp; value: string[] }              // tag NAMES, case-insensitive
  | { field: 'assignee'; op: SetOp; value: string[] }         // team_member_id values
  | { field: 'title'; op: StringOp; value: string }
  | { field: 'progress'; op: NumberOp; value: number }
  | { field: 'hasParent'; op: BoolOp }
  | { field: 'startDate'; op: DateOp; value: string | [string, string] }  // ISO date strings
  | { field: 'endDate'; op: DateOp; value: string | [string, string] }

interface FilterDefinition {
  logic: FilterLogic
  conditions: FilterCondition[]
}
```

### Key design choices

**Status matching by name, not ID.** Statuses are timeline-scoped — Timeline A's "In Progress" has a different ID than Timeline B's "In Progress". Matching by name (case-insensitive) makes filters portable across timelines. If a timeline lacks a matching status name, the condition simply finds no matches — nothing breaks. This is the core decision that makes filters team-scoped rather than timeline-locked.

**Tag matching by name.** Tags are team-scoped with a unique constraint on `(team_id, name)`, so name-based matching is unambiguous within a team.

**Flat conditions, no nesting for v1.** A single `logic` field (AND/OR) applies to all conditions. Nested groups (e.g., "(A AND B) OR (C AND D)") are not supported in v1. This keeps the UI simple — one toggle at the top. The schema is extensible to nested groups later by allowing conditions to be `FilterDefinition` recursively.

**Assignee matching by member ID.** Unlike status and tag, assignees are identified by `team_member_id` which is stable across timelines.

---

## Migration 018 — Team filter flag

**File:** `packages/api/internal/db/migrations/018_saved_filters_team_scope.sql`

```sql
ALTER TABLE saved_filters ADD COLUMN is_team_filter BOOLEAN NOT NULL DEFAULT 0;
```

---

## Backend — Model Update

**File:** `packages/api/internal/models/models.go`

Add to `SavedFilter` struct:
```go
IsTeamFilter bool `db:"is_team_filter" json:"isTeamFilter"`
```

---

## Backend — Saved Filter Repository Changes

**File:** `packages/api/internal/db/saved_filter_repo.go`

| Change | Detail |
|--------|--------|
| `Create` | Include `is_team_filter` in INSERT (`:is_team_filter`) |
| `Update` | Allow setting `is_team_filter` in UPDATE |
| `ListByTeamUser` | Change WHERE to: `team_id = ? AND (user_id = ? OR is_team_filter = 1)` — returns user's own filters PLUS all team filters regardless of creator |

No new methods needed — the existing CRUD covers all use cases.

---

## Backend — Saved Filter Handler Changes

**File:** `packages/api/internal/api/saved_filter_handler.go`

| Change | Detail |
|--------|--------|
| `handleUpdateSavedFilter` | Accept `isTeamFilter` in patch body. **Authorization**: only team admins can set `isTeamFilter: true`. Look up the filter's team, then check the caller's role. Non-admins can update their own filter's name/definition but not promote it. |
| `handleDeleteSavedFilter` | Allow team admins to delete any team filter (`is_team_filter = 1`) even if they aren't the owner. Non-admins can still only delete their own filters. |

Promotion is handled via the existing `PATCH /saved_filters/{id}` endpoint — set `isTeamFilter: true`. No separate endpoint needed.

---

## OpenAPI Spec Changes

**File:** `packages/shared/openapi.yaml`

- Add `isTeamFilter` boolean to `SavedFilter` schema (default: false)
- Add `isTeamFilter` to `CreateSavedFilterJSONBody` and `PatchSavedFilterJSONBody`
- Regenerate types: `pnpm --filter shared generate`

---

## Frontend — Filter Engine

**New file:** `packages/web/src/lib/filterEngine.ts`

A pure function that evaluates a filter definition against an activity:

```typescript
interface FilterContext {
  statusesByTimeline: Map<string, Status[]>  // timeline_id → statuses
  tags: Tag[]                                 // team's tags (for resolving tagIds → names)
}

function matchesFilter(
  activity: Activity,
  filter: FilterDefinition,
  ctx: FilterContext
): boolean
```

**Logic:**
1. For each condition, evaluate against the activity:
   - `status`: resolve activity's `statusId` to a status name via `statusesByTimeline.get(activity.timelineId)`, then compare case-insensitively against `condition.value[]`
   - `tag`: resolve activity's `tagIds` to tag names via `ctx.tags`, then compare case-insensitively
   - `assignee`: compare activity's `assignedMemberIds` against `condition.value[]`
   - `title`: string comparison against `activity.title`
   - `progress`: numeric comparison against `activity.percentComplete`
   - `hasParent`: check `activity.parentActivityId !== null`
   - `startDate` / `endDate`: date comparison against `activity.startAt` / `activity.endAt`
2. Combine condition results with `filter.logic` (AND: all must match; OR: any must match)

---

## Frontend — Unified Filter Application

**New file:** `packages/web/src/lib/presetFilters.ts`

Single entry point for all filter evaluation:

```typescript
function applyActiveFilter(
  activities: Activity[],
  activeFilter: ActiveFilter,
  context: {
    closedStatusIds: Set<string>     // for 'open' and 'overdue' presets
    currentUserMemberIds: string[]   // for 'my' preset
    savedFilters: SavedFilter[]      // for 'saved' kind
    statuses: Map<string, Status[]>  // for saved filter engine
    tags: Tag[]                      // for saved filter engine
  }
): Activity[]
```

**Preset implementations:**

| Preset | Logic |
|--------|-------|
| `all` | No filtering — return all |
| `open` | Exclude activities whose `statusId` is in `closedStatusIds` (uses `isClosed` flag, same as existing `filterOpenActivities`) |
| `upcoming` | `startAt` or `endAt` is within 7 days of now |
| `my` | `assignedMemberIds` includes any of `currentUserMemberIds` |
| `overdue` | `endAt < now` AND `statusId` not in `closedStatusIds` |
| `noassign` | `assignedMemberIds` is empty |

**Other filter kinds:**

| Kind | Logic |
|------|-------|
| `member` | `assignedMemberIds` includes a member whose `userId` matches the filter's `userId` |
| `saved` | Look up the `SavedFilter` by ID from `savedFilters`, parse `definition` as `FilterDefinition`, run through `matchesFilter` |

---

## Frontend — Wire Into GanttView

**File:** `packages/web/src/components/gantt/GanttView.tsx`

Replace current filtering logic (lines 358–363):

```typescript
// Before:
const hideClosedActive = activeFilter.kind === 'preset' && activeFilter.id === 'open'
const visibleActivities = useMemo(() => {
  if (!hideClosedActive || !closedStatusIds?.size) return apiActivities
  return filterOpenActivities(apiActivities, closedStatusIds)
}, [apiActivities, hideClosedActive, closedStatusIds])

// After:
const visibleActivities = useMemo(() => {
  return applyActiveFilter(apiActivities, activeFilter, {
    closedStatusIds,
    currentUserMemberIds,
    savedFilters,
    statuses: statusesByTimeline,
    tags: teamTags,
  })
}, [apiActivities, activeFilter, closedStatusIds, currentUserMemberIds, savedFilters, statusesByTimeline, teamTags])
```

This makes ALL presets and saved filters actually functional. The same `applyActiveFilter` function will be used by List/Calendar/Kanban views when they ship (Phases 11.x).

---

## Frontend — Filter Builder UI

### FilterEditor Component

**New file:** `packages/web/src/components/filters/FilterEditor.tsx`

Replaces the "Filter editor coming soon" content in the `RightSidebar` (DashboardPage lines 451–459).

**Layout:**
1. Header: "New filter" / "Edit filter" title
2. Filter name input (for saving)
3. AND/OR toggle (radio group or segmented control)
4. Condition rows (see below)
5. "+ Add condition" button
6. Footer: Save button (primary), Delete button (destructive, edit mode only), Cancel

**Props:**
- `teamId: string`
- `timelineId: string` (for status name suggestions)
- `filter?: SavedFilter` (null = new, defined = editing)
- `onSave: (filter: SavedFilter) => void`
- `onClose: () => void`

### FilterConditionRow Component

**New file:** `packages/web/src/components/filters/FilterConditionRow.tsx`

A single condition row with three parts:

**Field dropdown** — available fields:
| Field label | field value | Description |
|-------------|-------------|-------------|
| Status | `status` | Activity's status name |
| Tag | `tag` | Activity's tag names |
| Assignee | `assignee` | Assigned team members |
| Title | `title` | Activity title text |
| Progress | `progress` | Percent complete |
| Has parent | `hasParent` | Whether activity has a parent |
| Start date | `startDate` | Activity start date |
| End date | `endDate` | Activity end date |

**Operator dropdown** — contextual based on selected field type (see FilterDefinition schema for available operators per type).

**Value input** — contextual based on field:
| Field | Value UI |
|-------|----------|
| `status` | Multi-select dropdown; options are deduped status names across all team timelines (case-insensitive dedup) |
| `tag` | Multi-select dropdown from team's tags (colored pills) |
| `assignee` | Multi-select dropdown from team members (with avatars) |
| `title` | Text input |
| `progress` | Number input (0–100) |
| `hasParent` | No value input — operator is the whole condition (is_true / is_false) |
| `startDate` / `endDate` | Date picker; for `between` operator, two date pickers |

**Remove button (X)** on the right of each row.

---

## Frontend — Filter Management

### FilterDropdown Changes

**File:** `packages/web/src/components/filters/FilterDropdown.tsx`

Replace "No team filters yet" stub with real team filters:
- `useSavedFilters` already returns team filters after the repo change
- Partition saved filters: `teamFilters = filters.filter(f => f.isTeamFilter)`, `myFilters = filters.filter(f => !f.isTeamFilter)`
- Render team filters in the "Team filters" section with a team badge icon
- Admin users see a gear icon on filters that opens the editor for that filter
- Add "Manage filters" link at the bottom of the dropdown (above "Add filter")

### FilterManagePanel Component

**New file:** `packages/web/src/components/filters/FilterManagePanel.tsx`

Accessible from "Manage filters" link in FilterDropdown. Opens in the same RightSidebar.

**Layout:**
- "My Filters" section: user's own saved filters with edit/delete buttons
- "Team Filters" section: all team filters with edit/delete buttons (admin-only actions)
- For admins: user filters show a "Promote to team" button
- For admins: team filters show a "Demote to personal" button (sets isTeamFilter back to false, only visible to original owner or admin)

**Actions:**
- Edit → opens FilterEditor with the selected filter
- Delete → confirmation dialog, then `useDeleteSavedFilter`
- Promote → `useUpdateSavedFilter({ id, isTeamFilter: true })`
- Demote → `useUpdateSavedFilter({ id, isTeamFilter: false })`

---

## Frontend — DashboardPage Wiring

**File:** `packages/web/src/pages/DashboardPage.tsx`

Replace static "coming soon" sidebar content (lines 451–459):

```tsx
{filterEditorOpen && (
  <RightSidebar onClose={() => setFilterEditorOpen(false)}>
    <FilterEditor
      teamId={activeTeamId}
      timelineId={activeTimelineId}
      filter={editingFilter}
      onSave={handleFilterSave}
      onClose={() => setFilterEditorOpen(false)}
    />
  </RightSidebar>
)}
```

Or if the manage panel is open:
```tsx
{filterManageOpen && (
  <RightSidebar onClose={() => setFilterManageOpen(false)}>
    <FilterManagePanel
      teamId={activeTeamId}
      onEdit={(filter) => { setEditingFilter(filter); setFilterEditorOpen(true); setFilterManageOpen(false); }}
      onClose={() => setFilterManageOpen(false)}
    />
  </RightSidebar>
)}
```

---

## Frontend — Hook Updates

**File:** `packages/web/src/hooks/useSavedFilters.ts`

Update `useUpdateSavedFilter` to accept `isTeamFilter?: boolean` in the mutation input type.

---

## Frontend — FilterContext Updates

**File:** `packages/web/src/contexts/FilterContext.tsx`

No structural changes needed. The `ActiveFilter` type already supports `{ kind: 'saved'; id: string }`. When a saved filter is active, `GanttView` (and future views) look up the filter definition from the `useSavedFilters` cache by ID.

---

## Forward Compatibility Notes

These items are NOT in scope for 10.4.6 but inform the design:

| Future Phase | How filters interact |
|-------------|---------------------|
| Phase 11.x (List, Calendar, Kanban views) | Each view calls the same `applyActiveFilter` function. Filter state is shared via `FilterContext`. |
| Phase 13 (Shares) | A share captures a saved filter ID in its `view_config`. The public viewer applies the referenced filter. The `saved_filters` table and team-scoping support this. |
| Phase 14 (Exports) | Export endpoints accept a `filterId` parameter. Server-side, the definition is parsed and applied to the query (or the client sends the filtered activity IDs). |
| New activity fields | When adding a new field to activities, add a corresponding `FilterCondition` variant to `filterTypes.ts` and handle it in `filterEngine.ts`. |

---

## Tests

| File | Scope |
|------|-------|
| `packages/web/src/lib/filterEngine.test.ts` (new) | Unit tests: each field type × each operator, AND logic, OR logic, empty conditions (match all), null/missing fields, case-insensitive status/tag matching |
| `packages/web/src/lib/presetFilters.test.ts` (new) | Unit tests: each preset filter, member filter, saved filter delegation |
| `packages/api/internal/db/saved_filter_repo_test.go` (update) | Test `ListByTeamUser` returns team filters; test `is_team_filter` field round-trip |
| `packages/api/internal/api/saved_filter_handler_test.go` (update) | Test admin-only promotion (`isTeamFilter: true` rejected for non-admin); test admin can delete team filter they don't own |

---

## Implementation Order

1. Filter types + filter engine (pure logic, testable in isolation)
2. Preset filter implementations + `applyActiveFilter`
3. Wire into GanttView (makes all presets work immediately)
4. Migration 018 + Go model/repo/handler changes for team filters
5. OpenAPI + type regeneration
6. FilterConditionRow component (the most complex UI piece)
7. FilterEditor component
8. Wire FilterEditor into DashboardPage
9. FilterDropdown updates (team filters section, manage link)
10. FilterManagePanel component
11. Hook updates
12. Tests

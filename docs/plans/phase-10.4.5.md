# Phase 10.4.5 — Activity Tags, Parent & Progress Fields

**Detailed implementation plan. See [ROADMAP.md](../ROADMAP.md) for scope summary and exit criteria.**

---

## Migration 017 — Tags table + activity_tags rebuild

**File:** `packages/api/internal/db/migrations/017_tags_and_activity_tags.sql`

```sql
-- Team-scoped tags table: enables colored pills, autocomplete, rename-all,
-- and name-based filter matching across timelines.
CREATE TABLE IF NOT EXISTS tags (
    id         TEXT PRIMARY KEY,
    team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_team_id ON tags(team_id);

-- The original activity_tags table (migration 001, renamed in 005) used
-- (activity_id, tag TEXT) — a simple text junction. No Go code, handler,
-- or API endpoint has ever referenced it. Safe to drop and recreate with
-- normalized FK references.
DROP TABLE IF EXISTS activity_tags;

CREATE TABLE activity_tags (
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, tag_id)
);
```

---

## Backend — Tag Model

**File:** `packages/api/internal/models/models.go`

Add `Tag` struct:
```go
type Tag struct {
    ID        string    `db:"id"         json:"id"`
    TeamID    string    `db:"team_id"    json:"teamId"`
    Name      string    `db:"name"       json:"name"`
    Color     *string   `db:"color"      json:"color,omitempty"`
    CreatedBy string    `db:"created_by" json:"createdBy"`
    CreatedAt time.Time `db:"created_at" json:"createdAt"`
}
```

Add `TagIDs` to `Activity` struct:
```go
TagIDs []string `db:"-" json:"tagIds"`
```

This follows the identical pattern as `AssignedMemberIDs []string` — populated by the repo after queries, not stored directly on the activity row.

---

## Backend — Tag Repository

**New file:** `packages/api/internal/db/tag_repo.go`

Follow `saved_filter_repo.go` patterns:

| Method | Signature | Notes |
|--------|-----------|-------|
| `Create` | `(tag *models.Tag) error` | Generate UUID, insert |
| `GetByID` | `(id string) (*models.Tag, error)` | For update/delete auth checks |
| `ListByTeam` | `(teamID string) ([]*models.Tag, error)` | `ORDER BY name ASC` |
| `Update` | `(tag *models.Tag) error` | Name + color only |
| `Delete` | `(id string) error` | Cascade removes activity_tags rows |

---

## Backend — Activity Tag Methods

**File:** `packages/api/internal/db/activity_repo.go`

Add methods following the `SetAssignments` / `GetAssignments` pattern exactly:

| Method | Signature | Notes |
|--------|-----------|-------|
| `SetTags` | `(activityID string, tagIDs []string) error` | DELETE all + INSERT in a transaction |
| `GetTags` | `(activityID string) ([]string, error)` | Returns tag IDs |

Modify `ListByTimeline` to batch-populate `TagIDs` on each returned activity. Follow the identical pattern used for `AssignedMemberIDs` (lines 181–213 of `activity_repo.go`): `sqlx.In` query on `activity_tags WHERE activity_id IN (?)`, then loop to map tag_id lists onto the activity structs.

---

## Backend — Tag Handler

**New file:** `packages/api/internal/api/tag_handler.go`

Follow `saved_filter_handler.go` patterns:

| Endpoint | Handler | Auth |
|----------|---------|------|
| `GET /teams/{id}/tags` | `handleListTags` | Any team member |
| `POST /teams/{id}/tags` | `handleCreateTag` | Any team member; `created_by` from JWT |
| `PATCH /tags/{id}` | `handleUpdateTag` | Any team member (look up tag → resolve team → check membership) |
| `DELETE /tags/{id}` | `handleDeleteTag` | Any team member |

---

## Backend — Activity Handler Changes

**File:** `packages/api/internal/api/activity_handler.go`

- `handleCreateActivity`: Accept `tagIds` in request body. After `s.activities.Create(...)`, call `s.activities.SetTags(activity.ID, tagIds)` if provided. Populate `activity.TagIDs` on response.
- `handleUpdateActivity`: Accept `tagIds` in patch map. If present, call `SetTags`. Populate `activity.TagIDs` on response.
- `handleListActivities`: `TagIDs` already populated by modified `ListByTimeline` — no change needed.

---

## Backend — Server Wiring

**Files:** `packages/api/internal/api/server.go` + `packages/api/cmd/draba/main.go`

- Add `tags *db.TagRepo` field to `Server` struct
- Instantiate `db.NewTagRepo(database)` in `main.go`, pass to `NewServer`
- Register routes in `Routes()`:
  - `GET /teams/{id}/tags`
  - `POST /teams/{id}/tags`
  - `PATCH /tags/{id}`
  - `DELETE /tags/{id}`

---

## OpenAPI Spec

**File:** `packages/shared/openapi.yaml`

- Add `Tag` schema: `id`, `teamId`, `name`, `color` (nullable), `createdBy`, `createdAt`
- Add `tagIds` array of strings to `Activity` schema
- Add `tagIds` to `CreateActivityJSONBody` (optional)
- Add `tagIds` as a patchable field on activity update
- Add tag CRUD endpoint definitions (GET/POST team-scoped, PATCH/DELETE by ID)
- Regenerate: `pnpm --filter shared generate`

---

## Frontend — useTags Hook

**New file:** `packages/web/src/hooks/useTags.ts`

Follow `useSavedFilters.ts` pattern:

| Hook | URL | Query Key |
|------|-----|-----------|
| `useTags(teamId)` | `GET /teams/${teamId}/tags` | `['teams', teamId, 'tags']` |
| `useCreateTag(teamId)` | `POST /teams/${teamId}/tags` | Invalidates list |
| `useUpdateTag(teamId)` | `PATCH /tags/${id}` | Invalidates list |
| `useDeleteTag(teamId)` | `DELETE /tags/${id}` | Invalidates list |

---

## Frontend — TagInput Component

**New file:** `packages/web/src/components/TagInput.tsx`

A combobox/autocomplete component:

**Props:** `teamId: string`, `selectedTagIds: string[]`, `onChange: (tagIds: string[]) => void`, `tags: Tag[]`

**Behavior:**
- Selected tags render as colored pills with an X button to remove
- Text input with dropdown showing team tags filtered by typed text
- "Create \[typed text\]" option at bottom of dropdown when no exact match
- On create: calls `useCreateTag` mutation, adds new tag ID to selection
- New tags get a default color (cycle through identity palette)

---

## Frontend — ActivityDetailPanel Changes

**File:** `packages/web/src/components/gantt/ActivityDetailPanel.tsx`

### Tags (replace lines 497–510)
- Fetch team tags via `useTags(teamId)` — `teamId` is already a prop
- Render `<TagInput teamId={teamId} selectedTagIds={activity.tagIds ?? []} onChange={ids => save({ tagIds: ids })} tags={tags} />`
- Uses the same save-on-change pattern as all other fields

### Parent Picker (replace lines 519–531)
- Need access to timeline's activity list — either pass as prop from DashboardPage or call `useTimelineActivities` internally (panel already has `teamId` and `timelineId` props)
- Render a searchable combobox:
  - Source: activities in the same timeline
  - Exclude current activity (self) and descendants (prevent cycles)
  - Show activity titles, filter by typed text
  - On select: `save({ parentActivityId: selectedId })`
  - On clear: `save({ parentActivityId: null })`
  - Display: parent title if set, "None" with chevron otherwise

### Progress Slider (replace lines 534–545)
- HTML `<input type="range" min={0} max={100}>` with percentage label
- Save on mouseup / touchend: `save({ percentComplete: value })`
- Keep the visual progress bar but make it interactive

---

## Frontend — ActivityCreatePanel Changes

**File:** `packages/web/src/components/gantt/ActivityCreatePanel.tsx`

- Add optional `<TagInput>` section (below Assignees or in Classify)
- Include `tagIds` in the create mutation payload
- Parent and progress are optional on creation — add them if space allows, otherwise defer to the edit panel

---

## Frontend — Gantt Bar Progress Indicator (optional)

**File:** `packages/web/src/components/gantt/GanttGrid.tsx`

When `activity.percentComplete > 0`:
- Render a semi-transparent overlay inside the Gantt bar, spanning `percentComplete%` of bar width from the left
- Keep subtle (slightly darker shade of the bar's existing color) so it doesn't interfere with labels

---

## Sample Data

**New file:** `packages/api/sample_data/10_tags.sql`

Create 5–8 tags per sample team with meaningful names:
- Example tags: "urgent", "design", "content", "research", "launch", "competitive", "review", "blocked"
- Each with a color from the identity palette
- Insert `activity_tags` rows linking a subset of sample activities to tags

Update `packages/api/internal/db/sample_data_test.go` table counts if applicable.

---

## Tests

| File | Scope |
|------|-------|
| `packages/api/internal/db/tag_repo_test.go` (new) | CRUD: create, list, update, delete, unique constraint on (team_id, name) |
| `packages/api/internal/api/tag_handler_test.go` (new) | Handler: auth, happy paths, 404/409 errors. Follow `saved_filter_handler_test.go` patterns |
| `packages/api/internal/db/activity_repo_test.go` (update) | Test `SetTags`/`GetTags`; verify `ListByTimeline` populates `TagIDs` |
| `packages/api/internal/api/activity_handler_test.go` (update) | Test `tagIds` in create and update requests |

---

## Implementation Order

1. Migration 017 + Go model changes (Tag struct, TagIDs on Activity)
2. TagRepo + activity tag repo methods (SetTags, GetTags, ListByTimeline modification)
3. Tag handler + activity handler changes + server wiring
4. OpenAPI spec + type regeneration
5. Frontend: useTags hook + TagInput component
6. Frontend: wire TagInput into ActivityDetailPanel + ActivityCreatePanel
7. Frontend: parent picker (replace stub)
8. Frontend: progress slider (replace stub)
9. Optional: Gantt bar progress indicator
10. Sample data
11. Tests

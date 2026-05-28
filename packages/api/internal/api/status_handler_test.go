package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// statusTestSetup registers Alice, creates a team, and returns the handler,
// Alice's token, and the team ID.
func statusTestSetup(t *testing.T) (srv http.Handler, aliceToken, teamID string) {
	t.Helper()
	srv = newTestServer(t)
	aliceToken, _ = seedUser(t, srv, "alice@status.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Status Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)
	return
}

func TestListStatusTemplates_SeedsDefaultOnCreate(t *testing.T) {
	srv, aliceToken, teamID := statusTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/status-templates", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)

	var templates []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&templates))
	assert.Len(t, templates, 1, "new team should have one default template")

	tmpl := templates[0]
	assert.Equal(t, "Default", tmpl["name"])

	items, ok := tmpl["items"].([]any)
	require.True(t, ok, "items should be a list")
	assert.Len(t, items, 3, "Default template should have 3 items")

	// Verify the last item is marked closed (Complete).
	last := items[2].(map[string]any)
	assert.Equal(t, "Complete", last["name"])
	assert.True(t, last["isClosed"].(bool), "Complete should be a closed status")
}

func TestCreateStatusTemplate_AdminCanCreate(t *testing.T) {
	srv, aliceToken, teamID := statusTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/status-templates", teamID), map[string]string{"name": "Kanban"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)

	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	assert.Equal(t, "Kanban", created["name"])
	assert.Empty(t, created["items"])
}

func TestDeleteStatusTemplate_BlocksLast(t *testing.T) {
	srv, aliceToken, teamID := statusTestSetup(t)

	// Get the only template ID.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/status-templates", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var templates []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&templates))
	templateID := templates[0]["id"].(string)

	// Deleting the last template should return 409.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete, fmt.Sprintf("/status-templates/%s", templateID), nil, aliceToken))
	assert.Equal(t, http.StatusConflict, w.Code)
	var errResp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&errResp))
	errObj := errResp["error"].(map[string]any)
	assert.Equal(t, "LAST_TEMPLATE", errObj["code"])
}

func TestCreateTemplateItem_AddAndDelete(t *testing.T) {
	srv, aliceToken, teamID := statusTestSetup(t)

	// Get the only template ID.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/status-templates", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var templates []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&templates))
	templateID := templates[0]["id"].(string)

	// Add a new item.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/status-templates/%s/items", templateID), map[string]any{
		"name": "Blocked", "color": "#EF4444", "isClosed": false,
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var item map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&item))
	assert.Equal(t, "Blocked", item["name"])
	itemID := item["id"].(string)

	// Template now has 4 items - deleting one should succeed.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete, fmt.Sprintf("/status-template-items/%s", itemID), nil, aliceToken))
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestUpdateStatusTemplate_AdminCanRename(t *testing.T) {
	srv, aliceToken, teamID := statusTestSetup(t)

	// Get the seeded template ID.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/status-templates", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var templates []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&templates))
	templateID := templates[0]["id"].(string)

	// Rename it.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, fmt.Sprintf("/status-templates/%s", templateID),
		map[string]any{"name": "Renamed"}, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var updated map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&updated))
	assert.Equal(t, "Renamed", updated["name"])
}

func TestUpdateTemplateItem_AdminCanUpdate(t *testing.T) {
	srv, aliceToken, teamID := statusTestSetup(t)

	// Get the seeded template and its first item.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/status-templates", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var templates []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&templates))
	items := templates[0]["items"].([]any)
	itemID := items[0].(map[string]any)["id"].(string)

	// Update name and color.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, fmt.Sprintf("/status-template-items/%s", itemID),
		map[string]any{"name": "Backlog", "color": "#6366F1"}, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var updated map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&updated))
	assert.Equal(t, "Backlog", updated["name"])
	assert.Equal(t, "#6366F1", updated["color"])
}

func TestStatusTemplates_NonAdminForbidden(t *testing.T) {
	srv, aliceToken, teamID := statusTestSetup(t)

	// Register Bob as a non-admin member via invite.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@status.com"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob@status.com", "password2", "Bob", inv["token"].(string))

	// Get a template ID.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/status-templates", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var templates []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&templates))
	templateID := templates[0]["id"].(string)
	items := templates[0]["items"].([]any)
	itemID := items[0].(map[string]any)["id"].(string)

	// Bob (member) cannot create a template.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/status-templates", teamID),
		map[string]string{"name": "Kanban"}, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)

	// Bob cannot update a template.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, fmt.Sprintf("/status-templates/%s", templateID),
		map[string]string{"name": "Hijacked"}, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)

	// Bob cannot delete a template.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete, fmt.Sprintf("/status-templates/%s", templateID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)

	// Bob cannot add an item.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/status-templates/%s/items", templateID),
		map[string]string{"name": "Sneaky"}, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)

	// Bob cannot update an item.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, fmt.Sprintf("/status-template-items/%s", itemID),
		map[string]string{"name": "Hijacked"}, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestListTimelineStatuses_CopiedFromTemplate(t *testing.T) {
	srv, aliceToken, teamID := statusTestSetup(t)

	// Create a timeline.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Sprint 1", "startDate": "2026-06-01", "endDate": "2026-06-30",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	timelineID := tl["id"].(string)

	// List statuses — should mirror the 3 items from the default template.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)

	var statuses []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&statuses))
	assert.Len(t, statuses, 3, "timeline should have 3 statuses copied from the default template")
	assert.Equal(t, "Planning", statuses[0]["name"])
	assert.Equal(t, "In Progress", statuses[1]["name"])
	assert.Equal(t, "Complete", statuses[2]["name"])
	assert.True(t, statuses[2]["isClosed"].(bool), "Complete should be closed")
}

// ── Phase 10.3: timeline status CRUD ─────────────────────────────────────────

// tlStatusSetup builds on statusTestSetup by also creating a timeline so tests
// for the timeline-status CRUD endpoints have a ready-to-use timelineID.
func tlStatusSetup(t *testing.T) (srv http.Handler, aliceToken, teamID, timelineID string) {
	t.Helper()
	srv, aliceToken, teamID = statusTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "CRUD TL", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	timelineID = tl["id"].(string)
	return
}

func TestCreateTimelineStatus_AdminSuccess(t *testing.T) {
	srv, token, teamID, timelineID := tlStatusSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost,
		fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID),
		map[string]any{"name": "In Review", "color": "#f0a500"}, token))

	assert.Equal(t, http.StatusCreated, w.Code)
	var st map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&st))
	assert.Equal(t, "In Review", st["name"])
	assert.Equal(t, "#f0a500", st["color"])
	assert.NotEmpty(t, st["id"])
}

func TestCreateTimelineStatus_MissingName(t *testing.T) {
	srv, token, teamID, timelineID := tlStatusSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost,
		fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID),
		map[string]any{"color": "#aabbcc"}, token))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateTimelineStatus_NonAdminForbidden(t *testing.T) {
	srv, aliceToken, teamID, timelineID := tlStatusSetup(t)

	// Alice invites Bob as a regular member.
	wI := httptest.NewRecorder()
	srv.ServeHTTP(wI, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@tlstatus.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, wI.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(wI.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob@tlstatus.com", "password2", "Bob", inv["token"].(string))

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost,
		fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID),
		map[string]any{"name": "Sneaky Status"}, bobToken))

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestUpdateStatus_AdminCanRename(t *testing.T) {
	srv, token, teamID, timelineID := tlStatusSetup(t)

	// Add a fourth status so we have one that isn't a seeded template status.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost,
		fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID),
		map[string]any{"name": "Original"}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var st map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&st))
	statusID := st["id"].(string)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch,
		fmt.Sprintf("/statuses/%s", statusID),
		map[string]any{"name": "Renamed", "isClosed": true}, token))

	assert.Equal(t, http.StatusOK, w.Code)
	var updated map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&updated))
	assert.Equal(t, "Renamed", updated["name"])
	assert.Equal(t, true, updated["isClosed"])
}

func TestUpdateStatus_NonAdminForbidden(t *testing.T) {
	srv, aliceToken, teamID, timelineID := tlStatusSetup(t)

	// Grab a seeded status ID to patch.
	wL := httptest.NewRecorder()
	srv.ServeHTTP(wL, authReq(http.MethodGet,
		fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID), nil, aliceToken))
	require.Equal(t, http.StatusOK, wL.Code)
	var statuses []map[string]any
	require.NoError(t, json.NewDecoder(wL.Body).Decode(&statuses))
	statusID := statuses[0]["id"].(string)

	// Bob is a regular member.
	wI := httptest.NewRecorder()
	srv.ServeHTTP(wI, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob2@tlstatus.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, wI.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(wI.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob2@tlstatus.com", "password2", "Bob2", inv["token"].(string))

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, fmt.Sprintf("/statuses/%s", statusID),
		map[string]any{"name": "Sneaky"}, bobToken))

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestUpdateStatus_NotFound(t *testing.T) {
	srv, token, _, _ := tlStatusSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, "/statuses/nonexistent",
		map[string]any{"name": "Ghost"}, token))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestDeleteStatus_AdminCanDelete(t *testing.T) {
	srv, token, teamID, timelineID := tlStatusSetup(t)

	// The timeline is seeded with 3 statuses; add a fourth so we can delete
	// without hitting the LAST_STATUS guard.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost,
		fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID),
		map[string]any{"name": "Extra"}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var st map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&st))
	statusID := st["id"].(string)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete,
		fmt.Sprintf("/statuses/%s", statusID), nil, token))

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestDeleteStatus_LastStatusBlocked(t *testing.T) {
	srv, token, teamID, timelineID := tlStatusSetup(t)

	// List the seeded statuses and delete all but the last.
	wL := httptest.NewRecorder()
	srv.ServeHTTP(wL, authReq(http.MethodGet,
		fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID), nil, token))
	require.Equal(t, http.StatusOK, wL.Code)
	var statuses []map[string]any
	require.NoError(t, json.NewDecoder(wL.Body).Decode(&statuses))

	for i := 0; i < len(statuses)-1; i++ {
		wD := httptest.NewRecorder()
		srv.ServeHTTP(wD, authReq(http.MethodDelete,
			fmt.Sprintf("/statuses/%s", statuses[i]["id"].(string)), nil, token))
		require.Equal(t, http.StatusNoContent, wD.Code)
	}

	// Deleting the last one must return 409 LAST_STATUS.
	lastID := statuses[len(statuses)-1]["id"].(string)
	wFinal := httptest.NewRecorder()
	srv.ServeHTTP(wFinal, authReq(http.MethodDelete,
		fmt.Sprintf("/statuses/%s", lastID), nil, token))
	assert.Equal(t, http.StatusConflict, wFinal.Code)
}

func TestDeleteStatus_NonAdminForbidden(t *testing.T) {
	srv, aliceToken, teamID, timelineID := tlStatusSetup(t)

	// Grab a seeded status ID to delete.
	wL := httptest.NewRecorder()
	srv.ServeHTTP(wL, authReq(http.MethodGet,
		fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID), nil, aliceToken))
	require.Equal(t, http.StatusOK, wL.Code)
	var statuses []map[string]any
	require.NoError(t, json.NewDecoder(wL.Body).Decode(&statuses))
	statusID := statuses[0]["id"].(string)

	// Bob is a regular member.
	wI := httptest.NewRecorder()
	srv.ServeHTTP(wI, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob3@tlstatus.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, wI.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(wI.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob3@tlstatus.com", "password2", "Bob3", inv["token"].(string))

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete,
		fmt.Sprintf("/statuses/%s", statusID), nil, bobToken))

	assert.Equal(t, http.StatusForbidden, w.Code)
}

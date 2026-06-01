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

func TestArchiveActivity_HiddenByDefaultRestorableWithFlag(t *testing.T) {
	srv, token, teamID, timelineID := activityTestSetup(t)

	// Create an activity.
	wc := httptest.NewRecorder()
	srv.ServeHTTP(wc, authReq(http.MethodPost, activityURL(teamID, timelineID), map[string]any{
		"title":   "To archive",
		"startAt": "2026-05-05T09:00:00Z",
		"endAt":   "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, wc.Code, wc.Body.String())
	var act map[string]any
	require.NoError(t, json.NewDecoder(wc.Body).Decode(&act))
	activityID := act["id"].(string)

	// Archive.
	wa := httptest.NewRecorder()
	srv.ServeHTTP(wa, authReq(http.MethodPost, "/activities/"+activityID+"/archive", nil, token))
	require.Equal(t, http.StatusOK, wa.Code, wa.Body.String())
	var archived map[string]any
	require.NoError(t, json.NewDecoder(wa.Body).Decode(&archived))
	assert.NotEmpty(t, archived["archivedAt"], "archivedAt set after archive")

	// Default list excludes archived activities.
	wl := httptest.NewRecorder()
	srv.ServeHTTP(wl, authReq(http.MethodGet, activityURL(teamID, timelineID), nil, token))
	require.Equal(t, http.StatusOK, wl.Code)
	var defaultList []map[string]any
	require.NoError(t, json.NewDecoder(wl.Body).Decode(&defaultList))
	assert.Empty(t, defaultList, "archived activity hidden from default list")

	// ?archived=true restores visibility.
	wl2 := httptest.NewRecorder()
	srv.ServeHTTP(wl2, authReq(http.MethodGet, activityURL(teamID, timelineID)+"?archived=true", nil, token))
	require.Equal(t, http.StatusOK, wl2.Code)
	var withArchived []map[string]any
	require.NoError(t, json.NewDecoder(wl2.Body).Decode(&withArchived))
	require.Len(t, withArchived, 1)
	assert.Equal(t, activityID, withArchived[0]["id"])

	// Unarchive.
	wu := httptest.NewRecorder()
	srv.ServeHTTP(wu, authReq(http.MethodPost, "/activities/"+activityID+"/unarchive", nil, token))
	require.Equal(t, http.StatusOK, wu.Code, wu.Body.String())
	var unarchived map[string]any
	require.NoError(t, json.NewDecoder(wu.Body).Decode(&unarchived))
	assert.Nil(t, unarchived["archivedAt"], "archivedAt cleared after unarchive")

	// Now visible by default.
	wl3 := httptest.NewRecorder()
	srv.ServeHTTP(wl3, authReq(http.MethodGet, activityURL(teamID, timelineID), nil, token))
	require.Equal(t, http.StatusOK, wl3.Code)
	var afterUnarchive []map[string]any
	require.NoError(t, json.NewDecoder(wl3.Body).Decode(&afterUnarchive))
	require.Len(t, afterUnarchive, 1)
}

func TestDeleteActivity_ClearsParentRefs(t *testing.T) {
	srv, token, teamID, timelineID := activityTestSetup(t)

	// Create parent activity.
	wp := httptest.NewRecorder()
	srv.ServeHTTP(wp, authReq(http.MethodPost, activityURL(teamID, timelineID), map[string]any{
		"title":   "Parent",
		"startAt": "2026-05-05T09:00:00Z",
		"endAt":   "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, wp.Code)
	var parent map[string]any
	require.NoError(t, json.NewDecoder(wp.Body).Decode(&parent))
	parentID := parent["id"].(string)

	// Create child referencing parent.
	wc := httptest.NewRecorder()
	srv.ServeHTTP(wc, authReq(http.MethodPost, activityURL(teamID, timelineID), map[string]any{
		"title":            "Child",
		"startAt":          "2026-05-05T09:00:00Z",
		"endAt":            "2026-05-05T10:00:00Z",
		"parentActivityId": parentID,
	}, token))
	require.Equal(t, http.StatusCreated, wc.Code)
	var child map[string]any
	require.NoError(t, json.NewDecoder(wc.Body).Decode(&child))
	childID := child["id"].(string)

	// Delete parent.
	wd := httptest.NewRecorder()
	srv.ServeHTTP(wd, authReq(http.MethodDelete, "/activities/"+parentID, nil, token))
	require.Equal(t, http.StatusNoContent, wd.Code)

	// Patch child to read its current state (use PATCH with no-op to get current data).
	// Actually use PATCH to get current value — but we don't have a GET /activities/:id.
	// List activities and find the child.
	wl := httptest.NewRecorder()
	srv.ServeHTTP(wl, authReq(http.MethodGet, activityURL(teamID, timelineID), nil, token))
	require.Equal(t, http.StatusOK, wl.Code)
	var acts []map[string]any
	require.NoError(t, json.NewDecoder(wl.Body).Decode(&acts))
	var found map[string]any
	for _, a := range acts {
		if a["id"] == childID {
			found = a
			break
		}
	}
	require.NotNil(t, found, "child activity still exists")
	assert.Nil(t, found["parentActivityId"], "parent ref cleared after parent delete")
}

func TestArchiveActivity_ClearsParentRefs(t *testing.T) {
	srv, token, teamID, timelineID := activityTestSetup(t)

	// Create parent activity.
	wp := httptest.NewRecorder()
	srv.ServeHTTP(wp, authReq(http.MethodPost, activityURL(teamID, timelineID), map[string]any{
		"title":   "Parent",
		"startAt": "2026-05-05T09:00:00Z",
		"endAt":   "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, wp.Code)
	var parent map[string]any
	require.NoError(t, json.NewDecoder(wp.Body).Decode(&parent))
	parentID := parent["id"].(string)

	// Create child referencing parent.
	wc := httptest.NewRecorder()
	srv.ServeHTTP(wc, authReq(http.MethodPost, activityURL(teamID, timelineID), map[string]any{
		"title":            "Child",
		"startAt":          "2026-05-05T09:00:00Z",
		"endAt":            "2026-05-05T10:00:00Z",
		"parentActivityId": parentID,
	}, token))
	require.Equal(t, http.StatusCreated, wc.Code)
	var child map[string]any
	require.NoError(t, json.NewDecoder(wc.Body).Decode(&child))
	childID := child["id"].(string)

	// Archive parent.
	wa := httptest.NewRecorder()
	srv.ServeHTTP(wa, authReq(http.MethodPost, "/activities/"+parentID+"/archive", nil, token))
	require.Equal(t, http.StatusOK, wa.Code)

	// List activities (excludes archived by default) and check child has no parent ref.
	wl := httptest.NewRecorder()
	srv.ServeHTTP(wl, authReq(http.MethodGet, activityURL(teamID, timelineID), nil, token))
	require.Equal(t, http.StatusOK, wl.Code)
	var acts []map[string]any
	require.NoError(t, json.NewDecoder(wl.Body).Decode(&acts))
	var found map[string]any
	for _, a := range acts {
		if a["id"] == childID {
			found = a
			break
		}
	}
	require.NotNil(t, found, "child activity still exists")
	assert.Nil(t, found["parentActivityId"], "parent ref cleared after parent archive")
}

func TestArchiveTimeline_HiddenByDefault(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	// Create a timeline.
	wc := httptest.NewRecorder()
	srv.ServeHTTP(wc, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Q3 Roadmap",
		"startDate": "2026-07-01",
		"endDate":   "2026-09-30",
	}, token))
	require.Equal(t, http.StatusCreated, wc.Code, wc.Body.String())
	var tl map[string]any
	require.NoError(t, json.NewDecoder(wc.Body).Decode(&tl))
	tlID := tl["id"].(string)

	// Archive (Alice is the first user → team admin).
	wa := httptest.NewRecorder()
	srv.ServeHTTP(wa, authReq(http.MethodPost, "/timelines/"+tlID+"/archive", nil, token))
	require.Equal(t, http.StatusOK, wa.Code, wa.Body.String())

	// GET /timelines/{id} now returns 404 by default.
	wg := httptest.NewRecorder()
	srv.ServeHTTP(wg, authReq(http.MethodGet, "/timelines/"+tlID, nil, token))
	assert.Equal(t, http.StatusNotFound, wg.Code)

	// List excludes by default.
	wl := httptest.NewRecorder()
	srv.ServeHTTP(wl, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines", teamID), nil, token))
	require.Equal(t, http.StatusOK, wl.Code)
	var defaultList []map[string]any
	require.NoError(t, json.NewDecoder(wl.Body).Decode(&defaultList))
	assert.Empty(t, defaultList)

	// ?archived=true includes archived timelines.
	wl2 := httptest.NewRecorder()
	srv.ServeHTTP(wl2, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines?archived=true", teamID), nil, token))
	require.Equal(t, http.StatusOK, wl2.Code)
	var allList []map[string]any
	require.NoError(t, json.NewDecoder(wl2.Body).Decode(&allList))
	require.Len(t, allList, 1)
	assert.Equal(t, tlID, allList[0]["id"])

	// Unarchive restores.
	wu := httptest.NewRecorder()
	srv.ServeHTTP(wu, authReq(http.MethodPost, "/timelines/"+tlID+"/unarchive", nil, token))
	require.Equal(t, http.StatusOK, wu.Code, wu.Body.String())

	wg2 := httptest.NewRecorder()
	srv.ServeHTTP(wg2, authReq(http.MethodGet, "/timelines/"+tlID, nil, token))
	assert.Equal(t, http.StatusOK, wg2.Code)
}

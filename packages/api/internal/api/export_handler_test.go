package api_test

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"

	"github.com/I0-1O/draba/packages/api/internal/tier"
)

// exportTestSetup creates a server, registers Alice, creates a team and
// timeline, and adds two activities ("Alpha" and "Beta") with start/end
// dates set so both fall inside the timeline range. Returns the handler,
// Alice's token, team ID, and timeline ID.
func exportTestSetup(t *testing.T) (srv http.Handler, token, teamID, timelineID string) {
	t.Helper()
	srv = newTestServer(t)

	token, _ = seedUser(t, srv, "alice@export.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Export Team"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Export Timeline", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w2.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&tl))
	timelineID = tl["id"].(string)

	actURL := fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID)
	for _, title := range []string{"Alpha", "Beta"} {
		wA := httptest.NewRecorder()
		srv.ServeHTTP(wA, authReq(http.MethodPost, actURL, map[string]any{
			"title": title, "startAt": "2026-05-01T00:00:00Z", "endAt": "2026-05-10T00:00:00Z", "allDay": true,
		}, token))
		require.Equal(t, http.StatusCreated, wA.Code)
	}

	return srv, token, teamID, timelineID
}

// TestExportHandlers covers the export endpoints with a single shared
// server/timeline/activity fixture (one in-memory DB + migration run),
// run as ordered subtests. "ArchivedTimeline" mutates the timeline and
// must run last since the other subtests depend on it being live.
func TestExportHandlers(t *testing.T) {
	srv, token, teamID, timelineID := exportTestSetup(t)

	t.Run("PostCSV_ContainsAllActivities", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format": "csv",
		}, token))
		require.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "text/csv; charset=utf-8", w.Header().Get("Content-Type"))
		assert.Contains(t, w.Header().Get("Content-Disposition"), "attachment;")
		assert.Contains(t, w.Header().Get("Content-Disposition"), ".csv")

		records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 3) // header + 2 activities

		assert.Equal(t, "Title", records[0][0])
		titles := []string{records[1][0], records[2][0]}
		assert.ElementsMatch(t, []string{"Alpha", "Beta"}, titles)
	})

	t.Run("PostXLSX_ContainsAllActivities", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format": "xlsx",
		}, token))
		require.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", w.Header().Get("Content-Type"))
		assert.Contains(t, w.Header().Get("Content-Disposition"), ".xlsx")

		f, err := excelize.OpenReader(strings.NewReader(w.Body.String()))
		require.NoError(t, err)
		defer func() { _ = f.Close() }()

		rows, err := f.GetRows("Activities")
		require.NoError(t, err)
		require.Len(t, rows, 3)
	})

	t.Run("PostICS_ContainsActivities", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format": "ics",
		}, token))
		require.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "text/calendar; charset=utf-8", w.Header().Get("Content-Type"))
		assert.Contains(t, w.Header().Get("Content-Disposition"), ".ics")

		body := w.Body.String()
		assert.Contains(t, body, "BEGIN:VCALENDAR")
		assert.Contains(t, body, "SUMMARY:Alpha")
		assert.Contains(t, body, "SUMMARY:Beta")
	})

	t.Run("PostCSV_FilterAppliesServerSide", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format": "csv",
			"viewConfig": map[string]any{
				"filter": map[string]any{
					"logic":      "and",
					"conditions": []map[string]any{{"field": "title", "op": "equals", "value": "Alpha"}},
				},
			},
		}, token))
		require.Equal(t, http.StatusOK, w.Code)

		records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 2) // header + 1 activity
		assert.Equal(t, "Alpha", records[1][0])
	})

	t.Run("PostInvalidFormat", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format": "pdf",
		}, token))
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("PostUnauthenticated", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), strings.NewReader(`{"format":"csv"}`))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("GetCSV_Convenience", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.csv", teamID, timelineID), nil, token))
		require.Equal(t, http.StatusOK, w.Code)

		records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 3)
	})

	var savedFilterID string
	t.Run("GetCSV_WithSavedFilter", func(t *testing.T) {
		// Create a saved filter that only matches "Alpha".
		wF := httptest.NewRecorder()
		srv.ServeHTTP(wF, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID), map[string]any{
			"name":       "Only Alpha",
			"definition": `{"logic":"and","conditions":[{"field":"title","op":"equals","value":"Alpha"}]}`,
		}, token))
		require.Equal(t, http.StatusCreated, wF.Code)
		var saved map[string]any
		require.NoError(t, json.NewDecoder(wF.Body).Decode(&saved))
		savedFilterID = saved["id"].(string)

		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.csv?filter=%s", teamID, timelineID, savedFilterID), nil, token))
		require.Equal(t, http.StatusOK, w.Code)

		records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 2)
		assert.Equal(t, "Alpha", records[1][0])
	})

	t.Run("GetCSV_UnknownSavedFilter", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.csv?filter=nope", teamID, timelineID), nil, token))
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	// Blocker 1: non-member must be rejected with 403 on POST export.
	t.Run("PostCSV_NonMemberRejected", func(t *testing.T) {
		eveToken := seedNonMember(t, srv, token, "eve@export.com", "Eve")
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format": "csv",
		}, eveToken))
		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	// Blocker 2: viewConfig.activityIds takes precedence over filter and
	// preserves the caller-supplied order.
	t.Run("PostCSV_ActivityIDsPath", func(t *testing.T) {
		// List activities to find Alpha's ID.
		wA := httptest.NewRecorder()
		srv.ServeHTTP(wA, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID), nil, token))
		require.Equal(t, http.StatusOK, wA.Code)
		var acts []map[string]any
		require.NoError(t, json.NewDecoder(wA.Body).Decode(&acts))
		var alphaID string
		for _, a := range acts {
			if a["title"] == "Alpha" {
				alphaID = a["id"].(string)
			}
		}
		require.NotEmpty(t, alphaID, "Alpha activity not found in list response")

		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format":     "csv",
			"viewConfig": map[string]any{"activityIds": []string{alphaID}},
		}, token))
		require.Equal(t, http.StatusOK, w.Code)

		records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 2) // header + 1 activity
		assert.Equal(t, "Alpha", records[1][0])
	})

	// Blocker 3: viewConfig.columns restricts CSV output to the named columns.
	t.Run("PostCSV_ColumnSubset", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format":     "csv",
			"viewConfig": map[string]any{"columns": []string{"Title", "Start"}},
		}, token))
		require.Equal(t, http.StatusOK, w.Code)

		records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 3) // header + 2 activities
		assert.Equal(t, []string{"Title", "Start"}, records[0])
		assert.Len(t, records[1], 2)
	})

	// Blocker 3: same column subset, xlsx format.
	t.Run("PostXLSX_ColumnSubset", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
			"format":     "xlsx",
			"viewConfig": map[string]any{"columns": []string{"Title", "Start"}},
		}, token))
		require.Equal(t, http.StatusOK, w.Code)

		f, err := excelize.OpenReader(strings.NewReader(w.Body.String()))
		require.NoError(t, err)
		defer func() { _ = f.Close() }()
		rows, err := f.GetRows("Activities")
		require.NoError(t, err)
		require.Len(t, rows, 3) // header + 2 activities
		assert.Equal(t, []string{"Title", "Start"}, rows[0])
		assert.Len(t, rows[1], 2)
	})

	// Suggestion 3: convenience GET routes for xlsx and ics.
	t.Run("GetXLSX_Convenience", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.xlsx", teamID, timelineID), nil, token))
		require.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", w.Header().Get("Content-Type"))

		f, err := excelize.OpenReader(strings.NewReader(w.Body.String()))
		require.NoError(t, err)
		defer func() { _ = f.Close() }()
		rows, err := f.GetRows("Activities")
		require.NoError(t, err)
		require.Len(t, rows, 3)
	})

	t.Run("GetICS_Convenience", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.ics", teamID, timelineID), nil, token))
		require.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "text/calendar; charset=utf-8", w.Header().Get("Content-Type"))

		body := w.Body.String()
		assert.Contains(t, body, "BEGIN:VCALENDAR")
		assert.Contains(t, body, "SUMMARY:Alpha")
		assert.Contains(t, body, "SUMMARY:Beta")
	})

	// Archives the timeline — must run last, the prior subtests depend on it being live.
	t.Run("GetCSV_ArchivedTimeline_NotFound", func(t *testing.T) {
		wArchive := httptest.NewRecorder()
		srv.ServeHTTP(wArchive, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/archive", timelineID), nil, token))
		require.Equal(t, http.StatusOK, wArchive.Code)

		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.csv", teamID, timelineID), nil, token))
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// Suggestion 4: a saved filter whose stored definition is not valid JSON must
// return 500 (not crash). Requires direct DB access to bypass the creation
// endpoint's JSON validation.
func TestExportGet_CorruptSavedFilter(t *testing.T) {
	srv, sqlDB := newTestServerWithDB(t, tier.Unlimited)

	token, userID := seedUser(t, srv, "alice@export-corrupt.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Corrupt Team"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Corrupt Timeline", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w2.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&tl))
	timelineID := tl["id"].(string)

	// Insert a saved filter whose definition is not valid JSON, bypassing the
	// API's validation so the unmarshal error path in the handler is exercised.
	filterID := "bad-filter-" + teamID[:8]
	_, err := sqlDB.Exec(
		`INSERT INTO saved_filters (id, team_id, user_id, name, definition) VALUES (?, ?, ?, ?, ?)`,
		filterID, teamID, userID, "Bad Filter", "{not valid json}",
	)
	require.NoError(t, err)

	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet,
		fmt.Sprintf("/teams/%s/timelines/%s/export.csv?filter=%s", teamID, timelineID, filterID),
		nil, token))
	assert.Equal(t, http.StatusInternalServerError, w3.Code)
}

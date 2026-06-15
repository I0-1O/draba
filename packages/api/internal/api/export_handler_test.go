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

func TestExportPost_CSV_ContainsAllActivities(t *testing.T) {
	srv, token, _, timelineID := exportTestSetup(t)

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
}

func TestExportPost_XLSX_ContainsAllActivities(t *testing.T) {
	srv, token, _, timelineID := exportTestSetup(t)

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
}

func TestExportPost_ICS_ContainsActivities(t *testing.T) {
	srv, token, _, timelineID := exportTestSetup(t)

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
}

func TestExportPost_FilterAppliesServerSide(t *testing.T) {
	srv, token, _, timelineID := exportTestSetup(t)

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
}

func TestExportPost_InvalidFormat(t *testing.T) {
	srv, token, _, timelineID := exportTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), map[string]any{
		"format": "pdf",
	}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestExportPost_Unauthenticated(t *testing.T) {
	srv, _, _, timelineID := exportTestSetup(t)

	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID), strings.NewReader(`{"format":"csv"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestExportGet_CSV_Convenience(t *testing.T) {
	srv, token, teamID, timelineID := exportTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.csv", teamID, timelineID), nil, token))
	require.Equal(t, http.StatusOK, w.Code)

	records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 3)
}

func TestExportGet_WithSavedFilter(t *testing.T) {
	srv, token, teamID, timelineID := exportTestSetup(t)

	// Create a saved filter that only matches "Alpha".
	wF := httptest.NewRecorder()
	srv.ServeHTTP(wF, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID), map[string]any{
		"name":       "Only Alpha",
		"definition": `{"logic":"and","conditions":[{"field":"title","op":"equals","value":"Alpha"}]}`,
	}, token))
	require.Equal(t, http.StatusCreated, wF.Code)
	var saved map[string]any
	require.NoError(t, json.NewDecoder(wF.Body).Decode(&saved))
	filterID := saved["id"].(string)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.csv?filter=%s", teamID, timelineID, filterID), nil, token))
	require.Equal(t, http.StatusOK, w.Code)

	records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	assert.Equal(t, "Alpha", records[1][0])
}

func TestExportGet_UnknownSavedFilter(t *testing.T) {
	srv, token, teamID, timelineID := exportTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.csv?filter=nope", teamID, timelineID), nil, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestExportGet_ArchivedTimeline_NotFound(t *testing.T) {
	srv, token, teamID, timelineID := exportTestSetup(t)

	wArchive := httptest.NewRecorder()
	srv.ServeHTTP(wArchive, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/archive", timelineID), nil, token))
	require.Equal(t, http.StatusOK, wArchive.Code)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/export.csv", teamID, timelineID), nil, token))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

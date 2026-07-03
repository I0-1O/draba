package api_test

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"

	"github.com/I0-1O/draba/packages/api/internal/tier"
)

// importTestSetup creates a server with one team, one timeline, an "In
// Progress" status on the timeline, and a "launch" tag on the team. Alice is
// the only member.
func importTestSetup(t *testing.T) (srv http.Handler, database *sqlx.DB, token, teamID, timelineID string) {
	t.Helper()
	srv, database = newTestServerWithDB(t, tier.Unlimited)
	token, _ = seedUser(t, srv, "alice@import.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Import Team"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)

	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Import Timeline", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	timelineID = tl["id"].(string)

	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID),
		map[string]any{"name": "In Progress"}, token))
	require.Equal(t, http.StatusCreated, w.Code, "status create failed: %s", w.Body)

	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/tags", teamID),
		map[string]any{"name": "launch"}, token))
	require.Equal(t, http.StatusCreated, w.Code, "tag create failed: %s", w.Body)

	return srv, database, token, teamID, timelineID
}

// importReq builds the multipart POST for the import endpoint.
func importReq(t *testing.T, teamID, timelineID, filename string, fileData []byte, opts map[string]any, token string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, err = fw.Write(fileData)
	require.NoError(t, err)
	if opts != nil {
		optsJSON, err := json.Marshal(opts)
		require.NoError(t, err)
		require.NoError(t, mw.WriteField("options", string(optsJSON)))
	}
	require.NoError(t, mw.Close())

	req := httptest.NewRequest(http.MethodPost,
		fmt.Sprintf("/teams/%s/timelines/%s/import", teamID, timelineID), &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

func doImport(t *testing.T, srv http.Handler, req *http.Request) (code int, body map[string]any) {
	t.Helper()
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	return w.Code, body
}

func tableCount(t *testing.T, database *sqlx.DB, table string) int {
	t.Helper()
	var n int
	require.NoError(t, database.Get(&n, "SELECT COUNT(*) FROM "+table)) //nolint:gosec // test-only, fixed table names
	return n
}

// messyCSV has one clean row, one row with warnings (unknown tag/assignee,
// interpreted date), and one error row (end before start).
const messyCSV = `Title,Start,End,Status,Assignees,Tags,Progress
Kickoff,2026-03-02,2026-03-03,In Progress,Alice,launch,50
Fuzzy,3/5/26,,in progress,"Alice, Sarah K.","launch, q3",
Backwards,2026-03-05,2026-03-01,,,,
`

func TestImportDryRun_ReportsAndWritesNothing(t *testing.T) {
	srv, database, token, teamID, timelineID := importTestSetup(t)
	actsBefore := tableCount(t, database, "activities")
	tagsBefore := tableCount(t, database, "tags")

	code, body := doImport(t, srv, importReq(t, teamID, timelineID, "messy.csv",
		[]byte(messyCSV), map[string]any{"dryRun": true, "createMissingTags": true}, token))
	require.Equal(t, http.StatusOK, code)

	summary := body["summary"].(map[string]any)
	assert.Equal(t, float64(3), summary["total"])
	assert.Equal(t, float64(1), summary["ok"])
	assert.Equal(t, float64(1), summary["warnings"])
	assert.Equal(t, float64(1), summary["errors"])
	assert.Equal(t, float64(0), summary["created"])

	rows := body["rows"].([]any)
	require.Len(t, rows, 3)
	first := rows[0].(map[string]any)
	assert.Equal(t, "ok", first["status"])
	assert.Nil(t, first["createdId"], "dry-run must not assign IDs")

	unknown := body["unknownNames"].(map[string]any)
	assert.Equal(t, []any{"Sarah K."}, unknown["assignees"].([]any))
	assert.Equal(t, []any{"q3"}, unknown["tags"].([]any))

	assert.Equal(t, actsBefore, tableCount(t, database, "activities"), "dry-run wrote activities")
	assert.Equal(t, tagsBefore, tableCount(t, database, "tags"), "dry-run wrote tags (createMissingTags must be inert in preview)")
}

func TestImportCommit_WritesAcceptedRowsSkipsErrors(t *testing.T) {
	srv, _, token, teamID, timelineID := importTestSetup(t)

	code, body := doImport(t, srv, importReq(t, teamID, timelineID, "messy.csv",
		[]byte(messyCSV), map[string]any{"dryRun": false}, token))
	require.Equal(t, http.StatusOK, code)

	summary := body["summary"].(map[string]any)
	assert.Equal(t, float64(2), summary["created"])

	rows := body["rows"].([]any)
	assert.NotEmpty(t, rows[0].(map[string]any)["createdId"])
	assert.NotEmpty(t, rows[1].(map[string]any)["createdId"])
	assert.Nil(t, rows[2].(map[string]any)["createdId"], "error rows are never written")

	// The created activities are visible through the normal list endpoint
	// with resolved status and assignee.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet,
		fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID), nil, token))
	require.Equal(t, http.StatusOK, w.Code)
	var acts []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&acts))
	require.Len(t, acts, 2)

	byTitle := map[string]map[string]any{}
	for _, a := range acts {
		byTitle[a["title"].(string)] = a
	}
	kickoff := byTitle["Kickoff"]
	require.NotNil(t, kickoff)
	assert.NotEmpty(t, kickoff["statusId"])
	assert.Len(t, kickoff["assignedMemberIds"].([]any), 1)
	assert.Len(t, kickoff["tagIds"].([]any), 1)
	assert.Equal(t, true, kickoff["allDay"])
	assert.Contains(t, kickoff["startAt"], "2026-03-02")

	fuzzy := byTitle["Fuzzy"]
	require.NotNil(t, fuzzy)
	assert.Contains(t, fuzzy["startAt"], "2026-03-05", "3/5/26 read month-day-year")
	assert.Contains(t, fuzzy["endAt"], "2026-03-05", "missing end defaults to start")
}

func TestImportCommit_ParentForwardReference(t *testing.T) {
	srv, _, token, teamID, timelineID := importTestSetup(t)

	csvText := "Title,Start,End,Parent\nChild,2026-03-02,2026-03-03,Parent Task\nParent Task,2026-03-01,2026-03-10,\n"
	code, body := doImport(t, srv, importReq(t, teamID, timelineID, "parents.csv",
		[]byte(csvText), map[string]any{"dryRun": false}, token))
	require.Equal(t, http.StatusOK, code)

	rows := body["rows"].([]any)
	childID := rows[0].(map[string]any)["createdId"].(string)
	parentID := rows[1].(map[string]any)["createdId"].(string)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet,
		fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID), nil, token))
	var acts []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&acts))
	require.Len(t, acts, 2)
	for _, a := range acts {
		if a["id"] == childID {
			assert.Equal(t, parentID, a["parentActivityId"], "in-file parent resolved to the created parent's ID")
		}
	}
}

func TestImportCommit_CreateMissingTags(t *testing.T) {
	srv, _, token, teamID, timelineID := importTestSetup(t)

	csvText := "Title,Start,End,Tags\nA,2026-03-02,2026-03-03,\"launch, q3\"\n"
	code, body := doImport(t, srv, importReq(t, teamID, timelineID, "tags.csv",
		[]byte(csvText), map[string]any{"dryRun": false, "createMissingTags": true}, token))
	require.Equal(t, http.StatusOK, code)
	assert.Equal(t, float64(1), body["summary"].(map[string]any)["created"])

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/tags", teamID), nil, token))
	require.Equal(t, http.StatusOK, w.Code)
	var tags []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tags))
	names := make([]string, 0, len(tags))
	for _, tg := range tags {
		names = append(names, tg["name"].(string))
	}
	assert.ElementsMatch(t, []string{"launch", "q3"}, names)

	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet,
		fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID), nil, token))
	var acts []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&acts))
	require.Len(t, acts, 1)
	assert.Len(t, acts[0]["tagIds"].([]any), 2)
}

func TestImportSecondRun_DuplicateWarnings(t *testing.T) {
	srv, _, token, teamID, timelineID := importTestSetup(t)

	csvText := "Title,Start,End\nRepeat,2026-03-02,2026-03-03\n"
	code, _ := doImport(t, srv, importReq(t, teamID, timelineID, "a.csv",
		[]byte(csvText), map[string]any{"dryRun": false}, token))
	require.Equal(t, http.StatusOK, code)

	code, body := doImport(t, srv, importReq(t, teamID, timelineID, "a.csv",
		[]byte(csvText), map[string]any{"dryRun": true}, token))
	require.Equal(t, http.StatusOK, code)
	rows := body["rows"].([]any)
	rr := rows[0].(map[string]any)
	assert.Equal(t, "warning", rr["status"])
	found := false
	for _, is := range rr["issues"].([]any) {
		if strings.Contains(is.(map[string]any)["message"].(string), "possible duplicate") {
			found = true
		}
	}
	assert.True(t, found, "second run must disclose the possible duplicate")
}

func TestImport_StructuralErrors(t *testing.T) {
	srv, _, token, teamID, timelineID := importTestSetup(t)

	t.Run("MissingOptionsPart", func(t *testing.T) {
		code, body := doImport(t, srv, importReq(t, teamID, timelineID, "a.csv",
			[]byte("Title,Start\nA,2026-01-01\n"), nil, token))
		assert.Equal(t, http.StatusBadRequest, code)
		assert.Contains(t, body["error"].(map[string]any)["message"], "options")
	})
	t.Run("UnsupportedFileType", func(t *testing.T) {
		code, body := doImport(t, srv, importReq(t, teamID, timelineID, "notes.docx",
			[]byte("hello"), map[string]any{"dryRun": true}, token))
		assert.Equal(t, http.StatusBadRequest, code)
		assert.Equal(t, "IMPORT_FILE_INVALID", body["error"].(map[string]any)["code"])
	})
	t.Run("NoTitleColumn", func(t *testing.T) {
		code, body := doImport(t, srv, importReq(t, teamID, timelineID, "a.csv",
			[]byte("Foo,Bar\n1,2\n"), map[string]any{"dryRun": true}, token))
		assert.Equal(t, http.StatusBadRequest, code)
		assert.Contains(t, body["error"].(map[string]any)["message"], "Title")
	})
	t.Run("BadDateOrder", func(t *testing.T) {
		code, _ := doImport(t, srv, importReq(t, teamID, timelineID, "a.csv",
			[]byte("Title,Start\nA,2026-01-01\n"), map[string]any{"dryRun": true, "dateOrder": "ymd"}, token))
		assert.Equal(t, http.StatusBadRequest, code)
	})
	t.Run("NonMemberDenied", func(t *testing.T) {
		otherToken := seedNonMember(t, srv, token, "mallory@import.com", "Mallory")
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, importReq(t, teamID, timelineID, "a.csv",
			[]byte("Title,Start\nA,2026-01-01\n"), map[string]any{"dryRun": true}, otherToken))
		assert.Equal(t, http.StatusForbidden, w.Code)
	})
}

func TestImportTemplates(t *testing.T) {
	srv, _, token, _, _ := importTestSetup(t)

	t.Run("CSV", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, "/import/template.csv", nil, token))
		require.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Header().Get("Content-Disposition"), "draba-import-template.csv")
		records, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
		require.NoError(t, err)
		require.Len(t, records, 3, "header + minimal + full example rows")
		assert.Equal(t, "Title", records[0][0])
	})
	t.Run("XLSX", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, "/import/template.xlsx", nil, token))
		require.Equal(t, http.StatusOK, w.Code)
		f, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
		require.NoError(t, err)
		defer func() { _ = f.Close() }()
		rows, err := f.GetRows("Activities")
		require.NoError(t, err)
		require.Len(t, rows, 3)
	})
	t.Run("Unauthenticated", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/import/template.csv", http.NoBody))
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

// TestImportRoundTrip_ExportReimport pins the headline exit criterion: a
// Phase 14 export re-imported into a second timeline reproduces the same
// activities (modulo server-assigned IDs), for both CSV and xlsx.
func TestImportRoundTrip_ExportReimport(t *testing.T) {
	srv, _, token, teamID, timelineID := importTestSetup(t)

	// Seed a parent/child pair with status, assignee, tag, progress.
	var memberID string
	{
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, token))
		require.Equal(t, http.StatusOK, w.Code)
		var members []map[string]any
		require.NoError(t, json.NewDecoder(w.Body).Decode(&members))
		require.NotEmpty(t, members)
		memberID = members[0]["id"].(string)
	}
	var statusID, tagID string
	{
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, timelineID), nil, token))
		var sts []map[string]any
		require.NoError(t, json.NewDecoder(w.Body).Decode(&sts))
		statusID = sts[0]["id"].(string)

		w = httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/tags", teamID), nil, token))
		var tags []map[string]any
		require.NoError(t, json.NewDecoder(w.Body).Decode(&tags))
		tagID = tags[0]["id"].(string)
	}

	actURL := fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, actURL, map[string]any{
		"title": "Parent Item", "startAt": "2026-04-01T00:00:00Z", "endAt": "2026-04-10T00:00:00Z", "allDay": true,
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var parent map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&parent))

	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, actURL, map[string]any{
		"title": "Child Item", "startAt": "2026-04-02T00:00:00Z", "endAt": "2026-04-05T00:00:00Z", "allDay": true,
		"statusId": statusID, "parentActivityId": parent["id"],
		"assignedMemberIds": []string{memberID}, "tagIds": []string{tagID},
		"percentComplete": 50, "location": "HQ", "url": "https://example.com",
		"description": "Round trip me",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)

	for _, format := range []string{"csv", "xlsx"} {
		t.Run(format, func(t *testing.T) {
			// Export from the source timeline.
			w := httptest.NewRecorder()
			srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/export", timelineID),
				map[string]any{"format": format}, token))
			require.Equal(t, http.StatusOK, w.Code)
			exported := w.Body.Bytes()

			// A fresh target timeline with the same status name.
			w = httptest.NewRecorder()
			srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
				"name": "Target " + format, "startDate": "2026-01-01", "endDate": "2026-12-31",
			}, token))
			require.Equal(t, http.StatusCreated, w.Code)
			var target map[string]any
			require.NoError(t, json.NewDecoder(w.Body).Decode(&target))
			targetID := target["id"].(string)
			w = httptest.NewRecorder()
			srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines/%s/statuses", teamID, targetID),
				map[string]any{"name": "In Progress"}, token))
			require.Equal(t, http.StatusCreated, w.Code)

			code, body := doImport(t, srv, importReq(t, teamID, targetID, "export."+format,
				exported, map[string]any{"dryRun": false}, token))
			require.Equal(t, http.StatusOK, code)
			summary := body["summary"].(map[string]any)
			require.Equal(t, float64(2), summary["created"], "body: %v", body)
			assert.Equal(t, float64(0), summary["errors"])

			// The re-imported activities match the originals.
			w = httptest.NewRecorder()
			srv.ServeHTTP(w, authReq(http.MethodGet,
				fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, targetID), nil, token))
			var acts []map[string]any
			require.NoError(t, json.NewDecoder(w.Body).Decode(&acts))
			require.Len(t, acts, 2)
			byTitle := map[string]map[string]any{}
			for _, a := range acts {
				byTitle[a["title"].(string)] = a
			}
			child := byTitle["Child Item"]
			require.NotNil(t, child)
			assert.Contains(t, child["startAt"], "2026-04-02")
			assert.Contains(t, child["endAt"], "2026-04-05")
			assert.Equal(t, "Round trip me", child["description"])
			assert.Equal(t, float64(50), child["percentComplete"])
			assert.Equal(t, "HQ", child["location"])
			assert.Len(t, child["assignedMemberIds"].([]any), 1)
			assert.Len(t, child["tagIds"].([]any), 1)
			assert.Equal(t, byTitle["Parent Item"]["id"], child["parentActivityId"],
				"parent link re-established via in-file title match")
			assert.NotEmpty(t, child["statusId"], "status resolved by name on the target timeline")
		})
	}
}

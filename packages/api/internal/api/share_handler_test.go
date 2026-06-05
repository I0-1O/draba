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

// shareTestSetup creates a server, registers Alice, creates a team, timeline,
// and one activity. Returns the handler, Alice's auth token, team ID, and
// timeline ID.
func shareTestSetup(t *testing.T) (srv http.Handler, aliceToken, teamID, timelineID string) {
	t.Helper()
	srv = newTestServer(t)

	aliceToken, _ = seedUser(t, srv, "alice@share.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Share Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Share Timeline", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w2.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&tl))
	timelineID = tl["id"].(string)

	return srv, aliceToken, teamID, timelineID
}

// ── Create / List / Delete tests ──────────────────────────────────────────────

func TestShareCreate_Success(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)

	body := map[string]any{
		"viewType":   "gantt",
		"viewConfig": `{"groupBy":"none","sortBy":"startDate","colorBy":"activity","filter":{"logic":"and","conditions":[]}}`,
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), body, token))
	assert.Equal(t, http.StatusCreated, w.Code)

	var s map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&s))
	assert.NotEmpty(t, s["id"])
	assert.NotEmpty(t, s["token"])
	assert.Equal(t, "gantt", s["viewType"])
}

func TestShareCreate_Unauthenticated(t *testing.T) {
	srv, _, _, timelineID := shareTestSetup(t)

	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), http.NoBody)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestShareList_Success(t *testing.T) {
	srv, token, teamID, timelineID := shareTestSetup(t)

	// Create two shares.
	for range 2 {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
			"viewType": "gantt", "viewConfig": "{}",
		}, token))
		require.Equal(t, http.StatusCreated, w.Code)
	}

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/shares", teamID, timelineID), nil, token))
	assert.Equal(t, http.StatusOK, w.Code)

	var shares []any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&shares))
	assert.Len(t, shares, 2)
}

func TestShareDelete_Success(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)

	// Create a share then delete it.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareID := created["id"].(string)

	wD := httptest.NewRecorder()
	srv.ServeHTTP(wD, authReq(http.MethodDelete, fmt.Sprintf("/shares/%s", shareID), nil, token))
	assert.Equal(t, http.StatusNoContent, wD.Code)
}

// ── Public gateway tests (scope isolation) ────────────────────────────────────

func TestShareGateway_Success(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)

	// Create a share.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareToken := created["token"].(string)

	// Fetch the public projection — no auth header.
	wP := httptest.NewRecorder()
	srv.ServeHTTP(wP, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
	assert.Equal(t, http.StatusOK, wP.Code)

	var proj map[string]any
	require.NoError(t, json.NewDecoder(wP.Body).Decode(&proj))

	// Projection must contain the expected top-level fields.
	assert.NotNil(t, proj["share"])
	assert.NotNil(t, proj["timeline"])
	assert.NotNil(t, proj["activities"])
	assert.NotNil(t, proj["members"])
	assert.NotNil(t, proj["statuses"])
	assert.NotNil(t, proj["tags"])
}

func TestShareGateway_UnknownToken(t *testing.T) {
	srv := newTestServer(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/shares/doesnotexist", http.NoBody))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// TestShareGateway_NoEmailInResponse verifies that the public projection does
// not expose member emails (scope isolation).
func TestShareGateway_NoEmailInResponse(t *testing.T) {
	srv, token, teamID, timelineID := shareTestSetup(t)

	// Add an activity assigned to Alice.
	actURL := fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID)
	wA := httptest.NewRecorder()
	srv.ServeHTTP(wA, authReq(http.MethodPost, actURL, map[string]any{
		"title":   "Test Activity",
		"startAt": "2026-05-01T00:00:00Z",
		"endAt":   "2026-05-10T00:00:00Z",
		"allDay":  true,
	}, token))
	require.Equal(t, http.StatusCreated, wA.Code)

	// Create a share.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareToken := created["token"].(string)

	// Fetch the projection.
	wP := httptest.NewRecorder()
	srv.ServeHTTP(wP, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
	require.Equal(t, http.StatusOK, wP.Code)

	// Serialise to string and verify email address is absent.
	body := wP.Body.String()
	assert.NotContains(t, body, "alice@share.com", "member email must not appear in public projection")
	assert.NotContains(t, body, "userId", "userId must not appear in public projection")
	assert.NotContains(t, body, "role", "member role must not appear in public projection")
}

// TestShareGateway_ScopeIsolation verifies that query param injection cannot
// widen the scope. The gateway must ignore any extra query params.
func TestShareGateway_ScopeIsolation(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)

	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareToken := created["token"].(string)

	// Attempt to inject a timeline_id scope param — must be ignored.
	wP := httptest.NewRecorder()
	srv.ServeHTTP(wP, httptest.NewRequest(http.MethodGet,
		"/shares/"+shareToken+"?timeline_id=ANOTHER&team_id=ANOTHER",
		http.NoBody,
	))
	assert.Equal(t, http.StatusOK, wP.Code)

	var proj map[string]any
	require.NoError(t, json.NewDecoder(wP.Body).Decode(&proj))

	// The returned timeline id must be the one from the share row.
	tl := proj["timeline"].(map[string]any)
	assert.Equal(t, timelineID, tl["id"], "timeline id in response must match the share's timeline, not any injected param")
}

// TestShareGateway_FilteredOutActivitiesAbsent verifies that server-side filter
// evaluation removes activities from the payload.
func TestShareGateway_FilteredOutActivitiesAbsent(t *testing.T) {
	srv, token, teamID, timelineID := shareTestSetup(t)

	// Create two activities.
	actURL := fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID)
	for _, title := range []string{"Alpha", "Beta"} {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, actURL, map[string]any{
			"title": title, "startAt": "2026-05-01T00:00:00Z", "endAt": "2026-05-10T00:00:00Z", "allDay": true,
		}, token))
		require.Equal(t, http.StatusCreated, w.Code)
	}

	// Create a share with a filter that only passes "Alpha".
	filterDef := `{"logic":"and","conditions":[{"field":"title","op":"equals","value":"Alpha"}]}`
	viewConfig := fmt.Sprintf(`{"groupBy":"none","sortBy":"startDate","colorBy":"activity","filter":%s}`, filterDef)
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": viewConfig,
	}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareToken := created["token"].(string)

	// Fetch projection and verify only "Alpha" is present.
	wP := httptest.NewRecorder()
	srv.ServeHTTP(wP, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
	require.Equal(t, http.StatusOK, wP.Code)

	var proj map[string]any
	require.NoError(t, json.NewDecoder(wP.Body).Decode(&proj))

	activities := proj["activities"].([]any)
	require.Len(t, activities, 1, "only one activity should pass the filter")
	act := activities[0].(map[string]any)
	assert.Equal(t, "Alpha", act["title"])
}

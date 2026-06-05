package api_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// jsonBody marshals v and returns it as a request body reader, for building
// unauthenticated public requests (the auth helper attaches a Bearer header).
func jsonBody(t *testing.T, v any) io.Reader {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return bytes.NewReader(b)
}

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

// ── Update tests ──────────────────────────────────────────────────────────────

func TestShareUpdate_Success(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)

	// Create a share.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareID := created["id"].(string)

	newName := "Updated Name"
	wU := httptest.NewRecorder()
	srv.ServeHTTP(wU, authReq(http.MethodPatch, fmt.Sprintf("/shares/%s", shareID), map[string]any{
		"name": newName,
	}, token))
	assert.Equal(t, http.StatusOK, wU.Code)

	var updated map[string]any
	require.NoError(t, json.NewDecoder(wU.Body).Decode(&updated))
	assert.Equal(t, newName, updated["name"])
}

// TestShareUpdate_AnyTeamMember verifies the Phase 13.2 decision: a share is a
// read-only projection, so any member of the timeline's team may manage it —
// there is no creator/admin gate.
func TestShareUpdate_AnyTeamMember(t *testing.T) {
	srv, aliceToken, teamID, timelineID := shareTestSetup(t)

	// Alice creates a share.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareID := created["id"].(string)

	// Alice invites Bob so Bob can register.
	wI := httptest.NewRecorder()
	srv.ServeHTTP(wI, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@share.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, wI.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(wI.Body).Decode(&inv))

	// Bob joins as a regular member (not admin, not the share creator).
	bobToken, _ := seedUserWithInvite(t, srv, "bob@share.com", "password2", "Bob", inv["token"].(string))

	// Bob PATCHes Alice's share — allowed, because any team member may manage shares.
	wU := httptest.NewRecorder()
	srv.ServeHTTP(wU, authReq(http.MethodPatch, fmt.Sprintf("/shares/%s", shareID), map[string]any{
		"name": "Renamed by Bob",
	}, bobToken))
	assert.Equal(t, http.StatusOK, wU.Code)
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

// ── Password protection tests (Phase 13.2) ────────────────────────────────────

// createProtectedShare creates a password-protected share and returns its token.
func createProtectedShare(t *testing.T, srv http.Handler, authToken, timelineID, password string) string {
	t.Helper()
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}", "password": password,
	}, authToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	return created["token"].(string)
}

// TestShareGateway_LockedReturnsPasswordRequired verifies a protected share
// serves no projection data and signals passwordRequired without a view token.
func TestShareGateway_LockedReturnsPasswordRequired(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)
	shareToken := createProtectedShare(t, srv, token, timelineID, "hunter2")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, true, body["passwordRequired"])
	// No projection data must leak in the locked response.
	assert.Nil(t, body["activities"])
	assert.Nil(t, body["timeline"])
	// The password hash must never appear in any response.
	assert.NotContains(t, w.Body.String(), "hunter2")
}

// TestShareUnlock_WrongPassword verifies an incorrect password is rejected.
func TestShareUnlock_WrongPassword(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)
	shareToken := createProtectedShare(t, srv, token, timelineID, "correct-horse")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/shares/"+shareToken+"/unlock",
		jsonBody(t, map[string]any{"password": "wrong"})))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// TestShareUnlock_CorrectPasswordRendersView verifies the full unlock flow:
// the correct password yields a view token that opens the protected share.
func TestShareUnlock_CorrectPasswordRendersView(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)
	shareToken := createProtectedShare(t, srv, token, timelineID, "correct-horse")

	// Unlock with the correct password.
	wU := httptest.NewRecorder()
	srv.ServeHTTP(wU, httptest.NewRequest(http.MethodPost, "/shares/"+shareToken+"/unlock",
		jsonBody(t, map[string]any{"password": "correct-horse"})))
	require.Equal(t, http.StatusOK, wU.Code)
	var unlock map[string]string
	require.NoError(t, json.NewDecoder(wU.Body).Decode(&unlock))
	viewToken := unlock["token"]
	require.NotEmpty(t, viewToken)

	// Present the view token on the gateway — projection should render.
	req := httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody)
	req.Header.Set("Authorization", "Bearer "+viewToken)
	wP := httptest.NewRecorder()
	srv.ServeHTTP(wP, req)
	assert.Equal(t, http.StatusOK, wP.Code)
	var proj map[string]any
	require.NoError(t, json.NewDecoder(wP.Body).Decode(&proj))
	assert.NotNil(t, proj["timeline"])
}

// TestShareUnlock_TokenNotReplayableAcrossShares verifies a view token issued
// for one share cannot open another protected share.
func TestShareUnlock_TokenNotReplayableAcrossShares(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)
	tokenA := createProtectedShare(t, srv, token, timelineID, "pw-a")
	tokenB := createProtectedShare(t, srv, token, timelineID, "pw-b")

	// Unlock share A.
	wU := httptest.NewRecorder()
	srv.ServeHTTP(wU, httptest.NewRequest(http.MethodPost, "/shares/"+tokenA+"/unlock",
		jsonBody(t, map[string]any{"password": "pw-a"})))
	require.Equal(t, http.StatusOK, wU.Code)
	var unlock map[string]string
	require.NoError(t, json.NewDecoder(wU.Body).Decode(&unlock))
	viewTokenA := unlock["token"]

	// Replay A's token against share B — must be rejected.
	req := httptest.NewRequest(http.MethodGet, "/shares/"+tokenB, http.NoBody)
	req.Header.Set("Authorization", "Bearer "+viewTokenA)
	wP := httptest.NewRecorder()
	srv.ServeHTTP(wP, req)
	assert.Equal(t, http.StatusUnauthorized, wP.Code)
}

// TestShareUnlock_RateLimited verifies repeated unlock attempts from one client
// are throttled with 429 once the per-IP budget is exhausted.
func TestShareUnlock_RateLimited(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)
	shareToken := createProtectedShare(t, srv, token, timelineID, "secret")

	var got429 bool
	// Exceed the per-IP unlock budget (10/hour) with wrong passwords. The extra
	// iterations guarantee we cross the threshold regardless of its exact value.
	for range 15 {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/shares/"+shareToken+"/unlock",
			jsonBody(t, map[string]any{"password": "wrong"})))
		if w.Code == http.StatusTooManyRequests {
			got429 = true
		}
	}
	assert.True(t, got429, "expected to be rate-limited after exceeding the unlock budget")
}

// TestShareUpdate_PasswordToggle verifies adding then clearing a password via
// PATCH locks and then unlocks the public gateway.
func TestShareUpdate_PasswordToggle(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)

	// Create an open share.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareID := created["id"].(string)
	shareToken := created["token"].(string)

	// Open by default.
	wOpen := httptest.NewRecorder()
	srv.ServeHTTP(wOpen, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
	require.Equal(t, http.StatusOK, wOpen.Code)

	// PATCH a password on — now locked.
	wP := httptest.NewRecorder()
	srv.ServeHTTP(wP, authReq(http.MethodPatch, fmt.Sprintf("/shares/%s", shareID), map[string]any{
		"password": "now-locked",
	}, token))
	require.Equal(t, http.StatusOK, wP.Code)

	wLocked := httptest.NewRecorder()
	srv.ServeHTTP(wLocked, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
	assert.Equal(t, http.StatusUnauthorized, wLocked.Code)

	// PATCH the password off (empty string clears it) — open again.
	wClear := httptest.NewRecorder()
	srv.ServeHTTP(wClear, authReq(http.MethodPatch, fmt.Sprintf("/shares/%s", shareID), map[string]any{
		"password": "",
	}, token))
	require.Equal(t, http.StatusOK, wClear.Code)

	wReopen := httptest.NewRecorder()
	srv.ServeHTTP(wReopen, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
	assert.Equal(t, http.StatusOK, wReopen.Code)
}

// TestShareList_ExposesViewCount verifies the authenticated list response
// surfaces the view count for each share (Phase 13.2 in-modal display).
func TestShareList_ExposesViewCount(t *testing.T) {
	srv, token, teamID, timelineID := shareTestSetup(t)

	// Create an open share.
	wC := httptest.NewRecorder()
	srv.ServeHTTP(wC, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wC.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wC.Body).Decode(&created))
	shareToken := created["token"].(string)

	// The list response must carry a viewCount field for the share.
	wL := httptest.NewRecorder()
	srv.ServeHTTP(wL, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines/%s/shares", teamID, timelineID), nil, token))
	require.Equal(t, http.StatusOK, wL.Code)
	var shares []map[string]any
	require.NoError(t, json.NewDecoder(wL.Body).Decode(&shares))
	require.Len(t, shares, 1)
	// viewCount is present and JSON-decodes to a number (0 before any view).
	vc, ok := shares[0]["viewCount"].(float64)
	require.True(t, ok, "viewCount must be present in the list response")
	assert.Equal(t, float64(0), vc)

	// View the share once via the public gateway; RecordView runs async, so we
	// only assert the field's presence/shape here, not the post-increment value
	// (the increment is timing-dependent and covered by the repo-level behavior).
	wV := httptest.NewRecorder()
	srv.ServeHTTP(wV, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
	require.Equal(t, http.StatusOK, wV.Code)
}

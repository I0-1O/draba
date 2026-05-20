package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/api"
	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/tier"
	"github.com/I0-1O/draba/packages/api/internal/ws"
)

// savedFilterTestSetup builds an in-memory server, registers Alice, creates a
// team owned by Alice, and returns the handler, Alice's token, and the team ID.
func savedFilterTestSetup(t *testing.T) (srv http.Handler, aliceToken, teamID string) {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	eventsRepo := db.NewEventRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	savedFiltersRepo := db.NewSavedFilterRepo(database)
	tokens := auth.NewTokenService("saved-filter-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	srv = api.NewServer(users, invites, teams, eventsRepo, timelinesRepo, savedFiltersRepo, db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ = seedUser(t, srv, "alice@savedfilter.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Filter Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)
	return srv, aliceToken, teamID
}

// addTeamMember invites a new user (member role) to teamID and returns their access token.
func addTeamMember(t *testing.T, srv http.Handler, adminToken, teamID, email, displayName string) string {
	t.Helper()
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]any{"email": email, "role": "member"}, adminToken))
	require.Equal(t, http.StatusCreated, w.Code, "create invite: %s", w.Body)
	var invite map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&invite))
	token, _ := seedUserWithInvite(t, srv, email, "password1", displayName, invite["token"].(string))
	return token
}

func TestCreateSavedFilter_Success(t *testing.T) {
	srv, token, teamID := savedFilterTestSetup(t)

	body := map[string]any{
		"name":       "Upcoming",
		"definition": `{"kind":"preset","id":"upcoming"}`,
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID), body, token))

	assert.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	assert.Equal(t, "Upcoming", f["name"])
	assert.Equal(t, teamID, f["teamId"])
	assert.NotEmpty(t, f["id"])
	assert.NotEmpty(t, f["userId"])
}

func TestCreateSavedFilter_InvalidJSONDefinition(t *testing.T) {
	srv, token, teamID := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "Bad", "definition": "not valid json"}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSavedFilter_MissingName(t *testing.T) {
	srv, token, teamID := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"definition": "{}"}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSavedFilter_NonMemberForbidden(t *testing.T) {
	srv, _, teamID := savedFilterTestSetup(t)

	outsiderTokens := auth.NewTokenService("saved-filter-test-secret")
	outsiderToken, _ := outsiderTokens.IssueAccessToken("outsider-id", "outsider@example.com")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "X", "definition": "{}"}, outsiderToken))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestListSavedFilters_UserIsolation(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob@savedfilter.com", "Bob")

	// Alice creates two filters; Bob creates one.
	for _, name := range []string{"alice-1", "alice-2"} {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
			map[string]any{"name": name, "definition": "{}"}, aliceToken))
		require.Equal(t, http.StatusCreated, w.Code)
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "bob-1", "definition": "{}"}, bobToken))
	require.Equal(t, http.StatusCreated, w.Code)

	// Alice sees only her own filters.
	wList := httptest.NewRecorder()
	srv.ServeHTTP(wList, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/saved_filters", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, wList.Code)
	var aliceList []map[string]any
	require.NoError(t, json.NewDecoder(wList.Body).Decode(&aliceList))
	assert.Len(t, aliceList, 2)
	for _, f := range aliceList {
		assert.NotEqual(t, "bob-1", f["name"])
	}

	// Bob sees only his filter.
	wBob := httptest.NewRecorder()
	srv.ServeHTTP(wBob, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/saved_filters", teamID), nil, bobToken))
	require.Equal(t, http.StatusOK, wBob.Code)
	var bobList []map[string]any
	require.NoError(t, json.NewDecoder(wBob.Body).Decode(&bobList))
	assert.Len(t, bobList, 1)
	assert.Equal(t, "bob-1", bobList[0]["name"])
}

func TestUpdateSavedFilter_NonOwnerForbidden(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob@savedfilter.com", "Bob")

	// Bob creates a filter.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "bob's", "definition": "{}"}, bobToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	// Alice tries to update it — forbidden.
	wUpd := httptest.NewRecorder()
	srv.ServeHTTP(wUpd, authReq(http.MethodPatch, fmt.Sprintf("/saved_filters/%s", filterID),
		map[string]any{"name": "hijacked"}, aliceToken))
	assert.Equal(t, http.StatusForbidden, wUpd.Code)
}

func TestUpdateSavedFilter_OwnerSuccess(t *testing.T) {
	srv, token, teamID := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "Orig", "definition": `{"a":1}`}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	wUpd := httptest.NewRecorder()
	srv.ServeHTTP(wUpd, authReq(http.MethodPatch, fmt.Sprintf("/saved_filters/%s", filterID),
		map[string]any{"name": "Renamed", "definition": `{"a":2}`}, token))
	require.Equal(t, http.StatusOK, wUpd.Code)
	var updated map[string]any
	require.NoError(t, json.NewDecoder(wUpd.Body).Decode(&updated))
	assert.Equal(t, "Renamed", updated["name"])
	assert.Equal(t, `{"a":2}`, updated["definition"])
}

func TestDeleteSavedFilter_NonOwnerForbidden(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob@savedfilter.com", "Bob")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "bob's", "definition": "{}"}, bobToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	wDel := httptest.NewRecorder()
	srv.ServeHTTP(wDel, authReq(http.MethodDelete, fmt.Sprintf("/saved_filters/%s", filterID), nil, aliceToken))
	assert.Equal(t, http.StatusForbidden, wDel.Code)
}

func TestDeleteSavedFilter_OwnerSuccess(t *testing.T) {
	srv, token, teamID := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "Tmp", "definition": "{}"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	wDel := httptest.NewRecorder()
	srv.ServeHTTP(wDel, authReq(http.MethodDelete, fmt.Sprintf("/saved_filters/%s", filterID), nil, token))
	assert.Equal(t, http.StatusNoContent, wDel.Code)

	// Subsequent update is now 404.
	wUpd := httptest.NewRecorder()
	srv.ServeHTTP(wUpd, authReq(http.MethodPatch, fmt.Sprintf("/saved_filters/%s", filterID),
		map[string]any{"name": "X"}, token))
	assert.Equal(t, http.StatusNotFound, wUpd.Code)
}

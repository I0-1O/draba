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
	"github.com/I0-1O/draba/packages/api/internal/mailer"
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
	activitiesRepo := db.NewActivityRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	savedFiltersRepo := db.NewSavedFilterRepo(database)
	tokens := auth.NewTokenService("saved-filter-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	isrSF := db.NewInstanceSettingsRepo(database)
	srv = api.NewServer(users, invites, teams, activitiesRepo, timelinesRepo, savedFiltersRepo, db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isrSF, db.NewPasswordResetTokenRepo(database), db.NewStatusRepo(database), db.NewTagRepo(database), mailer.New(isrSF, nil), tokens, tier.Unlimited, bus, hub).Routes()

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

// seedNonMember registers a user in the server's DB (via a throwaway scratch
// team) so the user exists and has a valid JWT, but is not a member of the
// team under test. Use this instead of minting a ghost token whenever a test
// needs to assert that a real-but-unrelated user gets 403.
func seedNonMember(t *testing.T, srv http.Handler, aliceToken, email, displayName string) string {
	t.Helper()
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "_scratch"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code, "create scratch team: %s", w.Body)
	var scratch map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&scratch))
	return addTeamMember(t, srv, aliceToken, scratch["id"].(string), email, displayName)
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
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	outsiderToken := seedNonMember(t, srv, aliceToken, "outsider@savedfilter.com", "Outsider")

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

	// Alice tries to update it - forbidden.
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

// ── Team filter flag tests ─────────────────────────────────────────────────────

// TestListSavedFilters_IncludesTeamFilters checks that ListByTeamUser returns
// team filters alongside the caller's own filters.
func TestListSavedFilters_IncludesTeamFilters(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob2@savedfilter.com", "Bob2")

	// Alice creates a filter then promotes it to team scope.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "alice-team", "definition": "{}"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	// Promote to team filter.
	wProm := httptest.NewRecorder()
	srv.ServeHTTP(wProm, authReq(http.MethodPatch, fmt.Sprintf("/saved_filters/%s", filterID),
		map[string]any{"isTeamFilter": true}, aliceToken))
	require.Equal(t, http.StatusOK, wProm.Code, "promote: %s", wProm.Body)

	// Bob creates his own personal filter.
	wBob := httptest.NewRecorder()
	srv.ServeHTTP(wBob, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "bob-personal", "definition": "{}"}, bobToken))
	require.Equal(t, http.StatusCreated, wBob.Code)

	// Bob's list should include both alice's team filter and bob's own filter.
	wList := httptest.NewRecorder()
	srv.ServeHTTP(wList, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/saved_filters", teamID), nil, bobToken))
	require.Equal(t, http.StatusOK, wList.Code)
	var list []map[string]any
	require.NoError(t, json.NewDecoder(wList.Body).Decode(&list))
	assert.Len(t, list, 2, "bob should see the team filter + his own: %v", list)

	var names []string
	for _, item := range list {
		names = append(names, item["name"].(string))
	}
	assert.Contains(t, names, "alice-team")
	assert.Contains(t, names, "bob-personal")
}

// TestUpdateSavedFilter_AdminCanPromoteOthersFilter checks that an admin can
// set isTeamFilter=true on a filter they don't own.
func TestUpdateSavedFilter_AdminCanPromoteOthersFilter(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob3@savedfilter.com", "Bob3")

	// Bob creates a filter.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "bob-filter", "definition": "{}"}, bobToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	// Alice (admin) promotes it.
	wProm := httptest.NewRecorder()
	srv.ServeHTTP(wProm, authReq(http.MethodPatch, fmt.Sprintf("/saved_filters/%s", filterID),
		map[string]any{"isTeamFilter": true}, aliceToken))
	require.Equal(t, http.StatusOK, wProm.Code, "body: %s", wProm.Body)

	var updated map[string]any
	require.NoError(t, json.NewDecoder(wProm.Body).Decode(&updated))
	assert.Equal(t, true, updated["isTeamFilter"])
}

// TestUpdateSavedFilter_NonAdminCannotPromote checks that a non-admin member
// cannot set isTeamFilter=true.
func TestUpdateSavedFilter_NonAdminCannotPromote(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob4@savedfilter.com", "Bob4")

	// Bob creates a filter.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "bob-priv", "definition": "{}"}, bobToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	// Bob (member) tries to promote — should be 403.
	wProm := httptest.NewRecorder()
	srv.ServeHTTP(wProm, authReq(http.MethodPatch, fmt.Sprintf("/saved_filters/%s", filterID),
		map[string]any{"isTeamFilter": true}, bobToken))
	assert.Equal(t, http.StatusForbidden, wProm.Code)
}

// TestDeleteSavedFilter_AdminCanDeleteTeamFilter checks that an admin can
// delete a team filter they don't own.
func TestDeleteSavedFilter_AdminCanDeleteTeamFilter(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob5@savedfilter.com", "Bob5")

	// Bob creates a filter; Alice promotes it.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "bob-team-filter", "definition": "{}"}, bobToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	wProm := httptest.NewRecorder()
	srv.ServeHTTP(wProm, authReq(http.MethodPatch, fmt.Sprintf("/saved_filters/%s", filterID),
		map[string]any{"isTeamFilter": true}, aliceToken))
	require.Equal(t, http.StatusOK, wProm.Code)

	// Alice (admin) deletes a team filter she doesn't own.
	wDel := httptest.NewRecorder()
	srv.ServeHTTP(wDel, authReq(http.MethodDelete, fmt.Sprintf("/saved_filters/%s", filterID), nil, aliceToken))
	assert.Equal(t, http.StatusNoContent, wDel.Code)
}

// TestCreateSavedFilter_NonAdminCannotCreateAsTeamFilter checks that a
// non-admin member cannot create a filter with isTeamFilter=true.
func TestCreateSavedFilter_NonAdminCannotCreateAsTeamFilter(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob7@savedfilter.com", "Bob7")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "Sneaky", "definition": "{}", "isTeamFilter": true}, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

// TestListAllTeamSavedFilters_AdminSuccess checks that an admin can list all
// filters in the team (including other members' private filters).
func TestListAllTeamSavedFilters_AdminSuccess(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob8@savedfilter.com", "Bob8")

	// Alice (admin) creates one filter; Bob creates a private one.
	for _, pair := range []struct{ tok, name string }{
		{aliceToken, "alice-private"},
		{bobToken, "bob-private"},
	} {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
			map[string]any{"name": pair.name, "definition": "{}"}, pair.tok))
		require.Equal(t, http.StatusCreated, w.Code)
	}

	// Admin list-all should return both.
	wList := httptest.NewRecorder()
	srv.ServeHTTP(wList, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/saved_filters/all", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, wList.Code, "body: %s", wList.Body)
	var list []map[string]any
	require.NoError(t, json.NewDecoder(wList.Body).Decode(&list))
	assert.Len(t, list, 2)
}

// TestListAllTeamSavedFilters_NonAdminForbidden checks that a non-admin member
// cannot access the list-all endpoint.
func TestListAllTeamSavedFilters_NonAdminForbidden(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob9@savedfilter.com", "Bob9")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/saved_filters/all", teamID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

// TestDeleteSavedFilter_NonAdminCannotDeleteOthersTeamFilter checks that a
// regular member cannot delete a team filter they don't own.
func TestDeleteSavedFilter_NonAdminCannotDeleteOthersTeamFilter(t *testing.T) {
	srv, aliceToken, teamID := savedFilterTestSetup(t)
	bobToken := addTeamMember(t, srv, aliceToken, teamID, "bob6@savedfilter.com", "Bob6")

	// Alice creates a team filter.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/saved_filters", teamID),
		map[string]any{"name": "alice-team-filter", "definition": "{}", "isTeamFilter": true}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var f map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&f))
	filterID := f["id"].(string)

	// Bob (member) tries to delete it — forbidden.
	wDel := httptest.NewRecorder()
	srv.ServeHTTP(wDel, authReq(http.MethodDelete, fmt.Sprintf("/saved_filters/%s", filterID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, wDel.Code)
}

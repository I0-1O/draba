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

// revokeUserTestSetup registers Alice (first user → superadmin), creates a team,
// and invites Bob as a regular member. Returns tokens and user IDs for both.
func revokeUserTestSetup(t *testing.T) (srv http.Handler, aliceToken, aliceID, bobToken, bobID string) {
	t.Helper()
	srv, _ = newTeamTestServer(t)
	aliceToken, aliceID = seedUser(t, srv, "alice@revoke.com", "password1", "Alice")

	wTeam := httptest.NewRecorder()
	srv.ServeHTTP(wTeam, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	require.Equal(t, http.StatusCreated, wTeam.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(wTeam.Body).Decode(&team))
	teamID := team["id"].(string)

	wInv := httptest.NewRecorder()
	srv.ServeHTTP(wInv, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]any{"email": "bob@revoke.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, wInv.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(wInv.Body).Decode(&inv))

	bobToken, bobID = seedUserWithInvite(t, srv, "bob@revoke.com", "password1", "Bob", inv["token"].(string))
	return
}

func TestRevokeUser_ForbiddenForNonSuperadmin(t *testing.T) {
	srv, _, aliceID, bobToken, _ := revokeUserTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/users/"+aliceID+"/revoke", nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)
	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "FORBIDDEN", body["error"].(map[string]any)["code"])
}

func TestRevokeUser_SelfRevokeForbidden(t *testing.T) {
	srv, aliceToken, aliceID, _, _ := revokeUserTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/users/"+aliceID+"/revoke", nil, aliceToken))
	assert.Equal(t, http.StatusBadRequest, w.Code)
	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "CANNOT_SELF_REVOKE", body["error"].(map[string]any)["code"])
}

func TestRevokeUser_UserNotFound(t *testing.T) {
	srv, aliceToken, _, _, _ := revokeUserTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/users/does-not-exist/revoke", nil, aliceToken))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestRevokeUser_Success(t *testing.T) {
	srv, aliceToken, _, _, bobID := revokeUserTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/users/"+bobID+"/revoke", nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var result map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&result))
	assert.Equal(t, true, result["accountDeactivated"])
	// Bob has one membership with no assignments → it is removed, not inactivated.
	assert.Equal(t, float64(0), result["membershipsInactivated"])
	assert.Equal(t, float64(1), result["membershipsRemoved"])
}

func TestRevokeUser_WithAssignments_InactivatesMembership(t *testing.T) {
	srv, aliceToken, _, _, bobID := revokeUserTestSetup(t)

	// Find Bob's member ID via the admin users list.
	wList := httptest.NewRecorder()
	srv.ServeHTTP(wList, authReq(http.MethodGet, "/teams", nil, aliceToken))
	require.Equal(t, http.StatusOK, wList.Code)
	var teams []map[string]any
	require.NoError(t, json.NewDecoder(wList.Body).Decode(&teams))
	require.Len(t, teams, 1)
	teamID := teams[0]["id"].(string)

	// Find Bob's member ID.
	wMembers := httptest.NewRecorder()
	srv.ServeHTTP(wMembers, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, wMembers.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(wMembers.Body).Decode(&members))
	var bobMemberID string
	for _, m := range members {
		if m["email"] == "bob@revoke.com" {
			bobMemberID = m["id"].(string)
		}
	}
	require.NotEmpty(t, bobMemberID)

	// Create a timeline and an activity, then assign the activity to Bob.
	wTL := httptest.NewRecorder()
	srv.ServeHTTP(wTL, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Sprint", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, wTL.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(wTL.Body).Decode(&tl))
	tlID := tl["id"].(string)

	wAct := httptest.NewRecorder()
	srv.ServeHTTP(wAct, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, tlID), map[string]any{
		"title":   "Sprint Planning",
		"startAt": "2026-06-01T09:00:00Z",
		"endAt":   "2026-06-01T17:00:00Z",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, wAct.Code)
	var act map[string]any
	require.NoError(t, json.NewDecoder(wAct.Body).Decode(&act))

	wAssign := httptest.NewRecorder()
	srv.ServeHTTP(wAssign, authReq(http.MethodPatch, fmt.Sprintf("/activities/%s", act["id"].(string)),
		map[string]any{"assignedMemberIds": []string{bobMemberID}}, aliceToken))
	require.Equal(t, http.StatusOK, wAssign.Code)

	// Revoke Bob — membership has history so it must be inactivated, not deleted.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/users/"+bobID+"/revoke", nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var result map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&result))
	assert.Equal(t, true, result["accountDeactivated"])
	assert.Equal(t, float64(1), result["membershipsInactivated"])
	assert.Equal(t, float64(0), result["membershipsRemoved"])
}

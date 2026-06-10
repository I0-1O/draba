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

// icsShareSetup extends shareTestSetup with Alice's team-member ID, which
// member-scoped feed tests need for assignment and scope arguments.
func icsShareSetup(t *testing.T) (srv http.Handler, token, teamID, timelineID, memberID string) {
	t.Helper()
	srv, token, teamID, timelineID = shareTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, token))
	require.Equal(t, http.StatusOK, w.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&members))
	require.Len(t, members, 1)
	memberID = members[0]["id"].(string)
	return srv, token, teamID, timelineID, memberID
}

// createICSShare creates an ICS share via the API and returns the decoded row.
func createICSShare(t *testing.T, srv http.Handler, token, timelineID string, body map[string]any) map[string]any {
	t.Helper()
	body["kind"] = "ics"
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), body, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	return created
}

func createActivity(t *testing.T, srv http.Handler, token, teamID, timelineID string, body map[string]any) {
	t.Helper()
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost,
		fmt.Sprintf("/teams/%s/timelines/%s/activities", teamID, timelineID), body, token))
	require.Equal(t, http.StatusCreated, w.Code)
}

// ── Feed serving ──────────────────────────────────────────────────────────────

func TestShareICS_TimelineFeed_AllDayEvents(t *testing.T) {
	srv, token, teamID, timelineID, _ := icsShareSetup(t)

	createActivity(t, srv, token, teamID, timelineID, map[string]any{
		"title": "Launch prep", "startAt": "2026-05-01T00:00:00Z", "endAt": "2026-05-10T00:00:00Z", "allDay": true,
	})
	createActivity(t, srv, token, teamID, timelineID, map[string]any{
		"title": "Retro", "startAt": "2026-05-12T00:00:00Z", "endAt": "2026-05-12T00:00:00Z", "allDay": true,
	})

	created := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})
	shareToken := created["token"].(string)
	assert.Equal(t, "ics", created["kind"])
	assert.Equal(t, "timeline", created["scope"])

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken+".ics", http.NoBody))
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "text/calendar")

	body := w.Body.String()
	assert.Contains(t, body, "BEGIN:VCALENDAR")
	assert.Contains(t, body, "SUMMARY:Launch prep")
	assert.Contains(t, body, "SUMMARY:Retro")
	assert.Contains(t, body, "DTSTART;VALUE=DATE:20260501")
	// Inclusive activity end date 2026-05-10 → exclusive DTEND 2026-05-11.
	assert.Contains(t, body, "DTEND;VALUE=DATE:20260511")
}

func TestShareICS_MemberFeed_OnlyAssignedActivities(t *testing.T) {
	srv, token, teamID, timelineID, memberID := icsShareSetup(t)

	createActivity(t, srv, token, teamID, timelineID, map[string]any{
		"title": "Mine", "startAt": "2026-05-01T00:00:00Z", "endAt": "2026-05-02T00:00:00Z", "allDay": true,
		"assignedMemberIds": []string{memberID},
	})
	createActivity(t, srv, token, teamID, timelineID, map[string]any{
		"title": "Someone else's", "startAt": "2026-05-03T00:00:00Z", "endAt": "2026-05-04T00:00:00Z", "allDay": true,
	})

	created := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "member", "memberId": memberID})
	shareToken := created["token"].(string)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken+".ics", http.NoBody))
	require.Equal(t, http.StatusOK, w.Code)

	body := w.Body.String()
	assert.Contains(t, body, "SUMMARY:Mine")
	assert.NotContains(t, body, "Someone else's", "member feed must exclude unassigned activities")
	// The feed name carries the member's display name — the only PII allowed.
	assert.Contains(t, body, "Alice")
}

// TestShareICS_NoPIIInFeed verifies the 13.4 exit criterion: the .ics payload
// carries no member email, user ID, or role.
func TestShareICS_NoPIIInFeed(t *testing.T) {
	srv, token, teamID, timelineID, memberID := icsShareSetup(t)

	createActivity(t, srv, token, teamID, timelineID, map[string]any{
		"title": "Work", "startAt": "2026-05-01T00:00:00Z", "endAt": "2026-05-02T00:00:00Z", "allDay": true,
		"assignedMemberIds": []string{memberID},
	})

	created := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})
	shareToken := created["token"].(string)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken+".ics", http.NoBody))
	require.Equal(t, http.StatusOK, w.Code)

	body := w.Body.String()
	assert.NotContains(t, body, "alice@share.com")
	assert.NotContains(t, body, "userId")
	assert.NotContains(t, body, "role")
}

// TestShareICS_KindIsolation verifies the two share flavors never cross over:
// an ICS token is dead on the JSON projection gateway (a member-scoped feed
// token must not unlock a whole-timeline projection), and a view token is
// dead on the .ics endpoint.
func TestShareICS_KindIsolation(t *testing.T) {
	srv, token, _, timelineID, _ := icsShareSetup(t)

	icsShare := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})
	icsToken := icsShare["token"].(string)

	wView := httptest.NewRecorder()
	srv.ServeHTTP(wView, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wView.Code)
	var viewShare map[string]any
	require.NoError(t, json.NewDecoder(wView.Body).Decode(&viewShare))
	viewToken := viewShare["token"].(string)

	// ICS token on the JSON gateway → 404, no projection data.
	w1 := httptest.NewRecorder()
	srv.ServeHTTP(w1, httptest.NewRequest(http.MethodGet, "/shares/"+icsToken, http.NoBody))
	assert.Equal(t, http.StatusNotFound, w1.Code)

	// View token on the feed endpoint → 404.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/shares/"+viewToken+".ics", http.NoBody))
	assert.Equal(t, http.StatusNotFound, w2.Code)
}

// ── Create validation ─────────────────────────────────────────────────────────

func TestShareICS_CreateValidation(t *testing.T) {
	srv, token, _, timelineID, memberID := icsShareSetup(t)

	post := func(body map[string]any) int {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), body, token))
		return w.Code
	}

	assert.Equal(t, http.StatusBadRequest, post(map[string]any{"kind": "ics"}),
		"missing scope must be rejected")
	assert.Equal(t, http.StatusBadRequest, post(map[string]any{"kind": "ics", "scope": "everything"}),
		"unknown scope must be rejected")
	assert.Equal(t, http.StatusBadRequest, post(map[string]any{"kind": "ics", "scope": "member"}),
		"member scope without memberId must be rejected")
	assert.Equal(t, http.StatusBadRequest, post(map[string]any{"kind": "ics", "scope": "member", "memberId": "not-a-member"}),
		"memberId outside the timeline's team must be rejected")
	assert.Equal(t, http.StatusBadRequest, post(map[string]any{"kind": "ics", "scope": "timeline", "password": "secret"}),
		"ICS feeds cannot carry a password")
	assert.Equal(t, http.StatusBadRequest, post(map[string]any{"kind": "pixel"}),
		"unknown kind must be rejected")

	created := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "member", "memberId": memberID})
	assert.Equal(t, memberID, created["memberId"])
	// ICS rows never freeze view semantics.
	assert.Equal(t, "{}", created["viewConfig"])
	assert.Equal(t, false, created["protected"])
}

// TestShareICS_PatchCannotAddPassword verifies that an existing ICS feed can
// never gain a password through PATCH — calendar clients have no interactive
// unlock, so a password would silently brick the feed.
func TestShareICS_PatchCannotAddPassword(t *testing.T) {
	srv, token, _, timelineID, _ := icsShareSetup(t)
	created := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})
	shareID := created["id"].(string)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, "/shares/"+shareID, map[string]any{"password": "secret"}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)

	// A benign rename must still work.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, "/shares/"+shareID, map[string]any{"name": "Renamed feed"}, token))
	assert.Equal(t, http.StatusOK, w2.Code)
	var updated map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&updated))
	assert.Equal(t, false, updated["protected"])
}

// TestShareCreate_SuperadminOutsideTeam reproduces the Docker-found 500: a
// superadmin who holds no team_members row in the timeline's team passes
// requireTeamMember as a synthetic member with an empty ID, which previously
// hit the NOT NULL created_by FK. created_by is now nullable (migration 023)
// and stays NULL for them.
func TestShareCreate_SuperadminOutsideTeam(t *testing.T) {
	srv := newTestServer(t)

	// First registered user is the superadmin.
	superToken, _ := seedUser(t, srv, "root@share.com", "password1", "Root")
	// Bob, outside the superadmin's sphere, owns the team + timeline.
	bobToken := seedNonMember(t, srv, superToken, "bob@icsshare.com", "Bob")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Bob Team"}, bobToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", team["id"]), map[string]any{
		"name": "Bob Timeline", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, bobToken))
	require.Equal(t, http.StatusCreated, w2.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&tl))

	// Superadmin creates an ICS share on Bob's timeline.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", tl["id"]), map[string]any{
		"kind": "ics", "scope": "timeline",
	}, superToken))
	require.Equal(t, http.StatusCreated, w3.Code, "superadmin share creation must not 500: %s", w3.Body.String())
	var created map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&created))
	assert.Nil(t, created["createdBy"], "created_by must be NULL for a non-member superadmin")

	// The feed it produced is alive.
	w4 := httptest.NewRecorder()
	srv.ServeHTTP(w4, httptest.NewRequest(http.MethodGet, "/shares/"+created["token"].(string)+".ics", http.NoBody))
	assert.Equal(t, http.StatusOK, w4.Code)
}

// ── Regenerate ────────────────────────────────────────────────────────────────

// TestShareRegenerate_InvalidatesOldToken verifies the 13.4 exit criterion:
// regenerating the link immediately kills the old URL — including a feed
// payload already sitting in the ICS cache — and the new URL works.
func TestShareRegenerate_InvalidatesOldToken(t *testing.T) {
	srv, token, teamID, timelineID, _ := icsShareSetup(t)

	createActivity(t, srv, token, teamID, timelineID, map[string]any{
		"title": "Work", "startAt": "2026-05-01T00:00:00Z", "endAt": "2026-05-02T00:00:00Z", "allDay": true,
	})

	created := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})
	shareID := created["id"].(string)
	oldToken := created["token"].(string)

	// Warm the feed cache with the old token.
	wWarm := httptest.NewRecorder()
	srv.ServeHTTP(wWarm, httptest.NewRequest(http.MethodGet, "/shares/"+oldToken+".ics", http.NoBody))
	require.Equal(t, http.StatusOK, wWarm.Code)

	wR := httptest.NewRecorder()
	srv.ServeHTTP(wR, authReq(http.MethodPost, "/shares/"+shareID+"/regenerate", nil, token))
	require.Equal(t, http.StatusOK, wR.Code)
	var regenerated map[string]any
	require.NoError(t, json.NewDecoder(wR.Body).Decode(&regenerated))
	newToken := regenerated["token"].(string)
	require.NotEqual(t, oldToken, newToken)

	wOld := httptest.NewRecorder()
	srv.ServeHTTP(wOld, httptest.NewRequest(http.MethodGet, "/shares/"+oldToken+".ics", http.NoBody))
	assert.Equal(t, http.StatusNotFound, wOld.Code, "old token must be dead immediately after regenerate")

	wNew := httptest.NewRecorder()
	srv.ServeHTTP(wNew, httptest.NewRequest(http.MethodGet, "/shares/"+newToken+".ics", http.NoBody))
	assert.Equal(t, http.StatusOK, wNew.Code)
	assert.Contains(t, wNew.Body.String(), "SUMMARY:Work")
}

func TestShareRegenerate_RequiresTeamMembership(t *testing.T) {
	srv, token, _, timelineID, _ := icsShareSetup(t)
	created := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})
	shareID := created["id"].(string)

	// Unauthenticated → 401.
	w1 := httptest.NewRecorder()
	srv.ServeHTTP(w1, httptest.NewRequest(http.MethodPost, "/shares/"+shareID+"/regenerate", http.NoBody))
	assert.Equal(t, http.StatusUnauthorized, w1.Code)

	// A user outside the team → forbidden.
	outsiderToken := seedNonMember(t, srv, token, "mallory@share.com", "Mallory")
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, "/shares/"+shareID+"/regenerate", nil, outsiderToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)
}

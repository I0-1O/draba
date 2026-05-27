package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

// activityTestSetup creates a server, registers Alice, creates a team, and
// returns the handler, Alice's token, and the team ID.
func activityTestSetup(t *testing.T) (srv http.Handler, aliceToken, teamID string) {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	activitiesRepo := db.NewActivityRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("activity-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	isr := db.NewInstanceSettingsRepo(database)
	srv = api.NewServer(users, invites, teams, activitiesRepo, timelinesRepo, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isr, db.NewPasswordResetTokenRepo(database), db.NewStatusRepo(database), mailer.New(isr, nil), tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ = seedUser(t, srv, "alice@activity.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Activities Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)
	return srv, aliceToken, teamID
}

func TestCreateActivity_Success(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	body := map[string]any{
		"title":   "Sprint Planning",
		"startAt": "2026-05-05T09:00:00Z",
		"endAt":   "2026-05-05T10:00:00Z",
		"allDay":  false,
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), body, token))

	assert.Equal(t, http.StatusCreated, w.Code)
	var activity map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&activity))
	assert.Equal(t, "Sprint Planning", activity["title"])
	assert.Equal(t, teamID, activity["teamId"])
	assert.NotEmpty(t, activity["id"])
}

func TestCreateActivity_MissingTitle(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	body := map[string]any{
		"startAt": "2026-05-05T09:00:00Z",
		"endAt":   "2026-05-05T10:00:00Z",
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), body, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateActivity_EndBeforeStart(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	body := map[string]any{
		"title":   "Backwards Activity",
		"startAt": "2026-05-05T10:00:00Z",
		"endAt":   "2026-05-05T09:00:00Z",
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), body, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListActivities_NoFilter(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	for _, title := range []string{"Alpha", "Beta", "Gamma"} {
		body := map[string]any{
			"title":   title,
			"startAt": "2026-05-10T09:00:00Z",
			"endAt":   "2026-05-10T17:00:00Z",
		}
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), body, token))
		require.Equal(t, http.StatusCreated, w.Code)
	}

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/activities", teamID), nil, token))
	assert.Equal(t, http.StatusOK, w.Code)

	var acts []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&acts))
	assert.Len(t, acts, 3)
}

func TestListActivities_DateRangeFilter(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	// Three activities: one in April, two in May.
	for _, startAt := range []string{
		"2026-04-15T09:00:00Z",
		"2026-05-10T09:00:00Z",
		"2026-05-20T09:00:00Z",
	} {
		body := map[string]any{
			"title":   "Activity on " + startAt[:10],
			"startAt": startAt,
			"endAt":   startAt[:11] + "17:00:00Z",
		}
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), body, token))
		require.Equal(t, http.StatusCreated, w.Code)
	}

	// Filter to May only.
	url := fmt.Sprintf("/teams/%s/activities?from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z", teamID)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, url, nil, token))
	assert.Equal(t, http.StatusOK, w.Code)

	var acts []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&acts))
	assert.Len(t, acts, 2)
}

func TestListActivities_InvalidFromParam(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/activities?from=not-a-date", teamID), nil, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateActivity_Success(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	// Create an activity.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID),
		map[string]any{
			"title":   "Original Title",
			"startAt": "2026-05-05T09:00:00Z",
			"endAt":   "2026-05-05T10:00:00Z",
		}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	activityID := created["id"].(string)

	// Patch the title.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/activities/%s", activityID),
		map[string]any{"title": "Updated Title"}, token))
	assert.Equal(t, http.StatusOK, w2.Code)

	var updated map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&updated))
	assert.Equal(t, "Updated Title", updated["title"])
	// Start/end should be unchanged.
	assert.Equal(t, created["startAt"], updated["startAt"])
}

func TestUpdateActivity_NotFound(t *testing.T) {
	srv, token, _ := activityTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, "/activities/nonexistent-id",
		map[string]any{"title": "Whatever"}, token))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateActivity_EndBeforeStart(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID),
		map[string]any{
			"title":   "Original",
			"startAt": "2026-05-05T09:00:00Z",
			"endAt":   "2026-05-05T10:00:00Z",
		}, token))
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	activityID := created["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/activities/%s", activityID),
		map[string]any{"endAt": "2026-05-05T08:00:00Z"}, token))
	assert.Equal(t, http.StatusBadRequest, w2.Code)
}

func TestDeleteActivity_Success(t *testing.T) {
	srv, token, teamID := activityTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID),
		map[string]any{
			"title":   "To Delete",
			"startAt": "2026-05-05T09:00:00Z",
			"endAt":   "2026-05-05T10:00:00Z",
		}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	activityID := created["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodDelete, fmt.Sprintf("/activities/%s", activityID), nil, token))
	assert.Equal(t, http.StatusNoContent, w2.Code)

	// Activity no longer appears in the list.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/activities", teamID), nil, token))
	var acts []map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&acts))
	assert.Empty(t, acts)
}

func TestDeleteActivity_NotFound(t *testing.T) {
	srv, token, _ := activityTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete, "/activities/nonexistent-id", nil, token))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// activityTestSetupWithBus is like activityTestSetup but also returns the bus
// so tests can assert that activity mutations publish the correct messages.
func activityTestSetupWithBus(t *testing.T) (srv http.Handler, aliceToken, teamID string, bus *events.Bus) {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	activitiesRepo := db.NewActivityRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("activity-test-secret")
	bus = events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	isr := db.NewInstanceSettingsRepo(database)
	srv = api.NewServer(users, invites, teams, activitiesRepo, timelinesRepo, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isr, db.NewPasswordResetTokenRepo(database), db.NewStatusRepo(database), mailer.New(isr, nil), tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ = seedUser(t, srv, "alice@bustest.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Bus Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)
	return srv, aliceToken, teamID, bus
}

func TestCreateActivity_PublishesBusMessage(t *testing.T) {
	srv, token, teamID, bus := activityTestSetupWithBus(t)
	ch := bus.Subscribe()
	defer bus.Unsubscribe(ch)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), map[string]any{
		"title": "Bus Test", "startAt": "2026-05-05T09:00:00Z", "endAt": "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)

	select {
	case msg := <-ch:
		assert.Equal(t, events.ActivityCreated, msg.Type)
		assert.Equal(t, teamID, msg.TeamID)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("bus did not receive ActivityCreated within timeout")
	}
}

func TestUpdateActivity_PublishesBusMessage(t *testing.T) {
	srv, token, teamID, bus := activityTestSetupWithBus(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), map[string]any{
		"title": "Original", "startAt": "2026-05-05T09:00:00Z", "endAt": "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	activityID := created["id"].(string)

	ch := bus.Subscribe()
	defer bus.Unsubscribe(ch)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/activities/%s", activityID), map[string]any{"title": "Updated"}, token))
	require.Equal(t, http.StatusOK, w2.Code)

	select {
	case msg := <-ch:
		assert.Equal(t, events.ActivityUpdated, msg.Type)
		assert.Equal(t, teamID, msg.TeamID)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("bus did not receive ActivityUpdated within timeout")
	}
}

func TestDeleteActivity_PublishesBusMessage(t *testing.T) {
	srv, token, teamID, bus := activityTestSetupWithBus(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), map[string]any{
		"title": "To Delete", "startAt": "2026-05-05T09:00:00Z", "endAt": "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	activityID := created["id"].(string)

	ch := bus.Subscribe()
	defer bus.Unsubscribe(ch)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodDelete, fmt.Sprintf("/activities/%s", activityID), nil, token))
	require.Equal(t, http.StatusNoContent, w2.Code)

	select {
	case msg := <-ch:
		assert.Equal(t, events.ActivityDeleted, msg.Type)
		assert.Equal(t, teamID, msg.TeamID)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("bus did not receive ActivityDeleted within timeout")
	}
}

func TestActivityCRUD_NonMemberForbidden(t *testing.T) {
	srv, aliceToken, teamID := activityTestSetup(t)

	// Create an activity as Alice.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID),
		map[string]any{
			"title":   "Alice's Activity",
			"startAt": "2026-05-05T09:00:00Z",
			"endAt":   "2026-05-05T10:00:00Z",
		}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	activityID := created["id"].(string)

	// Register an outsider - not a member of the activities team.
	outsiderToken := seedNonMember(t, srv, aliceToken, "outsider@activity.com", "Outsider")

	// All activity operations should return 403 for the outsider.
	for _, tc := range []struct {
		method, path string
		body         any
	}{
		{http.MethodGet, fmt.Sprintf("/teams/%s/activities", teamID), nil},
		{http.MethodPost, fmt.Sprintf("/teams/%s/activities", teamID), map[string]any{
			"title": "x", "startAt": time.Now().Format(time.RFC3339),
			"endAt": time.Now().Add(time.Hour).Format(time.RFC3339),
		}},
		{http.MethodPatch, fmt.Sprintf("/activities/%s", activityID), map[string]any{"title": "y"}},
		{http.MethodDelete, fmt.Sprintf("/activities/%s", activityID), nil},
	} {
		wr := httptest.NewRecorder()
		srv.ServeHTTP(wr, authReq(tc.method, tc.path, tc.body, outsiderToken))
		assert.Equal(t, http.StatusForbidden, wr.Code, "expected 403 for %s %s", tc.method, tc.path)
	}
}

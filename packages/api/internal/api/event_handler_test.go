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
	"github.com/I0-1O/draba/packages/api/internal/tier"
	"github.com/I0-1O/draba/packages/api/internal/ws"
)

// eventTestSetup creates a server, registers Alice, creates a team, and
// returns the handler, Alice's token, and the team ID.
func eventTestSetup(t *testing.T) (srv http.Handler, aliceToken, teamID string) {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	eventsRepo := db.NewEventRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("event-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	srv = api.NewServer(users, invites, teams, eventsRepo, timelinesRepo, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ = seedUser(t, srv, "alice@event.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Events Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)
	return srv, aliceToken, teamID
}

func TestCreateEvent_Success(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	body := map[string]any{
		"title":   "Sprint Planning",
		"startAt": "2026-05-05T09:00:00Z",
		"endAt":   "2026-05-05T10:00:00Z",
		"allDay":  false,
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), body, token))

	assert.Equal(t, http.StatusCreated, w.Code)
	var event map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&event))
	assert.Equal(t, "Sprint Planning", event["title"])
	assert.Equal(t, teamID, event["teamId"])
	assert.NotEmpty(t, event["id"])
}

func TestCreateEvent_MissingTitle(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	body := map[string]any{
		"startAt": "2026-05-05T09:00:00Z",
		"endAt":   "2026-05-05T10:00:00Z",
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), body, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateEvent_EndBeforeStart(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	body := map[string]any{
		"title":   "Backwards Event",
		"startAt": "2026-05-05T10:00:00Z",
		"endAt":   "2026-05-05T09:00:00Z",
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), body, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListEvents_NoFilter(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	for _, title := range []string{"Alpha", "Beta", "Gamma"} {
		body := map[string]any{
			"title":   title,
			"startAt": "2026-05-10T09:00:00Z",
			"endAt":   "2026-05-10T17:00:00Z",
		}
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), body, token))
		require.Equal(t, http.StatusCreated, w.Code)
	}

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/events", teamID), nil, token))
	assert.Equal(t, http.StatusOK, w.Code)

	var events []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&events))
	assert.Len(t, events, 3)
}

func TestListEvents_DateRangeFilter(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	// Three events: one in April, two in May.
	for _, startAt := range []string{
		"2026-04-15T09:00:00Z",
		"2026-05-10T09:00:00Z",
		"2026-05-20T09:00:00Z",
	} {
		body := map[string]any{
			"title":   "Event on " + startAt[:10],
			"startAt": startAt,
			"endAt":   startAt[:11] + "17:00:00Z",
		}
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), body, token))
		require.Equal(t, http.StatusCreated, w.Code)
	}

	// Filter to May only.
	url := fmt.Sprintf("/teams/%s/events?from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z", teamID)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, url, nil, token))
	assert.Equal(t, http.StatusOK, w.Code)

	var events []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&events))
	assert.Len(t, events, 2)
}

func TestListEvents_InvalidFromParam(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/events?from=not-a-date", teamID), nil, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateEvent_Success(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	// Create an event.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID),
		map[string]any{
			"title":   "Original Title",
			"startAt": "2026-05-05T09:00:00Z",
			"endAt":   "2026-05-05T10:00:00Z",
		}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	eventID := created["id"].(string)

	// Patch the title.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/events/%s", eventID),
		map[string]any{"title": "Updated Title"}, token))
	assert.Equal(t, http.StatusOK, w2.Code)

	var updated map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&updated))
	assert.Equal(t, "Updated Title", updated["title"])
	// Start/end should be unchanged.
	assert.Equal(t, created["startAt"], updated["startAt"])
}

func TestUpdateEvent_NotFound(t *testing.T) {
	srv, token, _ := eventTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, "/events/nonexistent-id",
		map[string]any{"title": "Whatever"}, token))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateEvent_EndBeforeStart(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID),
		map[string]any{
			"title":   "Original",
			"startAt": "2026-05-05T09:00:00Z",
			"endAt":   "2026-05-05T10:00:00Z",
		}, token))
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	eventID := created["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/events/%s", eventID),
		map[string]any{"endAt": "2026-05-05T08:00:00Z"}, token))
	assert.Equal(t, http.StatusBadRequest, w2.Code)
}

func TestDeleteEvent_Success(t *testing.T) {
	srv, token, teamID := eventTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID),
		map[string]any{
			"title":   "To Delete",
			"startAt": "2026-05-05T09:00:00Z",
			"endAt":   "2026-05-05T10:00:00Z",
		}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	eventID := created["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodDelete, fmt.Sprintf("/events/%s", eventID), nil, token))
	assert.Equal(t, http.StatusNoContent, w2.Code)

	// Event no longer appears in the list.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/events", teamID), nil, token))
	var events []map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&events))
	assert.Empty(t, events)
}

func TestDeleteEvent_NotFound(t *testing.T) {
	srv, token, _ := eventTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete, "/events/nonexistent-id", nil, token))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// eventTestSetupWithBus is like eventTestSetup but also returns the bus so
// tests can assert that event mutations publish the correct messages.
func eventTestSetupWithBus(t *testing.T) (srv http.Handler, aliceToken, teamID string, bus *events.Bus) {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	eventsRepo := db.NewEventRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("event-test-secret")
	bus = events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	srv = api.NewServer(users, invites, teams, eventsRepo, timelinesRepo, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ = seedUser(t, srv, "alice@bustest.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Bus Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)
	return srv, aliceToken, teamID, bus
}

func TestCreateEvent_PublishesBusMessage(t *testing.T) {
	srv, token, teamID, bus := eventTestSetupWithBus(t)
	ch := bus.Subscribe()
	defer bus.Unsubscribe(ch)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), map[string]any{
		"title": "Bus Test", "startAt": "2026-05-05T09:00:00Z", "endAt": "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)

	select {
	case msg := <-ch:
		assert.Equal(t, events.EventCreated, msg.Type)
		assert.Equal(t, teamID, msg.TeamID)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("bus did not receive EventCreated within timeout")
	}
}

func TestUpdateEvent_PublishesBusMessage(t *testing.T) {
	srv, token, teamID, bus := eventTestSetupWithBus(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), map[string]any{
		"title": "Original", "startAt": "2026-05-05T09:00:00Z", "endAt": "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	eventID := created["id"].(string)

	ch := bus.Subscribe()
	defer bus.Unsubscribe(ch)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/events/%s", eventID), map[string]any{"title": "Updated"}, token))
	require.Equal(t, http.StatusOK, w2.Code)

	select {
	case msg := <-ch:
		assert.Equal(t, events.EventUpdated, msg.Type)
		assert.Equal(t, teamID, msg.TeamID)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("bus did not receive EventUpdated within timeout")
	}
}

func TestDeleteEvent_PublishesBusMessage(t *testing.T) {
	srv, token, teamID, bus := eventTestSetupWithBus(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), map[string]any{
		"title": "To Delete", "startAt": "2026-05-05T09:00:00Z", "endAt": "2026-05-05T10:00:00Z",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	eventID := created["id"].(string)

	ch := bus.Subscribe()
	defer bus.Unsubscribe(ch)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodDelete, fmt.Sprintf("/events/%s", eventID), nil, token))
	require.Equal(t, http.StatusNoContent, w2.Code)

	select {
	case msg := <-ch:
		assert.Equal(t, events.EventDeleted, msg.Type)
		assert.Equal(t, teamID, msg.TeamID)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("bus did not receive EventDeleted within timeout")
	}
}

func TestEventCRUD_NonMemberForbidden(t *testing.T) {
	srv, aliceToken, teamID := eventTestSetup(t)

	// Create an event as Alice.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID),
		map[string]any{
			"title":   "Alice's Event",
			"startAt": "2026-05-05T09:00:00Z",
			"endAt":   "2026-05-05T10:00:00Z",
		}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	eventID := created["id"].(string)

	// Mint a token for an unknown user (not a team member).
	outsiderTokens := auth.NewTokenService("event-test-secret")
	outsiderToken, _ := outsiderTokens.IssueAccessToken("outsider-id", "outsider@example.com")

	// All event operations should return 403 for the outsider.
	for _, tc := range []struct {
		method, path string
		body         any
	}{
		{http.MethodGet, fmt.Sprintf("/teams/%s/events", teamID), nil},
		{http.MethodPost, fmt.Sprintf("/teams/%s/events", teamID), map[string]any{
			"title": "x", "startAt": time.Now().Format(time.RFC3339),
			"endAt": time.Now().Add(time.Hour).Format(time.RFC3339),
		}},
		{http.MethodPatch, fmt.Sprintf("/events/%s", eventID), map[string]any{"title": "y"}},
		{http.MethodDelete, fmt.Sprintf("/events/%s", eventID), nil},
	} {
		wr := httptest.NewRecorder()
		srv.ServeHTTP(wr, authReq(tc.method, tc.path, tc.body, outsiderToken))
		assert.Equal(t, http.StatusForbidden, wr.Code, "expected 403 for %s %s", tc.method, tc.path)
	}
}

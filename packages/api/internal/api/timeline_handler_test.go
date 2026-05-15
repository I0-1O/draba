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

// timelineTestSetup creates an in-memory server, registers Alice, creates a
// team, and returns the handler, Alice's token, and the team ID.
func timelineTestSetup(t *testing.T) (srv http.Handler, aliceToken, teamID string) {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	eventsRepo := db.NewEventRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("timeline-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	srv = api.NewServer(users, invites, teams, eventsRepo, timelinesRepo, tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ = seedUser(t, srv, "alice@timeline.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Timeline Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)
	return srv, aliceToken, teamID
}

func TestCreateTimeline_Success(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	body := map[string]any{
		"name":       "Q2 Roadmap",
		"startDate":  "2026-04-01",
		"endDate":    "2026-06-30",
		"visibility": "public",
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), body, token))

	assert.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	assert.Equal(t, "Q2 Roadmap", tl["name"])
	assert.Equal(t, teamID, tl["teamId"])
	assert.Equal(t, "public", tl["visibility"])
	assert.NotEmpty(t, tl["id"])
	assert.NotEmpty(t, tl["shareToken"])
	assert.NotEmpty(t, tl["icalToken"])
}

func TestCreateTimeline_DefaultVisibilityPublic(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	body := map[string]any{
		"name":      "Implicit Public",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), body, token))

	assert.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	assert.Equal(t, "public", tl["visibility"])
}

func TestCreateTimeline_MissingName(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID),
		map[string]any{"startDate": "2026-01-01", "endDate": "2026-12-31"}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateTimeline_EndBeforeStart(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Backwards",
		"startDate": "2026-06-01",
		"endDate":   "2026-01-01",
	}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateTimeline_NonMemberForbidden(t *testing.T) {
	srv, _, teamID := timelineTestSetup(t)

	outsiderTokens := auth.NewTokenService("timeline-test-secret")
	outsiderToken, _ := outsiderTokens.IssueAccessToken("outsider-id", "outsider@example.com")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Sneaky",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, outsiderToken))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestGetTimeline_Success(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	// Create a timeline.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Fetch Me",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	timelineID := created["id"].(string)

	// Fetch it.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, token))
	assert.Equal(t, http.StatusOK, w2.Code)

	var fetched map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&fetched))
	assert.Equal(t, timelineID, fetched["id"])
	assert.Equal(t, "Fetch Me", fetched["name"])
}

func TestGetTimeline_NotFound(t *testing.T) {
	srv, token, _ := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/timelines/nonexistent-id", nil, token))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetTimeline_NonMemberForbidden(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Alice's TL",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	timelineID := created["id"].(string)

	outsiderTokens := auth.NewTokenService("timeline-test-secret")
	outsiderToken, _ := outsiderTokens.IssueAccessToken("outsider-id", "outsider@example.com")

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, outsiderToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)
}

func TestGetTimeline_RestrictedAccessForbidden(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	// Alice creates a restricted timeline.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":       "Secret Plan",
		"startDate":  "2026-01-01",
		"endDate":    "2026-12-31",
		"visibility": "restricted",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	timelineID := created["id"].(string)

	// A user not on the access list (here: a non-member with a valid JWT) is rejected.
	outsiderTokens := auth.NewTokenService("timeline-test-secret")
	outsiderToken, _ := outsiderTokens.IssueAccessToken("random-user-id", "random@example.com")

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, outsiderToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)
}

func TestGetTimeline_RestrictedCreatorCanAccess(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	// Alice creates a restricted timeline; she should be auto-granted access.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":       "Restricted But Mine",
		"startDate":  "2026-01-01",
		"endDate":    "2026-12-31",
		"visibility": "restricted",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	timelineID := created["id"].(string)

	// Alice can fetch her own restricted timeline.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, aliceToken))
	assert.Equal(t, http.StatusOK, w2.Code)
}

func TestGetTimeline_PublicShareToken(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	// Create a timeline and capture its shareToken.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Public Plan",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	shareToken := created["shareToken"].(string)

	// Fetch via share token — no auth header.
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/timelines/share/%s", shareToken), http.NoBody)
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, req)
	assert.Equal(t, http.StatusOK, w2.Code)

	var fetched map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&fetched))
	assert.Equal(t, created["id"], fetched["id"])
	assert.Equal(t, "Public Plan", fetched["name"])
}

func TestGetTimeline_InvalidShareToken(t *testing.T) {
	srv, _, _ := timelineTestSetup(t)

	req := httptest.NewRequest(http.MethodGet, "/timelines/share/totally-invalid-token", http.NoBody)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestCreateTimeline_PublishesBusMessage(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	eventsRepo := db.NewEventRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("timeline-bus-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	srv := api.NewServer(users, invites, teams, eventsRepo, timelinesRepo, tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ := seedUser(t, srv, "alice@tlbus.com", "password1", "Alice")

	wTeam := httptest.NewRecorder()
	srv.ServeHTTP(wTeam, authReq(http.MethodPost, "/teams", map[string]string{"name": "Bus TL Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, wTeam.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(wTeam.Body).Decode(&team))
	teamID := team["id"].(string)

	ch := bus.Subscribe()
	defer bus.Unsubscribe(ch)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Bus Test TL",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)

	select {
	case msg := <-ch:
		assert.Equal(t, events.TimelineCreated, msg.Type)
		assert.Equal(t, teamID, msg.TeamID)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("bus did not receive TimelineCreated within timeout")
	}
}

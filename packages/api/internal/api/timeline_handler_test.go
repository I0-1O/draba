package api_test

import (
	"encoding/json"
	"errors"
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
	"github.com/I0-1O/draba/packages/api/internal/models"
	"github.com/I0-1O/draba/packages/api/internal/tier"
	"github.com/I0-1O/draba/packages/api/internal/ws"
)

// fakeTimelineStore wraps a real TimelineRepo and lets tests inject errors for
// specific methods. Zero value delegates everything to the real repo.
type fakeTimelineStore struct {
	real           *db.TimelineRepo
	grantAccessErr error
}

func (f *fakeTimelineStore) Create(t *models.Timeline) error {
	return f.real.Create(t)
}
func (f *fakeTimelineStore) GetByID(id string) (*models.Timeline, error) {
	return f.real.GetByID(id)
}
func (f *fakeTimelineStore) GetByShareToken(token string) (*models.Timeline, error) {
	return f.real.GetByShareToken(token)
}
func (f *fakeTimelineStore) HasAccess(timelineID, teamMemberID string) (bool, error) {
	return f.real.HasAccess(timelineID, teamMemberID)
}
func (f *fakeTimelineStore) ListByTeam(teamID string, includeArchived bool) ([]*models.Timeline, error) {
	return f.real.ListByTeam(teamID, includeArchived)
}
func (f *fakeTimelineStore) SetArchived(id string, at *time.Time) error {
	return f.real.SetArchived(id, at)
}
func (f *fakeTimelineStore) GrantAccess(timelineID, teamMemberID, role string) error {
	if f.grantAccessErr != nil {
		return f.grantAccessErr
	}
	return f.real.GrantAccess(timelineID, teamMemberID, role)
}
func (f *fakeTimelineStore) RevokeAccess(timelineID, teamMemberID string) error {
	return f.real.RevokeAccess(timelineID, teamMemberID)
}
func (f *fakeTimelineStore) GetAccessRole(timelineID, teamMemberID string) (string, error) {
	return f.real.GetAccessRole(timelineID, teamMemberID)
}
func (f *fakeTimelineStore) ListAccess(timelineID string) ([]*models.TimelineAccessEntry, error) {
	return f.real.ListAccess(timelineID)
}
func (f *fakeTimelineStore) Update(t *models.Timeline) error {
	return f.real.Update(t)
}
func (f *fakeTimelineStore) Delete(id string) error {
	return f.real.Delete(id)
}

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
	activitiesRepo := db.NewActivityRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("timeline-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	isrTl := db.NewInstanceSettingsRepo(database)
	srv = api.NewServer(users, invites, teams, activitiesRepo, timelinesRepo, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isrTl, db.NewPasswordResetTokenRepo(database), db.NewStatusRepo(database), db.NewTagRepo(database), db.NewShareRepo(database), mailer.New(isrTl, nil), tokens, tier.Unlimited, bus, hub).Routes()

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
		"name":      "Q2 Roadmap",
		"startDate": "2026-04-01",
		"endDate":   "2026-06-30",
	}
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), body, token))

	assert.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	assert.Equal(t, "Q2 Roadmap", tl["name"])
	assert.Equal(t, teamID, tl["teamId"])
	assert.NotEmpty(t, tl["id"])
	assert.NotEmpty(t, tl["shareToken"])
	assert.NotEmpty(t, tl["icalToken"])
	assert.Nil(t, tl["visibility"], "visibility was removed in the RBAC refactor")
}

func TestCreateTimeline_CreatorCanAccess(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Creator Access",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	timelineID := tl["id"].(string)

	// Creator must be able to fetch their own timeline immediately after creation.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, token))
	assert.Equal(t, http.StatusOK, w2.Code)
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
	srv, aliceToken, teamID := timelineTestSetup(t)
	outsiderToken := seedNonMember(t, srv, aliceToken, "outsider@timeline.com", "Outsider")

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

	outsiderToken := seedNonMember(t, srv, aliceToken, "outsider@timeline.com", "Outsider")

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, outsiderToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)
}

func TestGetTimeline_NonTeamMemberAccessForbidden(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Secret Plan",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	timelineID := created["id"].(string)

	// User exists in this DB (registered via a scratch team) but is not on Alice's
	// team, so they are rejected regardless of timeline_access list entries.
	outsiderToken := seedNonMember(t, srv, aliceToken, "random@timeline.com", "Random")

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, outsiderToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)
}

func TestGetTimeline_TeamAdminCanAlwaysAccess(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	// Alice (team admin) creates a timeline; she should be able to access it.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Admin Timeline",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	timelineID := created["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, aliceToken))
	assert.Equal(t, http.StatusOK, w2.Code)
}

func TestGetTimeline_MemberWithoutAccessForbidden(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	// Alice (admin) creates a timeline and is auto-granted admin access.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Admin Only",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	timelineID := created["id"].(string)

	// Alice invites Bob as a regular member.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@member.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, w2.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob@member.com", "password2", "Bob", inv["token"].(string))

	// Bob is a team member but has no timeline_access entry - must be forbidden.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w3.Code)
}

func TestGetTimeline_MemberGrantedAccessAllowed(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	activitiesRepo := db.NewActivityRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("access-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })
	isrAcc := db.NewInstanceSettingsRepo(database)
	srv := api.NewServer(users, invites, teams, activitiesRepo, timelinesRepo,
		db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isrAcc, db.NewPasswordResetTokenRepo(database), db.NewStatusRepo(database), db.NewTagRepo(database), db.NewShareRepo(database), mailer.New(isrAcc, nil), tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ := seedUser(t, srv, "alice@access.com", "password1", "Alice")

	wTeam := httptest.NewRecorder()
	srv.ServeHTTP(wTeam, authReq(http.MethodPost, "/teams", map[string]string{"name": "Access Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, wTeam.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(wTeam.Body).Decode(&team))
	teamID := team["id"].(string)

	// Alice creates a timeline; she gets auto-granted admin access.
	wTL := httptest.NewRecorder()
	srv.ServeHTTP(wTL, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Shared Plan", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, wTL.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(wTL.Body).Decode(&tl))
	timelineID := tl["id"].(string)

	// Alice invites Bob as a member.
	wInv := httptest.NewRecorder()
	srv.ServeHTTP(wInv, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@access.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, wInv.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(wInv.Body).Decode(&inv))
	bobToken, bobID := seedUserWithInvite(t, srv, "bob@access.com", "password2", "Bob", inv["token"].(string))
	_ = bobToken

	// Grant Bob explicit timeline access via the repo (simulating an admin granting it).
	bobMember, err := teams.GetMember(teamID, bobID)
	require.NoError(t, err)
	require.NoError(t, timelinesRepo.GrantAccess(timelineID, bobMember.ID, "member"))

	// Bob can now fetch the timeline.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", timelineID), nil, bobToken))
	assert.Equal(t, http.StatusOK, w3.Code)
}

func TestListTimelines_Empty(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines", teamID), nil, token))

	assert.Equal(t, http.StatusOK, w.Code)
	var timelines []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&timelines))
	assert.Len(t, timelines, 0)
}

func TestListTimelines_ReturnsMembersTimelines(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	body := map[string]any{"name": "Q2 Plan", "startDate": "2026-04-01", "endDate": "2026-06-30"}
	wCreate := httptest.NewRecorder()
	srv.ServeHTTP(wCreate, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), body, token))
	require.Equal(t, http.StatusCreated, wCreate.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wCreate.Body).Decode(&created))

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines", teamID), nil, token))

	assert.Equal(t, http.StatusOK, w.Code)
	var timelines []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&timelines))
	require.Len(t, timelines, 1)
	assert.Equal(t, created["id"], timelines[0]["id"])
	assert.Equal(t, "Q2 Plan", timelines[0]["name"])
}

func TestListTimelines_NonMemberForbidden(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)
	outsiderToken := seedNonMember(t, srv, aliceToken, "outsider@timeline.com", "Outsider")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines", teamID), nil, outsiderToken))

	assert.Equal(t, http.StatusForbidden, w.Code)
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

	// Fetch via share token - no auth header.
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

func TestCreateTimeline_RestrictedGrantAccessError(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	activitiesRepo := db.NewActivityRepo(database)
	realTimelines := db.NewTimelineRepo(database)
	fake := &fakeTimelineStore{real: realTimelines, grantAccessErr: errors.New("injected DB error")}
	tokens := auth.NewTokenService("timeline-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	isrFake := db.NewInstanceSettingsRepo(database)
	srv := api.NewServer(users, invites, teams, activitiesRepo, fake, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isrFake, db.NewPasswordResetTokenRepo(database), db.NewStatusRepo(database), db.NewTagRepo(database), db.NewShareRepo(database), mailer.New(isrFake, nil), tokens, tier.Unlimited, bus, hub).Routes()

	aliceToken, _ := seedUser(t, srv, "alice@granterr.com", "password1", "Alice")

	wTeam := httptest.NewRecorder()
	srv.ServeHTTP(wTeam, authReq(http.MethodPost, "/teams", map[string]string{"name": "Grant Err Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, wTeam.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(wTeam.Body).Decode(&team))
	teamID := team["id"].(string)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name":      "Grant Fail",
		"startDate": "2026-01-01",
		"endDate":   "2026-12-31",
	}, aliceToken))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestCreateTimeline_PublishesBusMessage(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	activitiesRepo := db.NewActivityRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("timeline-bus-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	isrBus := db.NewInstanceSettingsRepo(database)
	srv := api.NewServer(users, invites, teams, activitiesRepo, timelinesRepo, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isrBus, db.NewPasswordResetTokenRepo(database), db.NewStatusRepo(database), db.NewTagRepo(database), db.NewShareRepo(database), mailer.New(isrBus, nil), tokens, tier.Unlimited, bus, hub).Routes()

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

// ── Phase 10.3 tests ──────────────────────────────────────────────────────────

func TestUpdateTimeline_AdminCanRename(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Original Name", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	id := tl["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/timelines/%s", id),
		map[string]any{"name": "Updated Name"}, token))
	assert.Equal(t, http.StatusOK, w2.Code)

	var updated map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&updated))
	assert.Equal(t, "Updated Name", updated["name"])
}

func TestUpdateTimeline_NonAdminForbidden(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Alice TL", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	id := tl["id"].(string)

	// Add Bob as member (not admin).
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@tl.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, w2.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob@tl.com", "password2", "Bob", inv["token"].(string))

	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPatch, fmt.Sprintf("/timelines/%s", id),
		map[string]any{"name": "Sneaky"}, bobToken))
	assert.Equal(t, http.StatusForbidden, w3.Code)
}

func TestDeleteTimeline_AdminCanDelete(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Doomed TL", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	id := tl["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodDelete, fmt.Sprintf("/timelines/%s", id), nil, token))
	assert.Equal(t, http.StatusNoContent, w2.Code)

	// Confirm it's gone.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, fmt.Sprintf("/timelines/%s", id), nil, token))
	assert.Equal(t, http.StatusNotFound, w3.Code)
}

func TestDeleteTimeline_NonAdminForbidden(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Alice TL2", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	id := tl["id"].(string)

	// Bob is a regular member.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob2@tl.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, w2.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob2@tl.com", "password2", "Bob2", inv["token"].(string))

	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodDelete, fmt.Sprintf("/timelines/%s", id), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w3.Code)
}

func TestArchiveTimeline_AdminCanArchiveAndUnarchive(t *testing.T) {
	srv, token, teamID := timelineTestSetup(t)

	// Create a timeline.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Archive Me", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	id := tl["id"].(string)

	// Archive it.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/archive", id), nil, token))
	assert.Equal(t, http.StatusOK, w2.Code)
	var archived map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&archived))
	assert.NotNil(t, archived["archivedAt"], "archivedAt should be set after archive")

	// Unarchive it.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/unarchive", id), nil, token))
	assert.Equal(t, http.StatusOK, w3.Code)
	var unarchived map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&unarchived))
	assert.Nil(t, unarchived["archivedAt"], "archivedAt should be nil after unarchive")
}

func TestArchiveTimeline_NonAdminForbidden(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	// Alice (admin) creates a timeline.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Admin Only Archive", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	id := tl["id"].(string)

	// Bob is a regular member — may not archive.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob4@tl.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, w2.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob4@tl.com", "password2", "Bob4", inv["token"].(string))

	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/archive", id), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w3.Code)
}

func TestArchiveTimeline_NotFound(t *testing.T) {
	srv, token, _ := timelineTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/timelines/nonexistent/archive", nil, token))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestTimelineAccessList_GrantAndRevoke(t *testing.T) {
	srv, aliceToken, teamID := timelineTestSetup(t)

	// Alice creates a timeline.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Access TL", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tl))
	timelineID := tl["id"].(string)

	// Add Bob as a member.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob3@tl.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, w2.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	_, bobID := seedUserWithInvite(t, srv, "bob3@tl.com", "password2", "Bob3", inv["token"].(string))

	// Look up Bob's team_member ID.
	wMembers := httptest.NewRecorder()
	srv.ServeHTTP(wMembers, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, wMembers.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(wMembers.Body).Decode(&members))
	var bobMemberID string
	for _, m := range members {
		if uid, _ := m["userId"].(string); uid == bobID {
			bobMemberID = m["id"].(string)
			break
		}
	}
	require.NotEmpty(t, bobMemberID)

	// Grant Bob access.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPut,
		fmt.Sprintf("/teams/%s/timelines/%s/access/%s", teamID, timelineID, bobMemberID),
		map[string]string{"role": "member"}, aliceToken))
	assert.Equal(t, http.StatusOK, w3.Code)

	// List access — should include Bob.
	w4 := httptest.NewRecorder()
	srv.ServeHTTP(w4, authReq(http.MethodGet,
		fmt.Sprintf("/teams/%s/timelines/%s/access", teamID, timelineID), nil, aliceToken))
	assert.Equal(t, http.StatusOK, w4.Code)
	var entries []map[string]any
	require.NoError(t, json.NewDecoder(w4.Body).Decode(&entries))
	// Alice (admin) was auto-granted at creation; Bob was just granted.
	found := false
	for _, e := range entries {
		if e["teamMemberId"] == bobMemberID {
			found = true
			assert.Equal(t, "member", e["role"])
		}
	}
	assert.True(t, found, "Bob's access entry not found")

	// Revoke Bob's access.
	w5 := httptest.NewRecorder()
	srv.ServeHTTP(w5, authReq(http.MethodDelete,
		fmt.Sprintf("/teams/%s/timelines/%s/access/%s", teamID, timelineID, bobMemberID),
		nil, aliceToken))
	assert.Equal(t, http.StatusNoContent, w5.Code)
}

package api_test

import (
	"bytes"
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
	"github.com/I0-1O/draba/packages/api/internal/models"
	"github.com/I0-1O/draba/packages/api/internal/tier"
	"github.com/I0-1O/draba/packages/api/internal/ws"
)

// newTeamTestServer builds an isolated in-memory server and returns both the
// handler and the token service so tests can mint tokens directly.
func newTeamTestServer(t *testing.T) (http.Handler, *auth.TokenService) {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	activitiesRepo := db.NewActivityRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("team-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	isr := db.NewInstanceSettingsRepo(database)
	srv := api.NewServer(users, invites, teams, activitiesRepo, timelinesRepo, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isr, db.NewPasswordResetTokenRepo(database), mailer.New(isr, nil), tokens, tier.Unlimited, bus, hub).Routes()
	return srv, tokens
}

// testServerEnv holds a test server and the repos that tests need to inject
// state directly (e.g. password reset tokens).
type testServerEnv struct {
	srv            http.Handler
	toks           *auth.TokenService
	passwordTokens *db.PasswordResetTokenRepo
}

// newTeamTestServerFull is like newTeamTestServer but also exposes repos that
// settings tests need to seed directly.
func newTeamTestServerFull(t *testing.T) *testServerEnv {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	activitiesRepo := db.NewActivityRepo(database)
	timelinesRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService("team-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	isr := db.NewInstanceSettingsRepo(database)
	pwr := db.NewPasswordResetTokenRepo(database)
	srv := api.NewServer(users, invites, teams, activitiesRepo, timelinesRepo, db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isr, pwr, mailer.New(isr, nil), tokens, tier.Unlimited, bus, hub).Routes()
	return &testServerEnv{srv: srv, toks: tokens, passwordTokens: pwr}
}

// seedUser registers and logs in a user, returning their access token and user ID.
func seedUser(t *testing.T, srv http.Handler, email, password, displayName string) (accessToken, userID string) {
	t.Helper()
	b, _ := json.Marshal(map[string]string{
		"email": email, "password": password, "displayName": displayName,
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, "seedUser register failed: %s", w.Body)

	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	user := resp["user"].(map[string]any)
	return resp["accessToken"].(string), user["id"].(string)
}

// seedUserWithInvite registers a second+ user using an invite token.
func seedUserWithInvite(t *testing.T, srv http.Handler, email, password, displayName, inviteToken string) (accessToken, userID string) {
	t.Helper()
	b, _ := json.Marshal(map[string]string{
		"email": email, "password": password, "displayName": displayName, "inviteToken": inviteToken,
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, "seedUserWithInvite failed: %s", w.Body)

	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	user := resp["user"].(map[string]any)
	return resp["accessToken"].(string), user["id"].(string)
}

// authReq wraps httptest.NewRequest with a Bearer token header.
func authReq(method, path string, body any, token string) *http.Request {
	var b []byte
	if body != nil {
		b, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

func TestCreateTeam_Success(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Engineering"}, token))

	assert.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	assert.Equal(t, "Engineering", team["name"])
	assert.NotEmpty(t, team["id"])
	assert.NotEmpty(t, team["slug"])
}

func TestCreateTeam_Unauthenticated(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	b, _ := json.Marshal(map[string]string{"name": "Engineering"})
	req := httptest.NewRequest(http.MethodPost, "/teams", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestCreateTeam_MissingName(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestInviteFlow_FullCycle(t *testing.T) {
	srv, _ := newTeamTestServer(t)

	// Alice registers and creates a team.
	aliceToken, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	// Alice sends an invite.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@example.com", "role": "member"}, aliceToken))
	require.Equal(t, http.StatusCreated, w2.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	inviteToken := inv["token"].(string)
	assert.NotEmpty(t, inviteToken)

	// Bob registers via the invite token.
	bobToken, _ := seedUserWithInvite(t, srv, "bob@example.com", "password2", "Bob", inviteToken)

	// Alice lists members — should see both Alice and Bob.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w3.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&members))
	assert.Len(t, members, 2)

	// Bob can also list members as a team member.
	w4 := httptest.NewRecorder()
	srv.ServeHTTP(w4, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, bobToken))
	assert.Equal(t, http.StatusOK, w4.Code)
}

func TestCreateInvite_NonAdminForbidden(t *testing.T) {
	srv, _ := newTeamTestServer(t)

	aliceToken, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	// Alice invites Bob as a regular member.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@example.com", "role": "member"}, aliceToken))
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob@example.com", "password2", "Bob", inv["token"].(string))

	// Bob (member) tries to send an invite — should be forbidden.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "carol@example.com"}, bobToken))
	assert.Equal(t, http.StatusForbidden, w3.Code)
}

func TestListMembers_NonMemberForbidden(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	aliceToken, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	// Create Alice's team.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	// Bob exists in this DB (registered via a scratch team) but is not on Acme.
	bobToken := seedNonMember(t, srv, aliceToken, "bob@example.com", "Bob")

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)
}

func TestListTeams_Unauthenticated(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/teams", http.NoBody)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestListTeams_Empty(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/teams", nil, token))

	assert.Equal(t, http.StatusOK, w.Code)
	var teams []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&teams))
	assert.Len(t, teams, 0)
}

func TestListTeams_ReturnsOwnTeams(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	wCreate := httptest.NewRecorder()
	srv.ServeHTTP(wCreate, authReq(http.MethodPost, "/teams", map[string]string{"name": "Engineering"}, token))
	require.Equal(t, http.StatusCreated, wCreate.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(wCreate.Body).Decode(&created))

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/teams", nil, token))

	assert.Equal(t, http.StatusOK, w.Code)
	var teams []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&teams))
	require.Len(t, teams, 1)
	assert.Equal(t, created["id"], teams[0]["id"])
	assert.Equal(t, "Engineering", teams[0]["name"])
}

func TestCreateTeam_SameNameAllowed(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	// Two teams with the same name are allowed — slugs include the team ID so
	// they never collide even when the names are identical.
	w1 := httptest.NewRecorder()
	srv.ServeHTTP(w1, authReq(http.MethodPost, "/teams", map[string]string{"name": "Engineering"}, token))
	require.Equal(t, http.StatusCreated, w1.Code)
	var t1 map[string]any
	require.NoError(t, json.NewDecoder(w1.Body).Decode(&t1))

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, "/teams", map[string]string{"name": "Engineering"}, token))
	require.Equal(t, http.StatusCreated, w2.Code)
	var t2 map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&t2))

	// Different IDs and different slugs despite identical names.
	assert.NotEqual(t, t1["id"], t2["id"])
	assert.NotEqual(t, t1["slug"], t2["slug"])
	assert.Equal(t, "Engineering", t1["name"])
	assert.Equal(t, "Engineering", t2["name"])
}

func TestUpdateTeam_Success(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Original"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	teamID := created["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/teams/%s", teamID),
		map[string]any{"name": "Renamed", "description": "A description"}, token))
	assert.Equal(t, http.StatusOK, w2.Code)
	var updated map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&updated))
	assert.Equal(t, "Renamed", updated["name"])
	assert.Equal(t, "A description", updated["description"])
}

func TestUpdateTeam_NonAdminForbidden(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	aliceToken, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@example.com", "role": "member"}, aliceToken))
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob@example.com", "password2", "Bob", inv["token"].(string))

	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPatch, fmt.Sprintf("/teams/%s", teamID),
		map[string]string{"name": "Hijacked"}, bobToken))
	assert.Equal(t, http.StatusForbidden, w3.Code)
}

func TestArchiveTeam_Success(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/archive", teamID), nil, token))
	assert.Equal(t, http.StatusOK, w2.Code)
	var archived map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&archived))
	assert.NotNil(t, archived["archivedAt"])

	// Default list excludes the archived team.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, "/teams", nil, token))
	var active []map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&active))
	assert.Len(t, active, 0)
}

func TestArchiveTeam_NonAdminForbidden(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	aliceToken, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", teamID),
		map[string]string{"email": "bob@example.com", "role": "member"}, aliceToken))
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&inv))
	bobToken, _ := seedUserWithInvite(t, srv, "bob@example.com", "password2", "Bob", inv["token"].(string))

	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/archive", teamID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w3.Code)
}

func TestUnarchiveTeam_Success(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	// Archive.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/archive", teamID), nil, token))
	require.Equal(t, http.StatusOK, w2.Code)

	// Unarchive.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/unarchive", teamID), nil, token))
	assert.Equal(t, http.StatusOK, w3.Code)
	var restored map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&restored))
	assert.Nil(t, restored["archivedAt"])

	// Active list now includes the team again.
	w4 := httptest.NewRecorder()
	srv.ServeHTTP(w4, authReq(http.MethodGet, "/teams", nil, token))
	var active []map[string]any
	require.NoError(t, json.NewDecoder(w4.Body).Decode(&active))
	assert.Len(t, active, 1)
}

func TestListTeams_IncludesArchivedWhenParamSet(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/archive", teamID), nil, token))
	require.Equal(t, http.StatusOK, w2.Code)

	// Without param: archived team is hidden.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, "/teams", nil, token))
	var active []map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&active))
	assert.Len(t, active, 0)

	// With ?archived=true: archived team is included.
	w4 := httptest.NewRecorder()
	srv.ServeHTTP(w4, authReq(http.MethodGet, "/teams?archived=true", nil, token))
	var all []map[string]any
	require.NoError(t, json.NewDecoder(w4.Body).Decode(&all))
	assert.Len(t, all, 1)
	assert.NotNil(t, all[0]["archivedAt"])
}

func TestGetTeam_Success(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	// Create a team.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	teamID := created["id"].(string)

	// Fetch the team.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/teams/%s", teamID), nil, token))
	assert.Equal(t, http.StatusOK, w2.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&team))
	assert.Equal(t, teamID, team["id"])
	assert.Equal(t, "Acme", team["name"])
}

func TestGetTeam_NonMember_Forbidden(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	aliceToken, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	// Create a team under Alice.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	// Bob exists in this DB (registered via a scratch team) but is not on Acme.
	bobToken := seedNonMember(t, srv, aliceToken, "bob@example.com", "Bob")

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/teams/%s", teamID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)
}

func TestTierTeamLimit(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	teamsRepo := db.NewTeamRepo(database)
	now := time.Now()
	for i := range 3 {
		require.NoError(t, teamsRepo.Create(&models.Team{
			ID:        fmt.Sprintf("team-%d", i),
			Name:      fmt.Sprintf("Team %d", i),
			Slug:      fmt.Sprintf("team-%d", i),
			CreatedAt: now,
			UpdatedAt: now,
		}))
	}

	users := db.NewUserRepo(database)
	toks2 := auth.NewTokenService("test-secret")
	bus2 := events.NewBus()
	hub2 := ws.NewHub(bus2, toks2, func(_, _ string) error { return nil })
	isr2 := db.NewInstanceSettingsRepo(database)
	srv := api.NewServer(
		users, db.NewInviteRepo(database), teamsRepo, db.NewActivityRepo(database), db.NewTimelineRepo(database),
		db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database),
		isr2, db.NewPasswordResetTokenRepo(database), mailer.New(isr2, nil), toks2, tier.Team, bus2, hub2,
	).Routes()

	// Register first user (no invite needed).
	aliceToken, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "New Team"}, aliceToken))
	assert.Equal(t, http.StatusPaymentRequired, w.Code)

	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	errObj := resp["error"].(map[string]any)
	assert.Equal(t, "TIER_TEAM_LIMIT", errObj["code"])
}

// ── Member management tests ───────────────────────────────────────────────────

// memberTestSetup returns a server, Alice's admin token, Bob's member token,
// and the shared team ID.
func memberTestSetup(t *testing.T) (srv http.Handler, aliceToken, bobToken, teamID string) {
	t.Helper()
	srv, _ = newTeamTestServer(t)
	aliceToken, _ = seedUser(t, srv, "alice@member.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)

	bobToken = addTeamMember(t, srv, aliceToken, teamID, "bob@member.com", "Bob")
	return srv, aliceToken, bobToken, teamID
}

func TestUpdateMember_RoleChange_AdminOnly(t *testing.T) {
	srv, aliceToken, bobToken, teamID := memberTestSetup(t)

	// Bob lists members to find his own member ID.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&members))

	var bobMemberID string
	for _, m := range members {
		if m["email"] == "bob@member.com" {
			bobMemberID = m["id"].(string)
		}
	}
	require.NotEmpty(t, bobMemberID)

	// Bob (member) tries to change his own role — forbidden.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/teams/%s/members/%s", teamID, bobMemberID),
		map[string]string{"role": "admin"}, bobToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)

	// Alice (admin) can change Bob's role.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPatch, fmt.Sprintf("/teams/%s/members/%s", teamID, bobMemberID),
		map[string]string{"role": "admin"}, aliceToken))
	assert.Equal(t, http.StatusOK, w3.Code)
	var updated map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&updated))
	assert.Equal(t, "admin", updated["role"])
}

func TestDeleteMember_LastAdminBlocked(t *testing.T) {
	srv, aliceToken, _, teamID := memberTestSetup(t)

	// Get Alice's member ID.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&members))

	var aliceMemberID string
	for _, m := range members {
		if m["role"] == "admin" {
			aliceMemberID = m["id"].(string)
		}
	}
	require.NotEmpty(t, aliceMemberID)

	// Alice is the sole admin — deleting her should return LAST_ADMIN.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodDelete, fmt.Sprintf("/teams/%s/members/%s", teamID, aliceMemberID),
		nil, aliceToken))
	assert.Equal(t, http.StatusConflict, w2.Code)
	var body map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&body))
	assert.Equal(t, "LAST_ADMIN", body["error"].(map[string]any)["code"])
}

func TestDeleteMember_Success(t *testing.T) {
	srv, aliceToken, _, teamID := memberTestSetup(t)

	// Find Bob's member ID.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&members))

	var bobMemberID string
	for _, m := range members {
		if m["email"] == "bob@member.com" {
			bobMemberID = m["id"].(string)
		}
	}
	require.NotEmpty(t, bobMemberID)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodDelete, fmt.Sprintf("/teams/%s/members/%s", teamID, bobMemberID),
		nil, aliceToken))
	assert.Equal(t, http.StatusNoContent, w2.Code)

	// Verify member count dropped.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	var remaining []map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&remaining))
	assert.Len(t, remaining, 1)
}

func TestArchiveMember_LastAdminBlocked(t *testing.T) {
	srv, aliceToken, _, teamID := memberTestSetup(t)

	// Get Alice's member ID (sole admin).
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&members))

	var aliceMemberID string
	for _, m := range members {
		if m["role"] == "admin" {
			aliceMemberID = m["id"].(string)
		}
	}
	require.NotEmpty(t, aliceMemberID)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/members/%s/archive", teamID, aliceMemberID),
		nil, aliceToken))
	assert.Equal(t, http.StatusConflict, w2.Code)
	var body map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&body))
	assert.Equal(t, "LAST_ADMIN", body["error"].(map[string]any)["code"])
}

func TestArchiveAndUnarchiveMember(t *testing.T) {
	srv, aliceToken, _, teamID := memberTestSetup(t)

	// Find Bob's member ID.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&members))

	var bobMemberID string
	for _, m := range members {
		if m["email"] == "bob@member.com" {
			bobMemberID = m["id"].(string)
		}
	}
	require.NotEmpty(t, bobMemberID)

	// Archive Bob.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/members/%s/archive", teamID, bobMemberID),
		nil, aliceToken))
	assert.Equal(t, http.StatusOK, w2.Code)
	var archived map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&archived))
	assert.NotNil(t, archived["archivedAt"])

	// Unarchive Bob.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/members/%s/unarchive", teamID, bobMemberID),
		nil, aliceToken))
	assert.Equal(t, http.StatusOK, w3.Code)
	var reactivated map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&reactivated))
	assert.Nil(t, reactivated["archivedAt"])
}

func TestGetMemberStats_Success(t *testing.T) {
	srv, aliceToken, _, teamID := memberTestSetup(t)

	// Get Bob's member ID.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, w.Code)
	var members []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&members))

	var bobMemberID string
	for _, m := range members {
		if m["email"] == "bob@member.com" {
			bobMemberID = m["id"].(string)
		}
	}
	require.NotEmpty(t, bobMemberID)

	// Standalone stats endpoint.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members/%s/stats", teamID, bobMemberID),
		nil, aliceToken))
	assert.Equal(t, http.StatusOK, w2.Code)
	var stats map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&stats))
	// All stat fields present and numeric.
	assert.Contains(t, stats, "activeTimelines")
	assert.Contains(t, stats, "running")
	assert.Contains(t, stats, "upcoming")
	assert.Contains(t, stats, "pastDue")
}

// ── Invite-link tests ─────────────────────────────────────────────────────────

func TestInviteLink_CreateGetReset(t *testing.T) {
	srv, aliceToken, bobToken, teamID := memberTestSetup(t)

	// No link yet — GET returns null token field.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/invite-link", teamID), nil, aliceToken))
	assert.Equal(t, http.StatusOK, w.Code)
	var linkResp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&linkResp))
	assert.Nil(t, linkResp["token"])

	// Create the invite link.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invite-link", teamID), nil, aliceToken))
	assert.Equal(t, http.StatusOK, w2.Code)
	var created map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&created))
	firstToken, ok := created["token"].(string)
	require.True(t, ok)
	assert.NotEmpty(t, firstToken)
	// Token should be 64 hex chars (256 bits).
	assert.Len(t, firstToken, 64)

	// Reset replaces the token.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invite-link/reset", teamID), nil, aliceToken))
	assert.Equal(t, http.StatusOK, w3.Code)
	var reset map[string]any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&reset))
	secondToken := reset["token"].(string)
	assert.NotEmpty(t, secondToken)
	assert.NotEqual(t, firstToken, secondToken, "reset must generate a new token")

	// Non-admin cannot manage the invite link.
	w4 := httptest.NewRecorder()
	srv.ServeHTTP(w4, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invite-link", teamID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w4.Code)
}

func TestInviteLink_Revoke(t *testing.T) {
	srv, aliceToken, _, teamID := memberTestSetup(t)

	// Create then revoke.
	wCreate := httptest.NewRecorder()
	srv.ServeHTTP(wCreate, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invite-link", teamID), nil, aliceToken))
	require.Equal(t, http.StatusOK, wCreate.Code)

	wDel := httptest.NewRecorder()
	srv.ServeHTTP(wDel, authReq(http.MethodDelete, fmt.Sprintf("/teams/%s/invite-link", teamID), nil, aliceToken))
	assert.Equal(t, http.StatusNoContent, wDel.Code)

	// Token should be null after revocation.
	wGet := httptest.NewRecorder()
	srv.ServeHTTP(wGet, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/invite-link", teamID), nil, aliceToken))
	assert.Equal(t, http.StatusOK, wGet.Code)
	var body map[string]any
	require.NoError(t, json.NewDecoder(wGet.Body).Decode(&body))
	assert.Nil(t, body["token"])
}

// ── User search tests ─────────────────────────────────────────────────────────

func TestSearchUsers_SafeFields(t *testing.T) {
	srv, aliceToken, _, teamID := memberTestSetup(t)
	_ = teamID

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/users/search?q=bob", nil, aliceToken))
	assert.Equal(t, http.StatusOK, w.Code)
	var results []map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&results))
	require.NotEmpty(t, results)

	for _, r := range results {
		assert.Contains(t, r, "id")
		assert.Contains(t, r, "email")
		assert.Contains(t, r, "displayName")
		// Sensitive or internal fields must not be present.
		assert.NotContains(t, r, "isSuperadmin")
		assert.NotContains(t, r, "archivedAt")
		assert.NotContains(t, r, "createdAt")
		assert.NotContains(t, r, "updatedAt")
		assert.NotContains(t, r, "passwordHash")
	}
}

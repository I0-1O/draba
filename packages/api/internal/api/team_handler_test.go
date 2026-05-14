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
	eventsRepo := db.NewEventRepo(database)
	tokens := auth.NewTokenService("team-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens)

	srv := api.NewServer(users, invites, teams, eventsRepo, tokens, tier.Unlimited, bus, hub).Routes()
	return srv, tokens
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

	// Register a second server user (Bob) who is NOT on Alice's team.
	// We need a separate server instance to avoid the invite requirement,
	// so we bypass by seeding directly via the DB.
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))
	users2 := db.NewUserRepo(database)
	require.NoError(t, users2.Create(&models.User{
		ID: "bob-id", Email: "bob@example.com", PasswordHash: "x",
		DisplayName: "Bob", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))
	bobTokens := auth.NewTokenService("team-test-secret")
	bobToken, _ := bobTokens.IssueAccessToken("bob-id", "bob@example.com")

	// Create team under Alice.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, aliceToken))
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	// Bob's token is valid JWT but Bob is not a team member — expect 403.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/members", teamID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w2.Code)
}

func TestCreateTeam_DuplicateSlug(t *testing.T) {
	srv, _ := newTeamTestServer(t)
	token, _ := seedUser(t, srv, "alice@example.com", "password1", "Alice")

	// First team succeeds.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Engineering"}, token))
	require.Equal(t, http.StatusCreated, w.Code)

	// Second team with same name produces the same slug — expect 409.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, "/teams", map[string]string{"name": "Engineering"}, token))
	assert.Equal(t, http.StatusConflict, w2.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&resp))
	errObj := resp["error"].(map[string]any)
	assert.Equal(t, "TEAM_NAME_TAKEN", errObj["code"])
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

	// Mint a valid JWT for Bob, who is not a member of Alice's team.
	bobTokens := auth.NewTokenService("team-test-secret")
	bobToken, _ := bobTokens.IssueAccessToken("bob-id", "bob@example.com")

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
	hub2 := ws.NewHub(bus2, toks2)
	srv := api.NewServer(
		users, db.NewInviteRepo(database), teamsRepo, db.NewEventRepo(database),
		toks2, tier.Team, bus2, hub2,
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

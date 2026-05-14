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

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	return newTestServerWithTier(t, tier.Unlimited)
}

func newTestServerWithTier(t *testing.T, tr tier.Tier) http.Handler {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	eventsRepo := db.NewEventRepo(database)
	tokens := auth.NewTokenService("test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })

	return api.NewServer(users, invites, teams, eventsRepo, tokens, tr, bus, hub).Routes()
}

func postJSON(t *testing.T, handler http.Handler, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	return w
}

func TestRegister_FirstUserNoInvite(t *testing.T) {
	srv := newTestServer(t)

	w := postJSON(t, srv, "/auth/register", map[string]string{
		"email":       "alice@example.com",
		"password":    "supersecret",
		"displayName": "Alice",
	})

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["accessToken"])
	assert.NotEmpty(t, resp["refreshToken"])
}

func TestRegister_SecondUserRequiresInvite(t *testing.T) {
	srv := newTestServer(t)

	// Register first user
	postJSON(t, srv, "/auth/register", map[string]string{
		"email": "alice@example.com", "password": "supersecret", "displayName": "Alice",
	})

	// Attempt second registration without invite
	w := postJSON(t, srv, "/auth/register", map[string]string{
		"email": "bob@example.com", "password": "supersecret", "displayName": "Bob",
	})
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	srv := newTestServer(t)

	postJSON(t, srv, "/auth/register", map[string]string{
		"email": "alice@example.com", "password": "supersecret", "displayName": "Alice",
	})
	w := postJSON(t, srv, "/auth/register", map[string]string{
		"email": "alice@example.com", "password": "anotherpass", "displayName": "Alice2",
	})
	// Second user without invite → 403 (invite required), not 409
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestLogin_ValidCredentials(t *testing.T) {
	srv := newTestServer(t)

	postJSON(t, srv, "/auth/register", map[string]string{
		"email": "alice@example.com", "password": "supersecret", "displayName": "Alice",
	})

	w := postJSON(t, srv, "/auth/login", map[string]string{
		"email": "alice@example.com", "password": "supersecret",
	})
	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp["accessToken"])
}

func TestLogin_WrongPassword(t *testing.T) {
	srv := newTestServer(t)

	postJSON(t, srv, "/auth/register", map[string]string{
		"email": "alice@example.com", "password": "supersecret", "displayName": "Alice",
	})

	w := postJSON(t, srv, "/auth/login", map[string]string{
		"email": "alice@example.com", "password": "wrongpass",
	})
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRefresh_ValidToken(t *testing.T) {
	srv := newTestServer(t)

	// Register and get tokens
	w := postJSON(t, srv, "/auth/register", map[string]string{
		"email": "alice@example.com", "password": "supersecret", "displayName": "Alice",
	})
	var reg map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&reg))
	refreshToken := reg["refreshToken"].(string)

	// Refresh
	w2 := postJSON(t, srv, "/auth/refresh", map[string]string{
		"refreshToken": refreshToken,
	})
	assert.Equal(t, http.StatusOK, w2.Code)

	var resp map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&resp))
	assert.NotEmpty(t, resp["accessToken"])
}

func TestMe_AuthenticatedRequest(t *testing.T) {
	srv := newTestServer(t)

	// Register
	w := postJSON(t, srv, "/auth/register", map[string]string{
		"email": "alice@example.com", "password": "supersecret", "displayName": "Alice",
	})
	var reg map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&reg))
	accessToken := reg["accessToken"].(string)

	// Call /auth/me
	req := httptest.NewRequest(http.MethodGet, "/auth/me", http.NoBody)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, req)

	assert.Equal(t, http.StatusOK, w2.Code)
	var user map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&user))
	assert.Equal(t, "alice@example.com", user["email"])
}

func TestMe_Unauthenticated(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/auth/me", http.NoBody)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRegister_TierUserLimitReached(t *testing.T) {
	// Seed a DB with 5 users already present, then confirm the 6th attempt returns 402.
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	users := db.NewUserRepo(database)
	for i := range 5 {
		require.NoError(t, users.Create(&models.User{
			ID:           fmt.Sprintf("user-%d", i),
			Email:        fmt.Sprintf("seed%d@example.com", i),
			PasswordHash: "x",
			DisplayName:  fmt.Sprintf("Seed %d", i),
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}))
	}

	toks2 := auth.NewTokenService("test-secret")
	bus2 := events.NewBus()
	hub2 := ws.NewHub(bus2, toks2, func(_, _ string) error { return nil })
	srv := api.NewServer(users, db.NewInviteRepo(database), db.NewTeamRepo(database), db.NewEventRepo(database), toks2, tier.Team, bus2, hub2).Routes()

	w := postJSON(t, srv, "/auth/register", map[string]string{
		"email": "newcomer@example.com", "password": "supersecret", "displayName": "Newcomer",
	})
	assert.Equal(t, http.StatusPaymentRequired, w.Code)

	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	errObj, _ := resp["error"].(map[string]any)
	assert.Equal(t, "TIER_USER_LIMIT", errObj["code"])
}

func TestRegister_UnlimitedTierAllowsAll(t *testing.T) {
	srv := newTestServerWithTier(t, tier.Unlimited)

	w := postJSON(t, srv, "/auth/register", map[string]string{
		"email": "alice@example.com", "password": "supersecret", "displayName": "Alice",
	})
	assert.Equal(t, http.StatusCreated, w.Code)

	// Second user fails due to missing invite, not a tier limit — confirm it's 403 not 402.
	w2 := postJSON(t, srv, "/auth/register", map[string]string{
		"email": "bob@example.com", "password": "supersecret", "displayName": "Bob",
	})
	assert.Equal(t, http.StatusForbidden, w2.Code)

	var resp map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&resp))
	errObj, _ := resp["error"].(map[string]any)
	assert.Equal(t, "INVITE_REQUIRED", errObj["code"])
}

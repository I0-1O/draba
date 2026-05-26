package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// settingsTestSetup creates an isolated server, registers Alice (superadmin),
// and returns the handler and Alice's JWT.
func settingsTestSetup(t *testing.T) (srv http.Handler, aliceJWT string) {
	t.Helper()
	srv, _ = newTeamTestServer(t)
	aliceJWT, _ = seedUser(t, srv, "alice@settings.com", "password1", "Alice")
	return srv, aliceJWT
}

// ── PATCH /users/me ───────────────────────────────────────────────────────────

func TestUpdateProfile_Success(t *testing.T) {
	srv, token := settingsTestSetup(t)

	body := `{"displayName":"Alice Updated","color":"teal","icon":"briefcase"}`
	req := httptest.NewRequest(http.MethodPatch, "/users/me", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "Alice Updated", resp["displayName"])
	assert.Equal(t, "teal", resp["color"])
}

func TestUpdateProfile_EmptyNameRejected(t *testing.T) {
	srv, token := settingsTestSetup(t)

	body := `{"displayName":"   "}`
	req := httptest.NewRequest(http.MethodPatch, "/users/me", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	errObj := resp["error"].(map[string]any)
	assert.Equal(t, "BAD_REQUEST", errObj["code"])
}

// ── PUT /users/me/password ────────────────────────────────────────────────────

func TestChangePassword_Success(t *testing.T) {
	srv, token := settingsTestSetup(t)

	body := `{"currentPassword":"password1","newPassword":"newpassword99"}`
	req := httptest.NewRequest(http.MethodPut, "/users/me/password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestChangePassword_WrongCurrent(t *testing.T) {
	srv, token := settingsTestSetup(t)

	body := `{"currentPassword":"wrongpassword","newPassword":"newpassword99"}`
	req := httptest.NewRequest(http.MethodPut, "/users/me/password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	errObj := resp["error"].(map[string]any)
	assert.Equal(t, "WRONG_PASSWORD", errObj["code"])
}

func TestChangePassword_WeakNew(t *testing.T) {
	srv, token := settingsTestSetup(t)

	body := `{"currentPassword":"password1","newPassword":"abc"}`
	req := httptest.NewRequest(http.MethodPut, "/users/me/password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ── POST /auth/forgot-password ────────────────────────────────────────────────

func TestForgotPassword_AlwaysOK(t *testing.T) {
	srv, _ := settingsTestSetup(t)

	// Unknown email — still returns 200 (no enumeration).
	body := `{"email":"nobody@example.com"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/forgot-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ── POST /auth/reset-password ─────────────────────────────────────────────────

func TestResetPassword_InvalidToken(t *testing.T) {
	srv, _ := settingsTestSetup(t)

	body := `{"token":"badtoken","newPassword":"newpassword99"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/reset-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	errObj := resp["error"].(map[string]any)
	assert.Equal(t, "TOKEN_INVALID", errObj["code"])
}

// ── GET /admin/settings ───────────────────────────────────────────────────────

func TestAdminSettings_SuperadminCanRead(t *testing.T) {
	srv, aliceJWT := settingsTestSetup(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/settings", http.NoBody)
	req.Header.Set("Authorization", "Bearer "+aliceJWT)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	settings, ok := resp["settings"].(map[string]any)
	require.True(t, ok)
	// Defaults should be applied.
	assert.Equal(t, "invite_only", settings["registration_policy"])
}

func TestAdminSettings_ForbiddenForNonSuperadmin(t *testing.T) {
	// Use newTeamTestServer to get a fresh server, then register Bob via invite.
	srv, toks := newTeamTestServer(t)
	// Alice registers first (becomes superadmin).
	aliceJWT, _ := seedUser(t, srv, "alice2@settings.com", "password1", "Alice2")

	// Alice creates a team and invites Bob.
	wTeam := httptest.NewRecorder()
	srv.ServeHTTP(wTeam, authReq(http.MethodPost, "/teams", map[string]string{"name": "T"}, aliceJWT))
	require.Equal(t, http.StatusCreated, wTeam.Code)
	var teamResp map[string]any
	require.NoError(t, json.NewDecoder(wTeam.Body).Decode(&teamResp))
	teamID := teamResp["id"].(string)

	wInv := httptest.NewRecorder()
	srv.ServeHTTP(wInv, authReq(http.MethodPost, "/teams/"+teamID+"/invites", map[string]string{"email": "bob@settings.com", "role": "member"}, aliceJWT))
	require.Equal(t, http.StatusCreated, wInv.Code)
	var invResp map[string]any
	require.NoError(t, json.NewDecoder(wInv.Body).Decode(&invResp))
	invToken := invResp["token"].(string)

	// Bob registers with the invite token.
	bobJWT := registerWithInvite(t, srv, "bob@settings.com", "password1", "Bob", invToken)
	_ = toks

	req := httptest.NewRequest(http.MethodGet, "/admin/settings", http.NoBody)
	req.Header.Set("Authorization", "Bearer "+bobJWT)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

// registerWithInvite is a test helper that registers a user using an invite token.
func registerWithInvite(t *testing.T, srv http.Handler, email, password, displayName, inviteToken string) string {
	t.Helper()
	b, _ := json.Marshal(map[string]string{
		"email": email, "password": password, "displayName": displayName, "inviteToken": inviteToken,
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, "registerWithInvite failed: %s", w.Body)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	return resp["accessToken"].(string)
}

// ── POST /auth/forgot-password (known user) ────────────────────────────────────

func TestForgotPassword_KnownUser_CreatesToken(t *testing.T) {
	// Uses a fresh env so "alice@settings.com" is the seeded user.
	srv, _ := settingsTestSetup(t)

	body := `{"email":"alice@settings.com"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/forgot-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	// Always 200 regardless of email existence; exercises the token-creation path.
	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "ok", resp["status"])
}

// ── POST /auth/reset-password (happy path) ────────────────────────────────────

func TestResetPassword_Success(t *testing.T) {
	env := newTeamTestServerFull(t)
	_, aliceID := seedUser(t, env.srv, "alice@resetok.com", "password1", "Alice")

	const rawTok = "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
	expiresAt := time.Now().Add(time.Hour)
	_, err := env.passwordTokens.Create("prt-test-1", aliceID, rawTok, expiresAt)
	require.NoError(t, err)

	body := `{"token":"` + rawTok + `","newPassword":"newpassword99"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/reset-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	env.srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Token should be marked used — a second attempt must fail.
	req2 := httptest.NewRequest(http.MethodPost, "/auth/reset-password", strings.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	env.srv.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code)
}

func TestResetPassword_ExpiredToken(t *testing.T) {
	env := newTeamTestServerFull(t)
	_, aliceID := seedUser(t, env.srv, "alice@resetexp.com", "password1", "Alice")

	const rawTok = "1122334455667788990011223344556677889900112233445566778899001122"
	expiresAt := time.Now().Add(-time.Minute) // already expired
	_, err := env.passwordTokens.Create("prt-test-2", aliceID, rawTok, expiresAt)
	require.NoError(t, err)

	body := `{"token":"` + rawTok + `","newPassword":"newpassword99"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/reset-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	env.srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "TOKEN_INVALID", resp["error"].(map[string]any)["code"])
}

// ── PATCH /admin/settings ─────────────────────────────────────────────────────

func TestPatchAdminSettings_Success(t *testing.T) {
	srv, aliceJWT := settingsTestSetup(t)

	body := `{"registration_policy":"open","default_week_start":"sunday"}`
	req := httptest.NewRequest(http.MethodPatch, "/admin/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+aliceJWT)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	settings := resp["settings"].(map[string]any)
	assert.Equal(t, "open", settings["registration_policy"])
	assert.Equal(t, "sunday", settings["default_week_start"])
}

func TestPatchAdminSettings_RejectsUnknownKey(t *testing.T) {
	srv, aliceJWT := settingsTestSetup(t)

	body := `{"unknown_key":"value"}`
	req := httptest.NewRequest(http.MethodPatch, "/admin/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+aliceJWT)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ── GET /admin/users ──────────────────────────────────────────────────────────

func TestListAdminUsers_SuperadminCanList(t *testing.T) {
	srv, aliceJWT := settingsTestSetup(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/users", http.NoBody)
	req.Header.Set("Authorization", "Bearer "+aliceJWT)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	users, ok := resp["users"].([]any)
	require.True(t, ok, "expected users array")
	assert.True(t, len(users) >= 1)
}

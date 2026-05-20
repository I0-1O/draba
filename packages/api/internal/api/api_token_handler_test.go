package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/auth"
)

// tokenTestSetup reuses the team test scaffolding and returns a fresh server
// plus a JWT for Alice (the first registered, superadmin user).
func tokenTestSetup(t *testing.T) (srv http.Handler, aliceJWT string) {
	t.Helper()
	srv, _ = newTeamTestServer(t)
	aliceJWT, _ = seedUser(t, srv, "alice@tokens.com", "password1", "Alice")
	return srv, aliceJWT
}

func TestAPIToken_CreateListRevoke(t *testing.T) {
	srv, jwt := tokenTestSetup(t)

	// Create a read-only token.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/tokens", map[string]string{
		"name":  "ci-readonly",
		"scope": "read",
	}, jwt))
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())

	var created map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
	raw, ok := created["token"].(string)
	require.True(t, ok, "raw token must be returned on create")
	assert.True(t, len(raw) > len(auth.APITokenPrefix), "raw token longer than prefix")
	id := created["id"].(string)
	assert.Equal(t, "read", created["scope"])

	// Listing returns the token, but never the raw value.
	wl := httptest.NewRecorder()
	srv.ServeHTTP(wl, authReq(http.MethodGet, "/tokens", nil, jwt))
	require.Equal(t, http.StatusOK, wl.Code)
	var list []map[string]any
	require.NoError(t, json.NewDecoder(wl.Body).Decode(&list))
	require.Len(t, list, 1)
	assert.Equal(t, id, list[0]["id"])
	_, hasRaw := list[0]["token"]
	assert.False(t, hasRaw, "listing must not include raw token")

	// Revoke + confirm idempotent.
	wd := httptest.NewRecorder()
	srv.ServeHTTP(wd, authReq(http.MethodDelete, "/tokens/"+id, nil, jwt))
	assert.Equal(t, http.StatusNoContent, wd.Code)
	wd2 := httptest.NewRecorder()
	srv.ServeHTTP(wd2, authReq(http.MethodDelete, "/tokens/"+id, nil, jwt))
	assert.Equal(t, http.StatusNoContent, wd2.Code)
}

func TestAPIToken_AuthAndScopeEnforcement(t *testing.T) {
	srv, jwt := tokenTestSetup(t)

	// Create a read-only token and a write token.
	mint := func(scope string) string {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, "/tokens",
			map[string]string{"name": scope, "scope": scope}, jwt))
		require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
		var resp map[string]any
		require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
		return resp["token"].(string)
	}
	readToken := mint("read")
	writeToken := mint("edit_all")

	// GET succeeds with read token.
	wGet := httptest.NewRecorder()
	srv.ServeHTTP(wGet, authReq(http.MethodGet, "/teams", nil, readToken))
	assert.Equal(t, http.StatusOK, wGet.Code, "read token must authenticate GET")

	// POST with read token is rejected with 403.
	wPost := httptest.NewRecorder()
	srv.ServeHTTP(wPost, authReq(http.MethodPost, "/teams",
		map[string]string{"name": "ReadOnly"}, readToken))
	assert.Equal(t, http.StatusForbidden, wPost.Code, "read token must be blocked from writes")

	// POST with write token succeeds.
	wPost2 := httptest.NewRecorder()
	srv.ServeHTTP(wPost2, authReq(http.MethodPost, "/teams",
		map[string]string{"name": "Writable"}, writeToken))
	assert.Equal(t, http.StatusCreated, wPost2.Code, "write-scope token must create teams")

	// API tokens cannot mint other API tokens.
	wMint := httptest.NewRecorder()
	srv.ServeHTTP(wMint, authReq(http.MethodPost, "/tokens",
		map[string]string{"name": "escalation", "scope": "edit_all"}, writeToken))
	assert.Equal(t, http.StatusForbidden, wMint.Code, "api tokens cannot mint api tokens")
}

func TestAPIToken_RevokedTokenRejected(t *testing.T) {
	srv, jwt := tokenTestSetup(t)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/tokens",
		map[string]string{"name": "soon-revoked", "scope": "edit_all"}, jwt))
	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	raw := resp["token"].(string)
	id := resp["id"].(string)

	// Revoke.
	wd := httptest.NewRecorder()
	srv.ServeHTTP(wd, authReq(http.MethodDelete, "/tokens/"+id, nil, jwt))
	require.Equal(t, http.StatusNoContent, wd.Code)

	// Subsequent use is 401.
	wUse := httptest.NewRecorder()
	srv.ServeHTTP(wUse, authReq(http.MethodGet, "/teams", nil, raw))
	assert.Equal(t, http.StatusUnauthorized, wUse.Code)
}

func TestAPIToken_InvalidScopeRejected(t *testing.T) {
	srv, jwt := tokenTestSetup(t)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/tokens",
		map[string]string{"name": "bad", "scope": "godmode"}, jwt))
	assert.Equal(t, http.StatusBadRequest, w.Code, fmt.Sprintf("body: %s", w.Body.String()))
}

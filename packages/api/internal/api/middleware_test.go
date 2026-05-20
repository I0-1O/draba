package api_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthMiddleware_GhostJWT_Returns401(t *testing.T) {
	srv, tokens := newTeamTestServer(t)

	// Mint a JWT for a user ID that was never inserted into the DB.
	ghostToken, err := tokens.IssueAccessToken("nonexistent-user-id", "ghost@example.com")
	require.NoError(t, err)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/teams", nil, ghostToken))
	assert.Equal(t, http.StatusUnauthorized, w.Code, "ghost JWT must be rejected: %s", w.Body)
}

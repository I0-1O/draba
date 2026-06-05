package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestVersionEndpoint verifies GET /version is public and returns the build
// fields (commit is "unknown" in tests, where no ldflags are injected).
func TestVersionEndpoint(t *testing.T) {
	srv := newTestServer(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/version", http.NoBody))
	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	_, hasCommit := body["commit"]
	assert.True(t, hasCommit, "response must include a commit field")
	assert.NotEmpty(t, body["commit"])
}

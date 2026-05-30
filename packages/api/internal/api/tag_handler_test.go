package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// tagTestSetup builds an in-memory server, registers Alice, creates a team,
// and returns the handler, Alice's token, and the team ID.
func tagTestSetup(t *testing.T) (srv http.Handler, aliceToken, teamID string) {
	t.Helper()
	srv = newTestServer(t)
	aliceToken, _ = seedUser(t, srv, "alice@tags.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Tag Team"}, aliceToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID = team["id"].(string)
	return srv, aliceToken, teamID
}

func TestTags_CreateAndList(t *testing.T) {
	srv, tok, teamID := tagTestSetup(t)

	// Create a tag.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/tags", teamID),
		map[string]any{"name": "urgent", "color": "red"}, tok))
	assert.Equal(t, http.StatusCreated, w.Code)
	var tag map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tag))
	assert.Equal(t, "urgent", tag["name"])
	assert.Equal(t, "red", tag["color"])
	tagID := tag["id"].(string)

	// List tags for the team.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/tags", teamID), nil, tok))
	assert.Equal(t, http.StatusOK, w2.Code)
	var tags []map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&tags))
	require.Len(t, tags, 1)
	assert.Equal(t, tagID, tags[0]["id"])
}

func TestTags_CreateDuplicate_409(t *testing.T) {
	srv, tok, teamID := tagTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/tags", teamID),
		map[string]any{"name": "dup"}, tok))
	require.Equal(t, http.StatusCreated, w.Code)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/tags", teamID),
		map[string]any{"name": "dup"}, tok))
	assert.Equal(t, http.StatusConflict, w2.Code)
}

func TestTags_CreateMissingName_400(t *testing.T) {
	srv, tok, teamID := tagTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/tags", teamID),
		map[string]any{}, tok))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestTags_Update(t *testing.T) {
	srv, tok, teamID := tagTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/tags", teamID),
		map[string]any{"name": "oldname", "color": "teal"}, tok))
	require.Equal(t, http.StatusCreated, w.Code)
	var tag map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tag))
	tagID := tag["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPatch, fmt.Sprintf("/tags/%s", tagID),
		map[string]any{"name": "newname", "color": "violet"}, tok))
	assert.Equal(t, http.StatusOK, w2.Code)
	var updated map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&updated))
	assert.Equal(t, "newname", updated["name"])
	assert.Equal(t, "violet", updated["color"])
}

func TestTags_Update_NotFound_404(t *testing.T) {
	srv, tok, _ := tagTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPatch, "/tags/nonexistent",
		map[string]any{"name": "x"}, tok))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestTags_Delete(t *testing.T) {
	srv, tok, teamID := tagTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/tags", teamID),
		map[string]any{"name": "todel"}, tok))
	require.Equal(t, http.StatusCreated, w.Code)
	var tag map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&tag))
	tagID := tag["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodDelete, fmt.Sprintf("/tags/%s", tagID), nil, tok))
	assert.Equal(t, http.StatusNoContent, w2.Code)

	// Confirm gone.
	w3 := httptest.NewRecorder()
	srv.ServeHTTP(w3, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/tags", teamID), nil, tok))
	require.Equal(t, http.StatusOK, w3.Code)
	var list []any
	require.NoError(t, json.NewDecoder(w3.Body).Decode(&list))
	assert.Empty(t, list)
}

func TestTags_Delete_NotFound_404(t *testing.T) {
	srv, tok, _ := tagTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete, "/tags/nonexistent", nil, tok))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestTags_NonMember_Forbidden(t *testing.T) {
	srv, aliceToken, teamID := tagTestSetup(t)

	// Bob is registered but not on Alice's team.
	bobToken := seedNonMember(t, srv, aliceToken, "bob@tags.com", "Bob")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/tags", teamID), nil, bobToken))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

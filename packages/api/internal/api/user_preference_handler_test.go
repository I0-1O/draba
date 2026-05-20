package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPreferences_EmptyGlobal(t *testing.T) {
	srv, token, _ := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/users/me/preferences", nil, token))

	assert.Equal(t, http.StatusOK, w.Code)
	var prefs []any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&prefs))
	assert.Empty(t, prefs)
}

func TestGetPreferences_Unauthenticated(t *testing.T) {
	srv := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/users/me/preferences", http.NoBody)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestUpsertPreference_GlobalSuccess(t *testing.T) {
	srv, token, _ := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPut, "/users/me/preferences",
		map[string]any{"key": "theme", "value": `"dark"`}, token))

	require.Equal(t, http.StatusOK, w.Code)
	var pref map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&pref))
	assert.Equal(t, "theme", pref["key"])
	assert.Equal(t, `"dark"`, pref["value"])
	assert.Empty(t, pref["timelineId"], "global pref must have empty timelineId")
}

func TestUpsertPreference_UpdateOnConflict(t *testing.T) {
	srv, token, _ := savedFilterTestSetup(t)

	// First write.
	w1 := httptest.NewRecorder()
	srv.ServeHTTP(w1, authReq(http.MethodPut, "/users/me/preferences",
		map[string]any{"key": "theme", "value": `"light"`}, token))
	require.Equal(t, http.StatusOK, w1.Code)

	// Second write — same key, new value.
	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPut, "/users/me/preferences",
		map[string]any{"key": "theme", "value": `"dark"`}, token))
	require.Equal(t, http.StatusOK, w2.Code)

	// GET must return exactly one row with the updated value.
	wGet := httptest.NewRecorder()
	srv.ServeHTTP(wGet, authReq(http.MethodGet, "/users/me/preferences", nil, token))
	require.Equal(t, http.StatusOK, wGet.Code)
	var prefs []map[string]any
	require.NoError(t, json.NewDecoder(wGet.Body).Decode(&prefs))
	require.Len(t, prefs, 1, "upsert must not duplicate the row")
	assert.Equal(t, `"dark"`, prefs[0]["value"])
}

func TestUpsertPreference_TimelineScoped(t *testing.T) {
	srv, token, _ := savedFilterTestSetup(t)

	timelineID := "tl-abc"
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPut, "/users/me/preferences",
		map[string]any{"key": "group_by", "value": `"member"`, "timelineId": timelineID}, token))
	require.Equal(t, http.StatusOK, w.Code)

	// Global scope must be empty.
	wGlobal := httptest.NewRecorder()
	srv.ServeHTTP(wGlobal, authReq(http.MethodGet, "/users/me/preferences", nil, token))
	require.Equal(t, http.StatusOK, wGlobal.Code)
	var global []any
	require.NoError(t, json.NewDecoder(wGlobal.Body).Decode(&global))
	assert.Empty(t, global)

	// Timeline scope must have the pref.
	wScoped := httptest.NewRecorder()
	srv.ServeHTTP(wScoped, authReq(http.MethodGet, "/users/me/preferences?timeline_id="+timelineID, nil, token))
	require.Equal(t, http.StatusOK, wScoped.Code)
	var scoped []map[string]any
	require.NoError(t, json.NewDecoder(wScoped.Body).Decode(&scoped))
	require.Len(t, scoped, 1)
	assert.Equal(t, "group_by", scoped[0]["key"])
}

func TestUpsertPreference_MissingKey(t *testing.T) {
	srv, token, _ := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPut, "/users/me/preferences",
		map[string]any{"value": `"dark"`}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpsertPreference_InvalidJSONValue(t *testing.T) {
	srv, token, _ := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPut, "/users/me/preferences",
		map[string]any{"key": "theme", "value": "not-valid-json"}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpsertPreference_Unauthenticated(t *testing.T) {
	srv := newTestServer(t)

	req := httptest.NewRequest(http.MethodPut, "/users/me/preferences", http.NoBody)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestUpsertPreference_KeyTooLong(t *testing.T) {
	srv, token, _ := savedFilterTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPut, "/users/me/preferences",
		map[string]any{"key": strings.Repeat("a", 65), "value": `"x"`}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpsertPreference_ValueTooLong(t *testing.T) {
	srv, token, _ := savedFilterTestSetup(t)

	// 4097-byte JSON string (quotes + 4095 chars + one extra).
	longValue := `"` + strings.Repeat("x", 4095) + `"`
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPut, "/users/me/preferences",
		map[string]any{"key": "x", "value": longValue}, token))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

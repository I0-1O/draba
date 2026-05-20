package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// handleGetPreferences handles GET /users/me/preferences.
// An optional ?timeline_id= query parameter scopes the results to a timeline;
// omitting it returns global preferences (timeline_id = ”).
func (s *Server) handleGetPreferences(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())
	timelineID := r.URL.Query().Get("timeline_id")

	prefs, err := s.preferences.List(claims.UserID, timelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load preferences")
		return
	}
	writeJSON(w, http.StatusOK, prefs)
}

// handleUpsertPreference handles PUT /users/me/preferences. It creates or
// updates a single key/value preference for the authenticated user, optionally
// scoped to a timeline.
func (s *Server) handleUpsertPreference(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())

	var req UpsertPreferenceJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.Key == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "key is required")
		return
	}
	if !json.Valid([]byte(req.Value)) {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "value must be valid JSON")
		return
	}

	timelineID := ""
	if req.TimelineId != nil {
		timelineID = *req.TimelineId
	}

	pref := &models.UserPreference{
		ID:         newID(),
		UserID:     claims.UserID,
		TimelineID: timelineID,
		Key:        req.Key,
		Value:      req.Value,
		UpdatedAt:  time.Now(),
	}
	if err := s.preferences.Upsert(pref); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to save preference")
		return
	}
	writeJSON(w, http.StatusOK, pref)
}

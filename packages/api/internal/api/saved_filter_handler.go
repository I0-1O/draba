package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// handleListSavedFilters handles GET /teams/{id}/saved_filters. Returns
// only filters owned by the calling user within the given team.
func (s *Server) handleListSavedFilters(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list saved filters")
		return
	}

	filters, err := s.savedFilters.ListByTeamUser(teamID, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list saved filters")
		return
	}
	writeJSON(w, http.StatusOK, filters)
}

// handleCreateSavedFilter handles POST /teams/{id}/saved_filters. The
// authenticated user must be a member of the team and becomes the owner.
func (s *Server) handleCreateSavedFilter(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create saved filter")
		return
	}

	var req CreateSavedFilterJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name is required")
		return
	}
	if !json.Valid([]byte(req.Definition)) {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "definition must be valid JSON")
		return
	}

	now := time.Now()
	filter := &models.SavedFilter{
		ID:         newID(),
		TeamID:     teamID,
		UserID:     claims.UserID,
		Name:       req.Name,
		Definition: req.Definition,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.savedFilters.Create(filter); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create saved filter")
		return
	}
	writeJSON(w, http.StatusCreated, filter)
}

// handleUpdateSavedFilter handles PATCH /saved_filters/{id}. Only the owner
// of the filter may modify it.
func (s *Server) handleUpdateSavedFilter(w http.ResponseWriter, r *http.Request) {
	filterID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	filter, err := s.savedFilters.GetByID(filterID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "saved filter not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update saved filter")
		return
	}
	if filter.UserID != claims.UserID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "not the owner of this saved filter")
		return
	}

	var req UpdateSavedFilterJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.Name != nil {
		if *req.Name == "" {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name must not be empty")
			return
		}
		filter.Name = *req.Name
	}
	if req.Definition != nil {
		if !json.Valid([]byte(*req.Definition)) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "definition must be valid JSON")
			return
		}
		filter.Definition = *req.Definition
	}
	filter.UpdatedAt = time.Now()

	if err := s.savedFilters.Update(filter); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update saved filter")
		return
	}
	writeJSON(w, http.StatusOK, filter)
}

// handleDeleteSavedFilter handles DELETE /saved_filters/{id}. Only the owner
// of the filter may delete it.
func (s *Server) handleDeleteSavedFilter(w http.ResponseWriter, r *http.Request) {
	filterID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	filter, err := s.savedFilters.GetByID(filterID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "saved filter not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete saved filter")
		return
	}
	if filter.UserID != claims.UserID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "not the owner of this saved filter")
		return
	}

	if err := s.savedFilters.Delete(filterID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete saved filter")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

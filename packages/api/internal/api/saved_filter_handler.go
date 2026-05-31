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

	if _, ok := s.requireTeamMember(w, r, teamID); !ok {
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
// Setting isTeamFilter=true at creation time requires admin role.
func (s *Server) handleCreateSavedFilter(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	member, ok := s.requireTeamMember(w, r, teamID)
	if !ok {
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

	isTeamFilter := false
	if req.IsTeamFilter != nil && *req.IsTeamFilter {
		if member.Role != "admin" {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "only team admins can create team filters")
			return
		}
		isTeamFilter = true
	}

	now := time.Now()
	filter := &models.SavedFilter{
		ID:           newID(),
		TeamID:       teamID,
		UserID:       claims.UserID,
		Name:         req.Name,
		Definition:   req.Definition,
		IsTeamFilter: isTeamFilter,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.savedFilters.Create(filter); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create saved filter")
		return
	}
	writeJSON(w, http.StatusCreated, filter)
}

// handleUpdateSavedFilter handles PATCH /saved_filters/{id}. Owners may
// update name and definition. Setting isTeamFilter=true is admin-only;
// admins may also update filters they don't own when the filter is already
// a team filter.
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

	var req UpdateSavedFilterJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	// Determine whether the caller is a team admin for permission checks.
	isAdmin := false
	if adminMember, ok := s.requireTeamMember(w, r, filter.TeamID); ok {
		isAdmin = adminMember.Role == "admin"
	} else {
		return
	}

	isOwner := filter.UserID == claims.UserID

	// Name and definition can be updated by:
	//   • The filter owner (any role)
	//   • A team admin, but only when the filter is already a team filter
	//     (admins promote first, then edit).
	wantsNameOrDef := req.Name != nil || req.Definition != nil
	if wantsNameOrDef && !isOwner {
		if !isAdmin || !filter.IsTeamFilter {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not the owner of this saved filter")
			return
		}
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
	// Only admins may promote/demote isTeamFilter (on any filter in the team,
	// regardless of ownership — this is how personal filters get promoted).
	if req.IsTeamFilter != nil {
		if !isAdmin {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "only team admins can change team filter status")
			return
		}
		filter.IsTeamFilter = *req.IsTeamFilter
	}
	filter.UpdatedAt = time.Now()

	if err := s.savedFilters.Update(filter); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update saved filter")
		return
	}
	writeJSON(w, http.StatusOK, filter)
}

// handleDeleteSavedFilter handles DELETE /saved_filters/{id}. The owner may
// always delete their own filter. Team admins may additionally delete any
// team filter (is_team_filter = true) even if they aren't the owner.
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

	// Check membership to determine admin status.
	adminMember, ok := s.requireTeamMember(w, r, filter.TeamID)
	if !ok {
		return
	}
	isAdmin := adminMember.Role == "admin"

	// Owner can always delete; admin can delete team filters they don't own.
	if filter.UserID != claims.UserID && !(isAdmin && filter.IsTeamFilter) {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "not the owner of this saved filter")
		return
	}

	if err := s.savedFilters.Delete(filterID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete saved filter")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

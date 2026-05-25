package api

import (
	"database/sql"
	"errors"
	"net/http"
	"time"
)

// handlePromoteUser sets is_superadmin=true on a user. Superadmin-only.
// Participants (no user account) cannot be promoted.
func (s *Server) handlePromoteUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	caller, err := s.users.GetByID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to promote user")
		return
	}
	if !caller.IsSuperadmin {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "superadmin required")
		return
	}

	target, err := s.users.GetByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to promote user")
		return
	}

	if err := s.users.SetSuperadmin(target.ID, true); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to promote user")
		return
	}

	target.IsSuperadmin = true
	writeJSON(w, http.StatusOK, target)
}

// handleArchiveUser inactivates a user account. Superadmin-only.
// Archived users cannot log in; their data is preserved.
func (s *Server) handleArchiveUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	caller, err := s.users.GetByID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive user")
		return
	}
	if !caller.IsSuperadmin {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "superadmin required")
		return
	}
	if userID == claims.UserID {
		writeError(w, http.StatusBadRequest, "CANNOT_SELF_ARCHIVE", "cannot archive your own account")
		return
	}

	target, err := s.users.GetByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive user")
		return
	}

	now := time.Now()
	if err := s.users.SetArchived(target.ID, &now); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive user")
		return
	}

	target.ArchivedAt = &now
	writeJSON(w, http.StatusOK, target)
}

// handleUnarchiveUser reactivates an inactivated user account. Superadmin-only.
func (s *Server) handleUnarchiveUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	caller, err := s.users.GetByID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to reactivate user")
		return
	}
	if !caller.IsSuperadmin {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "superadmin required")
		return
	}

	target, err := s.users.GetByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to reactivate user")
		return
	}

	if err := s.users.SetArchived(target.ID, nil); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to reactivate user")
		return
	}

	target.ArchivedAt = nil
	writeJSON(w, http.StatusOK, target)
}

// handleDeleteUser hard-deletes a user. Superadmin-only. Only permitted when
// the user has no active activity assignments and belongs to a single team.
func (s *Server) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	caller, err := s.users.GetByID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete user")
		return
	}
	if !caller.IsSuperadmin {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "superadmin required")
		return
	}
	if userID == claims.UserID {
		writeError(w, http.StatusBadRequest, "CANNOT_SELF_DELETE", "cannot delete your own account")
		return
	}

	if _, err := s.users.GetByID(userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete user")
		return
	}

	teamCount, err := s.teams.CountTeamsForUser(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete user")
		return
	}
	if teamCount > 1 {
		writeError(w, http.StatusConflict, "MULTI_TEAM", "user belongs to multiple teams; remove them from each team first")
		return
	}

	if err := s.users.Delete(userID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete user")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

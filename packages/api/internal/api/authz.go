package api

import (
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// requireTeamMember returns the caller's TeamMember for the given team.
// Superadmins who are not explicit members receive a synthetic member with
// role "admin" so downstream code works without special-casing.
func (s *Server) requireTeamMember(w http.ResponseWriter, r *http.Request, teamID string) (*models.TeamMember, bool) {
	claims := claimsFromContext(r.Context())
	member, err := s.teams.GetMember(teamID, claims.UserID)
	if err == nil {
		return member, true
	}
	if !errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to verify team membership")
		return nil, false
	}

	// Not a member — check superadmin.
	caller, err := s.users.GetByID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to verify permissions")
		return nil, false
	}
	if !caller.IsSuperadmin {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
		return nil, false
	}

	return superadminMember(teamID, claims.UserID), true
}

// requireTeamAdmin is like requireTeamMember but also enforces admin role.
// Superadmins always pass; regular members must have role "admin".
func (s *Server) requireTeamAdmin(w http.ResponseWriter, r *http.Request, teamID string) (*models.TeamMember, bool) {
	member, ok := s.requireTeamMember(w, r, teamID)
	if !ok {
		return nil, false
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "admin role required")
		return nil, false
	}
	return member, true
}

// hasTeamAccess reports whether the authenticated caller may access the given
// team without writing a response. Use when the correct failure status is
// NOT_FOUND rather than FORBIDDEN — e.g. resource-scoped endpoints where
// revealing a resource exists via a 403 is undesirable.
func (s *Server) hasTeamAccess(r *http.Request, teamID string) bool {
	claims := claimsFromContext(r.Context())
	_, err := s.teams.GetMember(teamID, claims.UserID)
	if err == nil {
		return true
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return false
	}
	caller, err := s.users.GetByID(claims.UserID)
	return err == nil && caller.IsSuperadmin
}

// superadminMember returns a synthetic TeamMember for superadmins who are
// not explicit members of a team. The ID is empty (no real row exists) and
// the role is "admin" so all admin-gated checks pass.
func superadminMember(teamID, userID string) *models.TeamMember {
	return &models.TeamMember{
		ID:       "",
		TeamID:   teamID,
		UserID:   &userID,
		Role:     "admin",
		JoinedAt: time.Now(),
	}
}

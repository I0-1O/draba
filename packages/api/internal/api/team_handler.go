package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// slugRe matches any run of characters that are not lowercase ASCII alphanumeric.
var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func (s *Server) handleListTeams(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())
	includeArchived := r.URL.Query().Get("archived") == "true"
	teams, err := s.teams.ListByUserID(claims.UserID, includeArchived)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list teams")
		return
	}
	writeJSON(w, http.StatusOK, teams)
}

func (s *Server) handleCreateTeam(w http.ResponseWriter, r *http.Request) {
	var req CreateTeamJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name is required")
		return
	}

	count, err := s.teams.Count()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create team")
		return
	}
	if err := s.tier.CheckTeamLimit(count); err != nil {
		writeError(w, http.StatusPaymentRequired, "TIER_TEAM_LIMIT", "team limit reached for current tier")
		return
	}

	claims := claimsFromContext(r.Context())
	now := time.Now()
	id := newID()
	team := &models.Team{
		ID:          id,
		Name:        req.Name,
		Slug:        slugify(req.Name) + "-" + id[:8],
		Description: req.Description,
		Notes:       req.Notes,
		Color:       req.Color,
		Icon:        req.Icon,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.teams.Create(team); err != nil {
		if errors.Is(err, db.ErrDuplicateName) {
			writeError(w, http.StatusConflict, "TEAM_NAME_TAKEN", "a team with that name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create team")
		return
	}

	userID := claims.UserID
	member := &models.TeamMember{
		ID:       newID(),
		TeamID:   team.ID,
		UserID:   &userID,
		Role:     "admin",
		JoinedAt: now,
	}
	if err := s.teams.AddMember(member); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create team")
		return
	}

	writeJSON(w, http.StatusCreated, team)
}

func (s *Server) handleCreateInvite(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	member, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create invite")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can send invites")
		return
	}

	var req CreateInviteJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	var email string
	if req.Email != nil {
		email = strings.ToLower(strings.TrimSpace(string(*req.Email)))
	}

	role := "member"
	if req.Role != nil {
		role = string(*req.Role)
	}
	if role != "admin" && role != "member" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "role must be admin or member")
		return
	}

	now := time.Now()
	invite := &models.Invite{
		ID:        newID(),
		TeamID:    teamID,
		Email:     email,
		Token:     newID(),
		Role:      role,
		InvitedBy: claims.UserID,
		ExpiresAt: now.Add(7 * 24 * time.Hour),
		CreatedAt: now,
	}
	if err := s.invites.Create(invite); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create invite")
		return
	}

	writeJSON(w, http.StatusCreated, invite)
}

// handleGetTeam checks membership before fetching the team row to avoid leaking
// team existence to non-members (a 403 is returned whether the team is missing
// or the caller is just not on it).
func (s *Server) handleGetTeam(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get team")
		return
	}

	team, err := s.teams.GetByID(teamID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "team not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get team")
		return
	}

	writeJSON(w, http.StatusOK, team)
}

func (s *Server) handleListMembers(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list members")
		return
	}

	members, err := s.teams.ListMembers(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list members")
		return
	}

	writeJSON(w, http.StatusOK, members)
}

// handleUpdateTeam applies partial updates — nil fields in the request body are
// ignored, not cleared. The caller does not need to fetch the current team state
// before patching.
func (s *Server) handleUpdateTeam(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	member, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update team")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can update a team")
		return
	}

	team, err := s.teams.GetByID(teamID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "team not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update team")
		return
	}

	var req UpdateTeamJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name cannot be empty")
			return
		}
		team.Name = name
		team.Slug = slugify(name) + "-" + team.ID[:8]
	}
	if req.Description != nil {
		team.Description = req.Description
	}
	if req.Notes != nil {
		team.Notes = req.Notes
	}
	if req.Color != nil {
		team.Color = req.Color
	}
	if req.Icon != nil {
		team.Icon = req.Icon
	}
	team.UpdatedAt = time.Now()

	if err := s.teams.Update(team); err != nil {
		if errors.Is(err, db.ErrDuplicateName) {
			writeError(w, http.StatusConflict, "TEAM_NAME_TAKEN", "a team with that name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update team")
		return
	}

	writeJSON(w, http.StatusOK, team)
}

// handleArchiveTeam soft-deletes by setting archived_at rather than removing
// the row, so activity history on the team is preserved and recovery is possible.
func (s *Server) handleArchiveTeam(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	member, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive team")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can archive a team")
		return
	}

	now := time.Now()
	if err := s.teams.SetArchived(teamID, &now); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive team")
		return
	}

	team, err := s.teams.GetByID(teamID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "team not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive team")
		return
	}
	writeJSON(w, http.StatusOK, team)
}

func (s *Server) handleUnarchiveTeam(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	member, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to unarchive team")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can unarchive a team")
		return
	}

	if err := s.teams.SetArchived(teamID, nil); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to unarchive team")
		return
	}

	team, err := s.teams.GetByID(teamID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "team not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to unarchive team")
		return
	}
	writeJSON(w, http.StatusOK, team)
}

// slugify converts a team name to a URL-safe slug by lowercasing, replacing
// spaces and punctuation with hyphens, and collapsing consecutive hyphens.
func slugify(name string) string {
	s := slugRe.ReplaceAllString(strings.ToLower(name), "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = newID()[:8]
	}
	return s
}

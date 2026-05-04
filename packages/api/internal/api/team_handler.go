package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// slugRe matches any run of characters that are not lowercase ASCII alphanumeric.
var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

// handleCreateTeam handles POST /teams. The authenticated user becomes the
// team's first admin member.
func (s *Server) handleCreateTeam(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
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
	team := &models.Team{
		ID:        newID(),
		Name:      req.Name,
		Slug:      slugify(req.Name),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.teams.Create(team); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create team")
		return
	}

	member := &models.TeamMember{
		TeamID:   team.ID,
		UserID:   claims.UserID,
		Role:     "admin",
		JoinedAt: now,
	}
	if err := s.teams.AddMember(member); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create team")
		return
	}

	writeJSON(w, http.StatusCreated, team)
}

// handleCreateInvite handles POST /teams/{id}/invites. Only team admins may
// send invites. An optional email field scopes the invite to that address.
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

	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	role := req.Role
	if role == "" {
		role = "member"
	}
	if role != "admin" && role != "member" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "role must be admin or member")
		return
	}

	now := time.Now()
	invite := &models.Invite{
		ID:        newID(),
		TeamID:    teamID,
		Email:     req.Email,
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

// handleGetTeam handles GET /teams/{id}. Any team member may fetch the team record.
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

// handleListMembers handles GET /teams/{id}/members. Any team member may
// list the membership roster.
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

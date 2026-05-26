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

	// Superadmins see all teams system-wide, not just the ones they belong to.
	caller, err := s.users.GetByID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list teams")
		return
	}

	var teams []*models.Team
	if caller.IsSuperadmin {
		teams, err = s.teams.ListAll(includeArchived)
	} else {
		teams, err = s.teams.ListByUserID(claims.UserID, includeArchived)
	}
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
		Token:     newToken(),
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

// ── Member CRUD ───────────────────────────────────────────────────────────────

// handleGetMember fetches a single team member with computed stats.
func (s *Server) handleGetMember(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	memberID := r.PathValue("memberId")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get member")
		return
	}

	m, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get member")
		return
	}
	if m.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
		return
	}

	stats, err := s.teams.GetMemberStats(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to compute member stats")
		return
	}

	var teams []*models.TeamMemberWithUser
	if m.UserID != nil {
		teams, err = s.teams.GetMemberAllTeams(*m.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get member teams")
			return
		}
	}

	// Deletable: zero active assignments and single-team membership.
	activeActivities := stats.PastDue + stats.Running + stats.Upcoming + stats.Unscheduled
	deletable := activeActivities == 0 && len(teams) <= 1

	detail := &models.MemberDetail{
		TeamMemberWithUser: *m,
		Stats:              *stats,
		Teams:              flatten(teams),
		Deletable:          deletable,
	}
	writeJSON(w, http.StatusOK, detail)
}

// handleAddMember adds an existing registered user to the team by their userID.
func (s *Server) handleAddMember(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to add member")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can add members")
		return
	}

	var req struct {
		UserID string `json:"userId"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	req.UserID = strings.TrimSpace(req.UserID)
	if req.UserID == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "userId is required")
		return
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if req.Role != "admin" && req.Role != "member" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "role must be admin or member")
		return
	}

	// Verify the user exists.
	if _, err := s.users.GetByID(req.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to add member")
		return
	}

	now := time.Now()
	uid := req.UserID
	member := &models.TeamMember{
		ID:       newID(),
		TeamID:   teamID,
		UserID:   &uid,
		Role:     req.Role,
		JoinedAt: now,
	}
	if err := s.teams.AddMember(member); err != nil {
		writeError(w, http.StatusConflict, "ALREADY_MEMBER", "user is already a member of this team")
		return
	}

	m, err := s.teams.GetMemberByID(member.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get created member")
		return
	}
	writeJSON(w, http.StatusCreated, m)
}

// handleUpdateMember updates display_name, color, icon, and/or role.
// Admins can change any field; regular members can only update their own
// display_name, color, and icon (not their role).
func (s *Server) handleUpdateMember(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	memberID := r.PathValue("memberId")
	claims := claimsFromContext(r.Context())

	callerMember, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update member")
		return
	}

	target, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update member")
		return
	}
	if target.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
		return
	}

	var req struct {
		DisplayName *string `json:"displayName"`
		Color       *string `json:"color"`
		Icon        *string `json:"icon"`
		Role        *string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	// Only admins can change role.
	if req.Role != nil && callerMember.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can change roles")
		return
	}
	// Members can only update their own identity.
	if callerMember.Role != "admin" && callerMember.ID != memberID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "members can only update their own profile")
		return
	}
	if req.Role != nil && *req.Role != "admin" && *req.Role != "member" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "role must be admin or member")
		return
	}

	// Admins cannot change their own role — another admin must do it.
	if req.Role != nil && target.UserID != nil && *target.UserID == claims.UserID {
		writeError(w, http.StatusConflict, "SELF_ROLE_CHANGE", "cannot change your own role")
		return
	}

	if err := s.teams.UpdateMember(memberID, req.DisplayName, req.Color, req.Icon, req.Role); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update member")
		return
	}

	m, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get updated member")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// handleDeleteMember removes a team member row. Rejects if the member is the
// last admin.
func (s *Server) handleDeleteMember(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	memberID := r.PathValue("memberId")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to remove member")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can remove members")
		return
	}

	target, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to remove member")
		return
	}
	if target.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
		return
	}

	if target.Role == "admin" {
		admins, err := s.teams.CountAdmins(teamID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to remove member")
			return
		}
		if admins <= 1 {
			writeError(w, http.StatusConflict, "LAST_ADMIN", "cannot remove the last admin")
			return
		}
	}

	if err := s.teams.DeleteMember(memberID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to remove member")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleArchiveMember inactivates a team member (sets archived_at).
func (s *Server) handleArchiveMember(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	memberID := r.PathValue("memberId")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive member")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can inactivate members")
		return
	}

	target, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive member")
		return
	}
	if target.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
		return
	}

	if target.Role == "admin" {
		admins, err := s.teams.CountAdmins(teamID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive member")
			return
		}
		if admins <= 1 {
			writeError(w, http.StatusConflict, "LAST_ADMIN", "cannot inactivate the last admin")
			return
		}
	}

	now := time.Now()
	if err := s.teams.SetMemberArchived(memberID, &now); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive member")
		return
	}

	m, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get archived member")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// handleUnarchiveMember reactivates an inactivated team member.
func (s *Server) handleUnarchiveMember(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	memberID := r.PathValue("memberId")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to reactivate member")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can reactivate members")
		return
	}

	target, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to reactivate member")
		return
	}
	if target.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
		return
	}

	if err := s.teams.SetMemberArchived(memberID, nil); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to reactivate member")
		return
	}

	m, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get reactivated member")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// handleCreateParticipant creates a login-less team member (Participant).
func (s *Server) handleCreateParticipant(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create participant")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can create participants")
		return
	}

	var req struct {
		Name  string  `json:"name"`
		Color *string `json:"color"`
		Icon  *string `json:"icon"`
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

	now := time.Now()
	name := req.Name
	member := &models.TeamMember{
		ID:          newID(),
		TeamID:      teamID,
		UserID:      nil,
		DisplayName: &name,
		Role:        "member",
		Color:       req.Color,
		Icon:        req.Icon,
		JoinedAt:    now,
	}
	if err := s.teams.AddMember(member); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create participant")
		return
	}

	m, err := s.teams.GetMemberByID(member.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get created participant")
		return
	}
	writeJSON(w, http.StatusCreated, m)
}

// ── Invites ───────────────────────────────────────────────────────────────────

// handleListInvites returns all pending invites for the team.
func (s *Server) handleListInvites(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list invites")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can list invites")
		return
	}

	invites, err := s.invites.ListByTeam(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list invites")
		return
	}
	writeJSON(w, http.StatusOK, invites)
}

// handleDeleteInvite revokes a pending invite.
func (s *Server) handleDeleteInvite(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	inviteID := r.PathValue("inviteId")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke invite")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can revoke invites")
		return
	}

	if err := s.invites.DeleteByID(inviteID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke invite")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Invite link ───────────────────────────────────────────────────────────────

// handleCreateInviteLink generates or regenerates the reusable invite link
// token for the team. Each call replaces the previous token.
//
// Design decision: tokens have no server-side expiry and are valid until an
// admin explicitly revokes (DELETE) or resets (POST /reset) them. This keeps
// the URL stable for onboarding docs and Slack pins. If time-bounded links are
// needed, add an invite_link_expires_at column to teams and check it in the
// registration handler.
func (s *Server) handleCreateInviteLink(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create invite link")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can manage invite links")
		return
	}

	token := newToken()
	if err := s.teams.SetInviteLinkToken(teamID, &token); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create invite link")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}

// handleGetInviteLink returns the current invite link token for the team, or
// null if none is set.
func (s *Server) handleGetInviteLink(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get invite link")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can view invite links")
		return
	}

	team, err := s.teams.GetByID(teamID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "team not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get invite link")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"token": team.InviteLinkToken})
}

// handleResetInviteLink invalidates the current token and generates a fresh one.
// Semantically identical to POST /invite-link; the distinct URL makes client
// intent (reset vs. first-time create) explicit without a separate code path.
func (s *Server) handleResetInviteLink(w http.ResponseWriter, r *http.Request) {
	s.handleCreateInviteLink(w, r)
}

// handleDeleteInviteLink revokes the current invite link by clearing the token.
func (s *Server) handleDeleteInviteLink(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	admin, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke invite link")
		return
	}
	if admin.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only admins can revoke invite links")
		return
	}

	if err := s.teams.SetInviteLinkToken(teamID, nil); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke invite link")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// userSearchResult is the safe public projection returned by GET /users/search.
// It intentionally omits isSuperadmin, archivedAt, createdAt, updatedAt, and
// passwordHash so that search results are safe to expose to any team member.
type userSearchResult struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	DisplayName string  `json:"displayName"`
	AvatarURL   *string `json:"avatarUrl,omitempty"`
}

// handleSearchUsers handles GET /users/search?q= and returns matching users.
func (s *Server) handleSearchUsers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "query must be at least 2 characters")
		return
	}
	users, err := s.users.SearchByNameOrEmail(q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "search failed")
		return
	}
	results := make([]userSearchResult, len(users))
	for i, u := range users {
		results[i] = userSearchResult{
			ID:          u.ID,
			Email:       u.Email,
			DisplayName: u.DisplayName,
			AvatarURL:   u.AvatarURL,
		}
	}
	writeJSON(w, http.StatusOK, results)
}

// handleGetMemberStats returns computed activity and timeline counts for a
// single team member. The full MemberDetail (with teams list) is available via
// GET /teams/:id/members/:memberId; this endpoint is for lightweight stat polling.
func (s *Server) handleGetMemberStats(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	memberID := r.PathValue("memberId")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get member stats")
		return
	}

	m, err := s.teams.GetMemberByID(memberID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get member stats")
		return
	}
	if m.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "member not found")
		return
	}

	stats, err := s.teams.GetMemberStats(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to compute member stats")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// flatten converts a nil slice to an empty slice for clean JSON serialisation.
func flatten[T any](s []*T) []T {
	out := make([]T, 0, len(s))
	for _, v := range s {
		if v != nil {
			out = append(out, *v)
		}
	}
	return out
}

package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// handleRegister handles POST /auth/register. The first user on a fresh
// install registers without an invite (bootstrap); every subsequent user
// must present a valid invite token. Tier user limits are enforced before
// hashing the password to avoid wasted bcrypt work.
func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	req.Email = openapi_types.Email(strings.ToLower(strings.TrimSpace(string(req.Email))))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if req.Email == "" || req.Password == "" || req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "email, password, and displayName are required")
		return
	}
	if !isValidPassword(req.Password) {
		writeError(w, http.StatusBadRequest, "WEAK_PASSWORD", "password must be at least 8 characters")
		return
	}

	// First user may register without an invite; all subsequent users require one.
	count, err := s.users.Count()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "registration failed")
		return
	}

	if err := s.tier.CheckUserLimit(count); err != nil {
		writeError(w, http.StatusPaymentRequired, "TIER_USER_LIMIT", "user limit reached for current tier")
		return
	}

	var invite *models.Invite
	var inviteLinkTeamID string // non-empty when a reusable invite link was used
	if count > 0 {
		if req.InviteToken == nil || *req.InviteToken == "" {
			writeError(w, http.StatusForbidden, "INVITE_REQUIRED", "an invite token is required to register")
			return
		}
		// Try as a one-time invite first.
		inv, err := s.invites.GetValid(*req.InviteToken)
		if err != nil {
			// Not a valid one-time invite — check if it's a reusable invite link token.
			team, linkErr := s.teams.GetByInviteLinkToken(*req.InviteToken)
			if linkErr != nil {
				writeError(w, http.StatusForbidden, "INVITE_INVALID", "invite token is invalid or expired")
				return
			}
			inviteLinkTeamID = team.ID
		} else {
			if inv.Email != "" && !strings.EqualFold(inv.Email, string(req.Email)) {
				writeError(w, http.StatusForbidden, "INVITE_EMAIL_MISMATCH", "this invite was issued to a different email address")
				return
			}
			invite = inv
		}
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "registration failed")
		return
	}

	now := time.Now()
	user := &models.User{
		ID:           newID(),
		Email:        string(req.Email),
		PasswordHash: hash,
		DisplayName:  req.DisplayName,
		IsSuperadmin: count == 0,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.users.Create(user); err != nil {
		writeError(w, http.StatusConflict, "EMAIL_TAKEN", "an account with that email already exists")
		return
	}

	if invite != nil {
		if err := s.invites.MarkAccepted(invite.ID); err != nil {
			// User and tokens are still returned — email uniqueness prevents a
			// second registration. Log so the open invite is visible in monitoring.
			slog.Error("failed to mark invite accepted", "invite_id", invite.ID, "err", err)
		}
		userID := user.ID
		member := &models.TeamMember{
			ID:       newID(),
			TeamID:   invite.TeamID,
			UserID:   &userID,
			Role:     invite.Role,
			JoinedAt: now,
		}
		if err := s.teams.AddMember(member); err != nil {
			slog.Error("failed to add user to team after invite", "team_id", invite.TeamID, "user_id", user.ID, "err", err)
		}
	} else if inviteLinkTeamID != "" {
		userID := user.ID
		member := &models.TeamMember{
			ID:       newID(),
			TeamID:   inviteLinkTeamID,
			UserID:   &userID,
			Role:     "member",
			JoinedAt: now,
		}
		if err := s.teams.AddMember(member); err != nil {
			slog.Error("failed to add user to team via invite link", "team_id", inviteLinkTeamID, "user_id", user.ID, "err", err)
		}
	}

	access, err := s.tokens.IssueAccessToken(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "registration failed")
		return
	}
	refresh, err := s.tokens.IssueRefreshToken(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "registration failed")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"user":         user,
		"accessToken":  access,
		"refreshToken": refresh,
	})
}

// handleLogin handles POST /auth/login. Returns the same generic
// INVALID_CREDENTIALS error for both unknown email and bad password so
// the endpoint cannot be used as an account-existence oracle.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	req.Email = openapi_types.Email(strings.ToLower(strings.TrimSpace(string(req.Email))))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "email and password are required")
		return
	}

	user, err := s.users.GetByEmail(string(req.Email))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "login failed")
		return
	}

	if user.ArchivedAt != nil {
		writeError(w, http.StatusForbidden, "ACCOUNT_INACTIVE", "this account has been deactivated")
		return
	}

	if err := auth.CheckPassword(user.PasswordHash, req.Password); err != nil {
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password")
		return
	}

	access, err := s.tokens.IssueAccessToken(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "login failed")
		return
	}
	refresh, err := s.tokens.IssueRefreshToken(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "login failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user":         user,
		"accessToken":  access,
		"refreshToken": refresh,
	})
}

// handleRefresh handles POST /auth/refresh. It exchanges a valid refresh
// token for a new access token; the refresh token itself is not rotated.
func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshTokenJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	claims, err := s.tokens.Validate(req.RefreshToken, "refresh")
	if err != nil {
		writeError(w, http.StatusUnauthorized, "INVALID_TOKEN", "refresh token is invalid or expired")
		return
	}

	access, err := s.tokens.IssueAccessToken(claims.UserID, claims.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "token refresh failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"accessToken": access,
	})
}

// handleMe handles GET /auth/me and returns the authenticated user's
// profile. Must be mounted behind authMiddleware.
func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())
	user, err := s.users.GetByID(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to fetch user")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// isValidPassword applies the minimum policy: at least 8 characters and
// no whitespace. Strength rules beyond length are intentionally lenient —
// length is what matters most against offline cracking.
func isValidPassword(p string) bool {
	if len(p) < 8 {
		return false
	}
	for _, r := range p {
		if unicode.IsSpace(r) {
			return false
		}
	}
	return true
}

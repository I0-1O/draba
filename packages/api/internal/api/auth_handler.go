package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// handleRegister handles POST /auth/register. The first user on a fresh
// install registers without an invite (bootstrap); every subsequent user
// must present a valid invite token. Tier user limits are enforced before
// hashing the password to avoid wasted bcrypt work.
func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"displayName"`
		InviteToken string `json:"inviteToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
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
	if count > 0 {
		if req.InviteToken == "" {
			writeError(w, http.StatusForbidden, "INVITE_REQUIRED", "an invite token is required to register")
			return
		}
		inv, err := s.invites.GetValid(req.InviteToken)
		if err != nil {
			writeError(w, http.StatusForbidden, "INVITE_INVALID", "invite token is invalid or expired")
			return
		}
		if inv.Email != "" && !strings.EqualFold(inv.Email, req.Email) {
			writeError(w, http.StatusForbidden, "INVITE_EMAIL_MISMATCH", "this invite was issued to a different email address")
			return
		}
		invite = inv
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "registration failed")
		return
	}

	now := time.Now()
	user := &models.User{
		ID:           newID(),
		Email:        req.Email,
		PasswordHash: hash,
		DisplayName:  req.DisplayName,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.users.Create(user); err != nil {
		writeError(w, http.StatusConflict, "EMAIL_TAKEN", "an account with that email already exists")
		return
	}

	if invite != nil {
		_ = s.invites.MarkAccepted(invite.ID)
		member := &models.TeamMember{
			TeamID:   invite.TeamID,
			UserID:   user.ID,
			Role:     invite.Role,
			JoinedAt: now,
		}
		_ = s.teams.AddMember(member)
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
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "email and password are required")
		return
	}

	user, err := s.users.GetByEmail(req.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "login failed")
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
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
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

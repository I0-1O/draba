package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// validAPITokenScopes mirrors the api_tokens.scope CHECK constraint.
var validAPITokenScopes = map[string]bool{
	tokenScopeRead:    true,
	tokenScopeAdd:     true,
	tokenScopeEditOwn: true,
	tokenScopeEditAll: true,
}

type createAPITokenRequest struct {
	Name  string `json:"name"`
	Scope string `json:"scope"`
}

// createAPITokenResponse extends APIToken with the raw token value, which is
// only returned once at creation time and never persisted in plaintext.
type createAPITokenResponse struct {
	*models.APIToken
	Token string `json:"token"`
}

// handleCreateAPIToken handles POST /tokens. The caller must hold a JWT
// access token — API tokens cannot mint other API tokens, to prevent a
// compromised token from escalating its own scope.
func (s *Server) handleCreateAPIToken(w http.ResponseWriter, r *http.Request) {
	if scope, _ := r.Context().Value(tokenScopeKey).(string); scope != tokenScopeFull {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "api tokens cannot be created via api token auth")
		return
	}
	claims := claimsFromContext(r.Context())

	var req createAPITokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name is required")
		return
	}
	if !validAPITokenScopes[req.Scope] {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "scope must be one of read, add, edit_own, edit_all")
		return
	}

	raw, hash, err := auth.GenerateAPIToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to generate token")
		return
	}

	tok := &models.APIToken{
		ID:        newID(),
		UserID:    claims.UserID,
		Name:      req.Name,
		TokenHash: hash,
		Scope:     req.Scope,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.apiTokens.Create(tok); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create token")
		return
	}

	writeJSON(w, http.StatusCreated, createAPITokenResponse{APIToken: tok, Token: raw})
}

// handleListAPITokens handles GET /tokens, returning every token (active and
// revoked) owned by the caller. The raw token value is never included.
func (s *Server) handleListAPITokens(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())
	tokens, err := s.apiTokens.ListByUser(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list tokens")
		return
	}
	writeJSON(w, http.StatusOK, tokens)
}

// handleDeleteAPIToken handles DELETE /tokens/{id}, revoking a token owned by
// the caller. The row is preserved (revoked_at set) so listings still show it.
func (s *Server) handleDeleteAPIToken(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	tok, err := s.apiTokens.GetByID(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "token not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke token")
		return
	}
	if tok.UserID != claims.UserID {
		// Match the 404 above so we don't leak the existence of tokens
		// owned by other users.
		writeError(w, http.StatusNotFound, "NOT_FOUND", "token not found")
		return
	}
	if tok.RevokedAt != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := s.apiTokens.Revoke(id); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke token")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

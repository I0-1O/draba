package api

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/auth"
)

// contextKey is an unexported type to avoid collisions with other packages
// using context.WithValue on the same request context.
type contextKey string

const (
	claimsKey     contextKey = "claims"
	tokenScopeKey contextKey = "tokenScope"
)

// Scope sentinels. tokenScopeFull is used for JWT-authenticated requests
// where no scope restriction applies; the other values mirror the api_tokens
// schema check constraint.
const (
	tokenScopeFull    = "full"
	tokenScopeRead    = "read"
	tokenScopeAdd     = "add"
	tokenScopeEditOwn = "edit_own"
	tokenScopeEditAll = "edit_all"
)

// authMiddleware enforces a Bearer credential on the request, attaches the
// resolved Claims (and any API-token scope) to the request context, and
// rejects unauthenticated or scope-violating requests.
//
// The Bearer value is either a JWT access token or an API token (prefix
// auth.APITokenPrefix). Read-only API tokens are rejected on any non-GET
// request — write scopes are accepted on all methods.
func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing or invalid authorization header")
			return
		}
		raw := strings.TrimPrefix(header, "Bearer ")

		var (
			claims *auth.Claims
			scope  = tokenScopeFull
		)

		if auth.LooksLikeAPIToken(raw) {
			tok, err := s.apiTokens.GetByHash(auth.HashAPIToken(raw))
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or revoked api token")
					return
				}
				writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to authenticate")
				return
			}
			if tok.Scope == tokenScopeRead && r.Method != http.MethodGet {
				writeError(w, http.StatusForbidden, "FORBIDDEN", "read-only token cannot perform writes")
				return
			}
			user, err := s.users.GetByID(tok.UserID)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "token owner not found")
				return
			}
			claims = &auth.Claims{UserID: user.ID, Email: user.Email, Type: "access"}
			scope = tok.Scope
			// Best-effort last-used touch; never block the request on a write failure.
			if err := s.apiTokens.TouchLastUsed(tok.ID); err != nil {
				slog.Debug("api token touch failed", "id", tok.ID, "err", err)
			}
		} else {
			c, err := s.tokens.Validate(raw, "access")
			if err != nil {
				writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or expired token")
				return
			}
			// Verify the user still exists. A valid JWT for a deleted user (e.g.
			// after a DB wipe) would otherwise pass signature validation but fail
			// later at the FK layer, producing a confusing 500 instead of a 401.
			if _, err := s.users.GetByID(c.UserID); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or expired token")
					return
				}
				writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to authenticate")
				return
			}
			claims = c
		}

		ctx := context.WithValue(r.Context(), claimsKey, claims)
		ctx = context.WithValue(ctx, tokenScopeKey, scope)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// claimsFromContext returns the Claims placed by authMiddleware, or nil
// if the request did not pass through it. Handlers behind authMiddleware
// can rely on a non-nil result.
func claimsFromContext(ctx context.Context) *auth.Claims {
	c, _ := ctx.Value(claimsKey).(*auth.Claims)
	return c
}

// statusWriter wraps ResponseWriter to capture the status code written by
// the handler, which is not otherwise readable after the fact.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

// Hijack implements http.Hijacker so that the WebSocket upgrader can take
// over the connection. Without this, the statusWriter wrapper breaks WS upgrades.
func (sw *statusWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := sw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("underlying ResponseWriter does not implement http.Hijacker")
	}
	return h.Hijack()
}

// requestLogger wraps next and emits a debug-level log line for every
// request: method, path, status code, and wall-clock duration in ms.
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		slog.Debug("http",
			"method", r.Method,
			"path", r.URL.Path,
			"status", sw.status,
			"ms", time.Since(start).Milliseconds(),
		)
	})
}

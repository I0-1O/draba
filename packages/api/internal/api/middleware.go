package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/I0-1O/draba/packages/api/internal/auth"
)

// contextKey is an unexported type to avoid collisions with other packages
// using context.WithValue on the same request context.
type contextKey string

const claimsKey contextKey = "claims"

// authMiddleware enforces a Bearer access token on the request, attaches
// the validated Claims to the request context, and rejects any request
// that fails the check with 401.
func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing or invalid authorization header")
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := s.tokens.Validate(tokenStr, "access")
		if err != nil {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or expired token")
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, claims)
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

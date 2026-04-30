package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/I0-1O/draba/packages/api/internal/auth"
)

type contextKey string

const claimsKey contextKey = "claims"

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

func claimsFromContext(ctx context.Context) *auth.Claims {
	c, _ := ctx.Value(claimsKey).(*auth.Claims)
	return c
}

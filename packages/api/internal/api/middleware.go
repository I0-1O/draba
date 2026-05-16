package api

import (
	"bufio"
	"context"
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

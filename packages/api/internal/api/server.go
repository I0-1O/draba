package api

import (
	"net/http"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
)

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	users   *db.UserRepo
	invites *db.InviteRepo
	tokens  *auth.TokenService
}

func NewServer(users *db.UserRepo, invites *db.InviteRepo, tokens *auth.TokenService) *Server {
	return &Server{
		users:   users,
		invites: invites,
		tokens:  tokens,
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /auth/register", s.handleRegister)
	mux.HandleFunc("POST /auth/login", s.handleLogin)
	mux.HandleFunc("POST /auth/refresh", s.handleRefresh)
	mux.HandleFunc("GET /auth/me", chain(s.handleMe, s.authMiddleware))

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	return mux
}

// chain applies a single middleware to a handler function.
func chain(h http.HandlerFunc, m func(http.Handler) http.Handler) http.HandlerFunc {
	return m(h).ServeHTTP
}

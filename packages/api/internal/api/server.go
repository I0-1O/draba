package api

import (
	"fmt"
	"net/http"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/tier"
)

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	users   *db.UserRepo
	invites *db.InviteRepo
	tokens  *auth.TokenService
	tier    tier.Tier
}

func NewServer(users *db.UserRepo, invites *db.InviteRepo, tokens *auth.TokenService, t tier.Tier) *Server {
	return &Server{
		users:   users,
		invites: invites,
		tokens:  tokens,
		tier:    t,
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

	ctx := &tier.ModuleContext{Mux: mux, Tier: s.tier}
	for _, m := range tier.Registered() {
		if err := m.Register(ctx); err != nil {
			// Module registration is a startup invariant — a failure here is a programming error.
			panic(fmt.Sprintf("tier module %q failed to register: %v", m.Name(), err))
		}
	}

	return mux
}

// chain applies a single middleware to a handler function.
func chain(h http.HandlerFunc, m func(http.Handler) http.Handler) http.HandlerFunc {
	return m(h).ServeHTTP
}

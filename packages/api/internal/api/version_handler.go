package api

import (
	"net/http"

	"github.com/I0-1O/draba/packages/api/internal/buildinfo"
)

// handleVersion reports the running build's git commit and build time. It is
// public (no auth) so a deploy can be identified with a single curl — e.g.
// confirming which commit a "latest" image actually contains.
func (s *Server) handleVersion(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"commit": buildinfo.Short(),
		"built":  buildinfo.Built,
	})
}

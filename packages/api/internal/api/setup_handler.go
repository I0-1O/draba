package api

import "net/http"

// handleSetupStatus handles GET /setup/status.
// Returns whether the app needs first-run setup (no users registered yet).
// Public — no auth required.
func (s *Server) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	count, err := s.users.Count()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to check setup status")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"needsSetup": count == 0})
}

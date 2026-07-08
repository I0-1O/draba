package api

import (
	"errors"
	"net/http"

	"github.com/I0-1O/draba/packages/api/internal/backup"
)

// handleGetBackupStatus handles GET /admin/backup/status. Reports the live
// database file, the backup directory, the last backup, and the derived
// health rating. Superadmin-only.
func (s *Server) handleGetBackupStatus(w http.ResponseWriter, r *http.Request) {
	if !s.requireSuperadmin(w, r) {
		return
	}

	st, err := s.backup.Status()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to read backup status")
		return
	}

	// schedule is always null until Phase 16.2 lands the scheduler; the key
	// is present so the response shape is stable for the web client.
	writeJSON(w, http.StatusOK, map[string]any{
		"database":   st.Database,
		"backupDir":  st.BackupDir,
		"lastBackup": st.LastBackup,
		"health":     st.Health,
		"running":    st.Running,
		"schedule":   nil,
	})
}

// handlePostBackup handles POST /admin/backup. Runs a manual backup
// synchronously and returns the resulting history entry. Superadmin-only.
func (s *Server) handlePostBackup(w http.ResponseWriter, r *http.Request) {
	if !s.requireSuperadmin(w, r) {
		return
	}

	entry, err := s.backup.RunNow(r.Context(), backup.TriggerManual)
	if errors.Is(err, backup.ErrBackupInProgress) {
		writeError(w, http.StatusConflict, "BACKUP_IN_PROGRESS", "a backup is already in progress")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "BACKUP_FAILED", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

// handleGetBackupHistory handles GET /admin/backup/history. Lists the
// backups in the backup directory, newest first. Superadmin-only.
func (s *Server) handleGetBackupHistory(w http.ResponseWriter, r *http.Request) {
	if !s.requireSuperadmin(w, r) {
		return
	}

	entries, err := s.backup.History()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list backups")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"backups": entries})
}

// handleDeleteBackup handles DELETE /admin/backup/{filename}. The manager
// only deletes filenames that exactly match the backup pattern, which is
// the path-traversal guard. Superadmin-only.
func (s *Server) handleDeleteBackup(w http.ResponseWriter, r *http.Request) {
	if !s.requireSuperadmin(w, r) {
		return
	}

	err := s.backup.Delete(r.PathValue("filename"))
	if errors.Is(err, backup.ErrNotFound) {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "backup not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete backup")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

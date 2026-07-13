package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

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

	// schedule is a summary of the active configuration; null means
	// scheduling is off (or the stored value is unreadable — the scheduler
	// logs that case and falls back to the default on its own).
	var schedule any
	if sched, err := backup.LoadSchedule(s.instanceSets); err == nil && sched.Preset != backup.PresetOff {
		schedule = sched
	} else if err != nil {
		slog.Warn("backup: status omitting unreadable schedule", "err", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"database":   st.Database,
		"backupDir":  st.BackupDir,
		"lastBackup": st.LastBackup,
		"health":     st.Health,
		"running":    st.Running,
		"schedule":   schedule,
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

// handleGetBackupSchedule handles GET /admin/backup/schedule. Returns the
// stored configuration (the default-on schedule when none was ever saved)
// with the computed next run time. Superadmin-only.
func (s *Server) handleGetBackupSchedule(w http.ResponseWriter, r *http.Request) {
	if !s.requireSuperadmin(w, r) {
		return
	}

	sched, err := backup.LoadSchedule(s.instanceSets)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load backup schedule")
		return
	}
	writeJSON(w, http.StatusOK, scheduleResponse(sched))
}

// handlePutBackupSchedule handles PUT /admin/backup/schedule. Validates and
// persists the configuration, pushes the retention count to the manager,
// and wakes the scheduler so the new schedule takes effect immediately.
// Superadmin-only.
func (s *Server) handlePutBackupSchedule(w http.ResponseWriter, r *http.Request) {
	if !s.requireSuperadmin(w, r) {
		return
	}

	var sched backup.Schedule
	if err := json.NewDecoder(r.Body).Decode(&sched); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if err := sched.Validate(); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	sched = sched.Normalize()

	if err := backup.SaveSchedule(s.instanceSets, sched); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to save backup schedule")
		return
	}
	// Apply retention directly too: the scheduler also does this on reload,
	// but manual backups must sweep with the new count even if the schedule
	// is off.
	s.backup.SetKeepLast(sched.KeepLast)
	if s.backupSched != nil {
		s.backupSched.Reload()
	}
	writeJSON(w, http.StatusOK, scheduleResponse(sched))
}

// scheduleResponse renders a schedule as the wire shape shared by the GET
// and PUT schedule endpoints: the config fields plus the computed
// nextRunAt (null when the preset is off).
func scheduleResponse(sched backup.Schedule) map[string]any {
	var nextRunAt any
	if next := sched.NextRun(time.Now()); !next.IsZero() {
		nextRunAt = next
	}
	return map[string]any{
		"preset":    sched.Preset,
		"time":      sched.Time,
		"day":       sched.Day,
		"keepLast":  sched.KeepLast,
		"nextRunAt": nextRunAt,
	}
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

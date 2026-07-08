package api_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/api"
	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/backup"
	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/mailer"
	"github.com/I0-1O/draba/packages/api/internal/tier"
	"github.com/I0-1O/draba/packages/api/internal/ws"
)

// newBackupTestServer builds a server against a file-backed database (so the
// status endpoint has a real file to stat) with the backup subsystem wired.
// When mgr is nil a real Manager with a SQLite engine and a temp backup dir
// is used; tests needing scripted engines pass their own.
func newBackupTestServer(t *testing.T, mgr *backup.Manager) (srv http.Handler, backupDir string) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "live.db")
	database, err := db.Open(dbPath)
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))
	t.Cleanup(func() { _ = database.Close() })

	backupDir = t.TempDir()
	if mgr == nil {
		mgr = backup.NewManager(backup.NewSQLiteEngine(database), backupDir, dbPath)
	}

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	tokens := auth.NewTokenService("backup-test-secret")
	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(_, _ string) error { return nil })
	isr := db.NewInstanceSettingsRepo(database)

	srv = api.NewServer(users, invites, teams, db.NewActivityRepo(database), db.NewTimelineRepo(database), db.NewSavedFilterRepo(database), db.NewUserPreferenceRepo(database), db.NewAPITokenRepo(database), isr, db.NewPasswordResetTokenRepo(database), db.NewStatusRepo(database), db.NewTagRepo(database), db.NewShareRepo(database), mailer.New(isr, nil), tokens, tier.Unlimited, bus, hub).WithBackup(mgr).Routes()
	return srv, backupDir
}

// seedNonSuperadmin registers a superadmin, then invites and registers a
// second (non-superadmin) user, returning both tokens.
func seedNonSuperadmin(t *testing.T, srv http.Handler) (adminToken, memberToken string) {
	t.Helper()
	adminToken, _ = seedUser(t, srv, "admin@example.com", "password1", "Admin")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Acme"}, adminToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))

	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/invites", team["id"]),
		map[string]string{"email": "bob@example.com", "role": "member"}, adminToken))
	require.Equal(t, http.StatusCreated, w.Code)
	var inv map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&inv))

	memberToken, _ = seedUserWithInvite(t, srv, "bob@example.com", "password2", "Bob", inv["token"].(string))
	return adminToken, memberToken
}

func TestBackup_RequiresSuperadmin(t *testing.T) {
	srv, _ := newBackupTestServer(t, nil)
	_, memberToken := seedNonSuperadmin(t, srv)

	paths := []struct{ method, path string }{
		{http.MethodGet, "/admin/backup/status"},
		{http.MethodPost, "/admin/backup"},
		{http.MethodGet, "/admin/backup/history"},
		{http.MethodDelete, "/admin/backup/draba-20260708T020000Z-manual.db"},
	}
	for _, p := range paths {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(p.method, p.path, nil, memberToken))
		assert.Equal(t, http.StatusForbidden, w.Code, "%s %s", p.method, p.path)
	}
}

func TestBackup_ManualRunStatusAndHistory(t *testing.T) {
	srv, backupDir := newBackupTestServer(t, nil)
	adminToken, _ := seedUser(t, srv, "admin@example.com", "password1", "Admin")

	// Fresh instance: empty history (a JSON array, never null) and an
	// honest critical health.
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/admin/backup/history", nil, adminToken))
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"backups":[]`)

	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/admin/backup/status", nil, adminToken))
	require.Equal(t, http.StatusOK, w.Code)
	var status map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&status))
	assert.Equal(t, "critical", status["health"])
	assert.Nil(t, status["lastBackup"])
	assert.Nil(t, status["schedule"])
	database := status["database"].(map[string]any)
	assert.Equal(t, "sqlite", database["driver"])
	assert.Greater(t, database["sizeBytes"].(float64), float64(0))
	assert.True(t, status["backupDir"].(map[string]any)["writable"].(bool))

	// Back up now.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/admin/backup", nil, adminToken))
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var entry map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&entry))
	assert.Equal(t, "manual", entry["trigger"])
	assert.Greater(t, entry["sizeBytes"].(float64), float64(0))
	filename := entry["filename"].(string)
	_, err := os.Stat(filepath.Join(backupDir, filename))
	require.NoError(t, err, "backup file must exist on disk")

	// History and status reflect the new backup.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/admin/backup/history", nil, adminToken))
	require.Equal(t, http.StatusOK, w.Code)
	var history map[string][]map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&history))
	require.Len(t, history["backups"], 1)
	assert.Equal(t, filename, history["backups"][0]["filename"])

	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/admin/backup/status", nil, adminToken))
	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, json.NewDecoder(w.Body).Decode(&status))
	assert.Equal(t, "ok", status["health"])
	require.NotNil(t, status["lastBackup"])

	// Delete it; a second delete is a 404.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete, "/admin/backup/"+filename, nil, adminToken))
	assert.Equal(t, http.StatusNoContent, w.Code)
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodDelete, "/admin/backup/"+filename, nil, adminToken))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestBackup_DeleteRejectsForeignFilenames(t *testing.T) {
	srv, backupDir := newBackupTestServer(t, nil)
	adminToken, _ := seedUser(t, srv, "admin@example.com", "password1", "Admin")

	// A foreign file in the dir must be undeletable through the API.
	foreign := filepath.Join(backupDir, "pre-upgrade.db")
	require.NoError(t, os.WriteFile(foreign, []byte("keep"), 0o644))

	for _, name := range []string{
		"pre-upgrade.db",
		"draba-20260708T020000Z-manual.db.bak",
		"..%2Fpre-upgrade.db",
	} {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodDelete, "/admin/backup/"+name, nil, adminToken))
		assert.Equal(t, http.StatusNotFound, w.Code, "expected 404 for %q", name)
	}
	_, err := os.Stat(foreign)
	assert.NoError(t, err, "foreign file must survive delete attempts")
}

// blockingEngine parks in Backup until released, so tests can hold a backup
// open across a second request.
type blockingEngine struct {
	started chan struct{}
	release chan struct{}
}

func (b *blockingEngine) Backup(_ context.Context, dest string) error {
	close(b.started)
	<-b.release
	return os.WriteFile(dest, []byte("slow"), 0o644)
}

func (b *blockingEngine) Verify(context.Context, string) error { return nil }

func TestBackup_ConflictWhileRunning(t *testing.T) {
	eng := &blockingEngine{started: make(chan struct{}), release: make(chan struct{})}
	mgr := backup.NewManager(eng, t.TempDir(), "unused")
	srv, _ := newBackupTestServer(t, mgr)
	adminToken, _ := seedUser(t, srv, "admin@example.com", "password1", "Admin")

	firstDone := make(chan int, 1)
	go func() {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodPost, "/admin/backup", nil, adminToken))
		firstDone <- w.Code
	}()
	<-eng.started

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/admin/backup", nil, adminToken))
	assert.Equal(t, http.StatusConflict, w.Code)
	assert.Contains(t, w.Body.String(), "BACKUP_IN_PROGRESS")

	// While running, status reports it.
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodGet, "/admin/backup/status", nil, adminToken))
	require.Equal(t, http.StatusOK, w.Code)
	var status map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&status))
	assert.True(t, status["running"].(bool))

	close(eng.release)
	select {
	case code := <-firstDone:
		assert.Equal(t, http.StatusCreated, code)
	case <-time.After(5 * time.Second):
		t.Fatal("first backup request never completed")
	}
}

// failingEngine always fails, simulating an unwritable directory or a
// mid-copy disk error.
type failingEngine struct{}

func (failingEngine) Backup(context.Context, string) error {
	return errors.New("disk full")
}

func (failingEngine) Verify(context.Context, string) error { return nil }

func TestBackup_FailureReturns500AndLeavesNoFile(t *testing.T) {
	dir := t.TempDir()
	mgr := backup.NewManager(failingEngine{}, dir, "unused")
	srv, _ := newBackupTestServer(t, mgr)
	adminToken, _ := seedUser(t, srv, "admin@example.com", "password1", "Admin")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/admin/backup", nil, adminToken))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "BACKUP_FAILED")

	dirents, err := os.ReadDir(dir)
	require.NoError(t, err)
	assert.Empty(t, dirents, "a failed backup must leave no file behind")
}

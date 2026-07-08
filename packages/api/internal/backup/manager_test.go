package backup

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
)

// fakeEngine lets tests script backup/verify outcomes without a database.
type fakeEngine struct {
	backup func(ctx context.Context, dest string) error
	verify func(ctx context.Context, path string) error
}

func (f *fakeEngine) Backup(ctx context.Context, dest string) error {
	if f.backup != nil {
		return f.backup(ctx, dest)
	}
	return os.WriteFile(dest, []byte("fake backup"), 0o644)
}

func (f *fakeEngine) Verify(ctx context.Context, path string) error {
	if f.verify != nil {
		return f.verify(ctx, path)
	}
	return nil
}

// openTestDB opens a real file-backed SQLite database configured like
// production (WAL mode, single writer connection).
func openTestDB(t *testing.T) (database *sqlx.DB, path string) {
	t.Helper()
	path = filepath.Join(t.TempDir(), "live.db")
	database, err := sqlx.Open("sqlite", path)
	require.NoError(t, err)
	database.SetMaxOpenConns(1)
	_, err = database.Exec("PRAGMA journal_mode=WAL")
	require.NoError(t, err)
	t.Cleanup(func() { _ = database.Close() })
	return database, path
}

func TestFilename_RoundTrip(t *testing.T) {
	ts := time.Date(2026, 7, 8, 2, 0, 0, 0, time.UTC)
	name := FormatFilename(ts, TriggerScheduled)
	assert.Equal(t, "draba-20260708T020000Z-scheduled.db", name)

	parsed, trigger, ok := ParseFilename(name)
	require.True(t, ok)
	assert.True(t, parsed.Equal(ts))
	assert.Equal(t, TriggerScheduled, trigger)
}

func TestParseFilename_RejectsForeignNames(t *testing.T) {
	rejected := []string{
		"",
		"notes.txt",
		"pre-upgrade.db",                        // admin's hand-copied file
		"draba-20260708T020000Z-manual.db.bak",  // trailing garbage
		"xdraba-20260708T020000Z-manual.db",     // leading garbage
		"draba-20260708T020000Z-other.db",       // unknown trigger
		"draba-2026-07-08T02:00:00Z-manual.db",  // wrong timestamp shape
		"../draba-20260708T020000Z-manual.db",   // traversal
		"..\\draba-20260708T020000Z-manual.db",  // traversal, Windows
		"a/draba-20260708T020000Z-manual.db",    // separator
		"draba-20260708T020000Z-manual.db/../x", // separator after match
		" draba-20260708T020000Z-manual.db",     // leading space
		"DRABA-20260708T020000Z-MANUAL.DB",      // wrong case
		"draba--manual.db",                      // missing timestamp
	}
	for _, name := range rejected {
		_, _, ok := ParseFilename(name)
		assert.False(t, ok, "expected %q to be rejected", name)
	}
}

func TestSQLiteEngine_BackupUnderConcurrentWrites(t *testing.T) {
	database, _ := openTestDB(t)
	_, err := database.Exec("CREATE TABLE items (id INTEGER PRIMARY KEY, v TEXT)")
	require.NoError(t, err)
	for i := 0; i < 100; i++ {
		_, err := database.Exec("INSERT INTO items (v) VALUES ('seed')")
		require.NoError(t, err)
	}

	dir := t.TempDir()
	m := NewManager(NewSQLiteEngine(database), dir, "unused")

	// Keep writing while the backup runs; the snapshot must stay coherent.
	stop := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
				_, _ = database.Exec("INSERT INTO items (v) VALUES ('during')")
			}
		}
	}()

	entry, err := m.RunNow(context.Background(), TriggerManual)
	close(stop)
	wg.Wait()
	require.NoError(t, err)
	require.NotNil(t, entry)
	assert.Equal(t, TriggerManual, entry.Trigger)
	assert.Greater(t, entry.SizeBytes, int64(0))

	// The copy must be a standalone, sound database with at least the
	// seeded rows.
	copyDB, err := sqlx.Open("sqlite", filepath.Join(dir, entry.Filename))
	require.NoError(t, err)
	defer func() { _ = copyDB.Close() }()
	var integrity string
	require.NoError(t, copyDB.Get(&integrity, "PRAGMA integrity_check"))
	assert.Equal(t, "ok", integrity)
	var count int
	require.NoError(t, copyDB.Get(&count, "SELECT COUNT(*) FROM items"))
	assert.GreaterOrEqual(t, count, 100)
}

func TestManager_VerifyFailureRemovesCopy(t *testing.T) {
	dir := t.TempDir()
	eng := &fakeEngine{verify: func(context.Context, string) error {
		return errors.New("corrupt")
	}}
	m := NewManager(eng, dir, "unused")

	_, err := m.RunNow(context.Background(), TriggerManual)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "verifying backup")

	// Nothing that looks like a backup may remain — not even the temp file.
	dirents, err := os.ReadDir(dir)
	require.NoError(t, err)
	assert.Empty(t, dirents)
}

func TestManager_BackupFailureRemovesPartialFile(t *testing.T) {
	dir := t.TempDir()
	eng := &fakeEngine{backup: func(_ context.Context, dest string) error {
		// Simulate disk-full mid-copy: a partial file exists, then failure.
		_ = os.WriteFile(dest, []byte("partial"), 0o644)
		return errors.New("disk full")
	}}
	m := NewManager(eng, dir, "unused")

	_, err := m.RunNow(context.Background(), TriggerManual)
	require.Error(t, err)
	dirents, err := os.ReadDir(dir)
	require.NoError(t, err)
	assert.Empty(t, dirents)
}

func TestManager_RetentionSweep(t *testing.T) {
	dir := t.TempDir()
	m := NewManager(&fakeEngine{}, dir, "unused")
	m.SetKeepLast(2)

	// A foreign file the admin dropped in must survive every sweep.
	foreign := filepath.Join(dir, "pre-upgrade.db")
	require.NoError(t, os.WriteFile(foreign, []byte("keep me"), 0o644))

	clock := time.Date(2026, 7, 8, 2, 0, 0, 0, time.UTC)
	m.now = func() time.Time { return clock }

	var names []string
	for i := 0; i < 3; i++ {
		entry, err := m.RunNow(context.Background(), TriggerScheduled)
		require.NoError(t, err)
		names = append(names, entry.Filename)
		clock = clock.Add(time.Hour)
	}

	history, err := m.History()
	require.NoError(t, err)
	require.Len(t, history, 2)
	// Newest first; the oldest of the three was swept.
	assert.Equal(t, names[2], history[0].Filename)
	assert.Equal(t, names[1], history[1].Filename)
	_, err = os.Stat(filepath.Join(dir, names[0]))
	assert.True(t, errors.Is(err, os.ErrNotExist), "oldest backup should be deleted")

	_, err = os.Stat(foreign)
	assert.NoError(t, err, "foreign file must never be touched")
}

func TestManager_SameSecondBackupsDoNotCollide(t *testing.T) {
	dir := t.TempDir()
	m := NewManager(&fakeEngine{}, dir, "unused")
	fixed := time.Date(2026, 7, 8, 2, 0, 0, 0, time.UTC)
	m.now = func() time.Time { return fixed }

	e1, err := m.RunNow(context.Background(), TriggerManual)
	require.NoError(t, err)
	e2, err := m.RunNow(context.Background(), TriggerManual)
	require.NoError(t, err)
	assert.NotEqual(t, e1.Filename, e2.Filename)

	history, err := m.History()
	require.NoError(t, err)
	assert.Len(t, history, 2)
}

func TestManager_ConcurrencyGuard(t *testing.T) {
	dir := t.TempDir()
	started := make(chan struct{})
	release := make(chan struct{})
	eng := &fakeEngine{backup: func(_ context.Context, dest string) error {
		close(started)
		<-release
		return os.WriteFile(dest, []byte("slow backup"), 0o644)
	}}
	m := NewManager(eng, dir, "unused")

	done := make(chan error, 1)
	go func() {
		_, err := m.RunNow(context.Background(), TriggerScheduled)
		done <- err
	}()
	<-started

	assert.True(t, m.Running())
	_, err := m.RunNow(context.Background(), TriggerManual)
	assert.ErrorIs(t, err, ErrBackupInProgress)

	close(release)
	require.NoError(t, <-done)
	assert.False(t, m.Running())
}

func TestManager_DeleteGuards(t *testing.T) {
	dir := t.TempDir()
	m := NewManager(&fakeEngine{}, dir, "unused")

	entry, err := m.RunNow(context.Background(), TriggerManual)
	require.NoError(t, err)

	// Traversal-shaped and foreign names are ErrNotFound, never resolved.
	assert.ErrorIs(t, m.Delete("../"+entry.Filename), ErrNotFound)
	assert.ErrorIs(t, m.Delete("..\\"+entry.Filename), ErrNotFound)
	assert.ErrorIs(t, m.Delete("pre-upgrade.db"), ErrNotFound)
	assert.ErrorIs(t, m.Delete("draba-20990101T000000Z-manual.db"), ErrNotFound)

	require.NoError(t, m.Delete(entry.Filename))
	assert.ErrorIs(t, m.Delete(entry.Filename), ErrNotFound)
}

func TestManager_HistoryMissingDirIsEmpty(t *testing.T) {
	m := NewManager(&fakeEngine{}, filepath.Join(t.TempDir(), "never-created"), "unused")
	history, err := m.History()
	require.NoError(t, err)
	assert.NotNil(t, history)
	assert.Empty(t, history)
}

func TestManager_Status(t *testing.T) {
	database, dbPath := openTestDB(t)
	_, err := database.Exec("CREATE TABLE items (id INTEGER PRIMARY KEY)")
	require.NoError(t, err)

	dir := t.TempDir()
	m := NewManager(NewSQLiteEngine(database), dir, dbPath)

	// Fresh instance: no backups yet is critical, honestly.
	st, err := m.Status()
	require.NoError(t, err)
	assert.Equal(t, "sqlite", st.Database.Driver)
	assert.Equal(t, dbPath, st.Database.Path)
	assert.Greater(t, st.Database.SizeBytes, int64(0))
	assert.NotNil(t, st.Database.ModifiedAt)
	assert.True(t, st.BackupDir.Writable)
	assert.Nil(t, st.LastBackup)
	assert.Equal(t, HealthCritical, st.Health)
	assert.False(t, st.Running)

	_, err = m.RunNow(context.Background(), TriggerManual)
	require.NoError(t, err)

	st, err = m.Status()
	require.NoError(t, err)
	require.NotNil(t, st.LastBackup)
	assert.Equal(t, HealthOK, st.Health)
}

func TestHealthFor_Thresholds(t *testing.T) {
	now := time.Date(2026, 7, 8, 12, 0, 0, 0, time.UTC)
	at := func(d time.Duration) *time.Time {
		ts := now.Add(-d)
		return &ts
	}
	cases := []struct {
		name string
		last *time.Time
		want string
	}{
		{"no backup", nil, HealthCritical},
		{"3 hours old", at(3 * time.Hour), HealthOK},
		{"just under 24h", at(24*time.Hour - time.Second), HealthOK},
		{"exactly 24h", at(24 * time.Hour), HealthStale},
		{"4 days old", at(4 * 24 * time.Hour), HealthStale},
		{"exactly 7 days", at(7 * 24 * time.Hour), HealthStale},
		{"over 7 days", at(7*24*time.Hour + time.Second), HealthCritical},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assert.Equal(t, c.want, HealthFor(c.last, now))
		})
	}
}

package backup

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/events"
)

// Sentinel errors surfaced to the HTTP layer.
var (
	// ErrBackupInProgress is returned when a backup is requested while one
	// is already running. One backup at a time, always.
	ErrBackupInProgress = errors.New("a backup is already in progress")
	// ErrNotFound is returned by Delete when the filename does not match
	// the backup pattern or no such backup exists.
	ErrNotFound = errors.New("backup not found")
)

// tempName is the in-progress copy's filename. It never matches
// filenamePattern, so an interrupted backup is invisible to history and
// retention, and is simply overwritten by the next run.
const tempName = "draba-inprogress.tmp"

// DefaultKeepLast is the retention count applied until a schedule config
// says otherwise.
const DefaultKeepLast = 14

// Entry describes one backup file, as listed in history and returned from
// a manual run. CreatedAt is the timestamp embedded in the filename — the
// filename is the record.
type Entry struct {
	Filename  string    `json:"filename"`
	SizeBytes int64     `json:"sizeBytes"`
	CreatedAt time.Time `json:"createdAt"`
	Trigger   Trigger   `json:"trigger"`
}

// DatabaseInfo reports facts about the live database file for the status
// endpoint.
type DatabaseInfo struct {
	Driver       string     `json:"driver"`
	Path         string     `json:"path"`
	SizeBytes    int64      `json:"sizeBytes"`
	WalSizeBytes int64      `json:"walSizeBytes"`
	ModifiedAt   *time.Time `json:"modifiedAt"`
}

// DirInfo reports where backups land and whether that directory is
// currently writable.
type DirInfo struct {
	Path     string `json:"path"`
	Writable bool   `json:"writable"`
}

// Status is the aggregate state the admin status endpoint reports.
type Status struct {
	Database   DatabaseInfo `json:"database"`
	BackupDir  DirInfo      `json:"backupDir"`
	LastBackup *Entry       `json:"lastBackup"`
	Health     string       `json:"health"`
	Running    bool         `json:"running"`
}

// Health thresholds are fixed in v1: a backup younger than 24h is healthy,
// older than 7 days (or absent) is critical, anything between is stale.
const (
	HealthOK       = "ok"
	HealthStale    = "stale"
	HealthCritical = "critical"
)

// HealthFor classifies backup freshness. last is the most recent backup's
// timestamp, nil when no backup exists.
func HealthFor(last *time.Time, now time.Time) string {
	switch {
	case last == nil:
		return HealthCritical
	case now.Sub(*last) < 24*time.Hour:
		return HealthOK
	case now.Sub(*last) <= 7*24*time.Hour:
		return HealthStale
	default:
		return HealthCritical
	}
}

// Manager owns the backup directory: it names, runs, verifies, lists,
// deletes, and prunes backups, and enforces that only one backup runs at
// a time.
type Manager struct {
	engine Engine
	dir    string
	dbPath string
	// keepLast is atomic because SetKeepLast is called from the scheduler
	// and the schedule PUT handler while a run may be sweeping retention.
	keepLast atomic.Int32
	running  atomic.Bool
	// bus receives backup.completed / backup.failed events when set.
	bus *events.Bus
	// mu serializes runs; TryLock (not Lock) so a second caller gets an
	// immediate ErrBackupInProgress instead of queueing.
	mu sync.Mutex
	// now is the clock, injectable in tests.
	now func() time.Time
}

// NewManager returns a Manager writing backups of the database file at
// dbPath into dir, using engine to produce and verify copies. Retention
// keeps DefaultKeepLast files until SetKeepLast says otherwise.
func NewManager(engine Engine, dir, dbPath string) *Manager {
	m := &Manager{engine: engine, dir: dir, dbPath: dbPath, now: time.Now}
	m.keepLast.Store(DefaultKeepLast)
	return m
}

// WithBus makes the manager publish backup.completed / backup.failed
// events on bus. Instance-scoped events: TeamID is left empty so the
// WebSocket hub never routes them to team subscribers.
func (m *Manager) WithBus(bus *events.Bus) *Manager {
	m.bus = bus
	return m
}

// SetKeepLast changes the retention count applied after each successful
// backup. Values below 1 are ignored — retention can shrink, never vanish.
func (m *Manager) SetKeepLast(n int) {
	if n < 1 {
		return
	}
	m.keepLast.Store(int32(n)) //nolint:gosec // bounded by schedule validation (1–365)
}

// Running reports whether a backup is currently executing.
func (m *Manager) Running() bool { return m.running.Load() }

// RunNow performs one backup synchronously: copy to a temp name, verify
// the copy, rename to the final pattern-matching name, then sweep
// retention. A failure at any step removes the partial file — a file that
// looks like a backup always is one. Returns ErrBackupInProgress when
// another backup is running (no event is published for that: nothing was
// attempted, so there is nothing to report).
func (m *Manager) RunNow(ctx context.Context, trigger Trigger) (*Entry, error) {
	if !m.mu.TryLock() {
		return nil, ErrBackupInProgress
	}
	defer m.mu.Unlock()
	m.running.Store(true)
	defer m.running.Store(false)

	entry, err := m.run(ctx, trigger)
	if m.bus != nil {
		if err != nil {
			m.bus.Publish(events.Message{Type: events.BackupFailed, Payload: &Failure{
				Trigger: trigger, Error: err.Error(), At: m.now().UTC(),
			}})
		} else {
			m.bus.Publish(events.Message{Type: events.BackupCompleted, Payload: entry})
		}
	}
	return entry, err
}

// run is RunNow's body, split out so event publication sees one
// entry-or-error result regardless of which step failed.
func (m *Manager) run(ctx context.Context, trigger Trigger) (*Entry, error) {
	if err := EnsureDir(m.dir); err != nil {
		return nil, fmt.Errorf("backup dir: %w", err)
	}

	tmp := filepath.Join(m.dir, tempName)
	// A stale temp file from a killed process would make VACUUM INTO fail.
	_ = os.Remove(tmp)

	if err := m.engine.Backup(ctx, tmp); err != nil {
		_ = os.Remove(tmp)
		return nil, fmt.Errorf("creating backup: %w", err)
	}
	// The engine creates the copy with umask-default permissions; tighten to
	// owner-only before the file gets its backup name (see EnsureDir on why).
	if err := os.Chmod(tmp, 0o600); err != nil {
		_ = os.Remove(tmp)
		return nil, fmt.Errorf("restricting backup permissions: %w", err)
	}
	if err := m.engine.Verify(ctx, tmp); err != nil {
		_ = os.Remove(tmp)
		return nil, fmt.Errorf("verifying backup: %w", err)
	}

	info, err := os.Stat(tmp)
	if err != nil {
		_ = os.Remove(tmp)
		return nil, fmt.Errorf("inspecting backup: %w", err)
	}

	// Bump the timestamp until the name is free: two backups within the
	// same second must not overwrite each other.
	ts := m.now().UTC().Truncate(time.Second)
	var final string
	for {
		final = filepath.Join(m.dir, FormatFilename(ts, trigger))
		if _, err := os.Stat(final); errors.Is(err, fs.ErrNotExist) {
			break
		}
		ts = ts.Add(time.Second)
	}
	if err := os.Rename(tmp, final); err != nil {
		_ = os.Remove(tmp)
		return nil, fmt.Errorf("finalizing backup: %w", err)
	}

	m.sweepRetention()

	return &Entry{
		Filename:  filepath.Base(final),
		SizeBytes: info.Size(),
		CreatedAt: ts,
		Trigger:   trigger,
	}, nil
}

// sweepRetention deletes the oldest pattern-matching backups beyond the
// keep-last-N count. Sweep failures are logged, never propagated — the
// backup that just succeeded is not undone by a cleanup problem.
func (m *Manager) sweepRetention() {
	keep := int(m.keepLast.Load())
	entries, err := m.History()
	if err != nil {
		slog.Warn("backup: retention sweep skipped", "err", err)
		return
	}
	if len(entries) <= keep {
		return
	}
	for _, e := range entries[keep:] {
		if err := os.Remove(filepath.Join(m.dir, e.Filename)); err != nil {
			slog.Warn("backup: retention delete failed", "file", e.Filename, "err", err)
		}
	}
}

// History lists the backups in the directory, newest first. The filesystem
// is the source of truth: files deleted out-of-band disappear, and files
// that don't match the backup pattern are never listed. A missing directory
// is an empty history, not an error.
func (m *Manager) History() ([]Entry, error) {
	dirents, err := os.ReadDir(m.dir)
	if errors.Is(err, fs.ErrNotExist) {
		return []Entry{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reading backup dir: %w", err)
	}

	entries := []Entry{}
	for _, d := range dirents {
		if d.IsDir() {
			continue
		}
		ts, trigger, ok := ParseFilename(d.Name())
		if !ok {
			continue
		}
		var size int64
		if info, err := d.Info(); err == nil {
			size = info.Size()
		}
		entries = append(entries, Entry{
			Filename:  d.Name(),
			SizeBytes: size,
			CreatedAt: ts,
			Trigger:   trigger,
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		if !entries[i].CreatedAt.Equal(entries[j].CreatedAt) {
			return entries[i].CreatedAt.After(entries[j].CreatedAt)
		}
		return entries[i].Filename > entries[j].Filename
	})
	return entries, nil
}

// Delete removes one backup by filename. The strict pattern match is the
// path-traversal guard: nothing containing a separator (or any name this
// package didn't create) can ever resolve to a deletable path. Returns
// ErrNotFound for pattern mismatches and missing files alike.
func (m *Manager) Delete(filename string) error {
	if _, _, ok := ParseFilename(filename); !ok {
		return ErrNotFound
	}
	err := os.Remove(filepath.Join(m.dir, filename))
	if errors.Is(err, fs.ErrNotExist) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("deleting backup: %w", err)
	}
	return nil
}

// Status reports the live database file's stats, the backup directory's
// writability, the most recent backup, and the derived health rating.
func (m *Manager) Status() (*Status, error) {
	st := &Status{
		Database:  DatabaseInfo{Driver: "sqlite", Path: m.dbPath},
		BackupDir: DirInfo{Path: m.dir, Writable: EnsureDir(m.dir) == nil},
		Running:   m.Running(),
	}

	// Stat failures (e.g. an in-memory DSN in tests) leave sizes at zero
	// rather than failing the whole status call.
	if info, err := os.Stat(m.dbPath); err == nil {
		st.Database.SizeBytes = info.Size()
		mod := info.ModTime().UTC()
		st.Database.ModifiedAt = &mod
	}
	if info, err := os.Stat(m.dbPath + "-wal"); err == nil {
		st.Database.WalSizeBytes = info.Size()
	}

	history, err := m.History()
	if err != nil {
		return nil, err
	}
	var last *time.Time
	if len(history) > 0 {
		st.LastBackup = &history[0]
		last = &history[0].CreatedAt
	}
	st.Health = HealthFor(last, m.now().UTC())
	return st, nil
}

// EnsureDir creates dir if needed and probes that it is writable by
// creating and removing a marker file. Called at startup (so a broken
// volume mount is loud in the logs from boot) and before every run.
func EnsureDir(dir string) error {
	// 0700/0600 throughout: a backup is the full database — password hashes
	// and encrypted credentials included — so nothing but the app's own user
	// should be able to read it.
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("creating %s: %w", dir, err)
	}
	probe := filepath.Join(dir, ".draba-writecheck")
	f, err := os.Create(probe)
	if err != nil {
		return fmt.Errorf("%s is not writable: %w", dir, err)
	}
	_ = f.Close()
	if err := os.Remove(probe); err != nil {
		return fmt.Errorf("cleaning up write probe in %s: %w", dir, err)
	}
	return nil
}

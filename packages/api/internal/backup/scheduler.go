package backup

import (
	"context"
	"errors"
	"log/slog"
	"time"
)

// Scheduler runs backups unattended: it loads the schedule, sleeps until
// the next run, backs up, and repeats. It is a purpose-built goroutine,
// deliberately not a job framework — the first background scheduler in the
// codebase should stay exactly as small as its one consumer needs.
//
// Missed windows (container down at 2am) are not made up on boot: the next
// window just runs, and the status health indicator reports the gap
// honestly.
type Scheduler struct {
	manager *Manager
	store   SettingsStore
	// reload wakes the run loop to re-read the schedule after a config
	// change. Buffered so Reload never blocks a request handler.
	reload chan struct{}
	// now and after are the clock, injectable in tests.
	now   func() time.Time
	after func(d time.Duration) <-chan time.Time
}

// NewScheduler returns a Scheduler driving m from the schedule stored in
// store. Call Run in a goroutine to start it.
func NewScheduler(m *Manager, store SettingsStore) *Scheduler {
	return &Scheduler{
		manager: m,
		store:   store,
		reload:  make(chan struct{}, 1),
		now:     time.Now,
		after:   time.After,
	}
}

// Reload wakes the run loop to pick up a changed schedule. Non-blocking;
// coalesces with an already-pending reload.
func (s *Scheduler) Reload() {
	select {
	case s.reload <- struct{}{}:
	default:
	}
}

// Run executes the schedule until ctx is cancelled. Each iteration re-reads
// the stored config, so a Reload after a PUT is all it takes to apply a
// change — including the retention count, which is pushed to the manager
// here so scheduled and manual runs sweep with the same keep-last-N.
func (s *Scheduler) Run(ctx context.Context) {
	for {
		sched, err := LoadSchedule(s.store)
		if err != nil {
			// A corrupt stored value must not silently disable backups —
			// fall back to the default-on schedule and say so.
			slog.Warn("backup: stored schedule unreadable; using default", "err", err)
			sched = DefaultSchedule()
		}
		s.manager.SetKeepLast(sched.KeepLast)

		if sched.Preset == PresetOff {
			select {
			case <-ctx.Done():
				return
			case <-s.reload:
				continue
			}
		}

		next := sched.NextRun(s.now())
		select {
		case <-ctx.Done():
			return
		case <-s.reload:
			continue
		case <-s.after(next.Sub(s.now())):
			if _, err := s.manager.RunNow(ctx, TriggerScheduled); err != nil {
				if errors.Is(err, ErrBackupInProgress) {
					// A manual backup is mid-flight; this window is simply
					// skipped rather than queued behind it.
					slog.Info("backup: scheduled run skipped; another backup is in progress")
				} else {
					slog.Error("backup: scheduled run failed", "err", err)
				}
			}
		}
	}
}

package backup

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeClock drives a Scheduler deterministically: every requested wait is
// pushed onto waits, and the test fires ticks by sending on tick.
type fakeClock struct {
	now   time.Time
	waits chan time.Duration
	tick  chan time.Time
}

func newFakeClock(now time.Time) *fakeClock {
	return &fakeClock{now: now, waits: make(chan time.Duration, 16), tick: make(chan time.Time)}
}

// install wires the clock into s and starts Run, cancelling it at test end.
func (c *fakeClock) install(t *testing.T, s *Scheduler) {
	t.Helper()
	s.now = func() time.Time { return c.now }
	s.after = func(d time.Duration) <-chan time.Time {
		c.waits <- d
		return c.tick
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go s.Run(ctx)
}

// nextWait returns the next wait duration the scheduler requested.
func (c *fakeClock) nextWait(t *testing.T) time.Duration {
	t.Helper()
	select {
	case d := <-c.waits:
		return d
	case <-time.After(5 * time.Second):
		t.Fatal("scheduler never requested a wait")
		return 0
	}
}

// scheduledCount polls until the directory holds want scheduled backups.
func scheduledCount(t *testing.T, dir string, want int) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		n := 0
		dirents, err := os.ReadDir(dir)
		require.NoError(t, err)
		for _, d := range dirents {
			if _, trigger, ok := ParseFilename(d.Name()); ok && trigger == TriggerScheduled {
				n++
			}
		}
		if n == want {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("expected %d scheduled backups, found %d", want, n)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestScheduler_WaitsMatchEveryPreset(t *testing.T) {
	// 2026-07-08 10:17 UTC is a Wednesday.
	now := time.Date(2026, 7, 8, 10, 17, 0, 0, time.UTC)
	cases := []struct {
		name  string
		sched Schedule
		want  time.Duration
	}{
		{"hourly", Schedule{Preset: PresetHourly, KeepLast: 14}, 43 * time.Minute},
		{"every6h", Schedule{Preset: PresetEvery6h, KeepLast: 14}, time.Hour + 43*time.Minute},
		{"every12h", Schedule{Preset: PresetEvery12h, KeepLast: 14}, time.Hour + 43*time.Minute},
		{"daily", Schedule{Preset: PresetDaily, Time: "02:00", KeepLast: 14}, 15*time.Hour + 43*time.Minute},
		{"weekly", Schedule{Preset: PresetWeekly, Time: "02:00", Day: "thu", KeepLast: 14}, 15*time.Hour + 43*time.Minute},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			mgr := NewManager(&fakeEngine{}, dir, "unused")
			store := &memStore{}
			require.NoError(t, SaveSchedule(store, tc.sched))

			clock := newFakeClock(now)
			s := NewScheduler(mgr, store)
			clock.install(t, s)

			assert.Equal(t, tc.want, clock.nextWait(t))

			// Fire the timer: a scheduled backup lands on disk and the loop
			// recomputes the next wait.
			clock.tick <- clock.now
			scheduledCount(t, dir, 1)
			clock.nextWait(t)
		})
	}
}

func TestScheduler_AppliesKeepLastAndDefaultOn(t *testing.T) {
	// No stored config: the scheduler runs the default-on schedule.
	dir := t.TempDir()
	mgr := NewManager(&fakeEngine{}, dir, "unused")
	clock := newFakeClock(time.Date(2026, 7, 8, 10, 0, 0, 0, time.UTC))
	s := NewScheduler(mgr, &memStore{})
	clock.install(t, s)

	// Default daily 02:00 → 16h wait from 10:00.
	assert.Equal(t, 16*time.Hour, clock.nextWait(t))
	assert.Equal(t, int32(DefaultKeepLast), mgr.keepLast.Load())
}

func TestScheduler_ReloadRecomputes(t *testing.T) {
	dir := t.TempDir()
	mgr := NewManager(&fakeEngine{}, dir, "unused")
	store := &memStore{}
	require.NoError(t, SaveSchedule(store, Schedule{Preset: PresetDaily, Time: "02:00", KeepLast: 14}))

	clock := newFakeClock(time.Date(2026, 7, 8, 10, 0, 0, 0, time.UTC))
	s := NewScheduler(mgr, store)
	clock.install(t, s)
	assert.Equal(t, 16*time.Hour, clock.nextWait(t))

	// Change the config mid-wait: the reload abandons the pending timer,
	// recomputes, and applies the new retention count.
	require.NoError(t, SaveSchedule(store, Schedule{Preset: PresetHourly, KeepLast: 3}))
	s.Reload()
	assert.Equal(t, time.Hour, clock.nextWait(t))
	assert.Equal(t, int32(3), mgr.keepLast.Load())
}

func TestScheduler_OffWaitsForReload(t *testing.T) {
	dir := t.TempDir()
	mgr := NewManager(&fakeEngine{}, dir, "unused")
	store := &memStore{}
	require.NoError(t, SaveSchedule(store, Schedule{Preset: PresetOff, KeepLast: 14}))

	clock := newFakeClock(time.Date(2026, 7, 8, 10, 0, 0, 0, time.UTC))
	s := NewScheduler(mgr, store)
	clock.install(t, s)

	// Off: no timer is ever requested…
	select {
	case d := <-clock.waits:
		t.Fatalf("off preset must not request a wait, got %v", d)
	case <-time.After(100 * time.Millisecond):
	}

	// …until a reload turns scheduling on.
	require.NoError(t, SaveSchedule(store, Schedule{Preset: PresetHourly, KeepLast: 14}))
	s.Reload()
	assert.Equal(t, time.Hour, clock.nextWait(t))
}

func TestScheduler_SkipsTickWhileBackupRunning(t *testing.T) {
	dir := t.TempDir()
	release := make(chan struct{})
	started := make(chan struct{})
	eng := &fakeEngine{backup: func(_ context.Context, dest string) error {
		close(started)
		<-release
		return os.WriteFile(dest, []byte("manual"), 0o600)
	}}
	mgr := NewManager(eng, dir, "unused")
	store := &memStore{}
	require.NoError(t, SaveSchedule(store, Schedule{Preset: PresetHourly, KeepLast: 14}))

	clock := newFakeClock(time.Date(2026, 7, 8, 10, 0, 0, 0, time.UTC))
	s := NewScheduler(mgr, store)
	clock.install(t, s)
	clock.nextWait(t)

	// Hold a manual backup open, then fire the scheduled tick into it.
	manualDone := make(chan error, 1)
	go func() {
		_, err := mgr.RunNow(context.Background(), TriggerManual)
		manualDone <- err
	}()
	<-started
	clock.tick <- clock.now

	// The skipped tick immediately recomputes the next wait.
	clock.nextWait(t)
	close(release)
	require.NoError(t, <-manualDone)

	// Only the manual backup exists — the scheduled tick was skipped, not queued.
	scheduledCount(t, dir, 0)
}

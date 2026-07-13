package backup

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// memStore is an in-memory SettingsStore for schedule persistence tests.
type memStore struct {
	mu   sync.Mutex
	vals map[string]string
}

func (s *memStore) Get(key string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.vals[key], nil
}

func (s *memStore) Set(key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.vals == nil {
		s.vals = map[string]string{}
	}
	s.vals[key] = value
	return nil
}

func TestSchedule_Validate(t *testing.T) {
	valid := []Schedule{
		{Preset: PresetOff, KeepLast: 1},
		{Preset: PresetHourly, KeepLast: 365},
		{Preset: PresetEvery6h, KeepLast: 14},
		{Preset: PresetEvery12h, KeepLast: 14},
		{Preset: PresetDaily, Time: "02:00", KeepLast: 14},
		{Preset: PresetDaily, Time: "23:59", KeepLast: 14},
		{Preset: PresetWeekly, Time: "02:00", Day: "sun", KeepLast: 14},
	}
	for _, s := range valid {
		assert.NoError(t, s.Validate(), "%+v", s)
	}

	invalid := []Schedule{
		{Preset: "cron", KeepLast: 14},                                     // unknown preset
		{Preset: PresetDaily, Time: "", KeepLast: 14},                      // missing time
		{Preset: PresetDaily, Time: "2:00", KeepLast: 14},                  // not HH:MM
		{Preset: PresetDaily, Time: "24:00", KeepLast: 14},                 // hour out of range
		{Preset: PresetDaily, Time: "12:60", KeepLast: 14},                 // minute out of range
		{Preset: PresetWeekly, Time: "02:00", KeepLast: 14},                // missing day
		{Preset: PresetWeekly, Time: "02:00", Day: "monday", KeepLast: 14}, // long day name
		{Preset: PresetHourly, KeepLast: 0},                                // keepLast too small
		{Preset: PresetHourly, KeepLast: 366},                              // keepLast too large
	}
	for _, s := range invalid {
		assert.Error(t, s.Validate(), "%+v", s)
	}
}

func TestSchedule_Normalize(t *testing.T) {
	s := Schedule{Preset: PresetHourly, Time: "02:00", Day: "mon", KeepLast: 14}.Normalize()
	assert.Empty(t, s.Time, "hourly must not keep a stale time")
	assert.Empty(t, s.Day, "hourly must not keep a stale day")

	s = Schedule{Preset: PresetDaily, Time: "02:00", Day: "mon", KeepLast: 14}.Normalize()
	assert.Equal(t, "02:00", s.Time)
	assert.Empty(t, s.Day, "daily must not keep a stale day")

	s = Schedule{Preset: PresetWeekly, Time: "02:00", Day: "mon", KeepLast: 14}.Normalize()
	assert.Equal(t, "02:00", s.Time)
	assert.Equal(t, "mon", s.Day)
}

func TestSchedule_NextRun(t *testing.T) {
	// 2026-07-08 is a Wednesday.
	at := func(h, m int) time.Time {
		return time.Date(2026, 7, 8, h, m, 0, 0, time.UTC)
	}
	cases := []struct {
		name  string
		sched Schedule
		now   time.Time
		want  time.Time
	}{
		{"off never runs", Schedule{Preset: PresetOff}, at(10, 0), time.Time{}},
		{"hourly next top of hour", Schedule{Preset: PresetHourly}, at(10, 17), at(11, 0)},
		{"hourly on the boundary is strictly after", Schedule{Preset: PresetHourly}, at(10, 0), at(11, 0)},
		{"every6h anchored to UTC midnight", Schedule{Preset: PresetEvery6h}, at(10, 17), at(12, 0)},
		{"every6h late evening wraps to midnight", Schedule{Preset: PresetEvery6h}, at(23, 30), time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC)},
		{"every12h afternoon wraps to midnight", Schedule{Preset: PresetEvery12h}, at(13, 0), time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC)},
		{"daily before the time runs today", Schedule{Preset: PresetDaily, Time: "14:30"}, at(10, 0), at(14, 30)},
		{"daily after the time runs tomorrow", Schedule{Preset: PresetDaily, Time: "02:00"}, at(10, 0), time.Date(2026, 7, 9, 2, 0, 0, 0, time.UTC)},
		{"daily exactly at the time runs tomorrow", Schedule{Preset: PresetDaily, Time: "10:00"}, at(10, 0), time.Date(2026, 7, 9, 10, 0, 0, 0, time.UTC)},
		{"weekly same day before the time runs today", Schedule{Preset: PresetWeekly, Time: "14:00", Day: "wed"}, at(10, 0), at(14, 0)},
		{"weekly same day after the time waits a week", Schedule{Preset: PresetWeekly, Time: "02:00", Day: "wed"}, at(10, 0), time.Date(2026, 7, 15, 2, 0, 0, 0, time.UTC)},
		{"weekly later in the week", Schedule{Preset: PresetWeekly, Time: "02:00", Day: "sat"}, at(10, 0), time.Date(2026, 7, 11, 2, 0, 0, 0, time.UTC)},
		{"weekly wraps past the weekend", Schedule{Preset: PresetWeekly, Time: "02:00", Day: "mon"}, at(10, 0), time.Date(2026, 7, 13, 2, 0, 0, 0, time.UTC)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.sched.NextRun(tc.now)
			assert.True(t, got.Equal(tc.want), "got %v, want %v", got, tc.want)
			if !tc.want.IsZero() {
				assert.True(t, got.After(tc.now), "next run must be strictly after now")
			}
		})
	}
}

func TestSchedule_LoadDefaultsWhenUnset(t *testing.T) {
	sched, err := LoadSchedule(&memStore{})
	require.NoError(t, err)
	assert.Equal(t, DefaultSchedule(), sched, "an instance with no stored config is default-on")
	assert.Equal(t, PresetDaily, sched.Preset)
	assert.Equal(t, "02:00", sched.Time)
	assert.Equal(t, 14, sched.KeepLast)
}

func TestSchedule_SaveLoadRoundTrip(t *testing.T) {
	store := &memStore{}
	in := Schedule{Preset: PresetWeekly, Time: "03:15", Day: "sun", KeepLast: 30}
	require.NoError(t, SaveSchedule(store, in))

	out, err := LoadSchedule(store)
	require.NoError(t, err)
	assert.Equal(t, in, out)
}

func TestSchedule_LoadRejectsCorruptValue(t *testing.T) {
	store := &memStore{}
	require.NoError(t, store.Set(ScheduleKey, "{not json"))
	_, err := LoadSchedule(store)
	assert.Error(t, err)
}

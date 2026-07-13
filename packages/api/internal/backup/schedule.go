package backup

import (
	"encoding/json"
	"fmt"
	"time"
)

// Preset names one of the supported schedule cadences. Presets, not cron
// expressions: they cover the real use cases, need no parser dependency,
// and render as dropdowns instead of a syntax textbox.
type Preset string

// The supported schedule presets.
const (
	PresetOff      Preset = "off"
	PresetHourly   Preset = "hourly"
	PresetEvery6h  Preset = "every6h"
	PresetEvery12h Preset = "every12h"
	PresetDaily    Preset = "daily"
	PresetWeekly   Preset = "weekly"
)

// ScheduleKey is the instance_settings key holding the JSON-encoded
// schedule. One key, no new table — the 010 key/value store is enough.
const ScheduleKey = "backup.schedule"

// Schedule is the backup schedule configuration. Time and Day only apply
// to the presets that need them (daily/weekly and weekly respectively);
// Normalize clears them otherwise. All times are UTC — the scheduler has
// no timezone knob in v1, which keeps next-run computation DST-free.
type Schedule struct {
	Preset   Preset `json:"preset"`
	Time     string `json:"time,omitempty"` // "HH:MM", daily and weekly only
	Day      string `json:"day,omitempty"`  // "mon".."sun", weekly only
	KeepLast int    `json:"keepLast"`
}

// DefaultSchedule is the configuration applied when an instance has never
// stored one: daily at 02:00 UTC, keep the last 14. Default-on — safe by
// default beats opt-in for a data-safety feature.
func DefaultSchedule() Schedule {
	return Schedule{Preset: PresetDaily, Time: "02:00", KeepLast: 14}
}

// weekdays maps the wire format for Schedule.Day to time.Weekday.
var weekdays = map[string]time.Weekday{
	"mon": time.Monday, "tue": time.Tuesday, "wed": time.Wednesday,
	"thu": time.Thursday, "fri": time.Friday, "sat": time.Saturday,
	"sun": time.Sunday,
}

// Validate checks the schedule for internal consistency and returns a
// human-readable error suitable for a 400 response body.
func (s Schedule) Validate() error {
	switch s.Preset {
	case PresetOff, PresetHourly, PresetEvery6h, PresetEvery12h:
	case PresetDaily, PresetWeekly:
		if _, _, err := parseHHMM(s.Time); err != nil {
			return fmt.Errorf("time must be HH:MM for the %s preset: %w", s.Preset, err)
		}
		if s.Preset == PresetWeekly {
			if _, ok := weekdays[s.Day]; !ok {
				return fmt.Errorf("day must be one of mon..sun for the weekly preset")
			}
		}
	default:
		return fmt.Errorf("preset must be one of off, hourly, every6h, every12h, daily, weekly")
	}
	if s.KeepLast < 1 || s.KeepLast > 365 {
		return fmt.Errorf("keepLast must be between 1 and 365")
	}
	return nil
}

// Normalize clears the fields the preset does not use, so a stored config
// never carries stale leftovers from a previous preset choice.
func (s Schedule) Normalize() Schedule {
	if s.Preset != PresetDaily && s.Preset != PresetWeekly {
		s.Time = ""
	}
	if s.Preset != PresetWeekly {
		s.Day = ""
	}
	return s
}

// NextRun returns the first run time strictly after now, in UTC. The zero
// time means the schedule never runs (preset off or invalid). Interval
// presets are anchored to UTC midnight, so hourly runs at the top of each
// hour and every6h at 00/06/12/18 — deterministic and table-testable.
func (s Schedule) NextRun(now time.Time) time.Time {
	now = now.UTC()
	switch s.Preset {
	case PresetHourly:
		return now.Truncate(time.Hour).Add(time.Hour)
	case PresetEvery6h:
		return now.Truncate(6 * time.Hour).Add(6 * time.Hour)
	case PresetEvery12h:
		return now.Truncate(12 * time.Hour).Add(12 * time.Hour)
	case PresetDaily, PresetWeekly:
		hour, minute, err := parseHHMM(s.Time)
		if err != nil {
			return time.Time{}
		}
		candidate := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, time.UTC)
		if !candidate.After(now) {
			candidate = candidate.AddDate(0, 0, 1)
		}
		if s.Preset == PresetWeekly {
			target, ok := weekdays[s.Day]
			if !ok {
				return time.Time{}
			}
			for candidate.Weekday() != target {
				candidate = candidate.AddDate(0, 0, 1)
			}
		}
		return candidate
	default:
		return time.Time{}
	}
}

// parseHHMM parses a 24-hour "HH:MM" string.
func parseHHMM(s string) (hour, minute int, err error) {
	if len(s) != 5 || s[2] != ':' {
		return 0, 0, fmt.Errorf("%q is not in HH:MM format", s)
	}
	if _, err := fmt.Sscanf(s, "%02d:%02d", &hour, &minute); err != nil {
		return 0, 0, fmt.Errorf("%q is not in HH:MM format", s)
	}
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return 0, 0, fmt.Errorf("%q is out of range", s)
	}
	return hour, minute, nil
}

// SettingsStore is the subset of the instance-settings repository the
// backup package needs to persist its schedule.
type SettingsStore interface {
	Get(key string) (string, error)
	Set(key, value string) error
}

// LoadSchedule reads the stored schedule, applying the default-on
// configuration when none has ever been saved. A stored value that fails
// to parse is an error — the caller decides whether to fall back.
func LoadSchedule(store SettingsStore) (Schedule, error) {
	raw, err := store.Get(ScheduleKey)
	if err != nil {
		return Schedule{}, fmt.Errorf("loading backup schedule: %w", err)
	}
	if raw == "" {
		return DefaultSchedule(), nil
	}
	var s Schedule
	if err := json.Unmarshal([]byte(raw), &s); err != nil {
		return Schedule{}, fmt.Errorf("parsing backup schedule: %w", err)
	}
	return s, nil
}

// SaveSchedule normalizes and persists s. Callers must Validate first.
func SaveSchedule(store SettingsStore, s Schedule) error {
	b, err := json.Marshal(s.Normalize())
	if err != nil {
		return fmt.Errorf("serialising backup schedule: %w", err)
	}
	if err := store.Set(ScheduleKey, string(b)); err != nil {
		return fmt.Errorf("saving backup schedule: %w", err)
	}
	return nil
}

package backup

import (
	"fmt"
	"regexp"
	"time"
)

// Trigger records what initiated a backup; it is embedded in the filename.
type Trigger string

// The two ways a backup can be initiated.
const (
	TriggerManual    Trigger = "manual"
	TriggerScheduled Trigger = "scheduled"
)

// filenameTimeLayout is the UTC timestamp embedded in backup filenames.
// Second resolution, no separators beyond T/Z, so names sort chronologically.
const filenameTimeLayout = "20060102T150405Z"

// filenamePattern matches exactly the files this package creates. It is
// deliberately strict: it doubles as the path-traversal guard on delete
// (no separator can match) and the filter that keeps foreign files an admin
// dropped into the directory out of history and retention.
var filenamePattern = regexp.MustCompile(`^draba-(\d{8}T\d{6}Z)-(manual|scheduled)\.db$`)

// FormatFilename returns the backup filename for a backup taken at t with
// the given trigger, e.g. "draba-20260708T020000Z-scheduled.db".
func FormatFilename(t time.Time, trigger Trigger) string {
	return fmt.Sprintf("draba-%s-%s.db", t.UTC().Format(filenameTimeLayout), trigger)
}

// ParseFilename reports whether name is a backup filename this package
// created, and if so returns the embedded timestamp and trigger.
func ParseFilename(name string) (t time.Time, trigger Trigger, ok bool) {
	m := filenamePattern.FindStringSubmatch(name)
	if m == nil {
		return time.Time{}, "", false
	}
	ts, err := time.Parse(filenameTimeLayout, m[1])
	if err != nil {
		return time.Time{}, "", false
	}
	return ts, Trigger(m[2]), true
}

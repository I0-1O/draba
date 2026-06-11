// Package ics serializes activities into RFC 5545 iCalendar feeds for the
// Phase 13.4 calendar share endpoint (GET /shares/{token}.ics). It implements
// only the slice of the spec draba needs — all-day VEVENTs in a PUBLISH
// calendar — rather than wrapping a general-purpose library.
package ics

import (
	"strings"
	"time"
)

// Event is one all-day calendar entry. Start and End are inclusive calendar
// dates (draba's activity model, Phase 11.1.1); End is converted to the
// RFC 5545 exclusive DTEND during serialization.
type Event struct {
	UID         string
	Summary     string
	Description string
	// Categories become the CATEGORIES property (draba tags); clients that
	// support it (Thunderbird, Apple Calendar) render them as event tags.
	Categories []string
	Start      time.Time
	End        time.Time
	// Stamp becomes DTSTAMP — the activity's last-modified time, which lets
	// calendar clients detect changed events between polls.
	Stamp time.Time
}

// Calendar renders a complete VCALENDAR document with CRLF line endings.
// name becomes X-WR-CALNAME, the display name most clients adopt when the
// user subscribes.
func Calendar(name string, events []Event) string {
	var b strings.Builder
	writeLine(&b, "BEGIN:VCALENDAR")
	writeLine(&b, "VERSION:2.0")
	writeLine(&b, "PRODID:-//draba//draba//EN")
	writeLine(&b, "CALSCALE:GREGORIAN")
	writeLine(&b, "METHOD:PUBLISH")
	// X-WR-CALNAME is the de-facto property older clients read; NAME is its
	// standardized RFC 7986 successor. Emit both so every client that names
	// the calendar from feed content gets the right answer.
	writeLine(&b, "X-WR-CALNAME:"+escapeText(name))
	writeLine(&b, "NAME:"+escapeText(name))
	// Suggest an hourly poll to clients that honor a published refresh
	// cadence (RFC 7986 REFRESH-INTERVAL; X-PUBLISHED-TTL for older ones).
	writeLine(&b, "REFRESH-INTERVAL;VALUE=DURATION:PT1H")
	writeLine(&b, "X-PUBLISHED-TTL:PT1H")
	for i := range events {
		writeEvent(&b, &events[i])
	}
	writeLine(&b, "END:VCALENDAR")
	return b.String()
}

func writeEvent(b *strings.Builder, e *Event) {
	writeLine(b, "BEGIN:VEVENT")
	writeLine(b, "UID:"+escapeText(e.UID))
	writeLine(b, "DTSTAMP:"+e.Stamp.UTC().Format("20060102T150405Z"))
	writeLine(b, "DTSTART;VALUE=DATE:"+e.Start.UTC().Format("20060102"))
	// RFC 5545 DTEND is exclusive: an event covering its inclusive end date
	// must end at midnight of the following day.
	writeLine(b, "DTEND;VALUE=DATE:"+e.End.UTC().AddDate(0, 0, 1).Format("20060102"))
	writeLine(b, "SUMMARY:"+escapeText(e.Summary))
	if e.Description != "" {
		writeLine(b, "DESCRIPTION:"+escapeText(e.Description))
	}
	if len(e.Categories) > 0 {
		// Commas separate list items here, so each value is escaped
		// individually and joined with bare (unescaped) commas.
		escaped := make([]string, len(e.Categories))
		for i, c := range e.Categories {
			escaped[i] = escapeText(c)
		}
		writeLine(b, "CATEGORIES:"+strings.Join(escaped, ","))
	}
	writeLine(b, "END:VEVENT")
}

// writeLine emits one content line, folded per RFC 5545 §3.1: lines longer
// than 75 octets continue on the next line after a CRLF + single space.
// Folding happens on rune boundaries so multi-byte UTF-8 sequences are never
// split mid-character.
func writeLine(b *strings.Builder, line string) {
	const limit = 75
	octets := 0
	for _, r := range line {
		rl := len(string(r))
		if octets+rl > limit {
			b.WriteString("\r\n ")
			// The leading fold space counts against the next line's budget.
			octets = 1
		}
		b.WriteRune(r)
		octets += rl
	}
	b.WriteString("\r\n")
}

// escapeText escapes a value per RFC 5545 §3.3.11: backslash, semicolon, and
// comma are backslash-escaped; newlines become literal "\n".
func escapeText(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, ";", `\;`)
	s = strings.ReplaceAll(s, ",", `\,`)
	s = strings.ReplaceAll(s, "\r\n", `\n`)
	s = strings.ReplaceAll(s, "\n", `\n`)
	return s
}

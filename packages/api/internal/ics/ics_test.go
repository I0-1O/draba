package ics

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func TestCalendar_AllDayEvent(t *testing.T) {
	out := Calendar("Q1 Workload", []Event{{
		UID:     "act-1@draba",
		Summary: "Launch prep",
		Start:   date(2026, 5, 1),
		End:     date(2026, 5, 10),
		Stamp:   time.Date(2026, 4, 20, 9, 30, 0, 0, time.UTC),
	}})

	assert.True(t, strings.HasPrefix(out, "BEGIN:VCALENDAR\r\n"))
	assert.True(t, strings.HasSuffix(out, "END:VCALENDAR\r\n"))
	assert.Contains(t, out, "X-WR-CALNAME:Q1 Workload\r\n")
	assert.Contains(t, out, "UID:act-1@draba\r\n")
	assert.Contains(t, out, "SUMMARY:Launch prep\r\n")
	assert.Contains(t, out, "DTSTART;VALUE=DATE:20260501\r\n")
	// RFC 5545 DTEND is exclusive — one day past the inclusive end date.
	assert.Contains(t, out, "DTEND;VALUE=DATE:20260511\r\n")
	assert.Contains(t, out, "DTSTAMP:20260420T093000Z\r\n")
}

func TestCalendar_EscapesText(t *testing.T) {
	out := Calendar("cal", []Event{{
		UID:     "a@draba",
		Summary: "Plan; review, and\nship \\ deploy",
		Start:   date(2026, 1, 1),
		End:     date(2026, 1, 1),
		Stamp:   date(2026, 1, 1),
	}})
	assert.Contains(t, out, `SUMMARY:Plan\; review\, and\nship \\ deploy`)
}

func TestCalendar_FoldsLongLines(t *testing.T) {
	out := Calendar("cal", []Event{{
		UID:     "a@draba",
		Summary: strings.Repeat("x", 200),
		Start:   date(2026, 1, 1),
		End:     date(2026, 1, 1),
		Stamp:   date(2026, 1, 1),
	}})
	for _, line := range strings.Split(out, "\r\n") {
		require.LessOrEqual(t, len(line), 75, "every physical line must be at most 75 octets: %q", line)
	}
	// Unfolding (strip CRLF + space) must restore the original text.
	unfolded := strings.ReplaceAll(out, "\r\n ", "")
	assert.Contains(t, unfolded, "SUMMARY:"+strings.Repeat("x", 200))
}

func TestCalendar_NamePropsAndRefreshHint(t *testing.T) {
	out := Calendar("Sales Kick Off", nil)
	assert.Contains(t, out, "X-WR-CALNAME:Sales Kick Off\r\n")
	assert.Contains(t, out, "NAME:Sales Kick Off\r\n")
	assert.Contains(t, out, "REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n")
	assert.Contains(t, out, "X-PUBLISHED-TTL:PT1H\r\n")
}

func TestCalendar_Categories(t *testing.T) {
	out := Calendar("cal", []Event{{
		UID: "a@draba", Summary: "t",
		Categories: []string{"launch", "q1, big"},
		Start:      date(2026, 1, 1), End: date(2026, 1, 1), Stamp: date(2026, 1, 1),
	}})
	// List-separator commas stay bare; commas inside a value are escaped.
	assert.Contains(t, out, `CATEGORIES:launch,q1\, big`)
}

func TestCalendar_OmitsEmptyDescription(t *testing.T) {
	out := Calendar("cal", []Event{{
		UID: "a@draba", Summary: "t",
		Start: date(2026, 1, 1), End: date(2026, 1, 1), Stamp: date(2026, 1, 1),
	}})
	assert.NotContains(t, out, "DESCRIPTION")
}

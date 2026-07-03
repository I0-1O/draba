package importer

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// isoDate is the calendar-date format all parsed dates normalize to.
const isoDate = "2006-01-02"

// numericDateRe matches numeric dates with /, -, or . separators.
var numericDateRe = regexp.MustCompile(`^(\d{1,4})([/.\-])(\d{1,2})([/.\-])(\d{1,4})$`)

// trailingTimeRe matches a time-of-day suffix ("2026-03-05 14:00",
// "3/5/26 2:30 PM", ISO "T" separator). All dates are calendar dates, so a
// matched suffix is stripped with a warning.
var trailingTimeRe = regexp.MustCompile(`(?i)[T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(AM|PM)?\s*(Z|[+-]\d{2}:?\d{2})?$`)

// ordinalRe strips English ordinal suffixes ("March 5th" → "March 5").
var ordinalRe = regexp.MustCompile(`(?i)(\d{1,2})(st|nd|rd|th)`)

// writtenMonthLayouts are tried, in order, for dates with spelled-out months
// after commas are removed and words are title-cased.
var writtenMonthLayouts = []string{
	"January 2 2006", "Jan 2 2006", "2 January 2006", "2 Jan 2006",
	"January 2 06", "Jan 2 06", "2 January 06", "2 Jan 06",
}

// dateContext carries the column-wide day/month order decision for one file.
// order is "mdy" or "dmy"; fromFile is true when the file's own values proved
// the order (no per-cell warning needed), false when it came from the
// caller's DateOrder option (ambiguous cells are disclosed).
type dateContext struct {
	order    string
	fromFile bool
}

// resolveDateOrder makes the column-wide ambiguity decision: scan every
// numeric date cell in the mapped date columns — any first number over 12
// proves day-first, any second number over 12 proves month-first. Conflicting
// or absent evidence falls back to the caller's DateOrder (default mdy).
func resolveDateOrder(rows []parsedRow, m *columnMapping, optOrder string) dateContext {
	dayFirst, monthFirst := false, false
	for _, col := range []int{m.col(FieldStart), m.col(FieldEnd)} {
		if col < 0 {
			continue
		}
		for _, row := range rows {
			if col >= len(row.cells) || row.cells[col].serial != nil {
				continue
			}
			v := trailingTimeRe.ReplaceAllString(row.cells[col].display, "")
			g := numericDateRe.FindStringSubmatch(v)
			if len(g) == 0 {
				continue // not a numeric date
			}
			if len(g[1]) == 4 {
				continue // year-first ISO-style, never ambiguous
			}
			first, _ := strconv.Atoi(g[1])
			second, _ := strconv.Atoi(g[3])
			if first > 12 && second <= 12 {
				dayFirst = true
			}
			if second > 12 && first <= 12 {
				monthFirst = true
			}
		}
	}

	switch {
	case dayFirst && !monthFirst:
		return dateContext{order: "dmy", fromFile: true}
	case monthFirst && !dayFirst:
		return dateContext{order: "mdy", fromFile: true}
	}
	if optOrder == "dmy" {
		return dateContext{order: "dmy"}
	}
	return dateContext{order: "mdy"}
}

// parseDate parses one date cell into a calendar date. Returned issues carry
// no Field — the caller scopes them to start or end. ok is false only for
// errors; warnings accompany a valid date.
func parseDate(c cell, ctx dateContext) (time.Time, []Issue, bool) {
	if c.serial != nil {
		// Native Excel date cell — the serial is unambiguous, no warning.
		t, err := excelize.ExcelDateToTime(*c.serial, false)
		if err != nil || t.Year() < 1900 || t.Year() > 2200 {
			return time.Time{}, []Issue{{
				Level:   LevelError,
				Message: fmt.Sprintf("%q is not a recognizable date", c.display),
			}}, false
		}
		return dateOnly(t), nil, true
	}

	raw := strings.TrimSpace(c.display)
	var issues []Issue

	v := trailingTimeRe.ReplaceAllString(raw, "")
	if v != raw {
		issues = append(issues, Issue{
			Level:   LevelWarning,
			Message: fmt.Sprintf("time of day in %q ignored — all dates are calendar dates", raw),
		})
		v = strings.TrimSpace(v)
	}

	if t, err := time.Parse(isoDate, v); err == nil {
		return t, issues, true
	}

	if g := numericDateRe.FindStringSubmatch(v); g != nil {
		t, iss, ok := parseNumericDate(g, v, ctx)
		return t, append(issues, iss...), ok
	}

	if t, ok := parseWrittenDate(v); ok {
		return t, issues, true
	}

	return time.Time{}, append(issues, Issue{
		Level:   LevelError,
		Message: fmt.Sprintf("%q is not a recognizable date", raw),
	}), false
}

// parseNumericDate handles a/b/c dates (any of / - . separators). A 4-digit
// first number is year-month-day; otherwise the day/month order comes from
// the cell itself when one number exceeds 12, else from the file-wide
// decision (disclosed when that decision came from the DateOrder option).
func parseNumericDate(g []string, raw string, ctx dateContext) (time.Time, []Issue, bool) {
	first, _ := strconv.Atoi(g[1])
	second, _ := strconv.Atoi(g[3])
	third, _ := strconv.Atoi(g[5])

	badDate := func() (time.Time, []Issue, bool) {
		return time.Time{}, []Issue{{
			Level:   LevelError,
			Message: fmt.Sprintf("%q is not a recognizable date", raw),
		}}, false
	}

	if len(g[1]) == 4 {
		if t, valid := makeDate(first, second, third); valid {
			return t, nil, true
		}
		return badDate()
	}

	year := third
	if len(g[5]) <= 2 {
		year += 2000
	}

	var month, day int
	var issues []Issue
	switch {
	case first > 12 && second <= 12:
		day, month = first, second
	case second > 12 && first <= 12:
		month, day = first, second
	case ctx.order == "dmy":
		day, month = first, second
		if !ctx.fromFile && first != second {
			issues = append(issues, Issue{
				Level:   LevelWarning,
				Message: fmt.Sprintf("%q read as day-month-year", raw),
			})
		}
	default:
		month, day = first, second
		if !ctx.fromFile && first != second {
			issues = append(issues, Issue{
				Level:   LevelWarning,
				Message: fmt.Sprintf("%q read as month-day-year", raw),
			})
		}
	}

	t, valid := makeDate(year, month, day)
	if !valid {
		return badDate()
	}
	return t, issues, true
}

// parseWrittenDate handles spelled-out months in either order.
func parseWrittenDate(v string) (time.Time, bool) {
	cleaned := ordinalRe.ReplaceAllString(v, "$1")
	cleaned = strings.ReplaceAll(cleaned, ",", " ")
	words := strings.Fields(cleaned)
	for i, w := range words {
		// Title-case month words so "march"/"MARCH" match Go's layout names.
		if w != "" && ((w[0] >= 'a' && w[0] <= 'z') || (w[0] >= 'A' && w[0] <= 'Z')) {
			words[i] = strings.ToUpper(w[:1]) + strings.ToLower(w[1:])
		}
	}
	cleaned = strings.Join(words, " ")
	for _, layout := range writtenMonthLayouts {
		if t, err := time.Parse(layout, cleaned); err == nil {
			return dateOnly(t), true
		}
	}
	return time.Time{}, false
}

// makeDate builds a UTC calendar date, rejecting values time.Date would
// silently normalize (month 13 → January).
func makeDate(year, month, day int) (time.Time, bool) {
	if month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200 {
		return time.Time{}, false
	}
	t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	if t.Day() != day || int(t.Month()) != month {
		return time.Time{}, false
	}
	return t, true
}

func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

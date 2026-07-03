package importer

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustDate(t *testing.T, c cell, ctx dateContext) (string, []Issue) {
	t.Helper()
	tm, issues, ok := parseDate(c, ctx)
	require.True(t, ok, "expected %q to parse", c.display)
	return tm.Format(isoDate), issues
}

func TestParseDate_Formats(t *testing.T) {
	mdy := dateContext{order: "mdy"}
	dmy := dateContext{order: "dmy"}

	tests := []struct {
		name     string
		input    string
		ctx      dateContext
		want     string
		wantWarn bool
	}{
		{"ISO", "2026-03-05", mdy, "2026-03-05", false},
		{"ISOWithTime", "2026-03-05T14:30:00Z", mdy, "2026-03-05", true},
		{"ISOWithSpaceTime", "2026-03-05 14:30", mdy, "2026-03-05", true},
		{"SlashMDY", "3/5/2026", mdy, "2026-03-05", true},
		{"SlashDMY", "3/5/2026", dmy, "2026-05-03", true},
		{"SlashUnambiguousDayFirst", "25/3/2026", mdy, "2026-03-25", false},
		{"SlashUnambiguousMonthFirst", "3/25/2026", dmy, "2026-03-25", false},
		{"TwoDigitYear", "3/5/26", mdy, "2026-03-05", true},
		{"DotsDMY", "05.03.2026", dmy, "2026-03-05", true},
		{"DashNumeric", "5-3-2026", dmy, "2026-03-05", true},
		{"YearFirstNumeric", "2026/3/5", mdy, "2026-03-05", false},
		{"WrittenMonthFirst", "March 5, 2026", mdy, "2026-03-05", false},
		{"WrittenDayFirst", "5 Mar 2026", mdy, "2026-03-05", false},
		{"WrittenOrdinal", "March 5th, 2026", mdy, "2026-03-05", false},
		{"WrittenLowercase", "march 5 2026", mdy, "2026-03-05", false},
		{"WrittenWithTime", "March 5, 2026 9:00 AM", mdy, "2026-03-05", true},
		{"SameDayAndMonthNoWarning", "3/3/2026", mdy, "2026-03-03", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, issues := mustDate(t, cell{display: tt.input}, tt.ctx)
			assert.Equal(t, tt.want, got)
			if tt.wantWarn {
				require.NotEmpty(t, issues, "expected a disclosure warning")
				assert.Equal(t, LevelWarning, issues[0].Level)
			} else {
				assert.Empty(t, issues)
			}
		})
	}
}

func TestParseDate_FileProvenOrderSkipsWarning(t *testing.T) {
	// When the file's own values proved the order, ambiguous cells are not
	// individually flagged.
	got, issues := mustDate(t, cell{display: "3/5/2026"}, dateContext{order: "dmy", fromFile: true})
	assert.Equal(t, "2026-05-03", got)
	assert.Empty(t, issues)
}

func TestParseDate_Errors(t *testing.T) {
	for _, input := range []string{
		"not a date", "13/13/2026", "2026-02-30", "0/5/2026", "3/32/2026", "March 2026",
	} {
		t.Run(input, func(t *testing.T) {
			_, issues, ok := parseDate(cell{display: input}, dateContext{order: "mdy"})
			require.False(t, ok)
			require.NotEmpty(t, issues)
			assert.Equal(t, LevelError, issues[0].Level)
		})
	}
}

func TestParseDate_ExcelSerial(t *testing.T) {
	// 2026-03-05 is Excel serial 46086.
	serial := 46086.0
	got, issues := mustDate(t, cell{display: "03/05/26", serial: &serial}, dateContext{order: "mdy"})
	assert.Equal(t, "2026-03-05", got)
	assert.Empty(t, issues, "native Excel dates are unambiguous — no warning")
}

func TestResolveDateOrder_ColumnWide(t *testing.T) {
	mkRows := func(dates ...string) []parsedRow {
		rows := make([]parsedRow, 0, len(dates))
		for i, d := range dates {
			rows = append(rows, parsedRow{line: i + 2, cells: []cell{{display: "x"}, {display: d}}})
		}
		return rows
	}
	m := &columnMapping{fields: []string{FieldTitle, FieldStart}, byField: map[string]int{FieldTitle: 0, FieldStart: 1}}

	t.Run("DayFirstEvidenceDecidesWholeFile", func(t *testing.T) {
		ctx := resolveDateOrder(mkRows("3/5/2026", "25/3/2026"), m, "mdy")
		assert.Equal(t, "dmy", ctx.order)
		assert.True(t, ctx.fromFile)
	})
	t.Run("MonthFirstEvidenceDecidesWholeFile", func(t *testing.T) {
		ctx := resolveDateOrder(mkRows("3/25/2026", "3/5/2026"), m, "dmy")
		assert.Equal(t, "mdy", ctx.order)
		assert.True(t, ctx.fromFile)
	})
	t.Run("NoEvidenceFallsBackToOption", func(t *testing.T) {
		ctx := resolveDateOrder(mkRows("3/5/2026", "1/2/2026"), m, "dmy")
		assert.Equal(t, "dmy", ctx.order)
		assert.False(t, ctx.fromFile)
	})
	t.Run("DefaultIsMDY", func(t *testing.T) {
		ctx := resolveDateOrder(mkRows("3/5/2026"), m, "")
		assert.Equal(t, "mdy", ctx.order)
		assert.False(t, ctx.fromFile)
	})
	t.Run("ConflictingEvidenceFallsBackToOption", func(t *testing.T) {
		ctx := resolveDateOrder(mkRows("25/3/2026", "3/25/2026"), m, "mdy")
		assert.Equal(t, "mdy", ctx.order)
		assert.False(t, ctx.fromFile)
	})
}

func TestRun_ColumnWideOrderAppliedConsistently(t *testing.T) {
	// One row proves day-first; the ambiguous row must follow the same
	// interpretation without a per-cell warning.
	csvText := "Title,Start\nA,25/3/2026\nB,3/5/2026\n"
	res, err := Run([]byte(csvText), "t.csv", Options{}, Lookups{})
	require.NoError(t, err)
	require.Len(t, res.Rows, 2)
	assert.Equal(t, "2026-03-25", res.Rows[0].Activity.Start)
	assert.Equal(t, "2026-05-03", res.Rows[1].Activity.Start)
	for _, rr := range res.Rows {
		for _, is := range rr.Issues {
			assert.NotContains(t, is.Message, "read as", fmt.Sprintf("line %d: %v", rr.Line, is))
		}
	}
}

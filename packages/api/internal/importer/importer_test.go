package importer

import (
	"bytes"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

// testLookups is a fixture team: two unambiguous members, one ambiguous
// display name, two statuses, one tag, and two existing activities.
func testLookups() Lookups {
	return Lookups{
		Statuses: map[string]string{"in progress": "st1", "done": "st2"},
		MembersByName: map[string][]string{
			"sarah kowalski": {"m1"},
			"alex chen":      {"m2"},
			"jo lee":         {"m3", "m4"},
		},
		MembersByEmail: map[string]string{"sarah@example.com": "m1", "alex@example.com": "m2"},
		Tags:           map[string]string{"launch": "t1"},
		ActivitiesByTitle: map[string][]string{
			"existing parent": {"a1"},
			"twin":            {"a2", "a3"},
		},
		ExistingKeys: map[string]bool{
			DuplicateKey("Existing Activity", "2026-03-05", "2026-03-07"): true,
		},
	}
}

func runCSV(t *testing.T, csvText string, opts Options) *Result {
	t.Helper()
	res, err := Run([]byte(csvText), "test.csv", opts, testLookups())
	require.NoError(t, err)
	return res
}

// allMessages flattens a row's issue messages for substring assertions.
func allMessages(rr *RowResult) string {
	var b strings.Builder
	for _, is := range rr.Issues {
		b.WriteString(is.Message)
		b.WriteString("\n")
	}
	return b.String()
}

func TestRun_HappyPathTemplateHeaders(t *testing.T) {
	res := runCSV(t, "Title,Start,End,Description,Status,Assignees,Tags,Parent,Progress,Location,URL\n"+
		`Kickoff,2026-03-02,2026-03-02,Plan it,In Progress,"Sarah Kowalski, alex@example.com",launch,,50,HQ,https://example.com`+"\n",
		Options{})

	require.Len(t, res.Rows, 1)
	rr := res.Rows[0]
	assert.Equal(t, RowOK, rr.Status, allMessages(&rr))
	assert.Equal(t, 2, rr.Line)
	assert.Equal(t, "Kickoff", rr.Activity.Title)
	assert.Equal(t, "2026-03-02", rr.Activity.Start)
	assert.Equal(t, "In Progress", rr.Activity.Status)
	assert.Equal(t, []string{"Sarah Kowalski", "alex@example.com"}, rr.Activity.Assignees)
	assert.Equal(t, []string{"m1", "m2"}, rr.Resolved.AssigneeIDs)
	assert.Equal(t, []string{"t1"}, rr.Resolved.TagIDs)
	require.NotNil(t, rr.Resolved.StatusID)
	assert.Equal(t, "st1", *rr.Resolved.StatusID)
	require.NotNil(t, rr.Activity.Progress)
	assert.Equal(t, 50, *rr.Activity.Progress)
	assert.Equal(t, Summary{Total: 1, OK: 1}, res.Summary)
	assert.Equal(t, FieldTitle, res.Mapping["Title"])
}

func TestRun_SynonymHeadersAutoMap(t *testing.T) {
	res := runCSV(t, "Task,Begin,Finish\nThing,2026-03-02,2026-03-04\n", Options{})
	require.Len(t, res.Rows, 1)
	assert.Equal(t, FieldTitle, res.Mapping["Task"])
	assert.Equal(t, FieldStart, res.Mapping["Begin"])
	assert.Equal(t, FieldEnd, res.Mapping["Finish"])
	assert.Equal(t, "2026-03-04", res.Rows[0].Activity.End)
}

func TestRun_UnmappedColumnIgnoredWithWarning(t *testing.T) {
	res := runCSV(t, "Title,Start,End,Budget\nThing,2026-03-02,2026-03-03,9000\n", Options{})
	assert.Equal(t, "", res.Mapping["Budget"])
	found := false
	for _, is := range res.FileIssues {
		if strings.Contains(is.Message, `column "Budget" not imported`) {
			found = true
			assert.Equal(t, LevelWarning, is.Level)
		}
	}
	assert.True(t, found, "expected a Budget ignore warning, got %v", res.FileIssues)
	// The row itself stays ok — ignored columns are a file-level disclosure.
	assert.Equal(t, RowOK, res.Rows[0].Status)
}

func TestRun_ExplicitMappingOverride(t *testing.T) {
	res := runCSV(t, "What,When,Extra\nThing,2026-03-02,x\n", Options{
		Mapping: map[string]string{"What": "title", "When": "start"},
	})
	assert.Equal(t, FieldTitle, res.Mapping["What"])
	assert.Equal(t, FieldStart, res.Mapping["When"])
	assert.Equal(t, "", res.Mapping["Extra"])
	assert.Equal(t, "Thing", res.Rows[0].Activity.Title)
}

func TestRun_FileScopedErrors(t *testing.T) {
	tests := []struct {
		name, csvText string
		opts          Options
		wantMsg       string
	}{
		{"NoTitleColumn", "Foo,Bar\na,b\n", Options{}, "Title"},
		{"DuplicateFieldTargets", "Start Date,Begin\n2026-01-01,2026-01-02\n", Options{}, "both map to start"},
		{"UnknownMappingField", "A\nx\n", Options{Mapping: map[string]string{"A": "bogus"}}, "unknown field"},
		{"MappingUnknownColumn", "Title\nx\n", Options{Mapping: map[string]string{"Title": "title", "Ghost": "start"}}, "not in the file"},
		{"Empty", "", Options{}, "empty"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Run([]byte(tt.csvText), "t.csv", tt.opts, testLookups())
			require.Error(t, err)
			assert.True(t, IsFileError(err))
			assert.Contains(t, err.Error(), tt.wantMsg)
		})
	}
}

func TestRun_RowCap(t *testing.T) {
	var b strings.Builder
	b.WriteString("Title,Start\n")
	for i := 0; i < MaxRows+1; i++ {
		fmt.Fprintf(&b, "Row %d,2026-01-01\n", i)
	}
	_, err := Run([]byte(b.String()), "t.csv", Options{}, testLookups())
	require.Error(t, err)
	assert.True(t, IsFileError(err))
	assert.Contains(t, err.Error(), "2,000 row")
}

func TestRun_UnsupportedType(t *testing.T) {
	_, err := Run([]byte("hello"), "notes.docx", Options{}, testLookups())
	require.Error(t, err)
	assert.True(t, IsFileError(err))
}

func TestParseCSV_Structure(t *testing.T) {
	t.Run("SemicolonDelimiter", func(t *testing.T) {
		res := runCSV(t, "Title;Start;End\nThing;2026-03-02;2026-03-04\n", Options{})
		require.Len(t, res.Rows, 1)
		assert.Equal(t, "Thing", res.Rows[0].Activity.Title)
	})
	t.Run("TabDelimiter", func(t *testing.T) {
		res := runCSV(t, "Title\tStart\nThing\t2026-03-02\n", Options{})
		require.Len(t, res.Rows, 1)
		assert.Equal(t, "Thing", res.Rows[0].Activity.Title)
	})
	t.Run("BOMTolerated", func(t *testing.T) {
		res := runCSV(t, "\xEF\xBB\xBFTitle,Start\nThing,2026-03-02\n", Options{})
		assert.Equal(t, FieldTitle, res.Mapping["Title"])
	})
	t.Run("CP1252Fallback", func(t *testing.T) {
		// 0xE9 is é in Windows-1252 and invalid UTF-8.
		res := runCSV(t, "Title,Start\nCaf\xe9,2026-03-02\n", Options{})
		assert.Equal(t, "Café", res.Rows[0].Activity.Title)
		found := false
		for _, is := range res.FileIssues {
			if strings.Contains(is.Message, "Windows-1252") {
				found = true
			}
		}
		assert.True(t, found, "expected an encoding warning")
	})
	t.Run("BlankRowsSkippedSilently", func(t *testing.T) {
		res := runCSV(t, "Title,Start\nA,2026-03-02\n,\n\nB,2026-03-03\n", Options{})
		assert.Equal(t, 2, res.Summary.Total)
	})
	t.Run("ShortRowPadded", func(t *testing.T) {
		res := runCSV(t, "Title,Start,End\nA,2026-03-02\n", Options{})
		require.Len(t, res.Rows, 1)
		// Missing End defaults to Start with a warning.
		assert.Equal(t, RowWarning, res.Rows[0].Status)
		assert.Equal(t, "2026-03-02", res.Rows[0].Activity.End)
	})
	t.Run("ExtraCellsWarn", func(t *testing.T) {
		res := runCSV(t, "Title,Start\nA,2026-03-02,unexpected\n", Options{})
		require.Len(t, res.Rows, 1)
		assert.Equal(t, RowWarning, res.Rows[0].Status)
		assert.Contains(t, allMessages(&res.Rows[0]), "more cells")
	})
}

func TestParseXLSX_NativeDatesAndSheets(t *testing.T) {
	f := excelize.NewFile()
	require.NoError(t, f.SetSheetName("Sheet1", "Data"))
	_, err := f.NewSheet("Scratch")
	require.NoError(t, err)
	require.NoError(t, f.SetCellStr("Scratch", "A1", "ignore me"))

	require.NoError(t, f.SetCellStr("Data", "A1", "Title"))
	require.NoError(t, f.SetCellStr("Data", "B1", "Start"))
	require.NoError(t, f.SetCellStr("Data", "A2", "Native"))
	// A real typed date cell: a time.Time value + date number format, so the
	// raw cell value is an Excel serial.
	style, err := f.NewStyle(&excelize.Style{NumFmt: 14})
	require.NoError(t, err)
	require.NoError(t, f.SetCellValue("Data", "B2", time.Date(2026, 3, 5, 0, 0, 0, 0, time.UTC)))
	require.NoError(t, f.SetCellStyle("Data", "B2", "B2", style))

	var buf bytes.Buffer
	require.NoError(t, f.Write(&buf))
	require.NoError(t, f.Close())

	res, err := Run(buf.Bytes(), "book.xlsx", Options{}, testLookups())
	require.NoError(t, err)
	require.Len(t, res.Rows, 1)
	rr := res.Rows[0]
	assert.Equal(t, "2026-03-05", rr.Activity.Start, allMessages(&rr))
	for _, is := range rr.Issues {
		assert.NotContains(t, is.Message, "read as", "native date cells must not warn")
	}

	found := false
	for _, is := range res.FileIssues {
		if strings.Contains(is.Message, "Scratch") {
			found = true
		}
	}
	assert.True(t, found, "expected a skipped-sheet warning naming Scratch")
}

func TestTemplates_RoundTripThroughParser(t *testing.T) {
	lk := Lookups{
		Statuses:       map[string]string{"in progress": "st1"},
		MembersByName:  map[string][]string{"alex chen": {"m2"}},
		MembersByEmail: map[string]string{"sam@example.com": "m9"},
		Tags:           map[string]string{"launch": "t1", "q3": "t2"},
	}

	t.Run("CSV", func(t *testing.T) {
		data, err := TemplateCSV()
		require.NoError(t, err)
		res, err := Run(data, "template.csv", Options{}, lk)
		require.NoError(t, err)
		require.Len(t, res.Rows, 2)
		assert.Equal(t, RowOK, res.Rows[0].Status, allMessages(&res.Rows[0]))
		assert.Equal(t, RowOK, res.Rows[1].Status, allMessages(&res.Rows[1]))
		assert.Equal(t, 0, res.Rows[1].Resolved.ParentRowIndex, "full row's Parent references the minimal row")
	})

	t.Run("XLSX", func(t *testing.T) {
		data, err := TemplateXLSX()
		require.NoError(t, err)
		res, err := Run(data, "template.xlsx", Options{}, lk)
		require.NoError(t, err)
		require.Len(t, res.Rows, 2)
		assert.Equal(t, RowOK, res.Rows[0].Status, allMessages(&res.Rows[0]))
		assert.Equal(t, RowOK, res.Rows[1].Status, allMessages(&res.Rows[1]))
		assert.Equal(t, "2026-03-09", res.Rows[1].Activity.Start, "xlsx template dates are native date cells")
	})
}

package export_test

import (
	"bytes"
	"encoding/csv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"

	"github.com/I0-1O/draba/packages/api/internal/export"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

func sampleActivities() []*models.Activity {
	desc := "Kickoff meeting"
	loc := "HQ"
	url := "https://example.com"
	progress := 50
	statusID := "status-1"
	parentID := "act-parent"

	parent := &models.Activity{
		ID:      "act-parent",
		Title:   "Parent Project",
		StartAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		EndAt:   time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC),
	}
	child := &models.Activity{
		ID:                "act-child",
		Title:             "Kickoff",
		Description:       &desc,
		StartAt:           time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC),
		EndAt:             time.Date(2026, 5, 3, 0, 0, 0, 0, time.UTC),
		StatusID:          &statusID,
		ParentActivityID:  &parentID,
		PercentComplete:   &progress,
		Location:          &loc,
		URL:               &url,
		AssignedMemberIDs: []string{"member-1", "member-2"},
		TagIDs:            []string{"tag-1"},
	}
	return []*models.Activity{parent, child}
}

func sampleNameMaps() (statusNames, memberNames, tagNames, activityTitles map[string]string) {
	statusNames = map[string]string{"status-1": "In Progress"}
	memberNames = map[string]string{"member-1": "Alice", "member-2": "Bob"}
	tagNames = map[string]string{"tag-1": "Launch"}
	activityTitles = map[string]string{"act-parent": "Parent Project", "act-child": "Kickoff"}
	return
}

func TestBuildRows_ResolvesDisplayNames(t *testing.T) {
	acts := sampleActivities()
	statusNames, memberNames, tagNames, activityTitles := sampleNameMaps()

	rows := export.BuildRows(acts, statusNames, memberNames, tagNames, activityTitles)
	require.Len(t, rows, 2)

	parentRow := rows[0]
	assert.Equal(t, "Parent Project", parentRow.Title)
	assert.Equal(t, "2026-01-01", parentRow.Start)
	assert.Equal(t, "2026-12-31", parentRow.End)
	assert.Empty(t, parentRow.Parent)

	childRow := rows[1]
	assert.Equal(t, "Kickoff", childRow.Title)
	assert.Equal(t, "2026-05-01", childRow.Start)
	assert.Equal(t, "2026-05-03", childRow.End)
	assert.Equal(t, "Kickoff meeting", childRow.Description)
	assert.Equal(t, "In Progress", childRow.Status)
	assert.Equal(t, "Alice, Bob", childRow.Assignees)
	assert.Equal(t, "Launch", childRow.Tags)
	assert.Equal(t, "Parent Project", childRow.Parent)
	assert.Equal(t, "50", childRow.Progress)
	assert.Equal(t, "HQ", childRow.Location)
	assert.Equal(t, "https://example.com", childRow.URL)
}

func TestWriteCSV_HeaderAndRows(t *testing.T) {
	acts := sampleActivities()
	statusNames, memberNames, tagNames, activityTitles := sampleNameMaps()
	rows := export.BuildRows(acts, statusNames, memberNames, tagNames, activityTitles)

	var buf bytes.Buffer
	require.NoError(t, export.WriteCSV(&buf, rows))

	records, err := csv.NewReader(&buf).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 3) // header + 2 rows

	assert.Equal(t, export.Columns, records[0])
	assert.Equal(t, "Kickoff", records[2][0])
	assert.Equal(t, "Alice, Bob", records[2][5])
}

func TestWriteXLSX_HeaderAndRows(t *testing.T) {
	acts := sampleActivities()
	statusNames, memberNames, tagNames, activityTitles := sampleNameMaps()
	rows := export.BuildRows(acts, statusNames, memberNames, tagNames, activityTitles)

	var buf bytes.Buffer
	require.NoError(t, export.WriteXLSX(&buf, rows))

	f, err := excelize.OpenReader(&buf)
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	header, err := f.GetRows("Activities")
	require.NoError(t, err)
	require.Len(t, header, 3)
	assert.Equal(t, export.Columns, header[0])
	assert.Equal(t, "Kickoff", header[2][0])
}

// Blocker 3: SelectColumns, ValuesByColumns, and the column-subset writers.

func TestSelectColumns_SubsetAndEdgeCases(t *testing.T) {
	// nil and empty both return the full canonical column list.
	assert.Equal(t, export.Columns, export.SelectColumns(nil))
	assert.Equal(t, export.Columns, export.SelectColumns([]string{}))

	// Subset is returned in canonical order regardless of input order.
	got := export.SelectColumns([]string{"Start", "Title"})
	assert.Equal(t, []string{"Title", "Start"}, got)

	// Unknown names are silently dropped.
	got2 := export.SelectColumns([]string{"Title", "Bogus", "End"})
	assert.Equal(t, []string{"Title", "End"}, got2)
}

func TestValuesByColumns_KnownAndUnknown(t *testing.T) {
	row := export.Row{Title: "Kickoff", Start: "2026-05-01", End: "2026-05-03"}

	vals := row.ValuesByColumns([]string{"Title", "Start"})
	assert.Equal(t, []string{"Kickoff", "2026-05-01"}, vals)

	// Unknown column name produces an empty string without panicking.
	vals2 := row.ValuesByColumns([]string{"Title", "Bogus"})
	assert.Equal(t, []string{"Kickoff", ""}, vals2)
}

func TestWriteCSVColumns_SubsetColumns(t *testing.T) {
	acts := sampleActivities()
	statusNames, memberNames, tagNames, activityTitles := sampleNameMaps()
	rows := export.BuildRows(acts, statusNames, memberNames, tagNames, activityTitles)

	var buf bytes.Buffer
	require.NoError(t, export.WriteCSVColumns(&buf, rows, []string{"Title", "Start"}))

	records, err := csv.NewReader(&buf).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 3) // header + 2 rows
	assert.Equal(t, []string{"Title", "Start"}, records[0])
	assert.Equal(t, "Parent Project", records[1][0])
	assert.Equal(t, "2026-01-01", records[1][1])
	assert.Len(t, records[1], 2)
}

func TestWriteXLSXColumns_SubsetColumns(t *testing.T) {
	acts := sampleActivities()
	statusNames, memberNames, tagNames, activityTitles := sampleNameMaps()
	rows := export.BuildRows(acts, statusNames, memberNames, tagNames, activityTitles)

	var buf bytes.Buffer
	require.NoError(t, export.WriteXLSXColumns(&buf, rows, []string{"Title", "Start"}))

	f, err := excelize.OpenReader(&buf)
	require.NoError(t, err)
	defer func() { _ = f.Close() }()

	grid, err := f.GetRows("Activities")
	require.NoError(t, err)
	require.Len(t, grid, 3) // header + 2 rows
	assert.Equal(t, []string{"Title", "Start"}, grid[0])
	assert.Equal(t, "Parent Project", grid[1][0])
	assert.Len(t, grid[1], 2)
}

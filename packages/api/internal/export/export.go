// Package export builds tabular representations of timeline activities for
// the Phase 14 data export endpoints (CSV and xlsx).
package export

import (
	"strconv"
	"strings"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// Columns is the export header row, in the order BuildRows fills Row fields.
// This order matches the Phase 15 import template so the round-trip holds.
var Columns = []string{
	"Title",
	"Start",
	"End",
	"Description",
	"Status",
	"Assignees",
	"Tags",
	"Parent",
	"Progress",
	"Location",
	"URL",
}

// Row is one exported activity with IDs resolved to display names. Field
// order matches Columns.
type Row struct {
	Title       string
	Start       string
	End         string
	Description string
	Status      string
	Assignees   string
	Tags        string
	Parent      string
	Progress    string
	Location    string
	URL         string
}

// Values returns the row's fields in column order, for writers that take
// plain string slices (e.g. encoding/csv).
func (r *Row) Values() []string {
	return []string{
		r.Title, r.Start, r.End, r.Description, r.Status, r.Assignees,
		r.Tags, r.Parent, r.Progress, r.Location, r.URL,
	}
}

// ValuesByColumns returns the row's field values for the specified column names.
// Unknown column names produce an empty string.
func (r *Row) ValuesByColumns(columns []string) []string {
	fields := map[string]string{
		"Title": r.Title, "Start": r.Start, "End": r.End,
		"Description": r.Description, "Status": r.Status, "Assignees": r.Assignees,
		"Tags": r.Tags, "Parent": r.Parent, "Progress": r.Progress,
		"Location": r.Location, "URL": r.URL,
	}
	out := make([]string, len(columns))
	for i, col := range columns {
		out[i] = fields[col]
	}
	return out
}

// SelectColumns returns the subset of Columns matching the requested names, in
// canonical order. If names is nil or empty, all Columns are returned.
func SelectColumns(names []string) []string {
	if len(names) == 0 {
		return Columns
	}
	want := make(map[string]bool, len(names))
	for _, n := range names {
		want[n] = true
	}
	out := make([]string, 0, len(names))
	for _, c := range Columns {
		if want[c] {
			out = append(out, c)
		}
	}
	return out
}

// dateFormat is the calendar-date format used for Start/End columns.
// Activities are all-day (Person + Time Range + Work — no time-of-day
// editor exists), so times are dropped.
const dateFormat = "2006-01-02"

// BuildRows projects activities into export rows. statusNames, memberNames,
// and tagNames map IDs to display names; activityTitles maps every activity
// ID (including ones outside the exported set) to its title, so a parent
// activity excluded by the active filter still resolves to a readable title.
func BuildRows(activities []*models.Activity, statusNames, memberNames, tagNames, activityTitles map[string]string) []Row {
	rows := make([]Row, 0, len(activities))
	for _, a := range activities {
		row := Row{
			Title: a.Title,
			Start: a.StartAt.Format(dateFormat),
			End:   a.EndAt.Format(dateFormat),
		}
		if a.Description != nil {
			row.Description = *a.Description
		}
		if a.StatusID != nil {
			row.Status = statusNames[*a.StatusID]
		}
		if len(a.AssignedMemberIDs) > 0 {
			names := make([]string, 0, len(a.AssignedMemberIDs))
			for _, id := range a.AssignedMemberIDs {
				if n, ok := memberNames[id]; ok {
					names = append(names, n)
				}
			}
			row.Assignees = strings.Join(names, ", ")
		}
		if len(a.TagIDs) > 0 {
			names := make([]string, 0, len(a.TagIDs))
			for _, id := range a.TagIDs {
				if n, ok := tagNames[id]; ok {
					names = append(names, n)
				}
			}
			row.Tags = strings.Join(names, ", ")
		}
		if a.ParentActivityID != nil {
			row.Parent = activityTitles[*a.ParentActivityID]
		}
		if a.PercentComplete != nil {
			row.Progress = strconv.Itoa(*a.PercentComplete)
		}
		if a.Location != nil {
			row.Location = *a.Location
		}
		if a.URL != nil {
			row.URL = *a.URL
		}
		rows = append(rows, row)
	}
	return rows
}

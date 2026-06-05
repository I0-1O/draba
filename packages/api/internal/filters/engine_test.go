package filters_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/filters"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// fixtureFilePath returns the absolute path to filter-fixtures.json in the
// shared testdata directory, regardless of where the test binary is run from.
func fixtureFilePath() string {
	_, thisFile, _, _ := runtime.Caller(0)
	// this file: packages/api/internal/filters/engine_test.go (4 levels deep in packages/)
	// fixtures:  packages/shared/testdata/filter-fixtures.json
	// Dir → filters → ../internal → ../../api → ../../../packages
	root := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "shared", "testdata")
	return filepath.Join(root, "filter-fixtures.json")
}

// ── JSON fixture types ────────────────────────────────────────────────────────

type fixtureFile struct {
	Statuses   []fixtureStatus   `json:"statuses"`
	Tags       []fixtureTag      `json:"tags"`
	Activities []fixtureActivity `json:"activities"`
	Fixtures   []fixture         `json:"fixtures"`
}

type fixtureStatus struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Color      string `json:"color"`
	IsClosed   bool   `json:"isClosed"`
	Position   int    `json:"position"`
	TimelineID string `json:"timelineId"`
}

type fixtureTag struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	TeamID    string `json:"teamId"`
	CreatedBy string `json:"createdBy"`
	CreatedAt string `json:"createdAt"`
}

type fixtureActivity struct {
	ID                string   `json:"id"`
	TimelineID        string   `json:"timelineId"`
	Title             string   `json:"title"`
	StartAt           string   `json:"startAt"`
	EndAt             string   `json:"endAt"`
	AllDay            bool     `json:"allDay"`
	StatusID          *string  `json:"statusId"`
	ParentActivityID  *string  `json:"parentActivityId"`
	PercentComplete   *int     `json:"percentComplete"`
	AssignedMemberIDs []string `json:"assignedMemberIds"`
	TagIDs            []string `json:"tagIds"`
	CreatedBy         string   `json:"createdBy"`
}

type fixture struct {
	Name     string                   `json:"name"`
	Filter   filters.FilterDefinition `json:"filter"`
	Expected map[string]bool          `json:"expected"`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func toModelActivity(fa *fixtureActivity) *models.Activity {
	start, _ := time.Parse(time.RFC3339, fa.StartAt)
	end, _ := time.Parse(time.RFC3339, fa.EndAt)
	a := &models.Activity{
		ID:                fa.ID,
		TimelineID:        fa.TimelineID,
		Title:             fa.Title,
		StartAt:           start,
		EndAt:             end,
		AllDay:            fa.AllDay,
		StatusID:          fa.StatusID,
		ParentActivityID:  fa.ParentActivityID,
		PercentComplete:   fa.PercentComplete,
		AssignedMemberIDs: fa.AssignedMemberIDs,
		TagIDs:            fa.TagIDs,
		CreatedBy:         fa.CreatedBy,
	}
	if a.AssignedMemberIDs == nil {
		a.AssignedMemberIDs = []string{}
	}
	if a.TagIDs == nil {
		a.TagIDs = []string{}
	}
	return a
}

// ── Test ──────────────────────────────────────────────────────────────────────

// TestGoldenFixtures runs the Go filter engine against every case in the shared
// golden-fixture file. If this test fails it means either the Go engine has
// diverged from the TypeScript one, or the fixture is inconsistent.
func TestGoldenFixtures(t *testing.T) {
	data, err := os.ReadFile(fixtureFilePath())
	require.NoError(t, err, "cannot read filter fixtures — is the shared testdata directory present?")

	var ff fixtureFile
	require.NoError(t, json.Unmarshal(data, &ff))

	// Build reference data for the FilterContext.
	statusesByTimeline := make(map[string][]models.Status)
	for _, fs := range ff.Statuses {
		statusesByTimeline[fs.TimelineID] = append(statusesByTimeline[fs.TimelineID], models.Status{
			ID:       fs.ID,
			Name:     fs.Name,
			Color:    fs.Color,
			IsClosed: fs.IsClosed,
			Position: fs.Position,
		})
	}

	tags := make([]models.Tag, 0, len(ff.Tags))
	for _, ft := range ff.Tags {
		tags = append(tags, models.Tag{
			ID:   ft.ID,
			Name: ft.Name,
		})
	}

	ctx := &filters.FilterContext{
		StatusesByTimelineID: statusesByTimeline,
		Tags:                 tags,
	}

	// Build the activity map.
	actByID := make(map[string]*models.Activity, len(ff.Activities))
	for i := range ff.Activities {
		actByID[ff.Activities[i].ID] = toModelActivity(&ff.Activities[i])
	}

	for _, fix := range ff.Fixtures {
		fix := fix // capture
		t.Run(fix.Name, func(t *testing.T) {
			for actID, wantMatch := range fix.Expected {
				act, ok := actByID[actID]
				require.True(t, ok, "activity %q not found in fixtures", actID)

				got := filters.MatchesFilter(act, &fix.Filter, ctx)
				assert.Equal(t, wantMatch, got,
					"activity %q: filter %q gave wrong result", actID, fix.Name)
			}
		})
	}
}

package importer

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolve_RequiredMinimum(t *testing.T) {
	res := runCSV(t, strings.Join([]string{
		"Title,Start,End",
		",2026-03-02,2026-03-03",          // missing title: error
		"NoStart,,",                       // missing start: error
		"BadStart,garbage,2026-03-03",     // unparseable start: error
		"Backwards,2026-03-05,2026-03-01", // end before start: error
		"Fine,2026-03-02,2026-03-03",
	}, "\n"), Options{})

	require.Len(t, res.Rows, 5)
	assert.Equal(t, RowError, res.Rows[0].Status)
	assert.Contains(t, allMessages(&res.Rows[0]), "title is required")
	assert.Equal(t, RowError, res.Rows[1].Status)
	assert.Contains(t, allMessages(&res.Rows[1]), "start date is required")
	assert.Equal(t, RowError, res.Rows[2].Status)
	assert.Equal(t, RowError, res.Rows[3].Status)
	assert.Contains(t, allMessages(&res.Rows[3]), "before start")
	assert.Equal(t, RowOK, res.Rows[4].Status, "bad rows must not poison good ones")
	assert.Equal(t, Summary{Total: 5, OK: 1, Errors: 4}, res.Summary)

	// Error rows carry no write payload.
	assert.Nil(t, res.Rows[0].Resolved)
	assert.NotNil(t, res.Rows[4].Resolved)
}

func TestResolve_MissingEndDefaultsToStart(t *testing.T) {
	res := runCSV(t, "Title,Start,End\nA,2026-03-02,\n", Options{})
	rr := res.Rows[0]
	assert.Equal(t, RowWarning, rr.Status)
	assert.Equal(t, "2026-03-02", rr.Activity.End)
	assert.Contains(t, allMessages(&rr), "single day")
}

func TestResolve_UnknownNamesWarnAndSkip(t *testing.T) {
	res := runCSV(t, "Title,Start,Status,Assignees,Tags\n"+
		`A,2026-03-02,Blocked,"Sarah K., Alex Chen","q3, launch"`+"\n", Options{})

	rr := res.Rows[0]
	assert.Equal(t, RowWarning, rr.Status)
	msgs := allMessages(&rr)
	assert.Contains(t, msgs, `"Blocked" doesn't match a status`)
	assert.Contains(t, msgs, `"Sarah K." doesn't match a team member`)
	assert.Contains(t, msgs, `tag "q3" doesn't exist`)

	// The row still imports, with the known associations kept.
	assert.Nil(t, rr.Resolved.StatusID)
	assert.Equal(t, []string{"m2"}, rr.Resolved.AssigneeIDs)
	assert.Equal(t, []string{"t1"}, rr.Resolved.TagIDs)

	assert.Equal(t, []string{"Blocked"}, res.UnknownNames.Statuses)
	assert.Equal(t, []string{"Sarah K."}, res.UnknownNames.Assignees)
	assert.Equal(t, []string{"q3"}, res.UnknownNames.Tags)
}

func TestResolve_AmbiguousMemberSkippedWithEmailHint(t *testing.T) {
	res := runCSV(t, "Title,Start,Assignees\nA,2026-03-02,Jo Lee\n", Options{})
	rr := res.Rows[0]
	assert.Contains(t, allMessages(&rr), "more than one team member")
	assert.Contains(t, allMessages(&rr), "email")
	assert.Empty(t, rr.Resolved.AssigneeIDs)
}

func TestResolve_CaseInsensitiveMatching(t *testing.T) {
	res := runCSV(t, "Title,Start,End,Status,Assignees\nA,2026-03-02,2026-03-03,in progress,SARAH KOWALSKI\n", Options{})
	rr := res.Rows[0]
	assert.Equal(t, RowOK, rr.Status, allMessages(&rr))
	assert.Equal(t, "st1", *rr.Resolved.StatusID)
	assert.Equal(t, []string{"m1"}, rr.Resolved.AssigneeIDs)
}

func TestResolve_CreateMissingTagsOptIn(t *testing.T) {
	csvText := "Title,Start,Tags\nA,2026-03-02,\"q3, launch, q3\"\n"

	t.Run("Off", func(t *testing.T) {
		res := runCSV(t, csvText, Options{})
		rr := res.Rows[0]
		assert.Empty(t, rr.Resolved.MissingTags)
		assert.Equal(t, []string{"t1"}, rr.Resolved.TagIDs)
		assert.Contains(t, allMessages(&rr), "create missing tags")
	})
	t.Run("On", func(t *testing.T) {
		res := runCSV(t, csvText, Options{CreateMissingTags: true})
		rr := res.Rows[0]
		assert.Equal(t, []string{"q3"}, rr.Resolved.MissingTags, "duplicate tokens deduped")
		assert.Contains(t, allMessages(&rr), `tag "q3" will be created`)
		assert.Equal(t, []string{"q3"}, res.UnknownNames.Tags)
	})
}

func TestResolve_AssigneeDedupe(t *testing.T) {
	res := runCSV(t, "Title,Start,Assignees\nA,2026-03-02,\"Sarah Kowalski; sarah@example.com\"\n", Options{})
	assert.Equal(t, []string{"m1"}, res.Rows[0].Resolved.AssigneeIDs,
		"name + email of the same member must resolve to one assignment")
}

func TestResolve_Progress(t *testing.T) {
	res := runCSV(t, strings.Join([]string{
		"Title,Start,End,Progress",
		"A,2026-03-02,2026-03-03,50%",
		"B,2026-03-02,2026-03-03,49.6",
		"C,2026-03-02,2026-03-03,150",
		"D,2026-03-02,2026-03-03,lots",
	}, "\n"), Options{})

	require.NotNil(t, res.Rows[0].Resolved.Progress)
	assert.Equal(t, 50, *res.Rows[0].Resolved.Progress)
	assert.Equal(t, RowOK, res.Rows[0].Status)

	require.NotNil(t, res.Rows[1].Resolved.Progress)
	assert.Equal(t, 50, *res.Rows[1].Resolved.Progress)
	assert.Contains(t, allMessages(&res.Rows[1]), "rounded")

	assert.Nil(t, res.Rows[2].Resolved.Progress)
	assert.Contains(t, allMessages(&res.Rows[2]), "outside 0")
	assert.Equal(t, RowWarning, res.Rows[2].Status, "bad progress is a warning, not an error")

	assert.Nil(t, res.Rows[3].Resolved.Progress)
	assert.Equal(t, RowWarning, res.Rows[3].Status)
}

func TestResolve_ParentInFile(t *testing.T) {
	res := runCSV(t, strings.Join([]string{
		"Title,Start,End,Parent",
		"Child,2026-03-02,2026-03-03,Parent Task", // forward reference
		"Parent Task,2026-03-01,2026-03-05,",
	}, "\n"), Options{})

	require.Len(t, res.Rows, 2)
	assert.Equal(t, 1, res.Rows[0].Resolved.ParentRowIndex)
	assert.Equal(t, "Parent Task", res.Rows[0].Activity.Parent)
	assert.Equal(t, RowOK, res.Rows[0].Status, allMessages(&res.Rows[0]))

	order := AcceptedOrder(res.Rows)
	assert.Equal(t, []int{1, 0}, order, "parent must be created before the child")
}

func TestResolve_ParentExistingActivity(t *testing.T) {
	res := runCSV(t, "Title,Start,Parent\nA,2026-03-02,Existing Parent\n", Options{})
	rr := res.Rows[0]
	require.NotNil(t, rr.Resolved.ParentActivityID)
	assert.Equal(t, "a1", *rr.Resolved.ParentActivityID)
	assert.Equal(t, -1, rr.Resolved.ParentRowIndex)
	assert.Equal(t, "Existing Parent", rr.Activity.Parent)
}

func TestResolve_ParentEdgeCases(t *testing.T) {
	t.Run("UnknownParentWarns", func(t *testing.T) {
		res := runCSV(t, "Title,Start,Parent\nA,2026-03-02,Nowhere\n", Options{})
		rr := res.Rows[0]
		assert.Equal(t, RowWarning, rr.Status)
		assert.Contains(t, allMessages(&rr), "parent link skipped")
		assert.Nil(t, rr.Resolved.ParentActivityID)
	})
	t.Run("AmbiguousInFileWarns", func(t *testing.T) {
		res := runCSV(t, strings.Join([]string{
			"Title,Start,Parent",
			"Dup,2026-03-01,",
			"Dup,2026-03-02,",
			"Child,2026-03-03,Dup",
		}, "\n"), Options{})
		rr := res.Rows[2]
		assert.Contains(t, allMessages(&rr), "more than one row")
		assert.Equal(t, -1, rr.Resolved.ParentRowIndex)
	})
	t.Run("AmbiguousExistingWarns", func(t *testing.T) {
		res := runCSV(t, "Title,Start,Parent\nA,2026-03-02,Twin\n", Options{})
		rr := res.Rows[0]
		assert.Contains(t, allMessages(&rr), "more than one existing activity")
		assert.Nil(t, rr.Resolved.ParentActivityID)
	})
	t.Run("ErroredParentDropsLink", func(t *testing.T) {
		res := runCSV(t, strings.Join([]string{
			"Title,Start,Parent",
			"Broken Parent,garbage,",
			"Child,2026-03-02,Broken Parent",
		}, "\n"), Options{})
		rr := res.Rows[1]
		assert.Equal(t, RowWarning, rr.Status)
		assert.Contains(t, allMessages(&rr), "won't be imported")
		assert.Equal(t, -1, rr.Resolved.ParentRowIndex)
	})
	t.Run("CycleBrokenWithWarning", func(t *testing.T) {
		res := runCSV(t, strings.Join([]string{
			"Title,Start,Parent",
			"A,2026-03-01,B",
			"B,2026-03-02,A",
		}, "\n"), Options{})
		cycleWarnings := 0
		for i := range res.Rows {
			if strings.Contains(allMessages(&res.Rows[i]), "circular") {
				cycleWarnings++
			}
		}
		assert.GreaterOrEqual(t, cycleWarnings, 1, "at least one link must be dropped")
		order := AcceptedOrder(res.Rows)
		assert.Len(t, order, 2, "both rows still import")
	})
}

func TestResolve_DuplicateDisclosure(t *testing.T) {
	res := runCSV(t, strings.Join([]string{
		"Title,Start,End",
		"existing activity,2026-03-05,2026-03-07",
		"Existing Activity,2026-03-05,2026-03-08",
	}, "\n"), Options{})

	assert.Equal(t, RowWarning, res.Rows[0].Status)
	assert.Contains(t, allMessages(&res.Rows[0]), "possible duplicate")
	assert.NotNil(t, res.Rows[0].Resolved, "duplicates still import — additive semantics")
	assert.Equal(t, RowOK, res.Rows[1].Status, "different dates are not a duplicate")
}

package db_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

func makeActivity(id, timelineID, createdBy string, start time.Time) *models.Activity {
	return &models.Activity{
		ID:         id,
		TimelineID: timelineID,
		Title:      "Test Activity " + id,
		StartAt:    start,
		EndAt:      start.Add(2 * time.Hour),
		CreatedBy:  createdBy,
		CreatedAt:  start,
		UpdatedAt:  start,
	}
}

func TestActivityRepo_CreateAndGetByID(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "cg")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-cg", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	a := makeActivity("act-cg", tl.ID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))

	got, err := repo.GetByID(a.ID)
	require.NoError(t, err)
	assert.Equal(t, a.ID, got.ID)
	assert.Equal(t, a.Title, got.Title)
	assert.Equal(t, a.TimelineID, got.TimelineID)
}

func TestActivityRepo_Update(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "upd")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-upd", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	a := makeActivity("act-upd", tl.ID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))

	a.Title = "Updated Title"
	a.UpdatedAt = time.Now().UTC()
	require.NoError(t, repo.Update(a))

	got, err := repo.GetByID(a.ID)
	require.NoError(t, err)
	assert.Equal(t, "Updated Title", got.Title)
}

func TestActivityRepo_Delete(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "del")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-del", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	a := makeActivity("act-del", tl.ID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))
	require.NoError(t, repo.Delete(a.ID))

	_, err := repo.GetByID(a.ID)
	assert.Error(t, err, "expected error after deletion")
}

func TestActivityRepo_SetArchived(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "arch")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-arch", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	a := makeActivity("act-arch", tl.ID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))

	// Archive.
	now := time.Now().UTC()
	require.NoError(t, repo.SetArchived(a.ID, &now))

	// Default list excludes it.
	acts, err := repo.ListByTimeline(tl.ID, nil, nil, false)
	require.NoError(t, err)
	assert.Empty(t, acts)

	// includeArchived=true brings it back.
	acts, err = repo.ListByTimeline(tl.ID, nil, nil, true)
	require.NoError(t, err)
	require.Len(t, acts, 1)
	assert.NotNil(t, acts[0].ArchivedAt)

	// Unarchive.
	require.NoError(t, repo.SetArchived(a.ID, nil))
	acts, err = repo.ListByTimeline(tl.ID, nil, nil, false)
	require.NoError(t, err)
	assert.Len(t, acts, 1)
}

func TestActivityRepo_SetAndGetAssignments(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "asn")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-asn", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	memberID := "mem-asn"
	seedTeamMember(t, database, memberID, teamID, userID)

	a := makeActivity("act-asn", tl.ID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))

	require.NoError(t, repo.SetAssignments(a.ID, []string{memberID}))

	ids, err := repo.GetAssignments(a.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{memberID}, ids)

	// Clear assignments.
	require.NoError(t, repo.SetAssignments(a.ID, []string{}))
	ids, err = repo.GetAssignments(a.ID)
	require.NoError(t, err)
	assert.Empty(t, ids)
}

func TestActivityRepo_ListByTimeline_DateFilter(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "dtf")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-dtf", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	may1 := time.Date(2026, 5, 1, 9, 0, 0, 0, time.UTC)
	may31 := time.Date(2026, 5, 31, 9, 0, 0, 0, time.UTC)
	apr15 := time.Date(2026, 4, 15, 9, 0, 0, 0, time.UTC)

	for _, start := range []time.Time{apr15, may1, may31} {
		a := makeActivity("act-dtf-"+start.Format("20060102"), tl.ID, userID, start)
		require.NoError(t, repo.Create(a))
	}

	from := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 5, 31, 23, 59, 59, 0, time.UTC)
	acts, err := repo.ListByTimeline(tl.ID, &from, &to, false)
	require.NoError(t, err)
	assert.Len(t, acts, 2, "expected only May activities")
}

func TestActivityRepo_AssignedMemberIDs_PopulatedInList(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "pop")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-pop", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	memberID := "mem-pop"
	seedTeamMember(t, database, memberID, teamID, userID)

	a := makeActivity("act-pop", tl.ID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))
	require.NoError(t, repo.SetAssignments(a.ID, []string{memberID}))

	acts, err := repo.ListByTimeline(tl.ID, nil, nil, false)
	require.NoError(t, err)
	require.Len(t, acts, 1)
	assert.Equal(t, []string{memberID}, acts[0].AssignedMemberIDs)
}

func TestActivityRepo_ListByTimeline_Filter(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "flt")

	tlRepo := db.NewTimelineRepo(database)
	tl1 := makeTimeline("tl-flt-1", teamID, userID)
	tl2 := makeTimeline("tl-flt-2", teamID, userID)
	require.NoError(t, tlRepo.Create(tl1))
	require.NoError(t, tlRepo.Create(tl2))

	start := time.Now().UTC()
	a1 := makeActivity("act-flt-1", tl1.ID, userID, start)
	a2 := makeActivity("act-flt-2", tl2.ID, userID, start)
	require.NoError(t, repo.Create(a1))
	require.NoError(t, repo.Create(a2))

	acts1, err := repo.ListByTimeline(tl1.ID, nil, nil, false)
	require.NoError(t, err)
	require.Len(t, acts1, 1, "timeline 1 should only contain its own activity")
	assert.Equal(t, "act-flt-1", acts1[0].ID)

	acts2, err := repo.ListByTimeline(tl2.ID, nil, nil, false)
	require.NoError(t, err)
	require.Len(t, acts2, 1, "timeline 2 should only contain its own activity")
	assert.Equal(t, "act-flt-2", acts2[0].ID)
}

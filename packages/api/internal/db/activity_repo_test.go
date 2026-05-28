package db_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

func makeActivity(id, teamID, createdBy string, start time.Time) *models.Activity {
	return &models.Activity{
		ID:        id,
		TeamID:    teamID,
		Title:     "Test Activity " + id,
		StartAt:   start,
		EndAt:     start.Add(2 * time.Hour),
		CreatedBy: createdBy,
		CreatedAt: start,
		UpdatedAt: start,
	}
}

func TestActivityRepo_CreateAndGetByID(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "cg")

	a := makeActivity("act-cg", teamID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))

	got, err := repo.GetByID(a.ID)
	require.NoError(t, err)
	assert.Equal(t, a.ID, got.ID)
	assert.Equal(t, a.Title, got.Title)
	assert.Equal(t, a.TeamID, got.TeamID)
}

func TestActivityRepo_Update(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "upd")

	a := makeActivity("act-upd", teamID, userID, time.Now().UTC())
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

	a := makeActivity("act-del", teamID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))
	require.NoError(t, repo.Delete(a.ID))

	_, err := repo.GetByID(a.ID)
	assert.Error(t, err, "expected error after deletion")
}

func TestActivityRepo_SetArchived(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "arch")

	a := makeActivity("act-arch", teamID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))

	// Archive.
	now := time.Now().UTC()
	require.NoError(t, repo.SetArchived(a.ID, &now))

	// Default list excludes it.
	acts, err := repo.ListByTeam(teamID, nil, nil, nil, false)
	require.NoError(t, err)
	assert.Empty(t, acts)

	// includeArchived=true brings it back.
	acts, err = repo.ListByTeam(teamID, nil, nil, nil, true)
	require.NoError(t, err)
	require.Len(t, acts, 1)
	assert.NotNil(t, acts[0].ArchivedAt)

	// Unarchive.
	require.NoError(t, repo.SetArchived(a.ID, nil))
	acts, err = repo.ListByTeam(teamID, nil, nil, nil, false)
	require.NoError(t, err)
	assert.Len(t, acts, 1)
}

func TestActivityRepo_SetAndGetAssignments(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "asn")
	memberID := "mem-asn"
	seedTeamMember(t, database, memberID, teamID, userID)

	a := makeActivity("act-asn", teamID, userID, time.Now().UTC())
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

func TestActivityRepo_ListByTeam_DateFilter(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "dtf")

	may1 := time.Date(2026, 5, 1, 9, 0, 0, 0, time.UTC)
	may31 := time.Date(2026, 5, 31, 9, 0, 0, 0, time.UTC)
	apr15 := time.Date(2026, 4, 15, 9, 0, 0, 0, time.UTC)

	for _, start := range []time.Time{apr15, may1, may31} {
		a := makeActivity("act-dtf-"+start.Format("20060102"), teamID, userID, start)
		require.NoError(t, repo.Create(a))
	}

	from := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 5, 31, 23, 59, 59, 0, time.UTC)
	acts, err := repo.ListByTeam(teamID, nil, &from, &to, false)
	require.NoError(t, err)
	assert.Len(t, acts, 2, "expected only May activities")
}

func TestActivityRepo_AssignedMemberIDs_PopulatedInList(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewActivityRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "pop")
	memberID := "mem-pop"
	seedTeamMember(t, database, memberID, teamID, userID)

	a := makeActivity("act-pop", teamID, userID, time.Now().UTC())
	require.NoError(t, repo.Create(a))
	require.NoError(t, repo.SetAssignments(a.ID, []string{memberID}))

	acts, err := repo.ListByTeam(teamID, nil, nil, nil, false)
	require.NoError(t, err)
	require.Len(t, acts, 1)
	assert.Equal(t, []string{memberID}, acts[0].AssignedMemberIDs)
}

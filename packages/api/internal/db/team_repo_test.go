package db_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

func TestListByUserID_Empty(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTeamRepo(database)

	teams, err := repo.ListByUserID("no-such-user")
	require.NoError(t, err)
	assert.Empty(t, teams)
}

func TestListByUserID_ReturnsTeamsUserBelongsTo(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTeamRepo(database)

	teamID, userID := seedTeamAndUser(t, database, "list-a")
	seedTeamMember(t, database, "mem-list-a", teamID, userID)

	teams, err := repo.ListByUserID(userID)
	require.NoError(t, err)
	require.Len(t, teams, 1)
	assert.Equal(t, teamID, teams[0].ID)
}

func TestListByUserID_ExcludesOtherUsersTeams(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTeamRepo(database)

	teamID1, userID1 := seedTeamAndUser(t, database, "excl-a")
	seedTeamMember(t, database, "mem-excl-a", teamID1, userID1)

	// user2 belongs to a separate team.
	teamID2, userID2 := seedTeamAndUser(t, database, "excl-b")
	seedTeamMember(t, database, "mem-excl-b", teamID2, userID2)

	teams1, err := repo.ListByUserID(userID1)
	require.NoError(t, err)
	require.Len(t, teams1, 1)
	assert.Equal(t, teamID1, teams1[0].ID)

	teams2, err := repo.ListByUserID(userID2)
	require.NoError(t, err)
	require.Len(t, teams2, 1)
	assert.Equal(t, teamID2, teams2[0].ID)
}

func TestListByUserID_MultipleTeams(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTeamRepo(database)

	team1ID, userID := seedTeamAndUser(t, database, "multi-a")

	// Insert a second team and add the same user to it.
	team2ID := "team-multi-b"
	_, err := database.Exec(
		`INSERT INTO teams (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
		team2ID, "Team multi-b", "slug-multi-b",
	)
	require.NoError(t, err)

	seedTeamMember(t, database, "mem-multi-a", team1ID, userID)
	seedTeamMember(t, database, "mem-multi-b", team2ID, userID)

	teams, err := repo.ListByUserID(userID)
	require.NoError(t, err)
	require.Len(t, teams, 2)
	ids := []string{teams[0].ID, teams[1].ID}
	assert.Contains(t, ids, team1ID)
	assert.Contains(t, ids, team2ID)
}

func TestTeamRepo_Create_AndGetByID(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTeamRepo(database)

	now := time.Now()
	team := &models.Team{
		ID:        "team-create-test",
		Name:      "Create Test",
		Slug:      "create-test",
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, repo.Create(team))

	got, err := repo.GetByID("team-create-test")
	require.NoError(t, err)
	assert.Equal(t, "Create Test", got.Name)
}

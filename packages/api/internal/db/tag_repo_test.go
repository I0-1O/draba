package db_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

func makeTag(id, teamID, createdBy string) *models.Tag {
	color := "teal"
	return &models.Tag{
		ID:        id,
		TeamID:    teamID,
		Name:      "tag-" + id,
		Color:     &color,
		CreatedBy: createdBy,
		CreatedAt: time.Now().UTC(),
	}
}

func TestTagRepo_CreateAndListByTeam(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTagRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "tag-list")

	tag1 := makeTag("t1", teamID, userID)
	tag1.Name = "beta"
	tag2 := makeTag("t2", teamID, userID)
	tag2.Name = "alpha"
	require.NoError(t, repo.Create(tag1))
	require.NoError(t, repo.Create(tag2))

	tags, err := repo.ListByTeam(teamID)
	require.NoError(t, err)
	require.Len(t, tags, 2)
	// Expect alphabetical order: alpha, beta
	assert.Equal(t, "alpha", tags[0].Name)
	assert.Equal(t, "beta", tags[1].Name)
}

func TestTagRepo_GetByID(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTagRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "tag-get")

	tag := makeTag("t-get", teamID, userID)
	require.NoError(t, repo.Create(tag))

	got, err := repo.GetByID(tag.ID)
	require.NoError(t, err)
	assert.Equal(t, tag.ID, got.ID)
	assert.Equal(t, tag.Name, got.Name)
	assert.Equal(t, tag.TeamID, got.TeamID)
}

func TestTagRepo_Update(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTagRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "tag-upd")

	tag := makeTag("t-upd", teamID, userID)
	require.NoError(t, repo.Create(tag))

	tag.Name = "renamed"
	newColor := "violet"
	tag.Color = &newColor
	require.NoError(t, repo.Update(tag))

	got, err := repo.GetByID(tag.ID)
	require.NoError(t, err)
	assert.Equal(t, "renamed", got.Name)
	assert.Equal(t, "violet", *got.Color)
}

func TestTagRepo_Delete(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTagRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "tag-del")

	tag := makeTag("t-del", teamID, userID)
	require.NoError(t, repo.Create(tag))
	require.NoError(t, repo.Delete(tag.ID))

	_, err := repo.GetByID(tag.ID)
	assert.Error(t, err)
}

func TestTagRepo_UniqueNamePerTeam(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTagRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "tag-uniq")

	tag1 := makeTag("t-uniq1", teamID, userID)
	tag1.Name = "duplicate"
	require.NoError(t, repo.Create(tag1))

	tag2 := makeTag("t-uniq2", teamID, userID)
	tag2.Name = "duplicate"
	err := repo.Create(tag2)
	assert.Error(t, err, "expected unique constraint error for duplicate name")
}

func TestTagRepo_SetAndGetTagsOnActivity(t *testing.T) {
	database := openTestDB(t)
	actRepo := db.NewActivityRepo(database)
	tagRepo := db.NewTagRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "tag-asn")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-tagasn", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	tag1 := makeTag("tg1", teamID, userID)
	tag1.Name = "urgent"
	tag2 := makeTag("tg2", teamID, userID)
	tag2.Name = "design"
	require.NoError(t, tagRepo.Create(tag1))
	require.NoError(t, tagRepo.Create(tag2))

	act := makeActivity("act-tagasn", tl.ID, userID, time.Now().UTC())
	require.NoError(t, actRepo.Create(act))

	require.NoError(t, actRepo.SetTags(act.ID, []string{tag1.ID, tag2.ID}))

	ids, err := actRepo.GetTags(act.ID)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{tag1.ID, tag2.ID}, ids)
}

func TestTagRepo_ListByTimelinePopulatesTagIDs(t *testing.T) {
	database := openTestDB(t)
	actRepo := db.NewActivityRepo(database)
	tagRepo := db.NewTagRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "tag-list2")

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-taglist", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	tag := makeTag("tg-list", teamID, userID)
	tag.Name = "launch"
	require.NoError(t, tagRepo.Create(tag))

	act := makeActivity("act-taglist", tl.ID, userID, time.Now().UTC())
	require.NoError(t, actRepo.Create(act))
	require.NoError(t, actRepo.SetTags(act.ID, []string{tag.ID}))

	acts, err := actRepo.ListByTimeline(tl.ID, nil, nil, false)
	require.NoError(t, err)
	require.Len(t, acts, 1)
	assert.Equal(t, []string{tag.ID}, acts[0].TagIDs)
}

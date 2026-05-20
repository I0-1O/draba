package db_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

func TestUserPreferenceRepo_List_EmptyGlobal(t *testing.T) {
	database := openTestDB(t)
	_, userID := seedTeamAndUser(t, database, "pref-empty")
	repo := db.NewUserPreferenceRepo(database)

	prefs, err := repo.List(userID, "")
	require.NoError(t, err)
	assert.Empty(t, prefs)
}

func TestUserPreferenceRepo_List_EmptyScoped(t *testing.T) {
	database := openTestDB(t)
	_, userID := seedTeamAndUser(t, database, "pref-empty-scoped")
	repo := db.NewUserPreferenceRepo(database)

	prefs, err := repo.List(userID, "tl-does-not-exist")
	require.NoError(t, err)
	assert.Empty(t, prefs)
}

func TestUserPreferenceRepo_Upsert_Insert(t *testing.T) {
	database := openTestDB(t)
	_, userID := seedTeamAndUser(t, database, "pref-ins")
	repo := db.NewUserPreferenceRepo(database)

	require.NoError(t, repo.Upsert(&models.UserPreference{
		ID:         "pref-1",
		UserID:     userID,
		TimelineID: "",
		Key:        "theme",
		Value:      `"dark"`,
		UpdatedAt:  time.Now(),
	}))

	prefs, err := repo.List(userID, "")
	require.NoError(t, err)
	require.Len(t, prefs, 1)
	assert.Equal(t, "theme", prefs[0].Key)
	assert.Equal(t, `"dark"`, prefs[0].Value)
}

func TestUserPreferenceRepo_Upsert_UpdatesOnConflict(t *testing.T) {
	database := openTestDB(t)
	_, userID := seedTeamAndUser(t, database, "pref-upsert")
	repo := db.NewUserPreferenceRepo(database)

	require.NoError(t, repo.Upsert(&models.UserPreference{
		ID: "pref-1", UserID: userID, Key: "theme", Value: `"light"`, UpdatedAt: time.Now(),
	}))
	// Different ID — the ON CONFLICT must update the existing row, not insert.
	require.NoError(t, repo.Upsert(&models.UserPreference{
		ID: "pref-2", UserID: userID, Key: "theme", Value: `"dark"`, UpdatedAt: time.Now(),
	}))

	prefs, err := repo.List(userID, "")
	require.NoError(t, err)
	require.Len(t, prefs, 1, "conflict must not create a duplicate row")
	assert.Equal(t, `"dark"`, prefs[0].Value)
}

func TestUserPreferenceRepo_List_ScopeIsolation(t *testing.T) {
	database := openTestDB(t)
	_, userID := seedTeamAndUser(t, database, "pref-scope")
	repo := db.NewUserPreferenceRepo(database)

	require.NoError(t, repo.Upsert(&models.UserPreference{
		ID: "g-1", UserID: userID, TimelineID: "", Key: "theme", Value: `"dark"`, UpdatedAt: time.Now(),
	}))
	require.NoError(t, repo.Upsert(&models.UserPreference{
		ID: "t-1", UserID: userID, TimelineID: "tl-xyz", Key: "group_by", Value: `"member"`, UpdatedAt: time.Now(),
	}))

	global, err := repo.List(userID, "")
	require.NoError(t, err)
	require.Len(t, global, 1)
	assert.Equal(t, "theme", global[0].Key)

	scoped, err := repo.List(userID, "tl-xyz")
	require.NoError(t, err)
	require.Len(t, scoped, 1)
	assert.Equal(t, "group_by", scoped[0].Key)
}

func TestUserPreferenceRepo_List_UserIsolation(t *testing.T) {
	database := openTestDB(t)
	_, userID1 := seedTeamAndUser(t, database, "pref-iso-1")
	_, userID2 := seedTeamAndUser(t, database, "pref-iso-2")
	repo := db.NewUserPreferenceRepo(database)

	require.NoError(t, repo.Upsert(&models.UserPreference{
		ID: "p-1", UserID: userID1, Key: "theme", Value: `"dark"`, UpdatedAt: time.Now(),
	}))

	prefs, err := repo.List(userID2, "")
	require.NoError(t, err)
	assert.Empty(t, prefs, "user2 must not see user1's preferences")
}

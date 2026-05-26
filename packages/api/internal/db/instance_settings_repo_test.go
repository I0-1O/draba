package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
)

func TestInstanceSettingsRepo_GetMissing(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewInstanceSettingsRepo(database)

	val, err := repo.Get("nonexistent_key")
	require.NoError(t, err)
	assert.Equal(t, "", val, "missing key should return empty string")
}

func TestInstanceSettingsRepo_SetAndGet(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewInstanceSettingsRepo(database)

	require.NoError(t, repo.Set("registration_policy", "open"))
	val, err := repo.Get("registration_policy")
	require.NoError(t, err)
	assert.Equal(t, "open", val)
}

func TestInstanceSettingsRepo_Upsert(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewInstanceSettingsRepo(database)

	require.NoError(t, repo.Set("default_timezone", "UTC"))
	require.NoError(t, repo.Set("default_timezone", "America/New_York"))

	val, err := repo.Get("default_timezone")
	require.NoError(t, err)
	assert.Equal(t, "America/New_York", val, "second Set should overwrite the first")
}

func TestInstanceSettingsRepo_Delete(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewInstanceSettingsRepo(database)

	require.NoError(t, repo.Set("to_delete", "value"))
	require.NoError(t, repo.Delete("to_delete"))

	val, err := repo.Get("to_delete")
	require.NoError(t, err)
	assert.Equal(t, "", val)
}

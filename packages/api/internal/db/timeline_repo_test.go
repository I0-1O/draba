package db_test

import (
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

func openTestDB(t *testing.T) *sqlx.DB {
	t.Helper()
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))
	return database
}

// seedTeamAndUser inserts a minimal team and user row to satisfy FK constraints
// on the timelines table. Returns the inserted teamID and userID.
func seedTeamAndUser(t *testing.T, database *sqlx.DB, suffix string) (teamID, userID string) {
	t.Helper()
	teamID = "team-" + suffix
	userID = "user-" + suffix
	_, err := database.Exec(`INSERT INTO teams (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
		teamID, "Team "+suffix, "slug-"+suffix)
	require.NoError(t, err)
	_, err = database.Exec(`INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, 'x', ?, datetime('now'), datetime('now'))`,
		userID, suffix+"@example.com", "User "+suffix)
	require.NoError(t, err)
	return teamID, userID
}

func makeTimeline(id, teamID, createdBy string) *models.Timeline {
	now := time.Now()
	return &models.Timeline{
		ID:         id,
		TeamID:     teamID,
		Name:       "Test Timeline",
		StartDate:  "2026-01-01",
		EndDate:    "2026-12-31",
		Visibility: "restricted",
		ShareToken: "share-" + id,
		IcalToken:  "ical-" + id,
		CreatedBy:  createdBy,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

func TestTimelineRepo_HasAccess_NotGranted(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTimelineRepo(database)

	ok, err := repo.HasAccess("any-timeline", "any-user")
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestTimelineRepo_HasAccess_AfterGrant(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTimelineRepo(database)

	teamID, userID := seedTeamAndUser(t, database, "a")
	tl := makeTimeline("tl-a", teamID, userID)
	require.NoError(t, repo.Create(tl))

	ok, err := repo.HasAccess(tl.ID, userID)
	require.NoError(t, err)
	assert.False(t, ok, "no access before GrantAccess")

	require.NoError(t, repo.GrantAccess(tl.ID, userID))

	ok, err = repo.HasAccess(tl.ID, userID)
	require.NoError(t, err)
	assert.True(t, ok, "access should be granted after GrantAccess")
}

func TestTimelineRepo_GrantAccess_Idempotent(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTimelineRepo(database)

	teamID, userID := seedTeamAndUser(t, database, "b")
	tl := makeTimeline("tl-b", teamID, userID)
	require.NoError(t, repo.Create(tl))

	require.NoError(t, repo.GrantAccess(tl.ID, userID))
	require.NoError(t, repo.GrantAccess(tl.ID, userID), "second grant must be a no-op")
}

func TestTimelineRepo_HasAccess_DifferentUser(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTimelineRepo(database)

	teamID, userID := seedTeamAndUser(t, database, "c")
	tl := makeTimeline("tl-c", teamID, userID)
	require.NoError(t, repo.Create(tl))

	require.NoError(t, repo.GrantAccess(tl.ID, userID))

	ok, err := repo.HasAccess(tl.ID, "other-user")
	require.NoError(t, err)
	assert.False(t, ok, "a different user should not gain access")
}

func TestTimelineRepo_GetByID_NotFound(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTimelineRepo(database)

	_, err := repo.GetByID("nonexistent")
	require.Error(t, err)
	assert.True(t, errors.Is(err, sql.ErrNoRows))
}

func TestTimelineRepo_GetByShareToken_NotFound(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewTimelineRepo(database)

	_, err := repo.GetByShareToken("bad-token")
	require.Error(t, err)
	assert.True(t, errors.Is(err, sql.ErrNoRows))
}

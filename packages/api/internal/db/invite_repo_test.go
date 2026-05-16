package db_test

import (
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// makeInvite builds a minimal Invite for testing. token is set to "tok-<id>"
// so each call produces a unique token as long as id is unique.
func makeInvite(id, teamID, invitedBy string, expiresAt time.Time) *models.Invite {
	return &models.Invite{
		ID:        id,
		TeamID:    teamID,
		Email:     "invitee@example.com",
		Token:     "tok-" + id,
		Role:      "member",
		InvitedBy: invitedBy,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
}

func TestInviteRepo_GetValid_Roundtrip(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewInviteRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "inv-a")

	inv := makeInvite("inv-a", teamID, userID, time.Now().Add(24*time.Hour))
	require.NoError(t, repo.Create(inv))

	got, err := repo.GetValid(inv.Token)
	require.NoError(t, err)
	assert.Equal(t, inv.ID, got.ID)
	assert.Equal(t, inv.Token, got.Token)
}

func TestInviteRepo_GetValid_UnknownToken(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewInviteRepo(database)

	_, err := repo.GetValid("no-such-token")
	require.Error(t, err)
	assert.True(t, errors.Is(err, sql.ErrNoRows))
}

func TestInviteRepo_GetValid_Expired(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewInviteRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "inv-b")

	inv := makeInvite("inv-b", teamID, userID, time.Now().Add(-time.Second))
	require.NoError(t, repo.Create(inv))

	_, err := repo.GetValid(inv.Token)
	require.Error(t, err, "expired invite must not be returned by GetValid")
}

func TestInviteRepo_GetValid_AfterMarkAccepted(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewInviteRepo(database)
	teamID, userID := seedTeamAndUser(t, database, "inv-c")

	inv := makeInvite("inv-c", teamID, userID, time.Now().Add(24*time.Hour))
	require.NoError(t, repo.Create(inv))

	// Confirm it is valid before acceptance.
	_, err := repo.GetValid(inv.Token)
	require.NoError(t, err)

	require.NoError(t, repo.MarkAccepted(inv.ID))

	// Must be rejected after acceptance — single-use enforcement.
	_, err = repo.GetValid(inv.Token)
	require.Error(t, err, "accepted invite must be rejected by GetValid")
	assert.True(t, errors.Is(err, sql.ErrNoRows))
}

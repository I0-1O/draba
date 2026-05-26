package db_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
)

func TestPasswordResetTokenRepo_CreateAndGetValid(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewPasswordResetTokenRepo(database)

	const userID = "user-prt-1"
	_, err := database.Exec(`INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, 'alice@pwreset.com', 'x', 'Alice', datetime('now'), datetime('now'))`, userID)
	require.NoError(t, err)

	const raw = "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222"
	tok, err := repo.Create("prt-1", userID, raw, time.Now().Add(time.Hour))
	require.NoError(t, err)
	assert.Equal(t, userID, tok.UserID)
	assert.Nil(t, tok.UsedAt)

	got, err := repo.GetValid(raw)
	require.NoError(t, err)
	assert.Equal(t, tok.ID, got.ID)
}

func TestPasswordResetTokenRepo_ExpiredToken(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewPasswordResetTokenRepo(database)

	const userID = "user-prt-2"
	_, err := database.Exec(`INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, 'alice@pwexpired.com', 'x', 'Alice', datetime('now'), datetime('now'))`, userID)
	require.NoError(t, err)

	const raw = "1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff1111aaaa2222bbbb"
	_, err = repo.Create("prt-2", userID, raw, time.Now().Add(-time.Minute))
	require.NoError(t, err)

	_, err = repo.GetValid(raw)
	assert.Error(t, err, "expired token should not be returned")
}

func TestPasswordResetTokenRepo_MarkUsed(t *testing.T) {
	database := openTestDB(t)
	repo := db.NewPasswordResetTokenRepo(database)

	const userID = "user-prt-3"
	_, err := database.Exec(`INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, 'alice@pwused.com', 'x', 'Alice', datetime('now'), datetime('now'))`, userID)
	require.NoError(t, err)

	const raw = "cccc1111dddd2222eeee3333ffff4444aaaa5555bbbb6666cccc1111dddd2222"
	tok, err := repo.Create("prt-3", userID, raw, time.Now().Add(time.Hour))
	require.NoError(t, err)

	require.NoError(t, repo.MarkUsed(tok.ID))

	_, err = repo.GetValid(raw)
	assert.Error(t, err, "used token should not be returned")
}

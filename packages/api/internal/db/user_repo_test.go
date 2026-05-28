package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
)

func TestRevokeUser_InactivatesMembershipWithAssignmentHistory(t *testing.T) {
	database := openTestDB(t)
	userRepo := db.NewUserRepo(database)
	teamRepo := db.NewTeamRepo(database)

	teamID, userID := seedTeamAndUser(t, database, "rvu-history")
	memberID := "mem-rvu-history"
	seedTeamMember(t, database, memberID, teamID, userID)

	tlRepo := db.NewTimelineRepo(database)
	tl := makeTimeline("tl-rvu-history", teamID, userID)
	require.NoError(t, tlRepo.Create(tl))

	// Seed an activity and an assignment row to simulate assignment history.
	actID := "act-rvu-history"
	_, err := database.Exec(
		`INSERT INTO activities (id, timeline_id, title, start_at, end_at, created_by, created_at, updated_at)
		 VALUES (?, ?, 'Test', datetime('now'), datetime('now'), ?, datetime('now'), datetime('now'))`,
		actID, tl.ID, userID,
	)
	require.NoError(t, err)
	_, err = database.Exec(
		`INSERT INTO activity_assignments (activity_id, team_member_id) VALUES (?, ?)`,
		actID, memberID,
	)
	require.NoError(t, err)

	result, err := userRepo.RevokeUser(userID)
	require.NoError(t, err)

	assert.True(t, result.AccountDeactivated)
	assert.Equal(t, 1, result.MembershipsInactivated)
	assert.Equal(t, 0, result.MembershipsRemoved)

	// User account should be archived.
	u, err := userRepo.GetByID(userID)
	require.NoError(t, err)
	assert.NotNil(t, u.ArchivedAt)

	// Membership row preserved (inactivated, not deleted).
	m, err := teamRepo.GetMemberByID(memberID)
	require.NoError(t, err)
	assert.NotNil(t, m.ArchivedAt)

	// Assignment row still present (data preserved).
	var count int
	require.NoError(t, database.Get(&count,
		`SELECT COUNT(*) FROM activity_assignments WHERE team_member_id = ?`, memberID))
	assert.Equal(t, 1, count)
}

func TestRevokeUser_RemovesZeroHistoryMembership(t *testing.T) {
	database := openTestDB(t)
	userRepo := db.NewUserRepo(database)

	teamID, userID := seedTeamAndUser(t, database, "rvu-zero")
	memberID := "mem-rvu-zero"
	seedTeamMember(t, database, memberID, teamID, userID)

	result, err := userRepo.RevokeUser(userID)
	require.NoError(t, err)

	assert.True(t, result.AccountDeactivated)
	assert.Equal(t, 0, result.MembershipsInactivated)
	assert.Equal(t, 1, result.MembershipsRemoved)

	// Membership row removed.
	var count int
	require.NoError(t, database.Get(&count,
		`SELECT COUNT(*) FROM team_members WHERE id = ?`, memberID))
	assert.Equal(t, 0, count)
}

func TestRevokeUser_MixedMemberships(t *testing.T) {
	database := openTestDB(t)
	userRepo := db.NewUserRepo(database)

	// Two teams: one membership with history, one without.
	team1ID, userID := seedTeamAndUser(t, database, "rvu-mix-1")
	member1ID := "mem-rvu-mix-1"
	seedTeamMember(t, database, member1ID, team1ID, userID)

	_, err := database.Exec(
		`INSERT INTO teams (id, name, slug, created_at, updated_at) VALUES ('team-rvu-mix-2', 'Mix2', 'mix2', datetime('now'), datetime('now'))`,
	)
	require.NoError(t, err)
	member2ID := "mem-rvu-mix-2"
	_, err = database.Exec(
		`INSERT INTO team_members (id, team_id, user_id, role, joined_at) VALUES (?, 'team-rvu-mix-2', ?, 'member', datetime('now'))`,
		member2ID, userID,
	)
	require.NoError(t, err)

	// Seed assignment on team1 membership only.
	tlRepo2 := db.NewTimelineRepo(database)
	tl2 := makeTimeline("tl-rvu-mix", team1ID, userID)
	require.NoError(t, tlRepo2.Create(tl2))

	actID := "act-rvu-mix"
	_, err = database.Exec(
		`INSERT INTO activities (id, timeline_id, title, start_at, end_at, created_by, created_at, updated_at)
		 VALUES (?, ?, 'Task', datetime('now'), datetime('now'), ?, datetime('now'), datetime('now'))`,
		actID, tl2.ID, userID,
	)
	require.NoError(t, err)
	_, err = database.Exec(
		`INSERT INTO activity_assignments (activity_id, team_member_id) VALUES (?, ?)`,
		actID, member1ID,
	)
	require.NoError(t, err)

	result, err := userRepo.RevokeUser(userID)
	require.NoError(t, err)

	assert.True(t, result.AccountDeactivated)
	assert.Equal(t, 1, result.MembershipsInactivated) // member1 kept (has history)
	assert.Equal(t, 1, result.MembershipsRemoved)     // member2 deleted (no history)
}

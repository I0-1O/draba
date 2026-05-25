// Package models holds the domain types shared across the API, db,
// and event-bus packages. These types are persisted directly via sqlx
// (db tags) and serialised on the wire (json tags); changing tags is a
// schema change.
package models

import "time"

// Activity is a scheduled item of work belonging to a Team. ArchivedAt is
// non-nil when the activity is soft-deleted; list endpoints exclude archived
// activities by default.
//
// AssignedMemberIDs is not stored on the activities table; it is populated by
// the repository from activity_assignments after every list query.
//
// GoogleEventID and CaldavUID are preserved as-is — they identify the
// corresponding records in external calendar systems (VEVENT identifiers).
type Activity struct {
	ID                string     `db:"id"                  json:"id"`
	TeamID            string     `db:"team_id"             json:"teamId"`
	Title             string     `db:"title"               json:"title"`
	Description       *string    `db:"description"         json:"description,omitempty"`
	Icon              *string    `db:"icon"                json:"icon,omitempty"`
	Color             *string    `db:"color"               json:"color,omitempty"`
	StartAt           time.Time  `db:"start_at"            json:"startAt"`
	EndAt             time.Time  `db:"end_at"              json:"endAt"`
	AllDay            bool       `db:"all_day"             json:"allDay"`
	StatusID          *string    `db:"status_id"           json:"statusId,omitempty"`
	ParentActivityID  *string    `db:"parent_activity_id"  json:"parentActivityId,omitempty"`
	PercentComplete   *int       `db:"percent_complete"    json:"percentComplete,omitempty"`
	Location          *string    `db:"location"            json:"location,omitempty"`
	URL               *string    `db:"url"                 json:"url,omitempty"`
	Rrule             *string    `db:"rrule"               json:"rrule,omitempty"`
	CaldavUID         *string    `db:"caldav_uid"          json:"caldavUid,omitempty"`
	GoogleEventID     *string    `db:"google_event_id"     json:"googleEventId,omitempty"`
	CreatedBy         string     `db:"created_by"          json:"createdBy"`
	CreatedAt         time.Time  `db:"created_at"          json:"createdAt"`
	UpdatedAt         time.Time  `db:"updated_at"          json:"updatedAt"`
	ArchivedAt        *time.Time `db:"archived_at"         json:"archivedAt,omitempty"`
	AssignedMemberIDs []string   `db:"-"                   json:"assignedMemberIds"`
}

// TeamMemberWithUser joins a TeamMember row with its associated User so
// callers receive display names and emails in a single query. Participants
// (no user account) have empty email and avatar; their display_name comes
// from team_members.display_name via COALESCE in the query.
type TeamMemberWithUser struct {
	TeamMember
	Email       string  `db:"email"        json:"email"`
	DisplayName string  `db:"display_name" json:"displayName"`
	AvatarURL   *string `db:"avatar_url"   json:"avatarUrl,omitempty"`
}

// User is an authenticated account. PasswordHash is omitted from JSON
// to avoid leaking it through any handler that returns a User.
// ArchivedAt is non-nil when the account is inactivated; login is rejected
// for archived users.
type User struct {
	ID           string     `db:"id"             json:"id"`
	Email        string     `db:"email"          json:"email"`
	PasswordHash string     `db:"password_hash"  json:"-"`
	DisplayName  string     `db:"display_name"   json:"displayName"`
	AvatarURL    *string    `db:"avatar_url"     json:"avatarUrl,omitempty"`
	IsSuperadmin bool       `db:"is_superadmin"  json:"isSuperadmin"`
	CreatedAt    time.Time  `db:"created_at"     json:"createdAt"`
	UpdatedAt    time.Time  `db:"updated_at"     json:"updatedAt"`
	ArchivedAt   *time.Time `db:"archived_at"    json:"archivedAt,omitempty"`
}

// Team is a workspace that groups users and their scheduled work. Color and
// Icon are identity fields added in migration 006; both are nullable until
// explicitly set by an admin. Description, Notes, and ArchivedAt are added in
// migration 008; ArchivedAt is non-nil when the team is soft-deleted.
// InviteLinkToken is a stable, reusable token added in migration 009; when
// non-nil it can be used by anyone to join the team during registration.
type Team struct {
	ID              string     `db:"id"                  json:"id"`
	Name            string     `db:"name"                json:"name"`
	Slug            string     `db:"slug"                json:"slug"`
	Description     *string    `db:"description"         json:"description,omitempty"`
	Notes           *string    `db:"notes"               json:"notes,omitempty"`
	Color           *string    `db:"color"               json:"color,omitempty"`
	Icon            *string    `db:"icon"                json:"icon,omitempty"`
	InviteLinkToken *string    `db:"invite_link_token"   json:"inviteLinkToken,omitempty"`
	CreatedAt       time.Time  `db:"created_at"          json:"createdAt"`
	UpdatedAt       time.Time  `db:"updated_at"          json:"updatedAt"`
	ArchivedAt      *time.Time `db:"archived_at"         json:"archivedAt,omitempty"`
}

// TeamMember is the join row that puts a person in a Team. UserID is nil
// for login-less Participants; DisplayName is populated for them instead.
// Role is the team-level role: "admin" or "member". Color and Icon are
// identity fields (migration 006); Color stores a color ID (e.g. "teal").
// ArchivedAt is non-nil when the member is inactivated (migration 009);
// inactivated members lose access but their data and assignments are preserved.
type TeamMember struct {
	ID          string     `db:"id"           json:"id"`
	TeamID      string     `db:"team_id"      json:"teamId"`
	UserID      *string    `db:"user_id"      json:"userId,omitempty"`
	DisplayName *string    `db:"display_name" json:"displayName,omitempty"`
	Role        string     `db:"role"         json:"role"`
	Color       *string    `db:"color"        json:"color,omitempty"`
	Icon        *string    `db:"icon"         json:"icon,omitempty"`
	JoinedAt    time.Time  `db:"joined_at"    json:"joinedAt"`
	ArchivedAt  *time.Time `db:"archived_at"  json:"archivedAt,omitempty"`
}

// MemberStats holds computed activity and timeline counts for a member.
// All counts are date-relative and scoped to activities the member is assigned to.
type MemberStats struct {
	ActiveTimelines    int `json:"activeTimelines"`
	ArchivedTimelines  int `json:"archivedTimelines"`
	PastDue            int `json:"pastDue"`
	Running            int `json:"running"`
	Upcoming           int `json:"upcoming"`
	Unscheduled        int `json:"unscheduled"`
	ArchivedActivities int `json:"archivedActivities"`
}

// MemberDetail combines a TeamMemberWithUser with computed stats and the
// member's full list of team memberships. Returned by GET /teams/:id/members/:memberId.
type MemberDetail struct {
	TeamMemberWithUser
	Stats     MemberStats          `json:"stats"`
	Teams     []TeamMemberWithUser `json:"teams"`
	Deletable bool                 `json:"deletable"`
}

// Timeline is a named date range over a team's events. It is not a data
// container — it is a view over a team's events for a given date window.
// Access is governed by timeline_access + team role; share_token allows
// unauthenticated read access via a stable public URL. Color and Icon are
// identity fields (migration 006); Color stores a color ID (e.g. "teal").
type Timeline struct {
	ID         string     `db:"id"          json:"id"`
	TeamID     string     `db:"team_id"     json:"teamId"`
	Name       string     `db:"name"        json:"name"`
	StartDate  string     `db:"start_date"  json:"startDate"`
	EndDate    string     `db:"end_date"    json:"endDate"`
	Color      *string    `db:"color"       json:"color,omitempty"`
	Icon       *string    `db:"icon"        json:"icon,omitempty"`
	ShareToken string     `db:"share_token" json:"shareToken"`
	IcalToken  string     `db:"ical_token"  json:"icalToken"`
	CreatedBy  string     `db:"created_by"  json:"createdBy"`
	CreatedAt  time.Time  `db:"created_at"  json:"createdAt"`
	UpdatedAt  time.Time  `db:"updated_at"  json:"updatedAt"`
	ArchivedAt *time.Time `db:"archived_at" json:"archivedAt,omitempty"`
}

// SavedFilter is a user-owned, team-scoped named filter spec. Definition is
// an opaque JSON string interpreted by the client; the server treats it as
// arbitrary text and only validates that it parses as JSON.
type SavedFilter struct {
	ID         string    `db:"id"         json:"id"`
	TeamID     string    `db:"team_id"    json:"teamId"`
	UserID     string    `db:"user_id"    json:"userId"`
	Name       string    `db:"name"       json:"name"`
	Definition string    `db:"definition" json:"definition"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt  time.Time `db:"updated_at" json:"updatedAt"`
}

// UserPreference stores a single key/value setting for a user, optionally
// scoped to a timeline. TimelineID is “” for global preferences so the
// UNIQUE(user_id, timeline_id, key) DB constraint works without NULL handling.
// Serialised JSON omits TimelineID when empty so callers see null for global prefs.
type UserPreference struct {
	ID         string    `db:"id"          json:"id"`
	UserID     string    `db:"user_id"     json:"userId"`
	TimelineID string    `db:"timeline_id" json:"timelineId,omitempty"`
	Key        string    `db:"key"         json:"key"`
	Value      string    `db:"value"       json:"value"`
	UpdatedAt  time.Time `db:"updated_at"  json:"updatedAt"`
}

// APIToken is a long-lived Bearer credential a user issues for programmatic
// access. token_hash stores SHA-256(rawToken); the raw value is shown to the
// caller only once on creation. RevokedAt is non-nil when the token has been
// revoked; revoked tokens are not deleted so listing remains stable.
type APIToken struct {
	ID         string     `db:"id"           json:"id"`
	UserID     string     `db:"user_id"      json:"userId"`
	Name       string     `db:"name"         json:"name"`
	TokenHash  string     `db:"token_hash"   json:"-"`
	Scope      string     `db:"scope"        json:"scope"`
	LastUsedAt *time.Time `db:"last_used_at" json:"lastUsedAt,omitempty"`
	CreatedAt  time.Time  `db:"created_at"   json:"createdAt"`
	RevokedAt  *time.Time `db:"revoked_at"   json:"revokedAt,omitempty"`
}

// Invite is a single-use token that grants an email address the right to
// join a Team. AcceptedAt is non-nil once consumed; expired or accepted
// invites are rejected by the registration handler.
type Invite struct {
	ID         string     `db:"id"          json:"id"`
	TeamID     string     `db:"team_id"     json:"teamId"`
	Email      string     `db:"email"       json:"email"`
	Token      string     `db:"token"       json:"token"`
	Role       string     `db:"role"        json:"role"`
	InvitedBy  string     `db:"invited_by"  json:"invitedBy"`
	ExpiresAt  time.Time  `db:"expires_at"  json:"expiresAt"`
	AcceptedAt *time.Time `db:"accepted_at" json:"acceptedAt,omitempty"`
	CreatedAt  time.Time  `db:"created_at"  json:"createdAt"`
}

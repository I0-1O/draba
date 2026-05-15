// Package models holds the domain types shared across the API, db,
// and event-bus packages. These types are persisted directly via sqlx
// (db tags) and serialised on the wire (json tags); changing tags is a
// schema change.
package models

import "time"

// Event is a scheduled item of work belonging to a Team. ArchivedAt is
// non-nil when the event is soft-deleted; list endpoints exclude archived
// events by default.
type Event struct {
	ID              string     `db:"id"               json:"id"`
	TeamID          string     `db:"team_id"          json:"teamId"`
	Title           string     `db:"title"            json:"title"`
	Description     *string    `db:"description"      json:"description,omitempty"`
	Icon            *string    `db:"icon"             json:"icon,omitempty"`
	Color           *string    `db:"color"            json:"color,omitempty"`
	StartAt         time.Time  `db:"start_at"         json:"startAt"`
	EndAt           time.Time  `db:"end_at"           json:"endAt"`
	AllDay          bool       `db:"all_day"          json:"allDay"`
	StatusID        *string    `db:"status_id"        json:"statusId,omitempty"`
	ParentEventID   *string    `db:"parent_event_id"  json:"parentEventId,omitempty"`
	PercentComplete *int       `db:"percent_complete" json:"percentComplete,omitempty"`
	Location        *string    `db:"location"         json:"location,omitempty"`
	URL             *string    `db:"url"              json:"url,omitempty"`
	Rrule           *string    `db:"rrule"            json:"rrule,omitempty"`
	CaldavUID       *string    `db:"caldav_uid"       json:"caldavUid,omitempty"`
	GoogleEventID   *string    `db:"google_event_id"  json:"googleEventId,omitempty"`
	CreatedBy       string     `db:"created_by"       json:"createdBy"`
	CreatedAt       time.Time  `db:"created_at"       json:"createdAt"`
	UpdatedAt       time.Time  `db:"updated_at"       json:"updatedAt"`
	ArchivedAt      *time.Time `db:"archived_at"      json:"archivedAt,omitempty"`
}

// TeamMemberWithUser joins a TeamMember row with its associated User so
// callers receive display names and emails in a single query.
type TeamMemberWithUser struct {
	TeamMember
	Email       string  `db:"email"        json:"email"`
	DisplayName string  `db:"display_name" json:"displayName"`
	AvatarURL   *string `db:"avatar_url"   json:"avatarUrl,omitempty"`
}

// User is an authenticated account. PasswordHash is omitted from JSON
// to avoid leaking it through any handler that returns a User.
type User struct {
	ID           string    `db:"id"            json:"id"`
	Email        string    `db:"email"         json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	DisplayName  string    `db:"display_name"  json:"displayName"`
	AvatarURL    *string   `db:"avatar_url"    json:"avatarUrl,omitempty"`
	CreatedAt    time.Time `db:"created_at"    json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at"    json:"updatedAt"`
}

// Team is a workspace that groups users and their scheduled work.
type Team struct {
	ID        string    `db:"id"         json:"id"`
	Name      string    `db:"name"       json:"name"`
	Slug      string    `db:"slug"       json:"slug"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// TeamMember is the join row that puts a User in a Team with a given
// Role ("owner", "admin", "member"). Color is the per-team display color
// used in timeline views.
type TeamMember struct {
	TeamID   string    `db:"team_id"  json:"teamId"`
	UserID   string    `db:"user_id"  json:"userId"`
	Role     string    `db:"role"     json:"role"`
	Color    *string   `db:"color"    json:"color,omitempty"`
	JoinedAt time.Time `db:"joined_at" json:"joinedAt"`
}

// Timeline is a named date range over a team's events. It is not a data
// container — it is a view with optional access control and shareable links.
// Visibility "public" allows any team member to access; "restricted" limits
// access to users listed in timeline_access.
type Timeline struct {
	ID         string     `db:"id"          json:"id"`
	TeamID     string     `db:"team_id"     json:"teamId"`
	Name       string     `db:"name"        json:"name"`
	StartDate  string     `db:"start_date"  json:"startDate"`
	EndDate    string     `db:"end_date"    json:"endDate"`
	Visibility string     `db:"visibility"  json:"visibility"`
	ShareToken string     `db:"share_token" json:"shareToken"`
	IcalToken  string     `db:"ical_token"  json:"icalToken"`
	CreatedBy  string     `db:"created_by"  json:"createdBy"`
	CreatedAt  time.Time  `db:"created_at"  json:"createdAt"`
	UpdatedAt  time.Time  `db:"updated_at"  json:"updatedAt"`
	ArchivedAt *time.Time `db:"archived_at" json:"archivedAt,omitempty"`
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

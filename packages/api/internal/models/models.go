package models

import "time"

type User struct {
	ID           string    `db:"id"            json:"id"`
	Email        string    `db:"email"         json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	DisplayName  string    `db:"display_name"  json:"displayName"`
	AvatarURL    *string   `db:"avatar_url"    json:"avatarUrl,omitempty"`
	CreatedAt    time.Time `db:"created_at"    json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at"    json:"updatedAt"`
}

type Team struct {
	ID        string    `db:"id"         json:"id"`
	Name      string    `db:"name"       json:"name"`
	Slug      string    `db:"slug"       json:"slug"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

type TeamMember struct {
	TeamID   string    `db:"team_id"  json:"teamId"`
	UserID   string    `db:"user_id"  json:"userId"`
	Role     string    `db:"role"     json:"role"`
	Color    *string   `db:"color"    json:"color,omitempty"`
	JoinedAt time.Time `db:"joined_at" json:"joinedAt"`
}

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

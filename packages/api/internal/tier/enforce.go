package tier

import "errors"

// Sentinel errors returned when a tier limit would be exceeded. Handlers
// translate these into HTTP 402 (Payment Required) responses.
var (
	ErrUserLimitReached = errors.New("user limit reached for current tier")
	ErrTeamLimitReached = errors.New("team limit reached for current tier")
)

// CheckUserLimit returns ErrUserLimitReached when adding one more user
// would exceed this tier's MaxUsers. A MaxUsers of 0 is unlimited.
func (t Tier) CheckUserLimit(currentCount int) error {
	if l := t.Limits(); l.MaxUsers != 0 && currentCount >= l.MaxUsers {
		return ErrUserLimitReached
	}
	return nil
}

// CheckTeamLimit returns ErrTeamLimitReached when adding one more team
// would exceed this tier's MaxTeams. A MaxTeams of 0 is unlimited.
func (t Tier) CheckTeamLimit(currentCount int) error {
	if l := t.Limits(); l.MaxTeams != 0 && currentCount >= l.MaxTeams {
		return ErrTeamLimitReached
	}
	return nil
}

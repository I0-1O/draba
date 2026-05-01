package tier

import "errors"

var (
	ErrUserLimitReached = errors.New("user limit reached for current tier")
	ErrTeamLimitReached = errors.New("team limit reached for current tier")
)

func (t Tier) CheckUserLimit(currentCount int) error {
	if l := t.Limits(); l.MaxUsers != 0 && currentCount >= l.MaxUsers {
		return ErrUserLimitReached
	}
	return nil
}

func (t Tier) CheckTeamLimit(currentCount int) error {
	if l := t.Limits(); l.MaxTeams != 0 && currentCount >= l.MaxTeams {
		return ErrTeamLimitReached
	}
	return nil
}

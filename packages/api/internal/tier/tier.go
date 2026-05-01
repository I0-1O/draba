package tier

import (
	"fmt"
	"os"
)

type Tier string

const (
	Unlimited  Tier = ""
	Team       Tier = "team"
	Business   Tier = "business"
	Enterprise Tier = "enterprise"
)

// Limits holds the maximums for a tier. 0 means unlimited.
type Limits struct {
	MaxUsers int
	MaxTeams int
}

var tierLimits = map[Tier]Limits{
	Unlimited:  {MaxUsers: 0, MaxTeams: 0},
	Team:       {MaxUsers: 5, MaxTeams: 1},
	Business:   {MaxUsers: 15, MaxTeams: 3},
	Enterprise: {MaxUsers: 0, MaxTeams: 0},
}

// tierOrder is used by AtLeast to compare capability levels.
var tierOrder = map[Tier]int{
	Unlimited:  0,
	Team:       1,
	Business:   2,
	Enterprise: 3,
}

// Load reads DRABA_TIER from the environment. Unset returns Unlimited.
// An unrecognised value is an error — fail closed, don't silently default.
func Load() (Tier, error) {
	v := os.Getenv("DRABA_TIER")
	if v == "" {
		return Unlimited, nil
	}
	t := Tier(v)
	if _, ok := tierLimits[t]; !ok {
		return "", fmt.Errorf("unknown DRABA_TIER %q: must be team, business, or enterprise", v)
	}
	return t, nil
}

func (t Tier) Limits() Limits {
	return tierLimits[t]
}

// AtLeast reports whether t is at least as capable as other.
// Unlimited (self-host, free) is the lowest; Enterprise is the highest.
func (t Tier) AtLeast(other Tier) bool {
	return tierOrder[t] >= tierOrder[other]
}

func (t Tier) String() string {
	if t == Unlimited {
		return "unlimited"
	}
	return string(t)
}

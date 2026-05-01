// Package tier defines the deployment tiers (Unlimited, Team, Business,
// Enterprise) and the per-tier limits and capability gates the API enforces.
// Pro modules register through this package so they can read the active Tier
// at startup. See registry.go for the module registration contract.
package tier

import (
	"fmt"
	"os"
)

// Tier is a deployment tier identifier. The zero value (empty string) is
// Unlimited, which is what self-hosted/free installs run as.
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

// Limits returns the user/team caps for this tier. Unknown tiers return
// the zero value, which is interpreted as "unlimited".
func (t Tier) Limits() Limits {
	return tierLimits[t]
}

// AtLeast reports whether t is at least as capable as other.
// Unlimited (self-host, free) is the lowest; Enterprise is the highest.
func (t Tier) AtLeast(other Tier) bool {
	return tierOrder[t] >= tierOrder[other]
}

// String returns the tier name for logs and error messages. Unlimited
// renders as "unlimited" rather than the empty string.
func (t Tier) String() string {
	if t == Unlimited {
		return "unlimited"
	}
	return string(t)
}

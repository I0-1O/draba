package tier_test

import (
	"errors"
	"testing"

	"github.com/I0-1O/draba/packages/api/internal/tier"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		env     string
		want    tier.Tier
		wantErr bool
	}{
		{env: "", want: tier.Unlimited},
		{env: "team", want: tier.Team},
		{env: "business", want: tier.Business},
		{env: "enterprise", want: tier.Enterprise},
		{env: "garbage", wantErr: true},
		{env: "TEAM", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.env, func(t *testing.T) {
			t.Setenv("DRABA_TIER", tc.env)
			got, err := tier.Load()
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil (tier=%q)", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("Load() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestCheckUserLimit(t *testing.T) {
	tests := []struct {
		tier    tier.Tier
		count   int
		wantErr bool
	}{
		// Unlimited: never blocks
		{tier: tier.Unlimited, count: 0, wantErr: false},
		{tier: tier.Unlimited, count: 1000, wantErr: false},
		// Team: max 5
		{tier: tier.Team, count: 4, wantErr: false},
		{tier: tier.Team, count: 5, wantErr: true},
		{tier: tier.Team, count: 99, wantErr: true},
		// Business: max 15
		{tier: tier.Business, count: 14, wantErr: false},
		{tier: tier.Business, count: 15, wantErr: true},
		// Enterprise: unlimited
		{tier: tier.Enterprise, count: 1000, wantErr: false},
	}
	for _, tc := range tests {
		err := tc.tier.CheckUserLimit(tc.count)
		if tc.wantErr && !errors.Is(err, tier.ErrUserLimitReached) {
			t.Errorf("%s.CheckUserLimit(%d): expected ErrUserLimitReached, got %v", tc.tier, tc.count, err)
		}
		if !tc.wantErr && err != nil {
			t.Errorf("%s.CheckUserLimit(%d): unexpected error: %v", tc.tier, tc.count, err)
		}
	}
}

func TestCheckTeamLimit(t *testing.T) {
	tests := []struct {
		tier    tier.Tier
		count   int
		wantErr bool
	}{
		{tier: tier.Unlimited, count: 100, wantErr: false},
		{tier: tier.Team, count: 0, wantErr: false},
		{tier: tier.Team, count: 1, wantErr: true},
		{tier: tier.Business, count: 2, wantErr: false},
		{tier: tier.Business, count: 3, wantErr: true},
		{tier: tier.Enterprise, count: 1000, wantErr: false},
	}
	for _, tc := range tests {
		err := tc.tier.CheckTeamLimit(tc.count)
		if tc.wantErr && !errors.Is(err, tier.ErrTeamLimitReached) {
			t.Errorf("%s.CheckTeamLimit(%d): expected ErrTeamLimitReached, got %v", tc.tier, tc.count, err)
		}
		if !tc.wantErr && err != nil {
			t.Errorf("%s.CheckTeamLimit(%d): unexpected error: %v", tc.tier, tc.count, err)
		}
	}
}

func TestAtLeast(t *testing.T) {
	if tier.Enterprise.AtLeast(tier.Business) != true {
		t.Error("Enterprise should be at least Business")
	}
	if tier.Team.AtLeast(tier.Business) != false {
		t.Error("Team should not be at least Business")
	}
	if tier.Unlimited.AtLeast(tier.Team) != false {
		t.Error("Unlimited (self-host) should not be at least Team (paid)")
	}
	if tier.Business.AtLeast(tier.Business) != true {
		t.Error("Business should be at least Business")
	}
}

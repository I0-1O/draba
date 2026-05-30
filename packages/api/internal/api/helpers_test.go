package api

import (
	"errors"
	"fmt"
	"testing"
)

func Test_isUniqueConstraintError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"unrelated error", errors.New("some other error"), false},
		{"exact SQLite message", errors.New("UNIQUE constraint failed: tags.team_id, tags.name"), true},
		{"wrapped once", fmt.Errorf("creating tag: %w", errors.New("UNIQUE constraint failed: tags.name")), true},
		{"wrapped twice", fmt.Errorf("outer: %w", fmt.Errorf("inner: %w", errors.New("UNIQUE constraint failed: x.y"))), true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isUniqueConstraintError(c.err); got != c.want {
				t.Errorf("isUniqueConstraintError(%v) = %v, want %v", c.err, got, c.want)
			}
		})
	}
}

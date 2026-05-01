// Package auth provides password hashing and JWT issuance/validation
// for access and refresh tokens used by the HTTP API.
package auth

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

// bcryptCost is the work factor for password hashing. 12 is the project
// baseline — raise only after benchmarking on the slowest deployment target.
const bcryptCost = 12

// HashPassword returns a bcrypt hash of password using bcryptCost.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", fmt.Errorf("hashing password: %w", err)
	}
	return string(hash), nil
}

// CheckPassword returns nil when password matches hash. A non-nil result
// (typically bcrypt.ErrMismatchedHashAndPassword) means the password is wrong;
// callers should treat any error as authentication failure without leaking
// which case occurred.
func CheckPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

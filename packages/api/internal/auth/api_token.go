package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// APITokenPrefix is the visible prefix every issued API token starts with so
// they are recognisable in logs, dotfiles, and the auth middleware.
const APITokenPrefix = "draba_pat_"

// GenerateAPIToken returns a fresh raw API token (the value shown once to the
// caller) and its SHA-256 hash (the value persisted in api_tokens.token_hash).
//
// The raw token has 32 bytes (256 bits) of entropy hex-encoded, which is more
// than enough to make brute-force enumeration unreasonable; SHA-256 of a
// high-entropy secret is the right primitive here — bcrypt is unnecessary
// (and slow) for unguessable tokens.
func GenerateAPIToken() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("reading random: %w", err)
	}
	raw = APITokenPrefix + hex.EncodeToString(b)
	hash = HashAPIToken(raw)
	return raw, hash, nil
}

// HashAPIToken returns the SHA-256 hex digest of raw. Used both at issue time
// and on every request to look the token up by hash.
func HashAPIToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// LooksLikeAPIToken reports whether raw has the visible APITokenPrefix and is
// therefore an API token rather than a JWT. Cheap pre-check used by the auth
// middleware to pick the correct validator.
func LooksLikeAPIToken(raw string) bool {
	return strings.HasPrefix(raw, APITokenPrefix)
}

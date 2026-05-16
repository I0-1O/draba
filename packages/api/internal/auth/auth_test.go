package auth_test

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/auth"
)

func TestTokenService_AccessToken_Roundtrip(t *testing.T) {
	svc := auth.NewTokenService("test-secret")

	tok, err := svc.IssueAccessToken("user-1", "user@example.com")
	require.NoError(t, err)
	require.NotEmpty(t, tok)

	claims, err := svc.Validate(tok, "access")
	require.NoError(t, err)
	assert.Equal(t, "user-1", claims.UserID)
	assert.Equal(t, "user@example.com", claims.Email)
	assert.Equal(t, "access", claims.Type)
}

func TestTokenService_RefreshToken_Roundtrip(t *testing.T) {
	svc := auth.NewTokenService("test-secret")

	tok, err := svc.IssueRefreshToken("user-1", "user@example.com")
	require.NoError(t, err)
	require.NotEmpty(t, tok)

	claims, err := svc.Validate(tok, "refresh")
	require.NoError(t, err)
	assert.Equal(t, "user-1", claims.UserID)
	assert.Equal(t, "refresh", claims.Type)
}

func TestTokenService_Validate_WrongType_AccessAsRefresh(t *testing.T) {
	svc := auth.NewTokenService("test-secret")

	tok, err := svc.IssueAccessToken("user-1", "user@example.com")
	require.NoError(t, err)

	_, err = svc.Validate(tok, "refresh")
	assert.Error(t, err, "access token presented as refresh must be rejected")
}

func TestTokenService_Validate_WrongType_RefreshAsAccess(t *testing.T) {
	svc := auth.NewTokenService("test-secret")

	tok, err := svc.IssueRefreshToken("user-1", "user@example.com")
	require.NoError(t, err)

	_, err = svc.Validate(tok, "access")
	assert.Error(t, err, "refresh token presented as access must be rejected")
}

func TestTokenService_Validate_WrongSecret(t *testing.T) {
	signer := auth.NewTokenService("secret-a")
	verifier := auth.NewTokenService("secret-b")

	tok, err := signer.IssueAccessToken("user-1", "user@example.com")
	require.NoError(t, err)

	_, err = verifier.Validate(tok, "access")
	assert.Error(t, err, "token signed with a different secret must be rejected")
}

func TestTokenService_Validate_Expired(t *testing.T) {
	const secret = "test-secret"
	svc := auth.NewTokenService(secret)

	// Craft a token whose ExpiresAt is already in the past using the jwt
	// library directly — the production IssueAccessToken always uses a future
	// TTL, so this is the only way to produce an expired token in a test.
	claims := &auth.Claims{
		UserID: "user-1",
		Email:  "user@example.com",
		Type:   "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Minute)),
		},
	}
	raw := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := raw.SignedString([]byte(secret))
	require.NoError(t, err)

	_, err = svc.Validate(signed, "access")
	assert.Error(t, err, "expired token must be rejected")
}

func TestTokenService_Validate_AlgConfusion(t *testing.T) {
	svc := auth.NewTokenService("test-secret")

	// Forge a token signed with RS256 to trigger the algorithm-confusion guard.
	// The validator rejects any non-HMAC method before reading claims, so the
	// exact payload contents do not matter here.
	privKey, err := rsa.GenerateKey(rand.Reader, 1024)
	require.NoError(t, err)

	claims := &auth.Claims{
		UserID: "attacker",
		Email:  "attacker@example.com",
		Type:   "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	raw := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signed, err := raw.SignedString(privKey)
	require.NoError(t, err)

	_, err = svc.Validate(signed, "access")
	assert.Error(t, err, "RS256-signed token must be rejected by the HS256-only validator")
}

func TestHashPassword_CheckPassword_Roundtrip(t *testing.T) {
	hash, err := auth.HashPassword("correct-horse-battery")
	require.NoError(t, err)
	require.NotEmpty(t, hash)
	assert.NotEqual(t, "correct-horse-battery", hash, "hash must not equal the plaintext")

	assert.NoError(t, auth.CheckPassword(hash, "correct-horse-battery"))
}

func TestCheckPassword_WrongPassword(t *testing.T) {
	hash, err := auth.HashPassword("correct-horse-battery")
	require.NoError(t, err)

	err = auth.CheckPassword(hash, "wrong-password")
	assert.Error(t, err, "wrong password must return an error")
}

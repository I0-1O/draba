package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Token TTLs. Access tokens are short-lived so revocation latency is bounded;
// refresh tokens are long enough to survive a typical work week.
const (
	accessTokenTTL  = 15 * time.Minute
	refreshTokenTTL = 7 * 24 * time.Hour
	// shareViewTTL bounds how long a single password unlock grants access to a
	// share before the viewer must re-enter the password.
	shareViewTTL = 30 * time.Minute
)

// Claims is the JWT payload used for both access and refresh tokens.
// The Type field discriminates the two so a refresh token cannot be
// presented in place of an access token (and vice versa).
type Claims struct {
	UserID string `json:"uid"`
	Email  string `json:"email"`
	Type   string `json:"type"` // "access" or "refresh"
	jwt.RegisteredClaims
}

// TokenService signs and validates JWTs with a shared HMAC secret.
type TokenService struct {
	secret []byte
}

// NewTokenService returns a TokenService that signs with secret.
// The secret must be kept private; rotating it invalidates every issued token.
func NewTokenService(secret string) *TokenService {
	return &TokenService{secret: []byte(secret)}
}

// IssueAccessToken returns a signed short-lived access token for the user.
func (s *TokenService) IssueAccessToken(userID, email string) (string, error) {
	return s.sign(userID, email, "access", accessTokenTTL)
}

// IssueRefreshToken returns a signed long-lived refresh token. Refresh tokens
// are exchanged at /auth/refresh for new access tokens.
func (s *TokenService) IssueRefreshToken(userID, email string) (string, error) {
	return s.sign(userID, email, "refresh", refreshTokenTTL)
}

// IssueShareViewToken returns a signed short-lived token that grants read
// access to a single password-protected share. The share ID is carried in the
// JWT subject so the token cannot be replayed against a different share (see
// ValidateShareViewToken). It carries no user identity — the public viewer is
// anonymous.
func (s *TokenService) IssueShareViewToken(shareID string) (string, error) {
	claims := Claims{
		Type: "share_view",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   shareID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(shareViewTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", fmt.Errorf("signing share view token: %w", err)
	}
	return signed, nil
}

// ValidateShareViewToken verifies a share view token and that it was issued for
// shareID specifically. A token minted for one share is rejected against any
// other, preventing a valid unlock from being reused across shares.
func (s *TokenService) ValidateShareViewToken(tokenStr, shareID string) error {
	claims, err := s.Validate(tokenStr, "share_view")
	if err != nil {
		return err
	}
	if claims.Subject != shareID {
		return fmt.Errorf("share view token issued for a different share")
	}
	return nil
}

// sign builds and serializes a Claims-bearing HS256 JWT.
func (s *TokenService) sign(userID, email, tokenType string, ttl time.Duration) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		Type:   tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", fmt.Errorf("signing token: %w", err)
	}
	return signed, nil
}

// Validate parses and verifies tokenStr, returning its claims when the
// signature is valid, the token has not expired, and its Type matches
// expectedType ("access" or "refresh"). Any failure returns an error and
// nil claims.
func (s *TokenService) Validate(tokenStr, expectedType string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		// Reject any token not signed with HMAC — guards against the
		// classic "alg=none" / algorithm-confusion attack.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("parsing token: %w", err)
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	if claims.Type != expectedType {
		return nil, fmt.Errorf("wrong token type")
	}
	return claims, nil
}

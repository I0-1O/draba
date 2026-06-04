// White-box tests for the mailer package. These live in package mailer
// (not mailer_test) so they can exercise the unexported encryptPassword /
// decryptPassword helpers directly, as called for by the Phase 12 plan.
package mailer

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeSettings is an in-memory SettingsReader for tests. It avoids a real DB
// so mailer logic can be exercised in isolation.
type fakeSettings struct {
	store map[string]string
}

func newFakeSettings() *fakeSettings {
	return &fakeSettings{store: map[string]string{}}
}

func (f *fakeSettings) Get(key string) (string, error) { return f.store[key], nil }

func (f *fakeSettings) Set(key, value string) error {
	f.store[key] = value
	return nil
}

// testKeyMaterial is arbitrary key material; New derives a 32-byte AES key from it.
var testKeyMaterial = []byte("phase-12-test-key-material")

func TestEncryptDecryptPassword_Roundtrip(t *testing.T) {
	m := New(newFakeSettings(), testKeyMaterial)

	const plaintext = "s3cr3t-app-password"
	enc, err := m.encryptPassword(plaintext)
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(enc, encPrefix), "ciphertext must carry the enc:v1: sentinel")
	assert.NotContains(t, enc, plaintext, "plaintext must not appear in ciphertext")

	dec, err := m.decryptPassword(enc)
	require.NoError(t, err)
	assert.Equal(t, plaintext, dec)
}

func TestEncryptPassword_NoKey_ReturnsPlaintext(t *testing.T) {
	// New(nil-keyMaterial) disables encryption — used by zero-value/test paths.
	m := New(newFakeSettings(), nil)

	enc, err := m.encryptPassword("hunter2")
	require.NoError(t, err)
	assert.Equal(t, "hunter2", enc, "with no key, password is stored as-is")
	assert.False(t, strings.HasPrefix(enc, encPrefix))
}

func TestDecryptPassword_PlaintextFallback(t *testing.T) {
	// Values written before encryption was introduced carry no sentinel and
	// must round-trip unchanged so legacy configs keep working.
	m := New(newFakeSettings(), testKeyMaterial)

	dec, err := m.decryptPassword("legacy-plaintext")
	require.NoError(t, err)
	assert.Equal(t, "legacy-plaintext", dec)
}

func TestSaveConfig_EncryptsPasswordAtRest(t *testing.T) {
	fs := newFakeSettings()
	m := New(fs, testKeyMaterial)

	cfg := &SMTPConfig{
		Host:       "smtp.example.com",
		Port:       587,
		Username:   "user",
		Password:   "plaintext-pw",
		FromName:   "draba",
		FromEmail:  "no-reply@example.com",
		Encryption: "starttls",
	}
	require.NoError(t, m.SaveConfig(cfg))

	// The raw stored blob must not contain the plaintext password.
	raw := fs.store["smtp_config"]
	require.NotEmpty(t, raw)
	assert.Contains(t, raw, encPrefix, "stored password must be encrypted")
	assert.NotContains(t, raw, "plaintext-pw", "plaintext password must not be persisted")
	// SaveConfig must not mutate the caller's struct.
	assert.Equal(t, "plaintext-pw", cfg.Password, "SaveConfig must not mutate caller's config")
}

func TestLoadConfig_DecryptsPassword(t *testing.T) {
	fs := newFakeSettings()
	m := New(fs, testKeyMaterial)

	saved := &SMTPConfig{Host: "smtp.example.com", Port: 587, Password: "round-trip-pw"}
	require.NoError(t, m.SaveConfig(saved))

	loaded, err := m.LoadConfig()
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, "round-trip-pw", loaded.Password, "LoadConfig must decrypt the stored password")
	assert.Equal(t, "smtp.example.com", loaded.Host)
}

func TestLoadConfig_PlaintextLegacyValue(t *testing.T) {
	// A config stored as plaintext JSON (pre-encryption) must still load.
	fs := newFakeSettings()
	fs.store["smtp_config"] = `{"host":"smtp.legacy.com","port":25,"password":"old-plaintext"}`
	m := New(fs, testKeyMaterial)

	loaded, err := m.LoadConfig()
	require.NoError(t, err)
	require.NotNil(t, loaded)
	assert.Equal(t, "old-plaintext", loaded.Password)
}

func TestLoadConfig_Unconfigured_ReturnsNil(t *testing.T) {
	m := New(newFakeSettings(), testKeyMaterial)

	loaded, err := m.LoadConfig()
	require.NoError(t, err)
	assert.Nil(t, loaded, "no stored config must yield (nil, nil)")
}

func TestSend_NoConfig_IsNoOp(t *testing.T) {
	// With no SMTP configured, Send must return nil without attempting a
	// connection — callers rely on this to treat "no mailer" as a no-op.
	m := New(newFakeSettings(), testKeyMaterial)

	err := m.Send("someone@example.com", "Subject", "<p>body</p>")
	assert.NoError(t, err, "Send with no config must be a silent no-op")
}

func TestIsConfigured(t *testing.T) {
	fs := newFakeSettings()
	m := New(fs, testKeyMaterial)
	assert.False(t, m.IsConfigured(), "fresh instance is not configured")

	require.NoError(t, m.SaveConfig(&SMTPConfig{Host: "smtp.example.com", Port: 587}))
	assert.True(t, m.IsConfigured(), "instance with a host is configured")
}

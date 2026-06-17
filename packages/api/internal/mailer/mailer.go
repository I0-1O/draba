// Package mailer sends email via SMTP. Configuration is read from
// instance_settings at send time so changes take effect without a restart.
// When SMTP is not configured, Send returns nil (not an error) so callers
// can treat "no mailer" as a no-op — the forgot-password flow still returns
// 200 to prevent email enumeration.
package mailer

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/smtp"
	"strings"
)

// encPrefix marks values encrypted with AES-256-GCM so LoadConfig can
// distinguish them from legacy plaintext values written before encryption
// was introduced.
const encPrefix = "enc:v1:"

// SMTPConfig holds the full SMTP configuration for the instance.
type SMTPConfig struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"` // stored encrypted at rest via AES-256-GCM
	FromName   string `json:"fromName"`
	FromEmail  string `json:"fromEmail"`
	Encryption string `json:"encryption"` // "none" | "tls" | "starttls"
}

// SettingsReader is the subset of InstanceSettingsRepo used by Mailer.
type SettingsReader interface {
	Get(key string) (string, error)
	Set(key, value string) error
}

// Mailer sends email via SMTP. The zero value is valid; calling Send on an
// unconfigured Mailer is a no-op.
type Mailer struct {
	settings SettingsReader
	encKey   []byte // 32-byte AES-256 key derived from keyMaterial; nil disables encryption
}

// New returns a Mailer that reads config from settings at send time.
// keyMaterial is used to derive an AES-256 key for encrypting stored SMTP
// passwords. Pass nil to disable encryption (tests, zero-value usage).
func New(settings SettingsReader, keyMaterial []byte) *Mailer {
	var encKey []byte
	if len(keyMaterial) > 0 {
		k := sha256.Sum256(keyMaterial)
		encKey = k[:]
	}
	return &Mailer{settings: settings, encKey: encKey}
}

// LoadConfig reads the SMTP configuration from instance_settings.
// Returns nil when SMTP has not been configured.
func (m *Mailer) LoadConfig() (*SMTPConfig, error) {
	raw, err := m.settings.Get("smtp_config")
	if err != nil {
		return nil, fmt.Errorf("loading smtp config: %w", err)
	}
	if raw == "" {
		return nil, nil
	}
	var cfg SMTPConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return nil, fmt.Errorf("parsing smtp config: %w", err)
	}
	if cfg.Password != "" {
		dec, err := m.decryptPassword(cfg.Password)
		if err != nil {
			return nil, fmt.Errorf("decrypting smtp password: %w", err)
		}
		cfg.Password = dec
	}
	return &cfg, nil
}

// IsConfigured reports whether SMTP has been set up.
func (m *Mailer) IsConfigured() bool {
	cfg, err := m.LoadConfig()
	return err == nil && cfg != nil && cfg.Host != ""
}

// SaveConfig serialises cfg and stores it in instance_settings.
// The password field is encrypted before storage when an encryption key is set.
func (m *Mailer) SaveConfig(cfg *SMTPConfig) error {
	toStore := *cfg
	if cfg.Password != "" {
		enc, err := m.encryptPassword(cfg.Password)
		if err != nil {
			return fmt.Errorf("encrypting smtp password: %w", err)
		}
		toStore.Password = enc
	}
	b, err := json.Marshal(toStore)
	if err != nil {
		return fmt.Errorf("serialising smtp config: %w", err)
	}
	return m.settings.Set("smtp_config", string(b))
}

// DeleteConfig removes the SMTP configuration.
func (m *Mailer) DeleteConfig() error {
	return m.settings.Set("smtp_config", "")
}

// Send sends a plain-text / HTML email to a single recipient.
// Returns nil without sending when SMTP is not configured.
func (m *Mailer) Send(to, subject, htmlBody string) error {
	cfg, err := m.LoadConfig()
	if err != nil {
		slog.Warn("mailer: failed to load config", "err", err)
		return nil
	}
	if cfg == nil || cfg.Host == "" {
		slog.Debug("mailer: no smtp config — email skipped", "subject", subject)
		return nil
	}

	return sendViaConfig(cfg, to, subject, htmlBody)
}

// SendWithConfig sends using an explicit config object, bypassing the stored
// config. Used by the SMTP test endpoint before saving.
func SendWithConfig(cfg *SMTPConfig, to, subject, htmlBody string) error {
	return sendViaConfig(cfg, to, subject, htmlBody)
}

// encryptPassword encrypts plaintext with AES-256-GCM and returns a
// base64-encoded ciphertext prefixed with encPrefix. Returns plaintext
// unchanged when no encryption key is set.
func (m *Mailer) encryptPassword(plaintext string) (string, error) {
	if len(m.encKey) == 0 {
		return plaintext, nil
	}
	block, err := aes.NewCipher(m.encKey)
	if err != nil {
		return "", fmt.Errorf("creating cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating gcm: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generating nonce: %w", err)
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return encPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptPassword reverses encryptPassword. Values without encPrefix are
// returned as-is — this handles configs saved before encryption was added.
func (m *Mailer) decryptPassword(encoded string) (string, error) {
	if !strings.HasPrefix(encoded, encPrefix) {
		// Plaintext fallback — encrypts on next SaveConfig call.
		return encoded, nil
	}
	if len(m.encKey) == 0 {
		return "", fmt.Errorf("encryption key not set; cannot decrypt smtp password")
	}
	data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(encoded, encPrefix))
	if err != nil {
		return "", fmt.Errorf("decoding encrypted password: %w", err)
	}
	block, err := aes.NewCipher(m.encKey)
	if err != nil {
		return "", fmt.Errorf("creating cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("creating gcm: %w", err)
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	plain, err := gcm.Open(nil, data[:nonceSize], data[nonceSize:], nil)
	if err != nil {
		return "", fmt.Errorf("decrypting password: %w", err)
	}
	return string(plain), nil
}

func sendViaConfig(cfg *SMTPConfig, to, subject, htmlBody string) error {
	from := fmt.Sprintf("%s <%s>", cfg.FromName, cfg.FromEmail)
	msg := buildMessage(from, to, subject, htmlBody)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	switch strings.ToLower(cfg.Encryption) {
	case "tls":
		return sendTLS(cfg, addr, from, to, msg)
	case "starttls":
		return sendSTARTTLS(cfg, addr, from, to, msg)
	default:
		return sendPlain(cfg, addr, from, to, msg)
	}
}

func buildMessage(from, to, subject, htmlBody string) string {
	var b strings.Builder
	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + to + "\r\n")
	b.WriteString("Subject: " + subject + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	b.WriteString("\r\n")
	b.WriteString(htmlBody)
	return b.String()
}

func sendPlain(cfg *SMTPConfig, addr, from, to, msg string) error {
	var auth smtp.Auth
	if cfg.Username != "" {
		auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	}
	if err := smtp.SendMail(addr, auth, cfg.FromEmail, []string{to}, []byte(msg)); err != nil {
		return fmt.Errorf("smtp send: %w", err)
	}
	return nil
}

func sendTLS(cfg *SMTPConfig, addr, from, to, msg string) error {
	tlsCfg := &tls.Config{ServerName: cfg.Host} //nolint:gosec // InsecureSkipVerify not set; ServerName ensures cert validation
	conn, err := tls.Dial("tcp", addr, tlsCfg)
	if err != nil {
		return fmt.Errorf("smtp tls dial: %w", err)
	}
	defer func() { _ = conn.Close() }()

	c, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return fmt.Errorf("smtp new client: %w", err)
	}
	defer c.Quit() //nolint:errcheck // SMTP Quit errors are not actionable at this point

	if cfg.Username != "" {
		auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	return doSend(c, cfg.FromEmail, to, msg)
}

func sendSTARTTLS(cfg *SMTPConfig, addr, from, to, msg string) error {
	c, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer c.Quit() //nolint:errcheck // SMTP Quit errors are not actionable at this point

	tlsCfg := &tls.Config{ServerName: cfg.Host} //nolint:gosec // InsecureSkipVerify not set; this is standard TLS
	if err := c.StartTLS(tlsCfg); err != nil {
		return fmt.Errorf("smtp starttls: %w", err)
	}
	if cfg.Username != "" {
		auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	return doSend(c, cfg.FromEmail, to, msg)
}

func doSend(c *smtp.Client, from, to, msg string) error {
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("smtp MAIL: %w", err)
	}
	if err := c.Rcpt(to); err != nil {
		return fmt.Errorf("smtp RCPT: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp DATA: %w", err)
	}
	if _, err := fmt.Fprint(w, msg); err != nil {
		return fmt.Errorf("smtp write body: %w", err)
	}
	return w.Close()
}

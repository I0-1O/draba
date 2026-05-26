// Package mailer sends email via SMTP. Configuration is read from
// instance_settings at send time so changes take effect without a restart.
// When SMTP is not configured, Send returns nil (not an error) so callers
// can treat "no mailer" as a no-op — the forgot-password flow still returns
// 200 to prevent email enumeration.
package mailer

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/smtp"
	"strings"
)

// SMTPConfig holds the full SMTP configuration for the instance.
type SMTPConfig struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"` // stored encrypted in instance_settings; decrypted before use
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
}

// New returns a Mailer that reads config from settings at send time.
func New(settings SettingsReader) *Mailer {
	return &Mailer{settings: settings}
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
	return &cfg, nil
}

// IsConfigured reports whether SMTP has been set up.
func (m *Mailer) IsConfigured() bool {
	cfg, err := m.LoadConfig()
	return err == nil && cfg != nil && cfg.Host != ""
}

// SaveConfig serialises cfg and stores it in instance_settings.
func (m *Mailer) SaveConfig(cfg *SMTPConfig) error {
	b, err := json.Marshal(cfg)
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
		slog.Debug("mailer: no smtp config — email skipped", "to", to, "subject", subject)
		return nil
	}

	return sendViaConfig(cfg, to, subject, htmlBody)
}

// SendWithConfig sends using an explicit config object, bypassing the stored
// config. Used by the SMTP test endpoint before saving.
func SendWithConfig(cfg *SMTPConfig, to, subject, htmlBody string) error {
	return sendViaConfig(cfg, to, subject, htmlBody)
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
	defer conn.Close()

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

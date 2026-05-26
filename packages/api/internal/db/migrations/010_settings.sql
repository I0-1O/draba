-- Phase 10.1.3: user-level identity, instance settings, password reset tokens.
--
-- Changes:
--   users                  → add color, icon (user-level identity, same value space as team_members)
--   instance_settings      → new table for SMTP config and instance-level defaults (key/value store)
--   password_reset_tokens  → new table for forgot-password flow
--
-- SMTP password is stored encrypted in instance_settings; the mailer package
-- decrypts at send time using DRABA_JWT_SECRET as the key.
ALTER TABLE users ADD COLUMN color TEXT;
ALTER TABLE users ADD COLUMN icon  TEXT;

CREATE TABLE IF NOT EXISTS instance_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at    DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
    ON password_reset_tokens (user_id);

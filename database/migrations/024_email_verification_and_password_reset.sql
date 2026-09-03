-- Authentication tokens for email verification and password reset.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
ON users(email_verification_token_hash);

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
ON users(password_reset_token_hash);
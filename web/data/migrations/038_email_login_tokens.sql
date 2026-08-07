-- Ring Mailer: hashed OTP / magic-link / verify / reset tokens
-- Adapted from react-email-login-specialist (users.id is VARCHAR in Ring schema)

DO $$ BEGIN
  CREATE TYPE email_flow_type AS ENUM ('otp_code', 'magic_link', 'email_verify', 'password_reset');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS email_login_tokens (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(254)  NOT NULL,
  token_hash     VARCHAR(64)   NOT NULL,
  flow_type      email_flow_type NOT NULL DEFAULT 'otp_code',
  user_id        VARCHAR(255)  REFERENCES users(id) ON DELETE CASCADE,
  expires_at     TIMESTAMPTZ   NOT NULL,
  used_at        TIMESTAMPTZ,
  ip_address     INET,
  attempt_count  SMALLINT      NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_login_tokens_hash_uidx
  ON email_login_tokens (token_hash);

CREATE INDEX IF NOT EXISTS email_login_tokens_email_rate_idx
  ON email_login_tokens (email, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS email_login_tokens_cleanup_idx
  ON email_login_tokens (expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE email_login_tokens IS
  'Ring Mailer auth tokens — store HMAC/SHA256 hashes only; never raw OTP or magic tokens';

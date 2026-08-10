-- Phone login OTP challenges (Telegram Gateway request_id / future WhatsApp).
-- Parallel to email_login_tokens; stores Gateway request_id, not raw OTP codes.

CREATE TABLE IF NOT EXISTS phone_login_tokens (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          VARCHAR(20)   NOT NULL,
  request_id     VARCHAR(128)  NOT NULL,
  channel        VARCHAR(32)   NOT NULL DEFAULT 'telegram_gateway',
  user_id        VARCHAR(255)  REFERENCES users(id) ON DELETE CASCADE,
  expires_at     TIMESTAMPTZ   NOT NULL,
  used_at        TIMESTAMPTZ,
  ip_address     INET,
  attempt_count  SMALLINT      NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS phone_login_tokens_request_uidx
  ON phone_login_tokens (request_id);

CREATE INDEX IF NOT EXISTS phone_login_tokens_phone_rate_idx
  ON phone_login_tokens (phone, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS phone_login_tokens_cleanup_idx
  ON phone_login_tokens (expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE phone_login_tokens IS
  'Phone login OTP challenges — Gateway/WhatsApp request ids only; never store raw OTP codes';

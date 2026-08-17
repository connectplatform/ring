-- P2 WhatsApp OTP: store hashed self-issued codes; widen request_id for wamid.…
-- Never store raw OTP. Telegram Gateway rows keep code_hash NULL.

ALTER TABLE phone_login_tokens
  ALTER COLUMN request_id TYPE VARCHAR(255);

ALTER TABLE phone_login_tokens
  ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64);

COMMENT ON COLUMN phone_login_tokens.code_hash IS
  'HMAC-SHA256 of self-issued OTP (WhatsApp/SMS); NULL for Telegram Gateway';

COMMENT ON TABLE phone_login_tokens IS
  'Phone login OTP challenges — Gateway request_id or WA wamid; code_hash for self-issued rails only; never raw OTP';

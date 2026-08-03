/**
 * PostgreSQL persistence for Ring Mailer login / verify / reset tokens.
 */
import 'server-only'

import { getSharedPgPool } from '@/lib/database/shared-pg-pool'
import {
  hashToken,
  hmacOTP,
  type EmailFlowType,
  verifyOTPTiming,
} from '@/lib/auth/email-tokens'
import { normalizeAuthEmail } from '@/features/auth/services/user-resolve'

const RATE_WINDOW = "INTERVAL '15 minutes'"
const MAX_REQUESTS_PER_WINDOW = 5
const MAX_VERIFY_ATTEMPTS = 5

export type StoredTokenRow = {
  id: string
  email: string
  flow_type: EmailFlowType
  user_id: string | null
  attempt_count: number
}

async function pool() {
  return getSharedPgPool()
}

export async function countRecentTokenRequests(email: string): Promise<number> {
  const normalized = normalizeAuthEmail(email)
  const pg = await pool()
  const { rows } = await pg.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM email_login_tokens
     WHERE email = $1 AND created_at > NOW() - ${RATE_WINDOW}`,
    [normalized],
  )
  return parseInt(rows[0]?.count || '0', 10)
}

export async function assertUnderRateLimit(email: string): Promise<boolean> {
  const count = await countRecentTokenRequests(email)
  return count < MAX_REQUESTS_PER_WINDOW
}

export async function invalidateOpenTokens(
  email: string,
  flowType: EmailFlowType,
): Promise<void> {
  const normalized = normalizeAuthEmail(email)
  const pg = await pool()
  await pg.query(
    `DELETE FROM email_login_tokens
     WHERE email = $1 AND used_at IS NULL AND flow_type = $2`,
    [normalized, flowType],
  )
}

export async function insertEmailToken(params: {
  email: string
  rawToken: string
  flowType: EmailFlowType
  userId?: string | null
  expiresIn: string
  ipAddress?: string | null
  /** When true, hash via hmacOTP(code, email) instead of hashToken */
  otpStyle?: boolean
}): Promise<{ id: string }> {
  const normalized = normalizeAuthEmail(params.email)
  const tokenHash = params.otpStyle
    ? hmacOTP(params.rawToken, normalized)
    : hashToken(params.rawToken)

  await invalidateOpenTokens(normalized, params.flowType)

  const pg = await pool()
  const { rows } = await pg.query<{ id: string }>(
    `INSERT INTO email_login_tokens (email, token_hash, flow_type, user_id, expires_at, ip_address)
     VALUES ($1, $2, $3, $4, NOW() + $5::interval, $6::inet)
     RETURNING id`,
    [
      normalized,
      tokenHash,
      params.flowType,
      params.userId ?? null,
      params.expiresIn,
      params.ipAddress || null,
    ],
  )
  return { id: rows[0].id }
}

export async function consumeOtpCode(params: {
  email: string
  code: string
}): Promise<{ email: string; userId: string | null } | null> {
  const normalized = normalizeAuthEmail(params.email)
  const tokenHash = hmacOTP(params.code.trim(), normalized)
  const pg = await pool()

  const pending = await pg.query<StoredTokenRow>(
    `SELECT id, email, flow_type, user_id, attempt_count
     FROM email_login_tokens
     WHERE email = $1 AND flow_type = 'otp_code' AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalized],
  )
  const row = pending.rows[0]
  if (!row) return null

  if (row.attempt_count >= MAX_VERIFY_ATTEMPTS) {
    await pg.query(`UPDATE email_login_tokens SET used_at = NOW() WHERE id = $1`, [row.id])
    return null
  }

  const expected = await pg.query<{ token_hash: string }>(
    `SELECT token_hash FROM email_login_tokens WHERE id = $1`,
    [row.id],
  )
  const storedHash = expected.rows[0]?.token_hash
  if (!storedHash || !verifyOTPTiming(storedHash, tokenHash)) {
    await pg.query(
      `UPDATE email_login_tokens SET attempt_count = attempt_count + 1 WHERE id = $1`,
      [row.id],
    )
    return null
  }

  const consumed = await pg.query<{ email: string; user_id: string | null }>(
    `UPDATE email_login_tokens
     SET used_at = NOW()
     WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING email, user_id`,
    [row.id],
  )
  const out = consumed.rows[0]
  if (!out) return null
  return { email: out.email, userId: out.user_id }
}

export async function consumeMagicToken(params: {
  rawToken: string
  flowTypes?: EmailFlowType[]
}): Promise<{ email: string; userId: string | null; flowType: EmailFlowType } | null> {
  const tokenHash = hashToken(params.rawToken)
  const flows = params.flowTypes ?? ['magic_link', 'email_verify', 'password_reset']
  const pg = await pool()

  const { rows } = await pg.query<{
    email: string
    user_id: string | null
    flow_type: EmailFlowType
  }>(
    `UPDATE email_login_tokens
     SET used_at = NOW()
     WHERE token_hash = $1
       AND flow_type = ANY($2::email_flow_type[])
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING email, user_id, flow_type`,
    [tokenHash, flows],
  )
  const row = rows[0]
  if (!row) return null
  return { email: row.email, userId: row.user_id, flowType: row.flow_type }
}

export async function cleanupExpiredEmailTokens(): Promise<number> {
  const pg = await pool()
  const { rowCount } = await pg.query(
    `DELETE FROM email_login_tokens WHERE expires_at < NOW() - INTERVAL '24 hours'`,
  )
  return rowCount ?? 0
}

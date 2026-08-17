/**
 * PostgreSQL persistence for phone login OTP challenges.
 * Telegram Gateway: request_id only. WhatsApp: request_id + code_hash (hmacOTP).
 */
import 'server-only'

import { getSharedPgPool } from '@/lib/database/shared-pg-pool'
import { hmacOTP } from '@/lib/auth/email-tokens'
import { normalizeToE164 } from '@/lib/phone/e164'

const RATE_WINDOW = "INTERVAL '15 minutes'"
const MAX_REQUESTS_PER_WINDOW = 5
const MAX_VERIFY_ATTEMPTS = 5

export type PhoneOtpChannel = 'telegram_gateway' | 'whatsapp' | 'sms_stub'

export type StoredPhoneTokenRow = {
  id: string
  phone: string
  request_id: string
  channel: PhoneOtpChannel
  user_id: string | null
  attempt_count: number
  code_hash: string | null
}

async function pool() {
  return getSharedPgPool()
}

export function normalizeLoginPhone(phone: string): string | null {
  return normalizeToE164(phone)
}

export async function countRecentPhoneTokenRequests(phone: string): Promise<number> {
  const normalized = normalizeLoginPhone(phone)
  if (!normalized) return MAX_REQUESTS_PER_WINDOW
  const pg = await pool()
  const { rows } = await pg.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM phone_login_tokens
     WHERE phone = $1 AND created_at > NOW() - ${RATE_WINDOW}`,
    [normalized],
  )
  return parseInt(rows[0]?.count || '0', 10)
}

export async function assertPhoneUnderRateLimit(phone: string): Promise<boolean> {
  const count = await countRecentPhoneTokenRequests(phone)
  return count < MAX_REQUESTS_PER_WINDOW
}

export async function invalidateOpenPhoneTokens(phone: string): Promise<void> {
  const normalized = normalizeLoginPhone(phone)
  if (!normalized) return
  const pg = await pool()
  await pg.query(
    `DELETE FROM phone_login_tokens
     WHERE phone = $1 AND used_at IS NULL`,
    [normalized],
  )
}

export async function insertPhoneLoginToken(params: {
  phone: string
  requestId: string
  channel: PhoneOtpChannel
  userId?: string | null
  expiresIn?: string
  ipAddress?: string | null
  /** Self-issued OTP (WhatsApp) — hashed with hmacOTP(code, phone); never stored raw */
  rawCode?: string
}): Promise<{ id: string; requestId: string }> {
  const normalized = normalizeLoginPhone(params.phone)
  if (!normalized) throw new Error('Invalid phone for phone_login_tokens')

  if (params.channel === 'whatsapp' && !params.rawCode?.trim()) {
    throw new Error('WhatsApp phone_login_tokens require rawCode for hashing')
  }

  const codeHash =
    params.rawCode && params.rawCode.trim()
      ? hmacOTP(params.rawCode.trim(), normalized)
      : null

  await invalidateOpenPhoneTokens(normalized)

  const pg = await pool()
  const { rows } = await pg.query<{ id: string; request_id: string }>(
    `INSERT INTO phone_login_tokens (phone, request_id, channel, user_id, expires_at, ip_address, code_hash)
     VALUES ($1, $2, $3, $4, NOW() + $5::interval, $6::inet, $7)
     RETURNING id, request_id`,
    [
      normalized,
      params.requestId,
      params.channel,
      params.userId ?? null,
      params.expiresIn ?? '3 minutes',
      params.ipAddress || null,
      codeHash,
    ],
  )
  return { id: rows[0].id, requestId: rows[0].request_id }
}

const SELECT_OPEN = `SELECT id, phone, request_id, channel, user_id, attempt_count, code_hash
     FROM phone_login_tokens`

export async function getOpenPhoneChallenge(params: {
  phone: string
  challengeId: string
}): Promise<StoredPhoneTokenRow | null> {
  const normalized = normalizeLoginPhone(params.phone)
  if (!normalized) return null
  const challengeId = params.challengeId.trim()
  if (!challengeId) return null

  const pg = await pool()
  const { rows } = await pg.query<StoredPhoneTokenRow>(
    `${SELECT_OPEN}
     WHERE phone = $1
       AND used_at IS NULL
       AND expires_at > NOW()
       AND (request_id = $2 OR id::text = $2)
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalized, challengeId],
  )
  return rows[0] ?? null
}

/** Latest unused, unexpired challenge for a phone — used when rate-limited. */
export async function getLatestOpenPhoneChallenge(
  phone: string,
): Promise<StoredPhoneTokenRow | null> {
  const normalized = normalizeLoginPhone(phone)
  if (!normalized) return null
  const pg = await pool()
  const { rows } = await pg.query<StoredPhoneTokenRow>(
    `${SELECT_OPEN}
     WHERE phone = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalized],
  )
  return rows[0] ?? null
}

/** Lookup open challenge by request_id (profile WA verify). */
export async function getOpenPhoneChallengeByRequestId(
  requestId: string,
): Promise<StoredPhoneTokenRow | null> {
  const id = requestId.trim()
  if (!id) return null
  const pg = await pool()
  const { rows } = await pg.query<StoredPhoneTokenRow>(
    `${SELECT_OPEN}
     WHERE request_id = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [id],
  )
  return rows[0] ?? null
}

export async function bumpPhoneChallengeAttempt(id: string): Promise<number> {
  const pg = await pool()
  const { rows } = await pg.query<{ attempt_count: number }>(
    `UPDATE phone_login_tokens
     SET attempt_count = attempt_count + 1
     WHERE id = $1
     RETURNING attempt_count`,
    [id],
  )
  return rows[0]?.attempt_count ?? MAX_VERIFY_ATTEMPTS
}

export async function markPhoneChallengeUsed(id: string): Promise<void> {
  const pg = await pool()
  await pg.query(
    `UPDATE phone_login_tokens SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`,
    [id],
  )
}

export async function expirePhoneChallengeIfMaxAttempts(id: string): Promise<boolean> {
  const pg = await pool()
  const { rows } = await pg.query<{ attempt_count: number }>(
    `SELECT attempt_count FROM phone_login_tokens WHERE id = $1`,
    [id],
  )
  const attempts = rows[0]?.attempt_count ?? 0
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    await markPhoneChallengeUsed(id)
    return true
  }
  return false
}

export async function cleanupExpiredPhoneTokens(): Promise<number> {
  const pg = await pool()
  const { rowCount } = await pg.query(
    `DELETE FROM phone_login_tokens WHERE expires_at < NOW() - INTERVAL '24 hours'`,
  )
  return rowCount ?? 0
}

export { MAX_VERIFY_ATTEMPTS }

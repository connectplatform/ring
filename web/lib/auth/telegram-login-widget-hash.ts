/**
 * Telegram Login Widget hash verification (legacy iframe / redirect widget).
 *
 * Algorithm (https://core.telegram.org/widgets/login#checking-authorization):
 * 1. data_check_string = sorted key=value lines (all fields except hash), joined by \n
 * 2. secret_key = SHA256(bot_token) as raw 32 bytes
 * 3. computed = hex(HMAC-SHA256(data_check_string, secret_key))
 * 4. timing-safe compare to provided hash
 *
 * Do NOT reuse Mini App initData (WebAppData) HMAC math.
 *
 * Truth lens: telegram_login_widget_specialist
 */
import crypto from 'crypto'

export const TELEGRAM_WIDGET_MAX_AUTH_AGE_SECONDS = 86400 // 24 hours

export type TelegramWidgetAuthPayload = {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string
  hash: string
}

/**
 * Build the Telegram Login Widget data-check string from received fields.
 * Only includes fields that are actually present (non-null / non-undefined).
 */
export function buildTelegramWidgetDataCheckString(
  data: Omit<TelegramWidgetAuthPayload, 'hash'> & { hash?: string },
): string {
  const fields: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (key === 'hash') continue
    if (value !== undefined && value !== null && value !== '') {
      fields.push(`${key}=${value}`)
    }
  }
  fields.sort()
  return fields.join('\n')
}

/**
 * Verify Telegram Login Widget authorization hash against bot token.
 * Returns false on missing inputs, length mismatch, or hash mismatch.
 */
export function verifyTelegramLoginWidgetHash(
  data: TelegramWidgetAuthPayload,
  botToken: string,
): boolean {
  if (!botToken || !data.hash || !data.id) return false

  const dataCheckString = buildTelegramWidgetDataCheckString(data)
  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  try {
    const a = Buffer.from(computedHash, 'utf8')
    const b = Buffer.from(data.hash, 'utf8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Reject replayed widget payloads older than maxAgeSeconds. */
export function isTelegramWidgetAuthDateFresh(
  authDateUnixSeconds: string | number,
  maxAgeSeconds: number = TELEGRAM_WIDGET_MAX_AUTH_AGE_SECONDS,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const authDate =
    typeof authDateUnixSeconds === 'string'
      ? parseInt(authDateUnixSeconds, 10)
      : authDateUnixSeconds
  if (!Number.isFinite(authDate) || authDate <= 0) return false
  return nowUnixSeconds - authDate <= maxAgeSeconds
}

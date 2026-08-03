/**
 * Telegram Mini App WebApp initData verification (HMAC-SHA256).
 *
 * Algorithm (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * 1. secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
 * 2. data_check_string = sorted key=value lines (all fields except hash), joined by \n
 * 3. computed = hex(HMAC_SHA256(key=secret_key, message=data_check_string))
 * 4. timing-safe compare to provided hash
 *
 * Do NOT reuse Login Widget hash math (SHA256(bot_token) secret).
 *
 * Truth lenses: telegram_bot_api_specialist, telegram_login_widget_specialist
 */
import crypto from 'crypto'

export const TELEGRAM_MINIAPP_MAX_AUTH_AGE_SECONDS = 86400 // 24h

export type TelegramMiniAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export type ParsedTelegramInitData = {
  hash: string
  authDate: number
  user: TelegramMiniAppUser | null
  queryId?: string
  raw: Record<string, string>
}

/**
 * Bot token used for Mini App initData HMAC and Stars invoices.
 * Prefer TELEGRAM_MINI_APP_BOT_TOKEN when the Mini App bot differs from ADMIN_BOT.
 */
export function getTelegramMiniAppBotToken(): string {
  return (
    process.env.TELEGRAM_MINI_APP_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    process.env.ADMIN_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_LOGIN_BOT_TOKEN?.trim() ||
    process.env.N9LIFE_BOT_TOKEN?.trim() ||
    ''
  )
}

/** Parse initData query-string into a record (values stay URL-decoded). */
export function parseTelegramInitData(initData: string): ParsedTelegramInitData | null {
  const raw = String(initData || '').trim()
  if (!raw) return null

  const params = new URLSearchParams(raw)
  const record: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    record[key] = value
  }

  const hash = record.hash || ''
  if (!hash) return null

  let user: TelegramMiniAppUser | null = null
  if (record.user) {
    try {
      user = JSON.parse(record.user) as TelegramMiniAppUser
    } catch {
      return null
    }
  }

  const authDate = Number(record.auth_date || 0)
  return {
    hash,
    authDate,
    user,
    queryId: record.query_id,
    raw: record,
  }
}

export function buildTelegramMiniAppDataCheckString(
  data: Record<string, string>,
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

export function verifyTelegramMiniAppInitData(
  initData: string,
  botToken: string,
): ParsedTelegramInitData | null {
  if (!botToken) return null
  const parsed = parseTelegramInitData(initData)
  if (!parsed) return null

  const dataCheckString = buildTelegramMiniAppDataCheckString(parsed.raw)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  try {
    const a = Buffer.from(computedHash, 'utf8')
    const b = Buffer.from(parsed.hash, 'utf8')
    if (a.length !== b.length) return null
    if (!crypto.timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  return parsed
}

export function isTelegramMiniAppAuthDateFresh(
  authDateUnixSeconds: number,
  maxAgeSeconds: number = TELEGRAM_MINIAPP_MAX_AUTH_AGE_SECONDS,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!Number.isFinite(authDateUnixSeconds) || authDateUnixSeconds <= 0) {
    return false
  }
  return nowUnixSeconds - authDateUnixSeconds <= maxAgeSeconds
}

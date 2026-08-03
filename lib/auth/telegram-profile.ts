/**
 * Telegram identity helpers for profile UI + rewards.
 *
 * SSOT: a Telegram account is "linked" only when `communication.telegramId`
 * (numeric UID from verified Login Widget / OIDC / Mini App initData) is present.
 * Username alone must never count as linked (abuse / spoofing).
 *
 * Truth lenses: telegram_login_widget_specialist, authjs_specialist
 */

export type TelegramCommunication = {
  telegramId?: string | null
  telegramUsername?: string | null
  telegramLinkedAt?: string | null
}

export function normalizeTelegramUsername(
  username: string | null | undefined,
): string {
  const raw = String(username || '').trim()
  if (!raw) return ''
  return raw.replace(/^@+/, '')
}

/** Linked iff verified numeric Telegram user id is present. */
export function isTelegramLinked(
  communication: TelegramCommunication | null | undefined,
): boolean {
  const id = String(communication?.telegramId || '').trim()
  return /^\d{3,}$/.test(id)
}

export function getTelegramId(
  communication: TelegramCommunication | null | undefined,
): string | null {
  if (!isTelegramLinked(communication)) return null
  return String(communication!.telegramId).trim()
}

/**
 * Display label for profile UI.
 * Prefer @username when known; otherwise show UID (never pretend username-only is linked).
 */
export function formatTelegramProfileLabel(
  communication: TelegramCommunication | null | undefined,
): string | null {
  if (!isTelegramLinked(communication)) return null
  const username = normalizeTelegramUsername(communication?.telegramUsername)
  const id = getTelegramId(communication)!
  if (username) return `@${username}`
  return `ID ${id}`
}

/**
 * Bot username for Login Widget `data-telegram-login` (no @).
 * Must match the bot whose token verifies the widget hash.
 */
export function getTelegramLoginBotUsername(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_BOT_USERNAME?.trim() ||
    process.env.TELEGRAM_LOGIN_BOT_USERNAME?.trim() ||
    ''
  return fromEnv.replace(/^@+/, '')
}

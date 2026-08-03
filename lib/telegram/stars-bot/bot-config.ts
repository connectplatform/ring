/**
 * Telegram Stars (XTR) Mini App bot — webhook secret + Bot API helpers.
 *
 * Uses the same bot token as Mini App initData / createInvoiceLink
 * (`getTelegramMiniAppBotToken`). Webhook secret is separate from Admin Bot.
 *
 * Truth lens: telegram_stars_payments_monetization_specialist
 */
import 'server-only'

import { getTelegramMiniAppBotToken } from '@/lib/auth/telegram-miniapp-initdata'

const API_URL = 'https://api.telegram.org'

export function getStarsBotToken(): string | null {
  return getTelegramMiniAppBotToken()
}

export function getStarsWebhookSecret(): string | null {
  const secret =
    process.env.TELEGRAM_STARS_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_MINI_APP_WEBHOOK_SECRET?.trim() ||
    ''
  return secret || null
}

export function validateStarsWebhookSecret(headerSecret: string | null): boolean {
  if (!headerSecret) return false
  const expected = getStarsWebhookSecret()
  if (!expected) {
    console.error(
      '[stars-bot] TELEGRAM_STARS_WEBHOOK_SECRET (or TELEGRAM_MINI_APP_WEBHOOK_SECRET) not configured',
    )
    return false
  }
  return headerSecret === expected
}

export function isStarsBotConfigured(): boolean {
  return !!(getStarsBotToken() && getStarsWebhookSecret())
}

type TelegramApiResponse = {
  ok?: boolean
  description?: string
  result?: unknown
}

async function starsApi(
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResponse> {
  const token = getStarsBotToken()
  if (!token) {
    return { ok: false, description: 'Stars bot token missing' }
  }
  const res = await fetch(`${API_URL}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json().catch(() => ({ ok: false }))) as TelegramApiResponse
}

/**
 * Must answer within ~10s of pre_checkout_query (Telegram Bot API).
 */
export async function answerPreCheckoutQuery(
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string,
): Promise<TelegramApiResponse> {
  return starsApi('answerPreCheckoutQuery', {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
    ...(ok ? {} : { error_message: errorMessage || 'Payment unavailable' }),
  })
}

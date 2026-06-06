/**
 * ADMIN TELEGRAM BOT - Configuration
 * Ring Platform Admin Bot Configuration and Webhook Management
 * 
 * Truth Lens:
 * - @legiox/telegram_bot_api_specialist.json
 * - @legiox/secrets-keeper.json
 * 
 * Security:
 * - Webhook secret token validation (PALADIN Layer 1)
 * - Environment variable protection
 * - Rate limiting aware
 */

export const BOT_CONFIG = {
  token: process.env.ADMIN_BOT_TOKEN!,
  webhookSecret: process.env.ADMIN_BOT_WEBHOOK_SECRET!,
  apiUrl: 'https://api.telegram.org',
  rateLimits: {
    globalPerSecond: 30,
    perChatPerSecond: 1,
  },
} as const

interface TelegramWebhookParams {
  url: string
  secret_token: string
  max_connections?: number
  allowed_updates?: string[]
  drop_pending_updates?: boolean
}

interface TelegramResponse<T = any> {
  ok: boolean
  result?: T
  description?: string
  error_code?: number
}

/**
 * Set webhook for Admin Bot
 * @param webhookUrl - Full HTTPS webhook URL (must be HTTPS in production)
 * @param options - Webhook configuration options
 */
export async function setWebhook(
  webhookUrl: string,
  options: Partial<TelegramWebhookParams> = {}
): Promise<TelegramResponse> {
  const params: TelegramWebhookParams = {
    url: webhookUrl,
    secret_token: BOT_CONFIG.webhookSecret,
    max_connections: options.max_connections || 40,
    allowed_updates: options.allowed_updates || ['message'],
    drop_pending_updates: options.drop_pending_updates || false,
  }

  const response = await fetch(
    `${BOT_CONFIG.apiUrl}/bot${BOT_CONFIG.token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  )

  return response.json()
}

/**
 * Get current webhook info
 */
export async function getWebhookInfo(): Promise<TelegramResponse> {
  const response = await fetch(
    `${BOT_CONFIG.apiUrl}/bot${BOT_CONFIG.token}/getWebhookInfo`,
    { method: 'GET' }
  )

  return response.json()
}

/**
 * Delete webhook (switch to long polling mode)
 */
export async function deleteWebhook(): Promise<TelegramResponse> {
  const response = await fetch(
    `${BOT_CONFIG.apiUrl}/bot${BOT_CONFIG.token}/deleteWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
    }
  )

  return response.json()
}

/**
 * Send message to Telegram user
 * @param chatId - Telegram Chat ID
 * @param text - Message text
 * @param options - Additional options (parse_mode, reply_markup, etc.)
 */
export async function sendMessage(
  chatId: string,
  text: string,
  options: {
    parse_mode?: 'HTML' | 'MarkdownV2'
    reply_markup?: any
    disable_web_page_preview?: boolean
  } = {}
): Promise<TelegramResponse> {
  const params = {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_web_page_preview ?? true,
    reply_markup: options.reply_markup,
  }

  const response = await fetch(
    `${BOT_CONFIG.apiUrl}/bot${BOT_CONFIG.token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  )

  return response.json()
}

/**
 * Validate webhook secret token from request headers
 * CRITICAL: First line of defense (PALADIN Layer 1)
 */
export function validateWebhookSecret(headerSecret: string | null): boolean {
  if (!headerSecret) return false
  if (!BOT_CONFIG.webhookSecret) {
    console.error('[ADMIN BOT] ADMIN_BOT_WEBHOOK_SECRET not configured!')
    return false
  }
  return headerSecret === BOT_CONFIG.webhookSecret
}

/**
 * Check if bot token is configured
 */
export function isBotConfigured(): boolean {
  return !!(BOT_CONFIG.token && BOT_CONFIG.webhookSecret)
}

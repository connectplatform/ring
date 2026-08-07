interface TelegramMessage {
  entityId: string
  entityName: string
  name: string
  email: string
  message: string
  userId?: string
}

function resolveTelegramNotifyConfig(): { token: string; chatId: string } | null {
  const token =
    process.env.TELEGRAM_NOTIFY_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    process.env.ADMIN_BOT_TOKEN?.trim() ||
    ''
  const chatId =
    process.env.TELEGRAM_NOTIFY_CHAT_ID?.trim() ||
    process.env.TELEGRAM_CHAT_ID?.trim() ||
    process.env.CONTACT_TELEGRAM_CHAT_ID?.trim() ||
    ''

  if (!token || !chatId || token.startsWith('YOUR_') || chatId.startsWith('YOUR_')) {
    return null
  }
  return { token, chatId }
}

/**
 * Best-effort Telegram notify for contact-form submissions.
 * Skips silently when bot/chat env is not configured (CRM is the SSOT path).
 */
export async function sendToTelegramBot(data: TelegramMessage): Promise<void> {
  const config = resolveTelegramNotifyConfig()
  if (!config) {
    console.warn('[telegram] contact notify skipped — TELEGRAM_* / ADMIN_BOT_TOKEN + chat id not configured')
    return
  }

  const message = `
New contact form submission:
Entity: ${data.entityName} (ID: ${data.entityId})
Name: ${data.name}
Email: ${data.email}
Message: ${data.message}
  `

  const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to send message to Telegram (${response.status}): ${body.slice(0, 200)}`)
  }
}

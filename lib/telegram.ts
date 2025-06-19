const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN'
const TELEGRAM_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID'

interface TelegramMessage {
  entityId: string
  entityName: string
  name: string
  email: string
  message: string
}

export async function sendToTelegramBot(data: TelegramMessage): Promise<void> {
  const message = `
New contact form submission:
Entity: ${data.entityName} (ID: ${data.entityId})
Name: ${data.name}
Email: ${data.email}
Message: ${data.message}
  `

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to send message to Telegram')
  }
}
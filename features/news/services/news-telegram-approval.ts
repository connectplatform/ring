import { sendMessage } from '@/lib/telegram/admin-bot/bot-config'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { UserRole } from '@/features/auth/types'
import { absoluteSiteUrl } from '@/lib/site-branding'
import { mapNewsDocument } from '@/lib/news/map-news-document'

export async function getAdminTelegramChatIds(): Promise<string[]> {
  await initializeDatabase()
  const db = getDatabaseService()
  const result = await db.query({
    collection: 'users',
    filters: [
      { field: 'role', operator: 'in', value: [UserRole.ADMIN, UserRole.SUPERADMIN] },
    ],
    pagination: { limit: 100 },
  })
  if (!result.success) return []

  const ids: string[] = []
  for (const row of result.data) {
    const d = (row.data ?? row) as Record<string, unknown>
    const comm = d.communication as Record<string, unknown> | undefined
    const tid = comm?.telegramId ?? d.telegramId
    if (tid) ids.push(String(tid))
  }
  return [...new Set(ids)]
}

export function buildNewsApprovalInlineKeyboard(articleId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `news_approve:${articleId}` },
        { text: '❌ Reject', callback_data: `news_reject:${articleId}` },
      ],
      [
        { text: '👁 View', url: absoluteSiteUrl(`/admin/news/edit/${articleId}`) },
        { text: '💰 Counter', callback_data: `news_counter:${articleId}` },
      ],
    ],
  }
}

export async function notifyAdminsNewsAwaitingApproval(articleId: string): Promise<void> {
  await initializeDatabase()
  const db = getDatabaseService()
  const found = await db.findById('news', articleId)
  if (!found.success || !found.data) return

  const article = mapNewsDocument(found.data as { id: string; data?: Record<string, unknown> })
  const chatIds = await getAdminTelegramChatIds()
  const price = article.aiScore?.suggestedPriceUah ?? article.payment?.amount ?? '?'
  const text = [
    '<b>News ready for main-page approval</b>',
    '',
    `<b>${article.title}</b>`,
    `Author: ${article.authorName}`,
    `Merit: ${article.aiScore?.merit?.toFixed(2) ?? 'n/a'}`,
    `Price: ${price} UAH`,
    `Status: ${article.mainPageStatus}`,
  ].join('\n')

  const replyMarkup = buildNewsApprovalInlineKeyboard(articleId)

  for (const chatId of chatIds) {
    try {
      await sendMessage(chatId, text, { reply_markup: replyMarkup })
    } catch (e) {
      console.error('[news-telegram] notify failed', chatId, e)
    }
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const token = process.env.ADMIN_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: !!text }),
  })
}

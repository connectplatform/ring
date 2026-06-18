import { sendMessage } from '@/lib/telegram/admin-bot/bot-config'
import { db } from '@/lib/database'
import { UserRole } from '@/features/auth/types'
import { absoluteSiteUrl } from '@/lib/site-branding'
import { mapNewsDocument } from '@/lib/news/map-news-document'

export async function getAdminTelegramChatIds(): Promise<string[]> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'users',
    filters: [
      { field: 'role', operator: 'in', value: [UserRole.admin, UserRole.superadmin] },
    ],
    pagination: { limit: 100 },
  })
  if (!result.success || !result.data) return []

  const ids: string[] = []
  for (const row of result.data) {
    const comm = row.communication as Record<string, unknown> | undefined
    const tid = comm?.telegramId ?? row.telegramId
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
  const found = await db().findDocById<Record<string, unknown>>('news', articleId)
  if (!found.success || !found.data) return

  const article = mapNewsDocument(found.data)
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

export async function sendArticleDraftApprovalToChat(
  chatId: string,
  articleId: string,
  summary: { title: string; locale: string; featuredImage?: string; audioUrl?: string }
): Promise<void> {
  const lines = [
    '<b>AI news draft ready for approval</b>',
    '',
    `<b>${summary.title}</b>`,
    `Locale: ${summary.locale}`,
    summary.featuredImage ? 'Featured image: generated' : 'Featured image: none',
    summary.audioUrl ? 'Audio narration: ready' : 'Audio narration: skipped',
    '',
    `ID: <code>${articleId}</code>`,
  ]
  await sendMessage(chatId, lines.join('\n'), {
    reply_markup: buildNewsApprovalInlineKeyboard(articleId),
  })
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

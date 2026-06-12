import {
  approveMainPagePublication,
  rejectMainPagePublication,
  appendStatusHistory,
  writeSubmissionAudit,
} from '@/features/news/services/news-promotion-workflow'
import {
  answerCallbackQuery,
} from '@/features/news/services/news-telegram-approval'
import { getUserIdFromTelegramId } from '@/lib/telegram/admin-bot/whitelist'
import { sendMessage } from '@/lib/telegram/admin-bot/bot-config'
import { db } from '@/lib/database'

export async function handleNewsCallback(
  chatId: string,
  data: string,
  callbackQueryId: string
): Promise<void> {
  const [action, articleId] = data.split(':')
  if (!articleId) {
    await answerCallbackQuery(callbackQueryId, 'Invalid callback')
    return
  }

  const userId = await getUserIdFromTelegramId(chatId)

  if (action === 'news_approve') {
    await approveMainPagePublication(articleId, userId ?? chatId)
    await answerCallbackQuery(callbackQueryId, 'Approved for main page')
    await sendMessage(chatId, `✅ Article <code>${articleId}</code> published on main news.`)
    return
  }

  if (action === 'news_reject') {
    await rejectMainPagePublication(articleId, userId ?? chatId, 'telegram_reject')
    await answerCallbackQuery(callbackQueryId, 'Rejected')
    await sendMessage(chatId, `❌ Article <code>${articleId}</code> rejected for main page.`)
    return
  }

  if (action === 'news_counter') {
    const found = await db().findDocById<Record<string, unknown>>('news', articleId)
    if (!found.success || !found.data) {
      await answerCallbackQuery(callbackQueryId, 'Article not found')
      return
    }
    const doc = found.data
    const current = (doc.aiScore as { suggestedPriceUah?: number })?.suggestedPriceUah ?? 500
    const counter = Math.round(current * 1.25)
    await db().updateDoc('news', articleId, {
      mainPageStatus: 'payment_pending',
      payment: {
        ...(doc.payment as object),
        counterOfferAmount: counter,
        amount: counter,
      },
    })
    await appendStatusHistory(articleId, 'payment_pending', userId ?? chatId, `counter ${counter}`)
    await writeSubmissionAudit({
      newsId: articleId,
      action: 'counter_offer',
      actorId: userId ?? undefined,
      payload: { counter },
    })
    await answerCallbackQuery(callbackQueryId, `Counter-offer: ${counter} UAH`)
    await sendMessage(
      chatId,
      `💰 Counter-offer set to <b>${counter} UAH</b> for article <code>${articleId}</code>. Member must pay updated amount.`
    )
    return
  }

  await answerCallbackQuery(callbackQueryId, 'Unknown action')
}

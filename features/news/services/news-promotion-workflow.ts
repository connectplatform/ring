import { db } from '@/lib/database'
import type { MainPageStatus, NewsAiScore } from '@/features/news/types'
import { scoreNewsForMainPage } from '@/features/news/services/news-scoring-service'
import { translitSlug } from '@/lib/news/translit-slug'
import { logger } from '@/lib/logger'

export async function appendStatusHistory(
  articleId: string,
  status: MainPageStatus,
  by?: string,
  note?: string
): Promise<void> {
  const found = await db().findDocById<Record<string, unknown>>('news', articleId)
  if (!found.success || !found.data) return

  const data = found.data
  const history = Array.isArray(data.mainPageStatusHistory)
    ? [...(data.mainPageStatusHistory as object[])]
    : []
  history.push({ status, at: new Date().toISOString(), by, note })

  await db().updateDoc('news', articleId, {
    mainPageStatus: status,
    mainPageStatusHistory: history,
  })
}

export async function writeSubmissionAudit(entry: {
  newsId: string
  action: string
  fromStatus?: string
  toStatus?: string
  actorId?: string
  telegramChatId?: string
  payload?: Record<string, unknown>
}): Promise<void> {
  const id = `audit-${entry.newsId}-${Date.now()}`
  await db().createDoc(
    'news_submission_audit',
    { ...entry, createdAt: new Date().toISOString() },
    { id }
  )
}

export async function runAiScoringForArticle(articleId: string): Promise<{
  status: MainPageStatus
  aiScore: NewsAiScore
}> {
  const found = await db().findDocById<Record<string, unknown>>('news', articleId)
  if (!found.success || !found.data) throw new Error('Article not found')

  const data = found.data
  const siteWideSlug =
    (data.siteWideSlug as string) ||
    translitSlug(String(data.slug ?? data.title ?? 'post'))

  const aiScore = await scoreNewsForMainPage({
    title: String(data.title ?? ''),
    excerpt: String(data.excerpt ?? ''),
    content: String(data.content ?? ''),
    slug: String(data.slug ?? ''),
    siteWideSlug,
    articleId,
  })

  let next: MainPageStatus = 'ai_scored'
  if (aiScore.hardBlock) {
    next = 'published_blog_only'
  } else if ((aiScore.merit ?? 0) < Number(process.env.NEWS_MERIT_SOFT_REJECT ?? 0.25)) {
    next = 'payment_pending'
  } else {
    next = 'payment_pending'
  }

  await db().updateDoc('news', articleId, {
    aiScore,
    siteWideSlug,
    siteWideCategory: data.siteWideCategory ?? 'blogs',
    mainPageStatus: next,
  })
  await appendStatusHistory(articleId, 'ai_scored', 'system', 'OpenRouter/heuristic score')
  if (next === 'payment_pending') {
    await appendStatusHistory(articleId, 'payment_pending', 'system')
  }
  if (next === 'published_blog_only') {
    await appendStatusHistory(articleId, 'published_blog_only', 'system', aiScore.blockReason)
  }

  await writeSubmissionAudit({
    newsId: articleId,
    action: 'ai_scored',
    toStatus: next,
    payload: { aiScore },
  })

  return { status: next, aiScore }
}

export async function markPaymentReceived(
  articleId: string,
  payment: Record<string, unknown>
): Promise<void> {
  const found = await db().findDocById<Record<string, unknown>>('news', articleId)
  if (!found.success || !found.data) return
  const data = found.data

  await db().updateDoc('news', articleId, {
    payment: { ...(data.payment as object), ...payment, paidAt: new Date().toISOString() },
    mainPageStatus: 'awaiting_admin_approval',
  })
  await appendStatusHistory(articleId, 'awaiting_admin_approval', 'payment', 'paid')
  await writeSubmissionAudit({
    newsId: articleId,
    action: 'payment_received',
    toStatus: 'awaiting_admin_approval',
    payload: payment,
  })
}

export async function approveMainPagePublication(
  articleId: string,
  actorId?: string
): Promise<void> {
  const found = await db().findDocById<Record<string, unknown>>('news', articleId)
  if (!found.success || !found.data) return
  const data = found.data

  await db().updateDoc('news', articleId, {
    mainPageStatus: 'published_main',
    status: 'published',
    visibility: 'site-wide',
    featured: Boolean(data.featured ?? false),
  })
  await appendStatusHistory(articleId, 'published_main', actorId, 'approved')
  await writeSubmissionAudit({
    newsId: articleId,
    action: 'approved',
    toStatus: 'published_main',
    actorId,
  })

  void import('@/features/news/services/article-translation')
    .then(({ generateArticleTranslations }) => generateArticleTranslations(articleId, actorId))
    .catch((error) => {
      logger.error('[news-promotion] translation fan-out failed:', error)
    })
}

export async function rejectMainPagePublication(
  articleId: string,
  actorId?: string,
  note?: string
): Promise<void> {
  const found = await db().findDocById<Record<string, unknown>>('news', articleId)
  if (!found.success || !found.data) return
  await db().updateDoc('news', articleId, {
    mainPageStatus: 'rejected',
    promoteToMainPage: false,
  })
  await appendStatusHistory(articleId, 'rejected', actorId, note)
  await writeSubmissionAudit({
    newsId: articleId,
    action: 'rejected',
    toStatus: 'rejected',
    actorId,
    payload: { note },
  })
}

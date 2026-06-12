import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { runAiScoringForArticle, appendStatusHistory } from '@/features/news/services/news-promotion-workflow'
import {
  createPromotionPayment,
  buildPaymentRecord,
} from '@/features/news/services/news-payment-service'
import { getPaymentProvider } from '@/lib/payments/payment.config'
import { notifyAdminsNewsAwaitingApproval } from '@/features/news/services/news-telegram-approval'

export async function POST(request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const articleId = String(body.articleId ?? '')
  if (!articleId) {
    return NextResponse.json({ error: 'articleId required' }, { status: 400 })
  }

  const found = await db().findDocById<Record<string, unknown>>('news', articleId)
  if (!found.success || !found.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const data = found.data
  if (String(data.authorId) !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db().updateDoc('news', articleId, {
    promoteToMainPage: true,
    mainPageStatus: 'submitted',
    contentType: 'blog',
  })
  await appendStatusHistory(articleId, 'submitted', session.user.id)

  const { status, aiScore } = await runAiScoringForArticle(articleId)

  if (status === 'published_blog_only') {
    return NextResponse.json({
      success: true,
      status,
      aiScore,
      message: 'Content blocked for main page; blog-only.',
    })
  }

  const amount =
    ((aiScore as { counterOfferAmount?: number }).counterOfferAmount) ??
    aiScore.suggestedPriceUah ??
    Number(process.env.NEWS_PROMO_BASE_UAH ?? 50)

  const locale = String(data.locale ?? 'en')
  const { getSiteBaseUrl } = await import('@/lib/ring-config')
  const returnUrl = `${getSiteBaseUrl()}/${locale}/my-news?article=${articleId}`

  const pay = await createPromotionPayment({
    articleId,
    userId: session.user.id,
    userEmail: session.user.email ?? 'user@local',
    amountUah: amount,
    returnUrl,
  })

  if (!pay.success || !pay.paymentUrl) {
    return NextResponse.json({ error: pay.error ?? 'Payment init failed' }, { status: 500 })
  }

  const provider = getPaymentProvider('news_promotion') as 'wayforpay' | 'stripe'
  await db().updateDoc('news', articleId, {
    aiScore,
    mainPageStatus: 'payment_pending',
    payment: buildPaymentRecord(provider, pay.orderReference!, amount),
  })

  return NextResponse.json({
    success: true,
    status: 'payment_pending',
    aiScore,
    paymentUrl: pay.paymentUrl,
    orderReference: pay.orderReference,
  })
}

/** Mark paid (dev/test) or called from webhook */
export async function PATCH(request: NextRequest) {
  await connection()
  const body = await request.json()
  const articleId = String(body.articleId ?? '')
  const secret = request.headers.get('x-news-promotion-secret')
  if (secret !== process.env.NEWS_PROMOTION_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { markPaymentReceived } = await import('@/features/news/services/news-promotion-workflow')
  await markPaymentReceived(articleId, body.payment ?? {})
  await notifyAdminsNewsAwaitingApproval(articleId)
  return NextResponse.json({ success: true })
}

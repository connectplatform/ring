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

// TODO: Move environment variable handling to Next.js 16 server config where possible (use 'process.env' only in server actions/middleware).
// TODO: Type incoming request bodies for stricter validation using e.g. Zod or Next.js Server Actions props if possible.
// TODO: Consider switching database access to Server Actions (Next.js 16+) for improved type-safety and loading state.

export async function POST(request: NextRequest) {
  // Establish connection to the database (assumed async initialization)
  await connection()

  // Authenticate user session
  const session = await auth()
  if (!session?.user?.id) {
    // If user is not logged in, return 401 Unauthorized
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse incoming JSON request body to extract articleId
  const body = await request.json()
  const articleId = String(body.articleId ?? '')
  if (!articleId) {
    // If articleId is missing, return 400 Bad Request
    return NextResponse.json({ error: 'articleId required' }, { status: 400 })
  }

  // Retrieve article data from database by articleId
  const found = await db().findDocById<Record<string, unknown>>('news', articleId)
  if (!found.success || !found.data) {
    // Return 404 if article not found
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const data = found.data
  // Check if the user is the author of the article
  if (String(data.authorId) !== session.user.id) {
    // If not author, return 403 Forbidden
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Update article to mark it as promotion-submitted
  await db().updateDoc('news', articleId, {
    promoteToMainPage: true,
    mainPageStatus: 'submitted',
    contentType: 'blog',
  })

  // Add history entry about submission
  await appendStatusHistory(articleId, 'submitted', session.user.id)

  // Run AI scoring to get status and suggested price
  const { status, aiScore } = await runAiScoringForArticle(articleId)

  // If AI status blocks content from main page, inform client and exit early
  if (status === 'published_blog_only') {
    return NextResponse.json({
      success: true,
      status,
      aiScore,
      message: 'Content blocked for main page; blog-only.',
    })
  }

  // Calculate promotion price: counter-offer, suggested, or fallback to default
  const amount =
    ((aiScore as { counterOfferAmount?: number }).counterOfferAmount) ??
    aiScore.suggestedPriceUah ??
    Number(process.env.NEWS_PROMO_BASE_UAH ?? 50)

  // Get locale to build return URL for payment redirect
  const locale = String(data.locale ?? 'en')
  // Dynamically import function to get base URL (to avoid circular deps or heavy import)
  const getSiteBaseUrl = (await import('@/lib/ring-config-core')).getSiteBaseUrl
  const returnUrl = `${getSiteBaseUrl()}/${locale}/my-news?article=${articleId}`

  // Initiate third-party payment for promotion
  const pay = await createPromotionPayment({
    articleId,
    userId: session.user.id,
    userEmail: session.user.email ?? 'user@local',
    amountUah: amount,
    returnUrl,
  })

  if (!pay.success || !(pay.redirect || pay.paymentUrl || pay.paymentFields)) {
    // Failed payment setup: send 500/server error
    return NextResponse.json({ error: pay.error ?? 'Payment init failed' }, { status: 500 })
  }

  // Get active payment provider (e.g., WayForPay or Stripe)
  const provider = getPaymentProvider('news_promotion') as 'wayforpay' | 'stripe'
  // Update article with payment info and status
  await db().updateDoc('news', articleId, {
    aiScore,
    mainPageStatus: 'payment_pending',
    payment: buildPaymentRecord(provider, pay.orderReference!, amount),
  })

  // Success: return payment link to the client
  return NextResponse.json({
    success: true,
    status: 'payment_pending',
    aiScore,
    redirect: pay.redirect,
    paymentUrl: pay.paymentUrl,
    paymentFields: pay.paymentFields,
    orderReference: pay.orderReference,
  })
}

/** Mark paid (dev/test) or called from webhook */
export async function PATCH(request: NextRequest) {
  // Ensure DB connection (could be refactored to shared middleware, see Next.js 16/Edge)
  await connection()
  // Parse and validate incoming JSON
  const body = await request.json()
  const articleId = String(body.articleId ?? '')

  // Validate webhook or dev mode secret for security
  const secret = request.headers.get('x-news-promotion-secret')
  if (secret !== process.env.NEWS_PROMOTION_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Import function to mark payment as received
  // TODO: Convert to static import if not dynamically changed/needed for true cold boot perf
  const { markPaymentReceived } = await import('@/features/news/services/news-promotion-workflow')
  // Mark the promotion as paid, provide payment details if any
  await markPaymentReceived(articleId, body.payment ?? {})
  // Notify admins via Telegram or preferred supports channel
  await notifyAdminsNewsAwaitingApproval(articleId)
  // Respond with generic success
  return NextResponse.json({ success: true })
}

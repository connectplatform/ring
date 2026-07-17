import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { db } from '@/lib/database'
import { getProductReviews } from '@/features/store/services/product-reviews'

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  content: z.string().min(3).max(4000),
})

type ReviewRow = Record<string, unknown> & { id: string }
type OrderRow = Record<string, unknown> & { id: string }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  const { id: productId } = await params
  const data = await getProductReviews(productId)
  return NextResponse.json({
    reviews: data.reviews,
    totalReviews: data.totalReviews,
    averageRating: data.averageRating,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()
  const { id: productId } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid review', details: parsed.error.flatten() }, { status: 400 })
  }

  // One review per user per product
  const existing = await db().queryDocs<ReviewRow>({
    collection: 'reviews',
    filters: [
      { field: 'productId', operator: '=', value: productId },
      { field: 'authorId', operator: '=', value: session.user.id },
    ],
    pagination: { limit: 1 },
  })
  if (existing.success && existing.data?.length) {
    return NextResponse.json({ error: 'You already reviewed this product' }, { status: 409 })
  }

  // Verified purchase: buyer has a paid order containing this product
  let verifiedPurchase = false
  const orders = await db().queryDocs<OrderRow>({
    collection: 'orders',
    filters: [{ field: 'userId', operator: '=', value: session.user.id }],
    pagination: { limit: 100 },
  })
  if (orders.success && orders.data) {
    verifiedPurchase = orders.data.some((row) => {
      const payment = row.payment as Record<string, unknown> | undefined
      const paid = row.status === 'paid' || payment?.status === 'paid'
      const items = (row.items as Array<Record<string, unknown>>) || []
      const hasProduct = items.some(
        (item) => ((item.product as { id?: string } | undefined)?.id ?? item.productId) === productId
      )
      return paid && hasProduct
    })
  }

  const reviewId = `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const created = await db().createDoc(
    'reviews',
    {
      productId,
      authorId: session.user.id,
      authorName: session.user.name || 'Anonymous',
      rating: parsed.data.rating,
      title: parsed.data.title,
      content: parsed.data.content,
      verifiedPurchase,
      helpful: 0,
      createdAt: new Date().toISOString(),
    },
    { id: reviewId }
  )

  if (!created.success) {
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
  }

  void import('@/lib/wallet/reward-credit-service')
    .then(({ enqueueRewardCreditAddEvent }) =>
      enqueueRewardCreditAddEvent({
        userId: session.user.id,
        trigger: 'reviewCreated',
        username: (session.user as { username?: string | null }).username ?? null,
        userRole: session.user.role,
        objectType: 'review',
        objectId: reviewId,
      }),
    )
    .catch(() => undefined)

  return NextResponse.json({ success: true, reviewId, verifiedPurchase })
}

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { db } from '@/lib/database'

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

  const result = await db().queryDocs<ReviewRow>({
    collection: 'reviews',
    filters: [{ field: 'productId', operator: '=', value: productId }],
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    pagination: { limit: 100 },
  })

  const rows = result.success && result.data ? result.data : []
  const reviews = rows.map((row) => ({
    id: row.id,
    author: (row.authorName as string) || 'Anonymous',
    rating: Number(row.rating) || 0,
    title: row.title,
    content: (row.content as string) || '',
    verifiedPurchase: Boolean(row.verifiedPurchase),
    helpful: Number(row.helpful) || 0,
    date: row.createdAt ? String(row.createdAt).slice(0, 10) : '',
    images: row.images || [],
    sellerResponse: row.sellerResponse,
  }))

  const averageRating = reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 0

  return NextResponse.json({ reviews, totalReviews: reviews.length, averageRating })
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

  return NextResponse.json({ success: true, reviewId, verifiedPurchase })
}

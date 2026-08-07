/**
 * Shared product reviews loader — used by API route and PDP server page.
 */

import 'server-only'

import { db, initializeDatabase } from '@/lib/database'

export type ProductReviewView = {
  id: string
  author: string
  rating: number
  title?: string
  content: string
  verifiedPurchase: boolean
  helpful: number
  date: string
  images?: unknown
  sellerResponse?: unknown
}

export type ProductReviewsResult = {
  reviews: ProductReviewView[]
  totalReviews: number
  averageRating: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

type ReviewRow = Record<string, unknown> & { id: string }

function emptyResult(): ProductReviewsResult {
  return {
    reviews: [],
    totalReviews: 0,
    averageRating: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  }
}

export async function getProductReviews(productId: string): Promise<ProductReviewsResult> {
  if (!productId) return emptyResult()

  await initializeDatabase()
  const result = await db().queryDocs<ReviewRow>({
    collection: 'reviews',
    filters: [{ field: 'productId', operator: '=', value: productId }],
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    pagination: { limit: 100 },
  })

  const rows = result.success && result.data ? result.data : []
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  const reviews: ProductReviewView[] = rows.map((row) => {
    const rating = Number(row.rating) || 0
    if (rating >= 1 && rating <= 5) {
      distribution[rating as 1 | 2 | 3 | 4 | 5] += 1
    }
    return {
      id: row.id,
      author: (row.authorName as string) || 'Anonymous',
      rating,
      title: typeof row.title === 'string' ? row.title : undefined,
      content: (row.content as string) || '',
      verifiedPurchase: Boolean(row.verifiedPurchase),
      helpful: Number(row.helpful) || 0,
      date: row.createdAt ? String(row.createdAt).slice(0, 10) : '',
      images: row.images || [],
      sellerResponse: row.sellerResponse,
    }
  })

  const averageRating = reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 0

  return {
    reviews,
    totalReviews: reviews.length,
    averageRating,
    distribution,
  }
}

import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'

type NewsRow = Record<string, unknown> & { id: string }
type LikeRow = Record<string, unknown> & { id: string }

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: newsId } = params
    const userId = session.user.id

    if (!newsId) {
      return NextResponse.json(
        { error: 'Invalid news ID' },
        { status: 400 }
      )
    }

    const newsResult = await db().readDoc<NewsRow>('news', newsId)

    if (!newsResult.success || !newsResult.data) {
      return NextResponse.json(
        { error: 'News article not found' },
        { status: 404 }
      )
    }

    const newsData = newsResult.data

    const likeQueryResult = await db().queryDocs<LikeRow>({
      collection: 'news_likes',
      filters: [
        { field: 'news_id', operator: '==', value: newsId },
        { field: 'user_id', operator: '==', value: userId }
      ],
      pagination: { limit: 1 }
    })

    const existingLike = likeQueryResult.success && likeQueryResult.data.length > 0
    const currentLikes = (newsData.likes as number) || 0

    let newLikeCount: number
    let isNowLiked: boolean

    if (existingLike) {
      const likeId = likeQueryResult.data[0].id
      await db().deleteDoc('news_likes', likeId)

      const updatedNewsData = {
        ...newsData,
        likes: Math.max(0, currentLikes - 1),
        updated_at: new Date()
      }

      await db().updateDoc('news', newsId, updatedNewsData)

      newLikeCount = Math.max(0, currentLikes - 1)
      isNowLiked = false
    } else {
      await db().createDoc('news_likes', {
        news_id: newsId,
        user_id: userId,
        created_at: new Date()
      })

      const updatedNewsData = {
        ...newsData,
        likes: currentLikes + 1,
        updated_at: new Date()
      }

      await db().updateDoc('news', newsId, updatedNewsData)

      newLikeCount = currentLikes + 1
      isNowLiked = true
    }

    return NextResponse.json({
      success: true,
      liked: isNowLiked,
      likeCount: newLikeCount,
      message: isNowLiked ? 'Article liked' : 'Article unliked'
    })

  } catch (error) {
    console.error('Error toggling news like:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    const { id: newsId } = params

    if (!newsId) {
      return NextResponse.json(
        { error: 'Invalid news ID' },
        { status: 400 }
      )
    }

    const newsResult = await db().readDoc<NewsRow>('news', newsId)

    if (!newsResult.success || !newsResult.data) {
      return NextResponse.json(
        { error: 'News article not found' },
        { status: 404 }
      )
    }

    const newsData = newsResult.data
    let isLiked = false

    if (session?.user?.id) {
      const likeQueryResult = await db().queryDocs<LikeRow>({
        collection: 'news_likes',
        filters: [
          { field: 'news_id', operator: '==', value: newsId },
          { field: 'user_id', operator: '==', value: session.user.id }
        ],
        pagination: { limit: 1 }
      })

      isLiked = likeQueryResult.success && likeQueryResult.data.length > 0
    }

    return NextResponse.json({
      likeCount: (newsData.likes as number) || 0,
      isLiked,
      success: true
    })

  } catch (error) {
    console.error('Error fetching news likes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getNewsCollection } from '@/lib/firestore-collections'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const newsCollection = getNewsCollection()
    const db = getFirestore()
    
    // Check if news article exists
    const newsDoc = await newsCollection.doc(newsId).get()

    if (!newsDoc.exists) {
      return NextResponse.json(
        { error: 'News article not found' },
        { status: 404 }
      )
    }

    const newsData = newsDoc.data()
    
    // Check if user already liked this article
    const likesCollection = db.collection('news_likes')
    const existingLike = await likesCollection
      .where('newsId', '==', newsId)
      .where('userId', '==', userId)
      .get()

    let newLikeCount: number
    let isNowLiked: boolean
    const currentLikes = newsData?.likes || 0

    if (!existingLike.empty) {
      // Remove like
      const likeDoc = existingLike.docs[0]
      await likeDoc.ref.delete()

      // Decrement like count
      await newsCollection.doc(newsId).update({
        likes: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp()
      })

      newLikeCount = Math.max(0, currentLikes - 1)
      isNowLiked = false
    } else {
      // Add like
      await likesCollection.add({
        newsId: newsId,
        userId: userId,
        createdAt: FieldValue.serverTimestamp()
      })

      // Increment like count
      await newsCollection.doc(newsId).update({
        likes: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      })

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
  try {
    const session = await auth()
    const { id: newsId } = params

    if (!newsId) {
      return NextResponse.json(
        { error: 'Invalid news ID' },
        { status: 400 }
      )
    }

    const newsCollection = getNewsCollection()
    const db = getFirestore()
    
    // Get like count for the article
    const newsDoc = await newsCollection.doc(newsId).get()

    if (!newsDoc.exists) {
      return NextResponse.json(
        { error: 'News article not found' },
        { status: 404 }
      )
    }

    const newsData = newsDoc.data()
    let isLiked = false
    
    // Check if current user liked this article
    if (session?.user?.id) {
      const userLike = await db.collection('news_likes')
        .where('newsId', '==', newsId)
        .where('userId', '==', session.user.id)
        .get()
      
      isLiked = !userLike.empty
    }

    return NextResponse.json({
      likeCount: newsData?.likes || 0,
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
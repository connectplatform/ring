import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

/**
 * POST /api/comments/[id]/like
 * Like or unlike a comment
 */
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

    const commentId = params.id
    const userId = session.user.id

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      )
    }

    const db = getFirestore()
    
    // Check if comment exists
    const commentRef = db.collection('comments').doc(commentId)
    const commentSnap = await commentRef.get()
    
    if (!commentSnap.exists) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      )
    }

    const commentData = commentSnap.data()
    
    // Check if comment is active
    if (commentData?.status !== 'active') {
      return NextResponse.json(
        { error: 'Cannot like inactive comment' },
        { status: 400 }
      )
    }

    // Check if user has already liked this comment
    const likeRef = db.collection('commentLikes').doc(`${commentId}_${userId}`)
    const likeSnap = await likeRef.get()
    
    const isCurrentlyLiked = likeSnap.exists
    const action = isCurrentlyLiked ? 'unlike' : 'like'
    
    // Create batch operation for atomic updates
    const batch = db.batch()
    
    if (isCurrentlyLiked) {
      // Unlike: Remove like document and decrement counter
      batch.delete(likeRef)
      batch.update(commentRef, {
        likes: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp()
      })
    } else {
      // Like: Create like document and increment counter
      batch.set(likeRef, {
        commentId: commentId,
        userId: userId,
        userName: session.user.name || 'Anonymous',
        userAvatar: session.user.image || null,
        createdAt: FieldValue.serverTimestamp()
      })
      batch.update(commentRef, {
        likes: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      })
    }
    
    // Execute batch operation
    await batch.commit()
    
    // Get updated comment data
    const updatedCommentSnap = await commentRef.get()
    const updatedComment = updatedCommentSnap.data()
    
    return NextResponse.json({
      success: true,
      data: {
        commentId: commentId,
        action: action,
        liked: !isCurrentlyLiked,
        likes: updatedComment?.likes || 0,
        userId: userId
      },
      message: `Comment ${action}d successfully`
    })

  } catch (error) {
    console.error('Error liking/unliking comment:', error)
    return NextResponse.json(
      { error: 'Failed to process like action' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/comments/[id]/like
 * Get like status for a comment by the current user
 */
export async function GET(
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

    const commentId = params.id
    const userId = session.user.id

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      )
    }

    const db = getFirestore()
    
    // Check if comment exists
    const commentRef = db.collection('comments').doc(commentId)
    const commentSnap = await commentRef.get()
    
    if (!commentSnap.exists) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      )
    }

    const commentData = commentSnap.data()
    
    // Check if user has liked this comment
    const likeRef = db.collection('commentLikes').doc(`${commentId}_${userId}`)
    const likeSnap = await likeRef.get()
    
    return NextResponse.json({
      success: true,
      data: {
        commentId: commentId,
        liked: likeSnap.exists,
        likes: commentData?.likes || 0,
        userId: userId
      }
    })

  } catch (error) {
    console.error('Error getting like status:', error)
    return NextResponse.json(
      { error: 'Failed to get like status' },
      { status: 500 }
    )
  }
} 
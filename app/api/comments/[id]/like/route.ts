import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'

type CommentRow = Record<string, unknown> & { id: string }
type LikeRow = Record<string, unknown> & { id: string }

/**
 * POST /api/comments/[id]/like
 * Like or unlike a comment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Establish database connection
  await connection()

  try {
    // Retrieve current user session
    const session = await auth()
    
    // Ensure the user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const commentId = params.id
    const userId = session.user.id

    // Validate commentId
    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    // Fetch comment document from database
    const commentResult = await db().readDoc<CommentRow>('comments', commentId)

    if (!commentResult.success || !commentResult.data) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const commentData = commentResult.data

    // Prevent likes on inactive comments
    if (commentData.status !== 'active') {
      return NextResponse.json({ error: 'Cannot like inactive comment' }, { status: 400 })
    }

    // Check if the user has already liked this comment
    const likeQueryResult = await db().queryDocs<LikeRow>({
      collection: 'comment_likes',
      filters: [
        { field: 'comment_id', operator: '==', value: commentId },
        { field: 'user_id', operator: '==', value: userId }
      ],
      pagination: { limit: 1 }
    })

    const isCurrentlyLiked = likeQueryResult.success && likeQueryResult.data.length > 0
    const action = isCurrentlyLiked ? 'unlike' : 'like'

    if (isCurrentlyLiked) {
      // User has liked the comment, so perform unlike
      const likeId = likeQueryResult.data[0].id
      await db().deleteDoc('comment_likes', likeId)

      // Decrement the like count, ensuring it doesn't go below zero
      await db().updateDoc('comments', commentId, {
        ...commentData,
        likes: Math.max(0, ((commentData.likes as number) || 0) - 1),
        updated_at: new Date()
      })
    } else {
      // User has NOT liked the comment, so perform like
      await db().createDoc('comment_likes', {
        comment_id: commentId,
        user_id: userId,
        user_name: session.user.name || 'Anonymous',
        user_avatar: session.user.image || null,
        created_at: new Date()
      })

      // Increment the like count
      await db().updateDoc('comments', commentId, {
        ...commentData,
        likes: ((commentData.likes as number) || 0) + 1,
        updated_at: new Date()
      })
    }

    // Fetch the updated comment to return fresh like count
    const updatedCommentResult = await db().readDoc<CommentRow>('comments', commentId)
    const updatedComment = updatedCommentResult.success && updatedCommentResult.data
      ? updatedCommentResult.data
      : commentData
    
    // Return response with updated like/unlike state
    return NextResponse.json({
      success: true,
      data: {
        commentId,
        action,
        liked: !isCurrentlyLiked, // true if now liked, false if now unliked
        likes: (updatedComment.likes as number) || 0,
        userId
      },
      message: `Comment ${action}d successfully` // "liked" or "unliked"
    })

  } catch (error) {
    // Log and respond on error
    console.error('Error liking/unliking comment:', error)
    return NextResponse.json({ error: 'Failed to process like action' }, { status: 500 })
  }
  // TODO: Consider using optimistic UI updates OR Next16 partial revalidation for instant feedback.
}

/**
 * GET /api/comments/[id]/like
 * Get like status for a comment by the current user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Establish database connection
  await connection()

  try {
    // Retrieve current user session
    const session = await auth()
    
    // Ensure the user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const commentId = params.id
    const userId = session.user.id

    // Validate commentId
    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    // Fetch comment document from database
    const commentResult = await db().readDoc<CommentRow>('comments', commentId)

    if (!commentResult.success || !commentResult.data) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const commentData = commentResult.data

    // Check if there is an entry in comment_likes for this user/comment pair
    const likeQueryResult = await db().queryDocs({
      collection: 'comment_likes',
      filters: [
        { field: 'comment_id', operator: '==', value: commentId },
        { field: 'user_id', operator: '==', value: userId }
      ],
      pagination: { limit: 1 }
    })

    const isLiked = likeQueryResult.success && likeQueryResult.data.length > 0

    // Respond with like status and total like count
    return NextResponse.json({
      success: true,
      data: {
        commentId,
        liked: isLiked,
        likes: (commentData.likes as number) || 0,
        userId
      }
    })

  } catch (error) {
    // Log and respond on error
    console.error('Error getting like status:', error)
    return NextResponse.json({ error: 'Failed to get like status' }, { status: 500 })
  }
  // TODO: Add caching (Next16 Route segment config) to lessen DB load for GETs if user's session is stable over time.
}

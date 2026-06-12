import { NextRequest, NextResponse, connection} from 'next/server'
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
  await connection()

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const commentId = params.id
    const userId = session.user.id

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    const commentResult = await db().readDoc<CommentRow>('comments', commentId)

    if (!commentResult.success || !commentResult.data) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const commentData = commentResult.data

    if (commentData.status !== 'active') {
      return NextResponse.json({ error: 'Cannot like inactive comment' }, { status: 400 })
    }

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
      const likeId = likeQueryResult.data[0].id
      await db().deleteDoc('comment_likes', likeId)

      await db().updateDoc('comments', commentId, {
        ...commentData,
        likes: Math.max(0, ((commentData.likes as number) || 0) - 1),
        updated_at: new Date()
      })
    } else {
      await db().createDoc('comment_likes', {
        comment_id: commentId,
        user_id: userId,
        user_name: session.user.name || 'Anonymous',
        user_avatar: session.user.image || null,
        created_at: new Date()
      })

      await db().updateDoc('comments', commentId, {
        ...commentData,
        likes: ((commentData.likes as number) || 0) + 1,
        updated_at: new Date()
      })
    }

    const updatedCommentResult = await db().readDoc<CommentRow>('comments', commentId)
    const updatedComment = updatedCommentResult.success && updatedCommentResult.data
      ? updatedCommentResult.data
      : commentData
    
    return NextResponse.json({
      success: true,
      data: {
        commentId,
        action,
        liked: !isCurrentlyLiked,
        likes: (updatedComment.likes as number) || 0,
        userId
      },
      message: `Comment ${action}d successfully`
    })

  } catch (error) {
    console.error('Error liking/unliking comment:', error)
    return NextResponse.json({ error: 'Failed to process like action' }, { status: 500 })
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
  await connection()

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const commentId = params.id
    const userId = session.user.id

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    const commentResult = await db().readDoc<CommentRow>('comments', commentId)

    if (!commentResult.success || !commentResult.data) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const commentData = commentResult.data

    const likeQueryResult = await db().queryDocs({
      collection: 'comment_likes',
      filters: [
        { field: 'comment_id', operator: '==', value: commentId },
        { field: 'user_id', operator: '==', value: userId }
      ],
      pagination: { limit: 1 }
    })

    const isLiked = likeQueryResult.success && likeQueryResult.data.length > 0

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
    console.error('Error getting like status:', error)
    return NextResponse.json({ error: 'Failed to get like status' }, { status: 500 })
  }
}

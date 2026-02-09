import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { getDatabaseService, initializeDatabase } from '@/lib/database'

/**
 * POST /api/comments/[id]/like
 * Like or unlike a comment
 */
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

    const commentId = params.id
    const userId = session.user.id

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      )
    }

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return NextResponse.json(
        { error: 'Database initialization failed' },
        { status: 500 }
      );
    }

    const dbService = getDatabaseService();

    // Check if comment exists
    const commentResult = await dbService.read('comments', commentId);

    if (!commentResult.success || !commentResult.data) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const commentData = commentResult.data.data || commentResult.data;

    // Check if comment is active
    if (commentData?.status !== 'active') {
      return NextResponse.json(
        { error: 'Cannot like inactive comment' },
        { status: 400 }
      );
    }

    // Check if user has already liked this comment
    const likeQueryResult = await dbService.query({
      collection: 'comment_likes',
      filters: [
        { field: 'comment_id', operator: '==' as const, value: commentId },
        { field: 'user_id', operator: '==' as const, value: userId }
      ],
      pagination: { limit: 1 }
    });

    const isCurrentlyLiked = likeQueryResult.success && likeQueryResult.data.length > 0;
    const action = isCurrentlyLiked ? 'unlike' : 'like';

    if (isCurrentlyLiked) {
      // Unlike: Remove like document and decrement counter
      const likeId = likeQueryResult.data[0].id;
      await dbService.delete('comment_likes', likeId);

      // Update comment likes count
      const updatedCommentData = {
        ...commentData,
        likes: Math.max(0, (commentData?.likes || 0) - 1),
        updated_at: new Date()
      };
      await dbService.update('comments', commentId, updatedCommentData);
    } else {
      // Like: Create like document and increment counter
      const likeData = {
        comment_id: commentId,
        user_id: userId,
        user_name: session.user.name || 'Anonymous',
        user_avatar: session.user.image || null,
        created_at: new Date()
      };
      await dbService.create('comment_likes', likeData);

      // Update comment likes count
      const updatedCommentData = {
        ...commentData,
        likes: (commentData?.likes || 0) + 1,
        updated_at: new Date()
      };
      await dbService.update('comments', commentId, updatedCommentData);
    }

    // Get updated comment data
    const updatedCommentResult = await dbService.read('comments', commentId);
    const updatedComment = updatedCommentResult.success && updatedCommentResult.data
      ? (updatedCommentResult.data.data || updatedCommentResult.data)
      : commentData;
    
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
  await connection() // Next.js 16: opt out of prerendering

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

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return NextResponse.json(
        { error: 'Database initialization failed' },
        { status: 500 }
      );
    }

    const dbService = getDatabaseService();

    // Check if comment exists
    const commentResult = await dbService.read('comments', commentId);

    if (!commentResult.success || !commentResult.data) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const commentData = commentResult.data.data || commentResult.data;

    // Check if user has liked this comment
    const likeQueryResult = await dbService.query({
      collection: 'comment_likes',
      filters: [
        { field: 'comment_id', operator: '==' as const, value: commentId },
        { field: 'user_id', operator: '==' as const, value: userId }
      ],
      pagination: { limit: 1 }
    });

    const isLiked = likeQueryResult.success && likeQueryResult.data.length > 0;

    return NextResponse.json({
      success: true,
      data: {
        commentId: commentId,
        liked: isLiked,
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
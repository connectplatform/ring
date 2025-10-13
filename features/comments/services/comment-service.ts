// Comments Service - Direct Firestore operations
// Extracted from API routes to follow Ring's architectural pattern:
// "Server Actions should call services directly; avoid HTTP requests to own API routes"

import { auth } from '@/auth'
import { getDatabaseService, initializeDatabase } from '@/lib/database'
import { CommentFormData, CommentFilters } from '@/features/comments/types'

interface CreateCommentResult {
  success: boolean
  data?: any
  error?: string
}

interface GetCommentsResult {
  success: boolean
  data?: any[]
  pagination?: {
    limit: number
    offset: number
    total: number
  }
  filters?: CommentFilters
  error?: string
}

export async function createComment(formData: CommentFormData): Promise<CreateCommentResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Validate required fields
    if (!formData.content || !formData.targetId || !formData.targetType) {
      return {
        success: false,
        error: 'Content, targetId, and targetType are required'
      }
    }

    // Validate content length
    if (formData.content.length > 2000) {
      return {
        success: false,
        error: 'Comment content too long (max 2000 characters)'
      }
    }

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return {
        success: false,
        error: 'Database initialization failed'
      };
    }

    const dbService = getDatabaseService();

    // Check if target exists based on targetType
    let targetCollection = ''

    switch (formData.targetType) {
      case 'news':
        targetCollection = 'news'
        break
      case 'entity':
        targetCollection = 'entities'
        break
      case 'opportunity':
        targetCollection = 'opportunities'
        break
      case 'comment':
        targetCollection = 'comments'
        break
      default:
        return {
          success: false,
          error: 'Invalid target type'
        }
    }

    const targetResult = await dbService.read(targetCollection, formData.targetId);
    if (!targetResult.success || !targetResult.data) {
      return {
        success: false,
        error: 'Target not found'
      };
    }

    // Determine comment level
    let level = 0
    if (formData.parentId) {
      const parentResult = await dbService.read('comments', formData.parentId);
      if (!parentResult.success || !parentResult.data) {
        return {
          success: false,
          error: 'Parent comment not found'
        };
      }
      const parentData = parentResult.data.data || parentResult.data;
      level = (parentData?.level || 0) + 1;

      // Limit nesting depth
      if (level > 3) {
        return {
          success: false,
          error: 'Comment nesting too deep (max 3 levels)'
        };
      }
    }

    const newComment = {
      content: formData.content.trim(),
      author_id: session.user.id,
      author_name: session.user.name || 'Anonymous',
      author_avatar: session.user.image || null,
      target_id: formData.targetId,
      target_type: formData.targetType,
      parent_id: formData.parentId || null,
      level: level,
      likes: 0,
      replies: 0,
      status: 'active',
      is_edited: false,
      is_pinned: false,
      created_at: new Date(),
      updated_at: new Date(),
    }

    // Generate comment ID
    const commentId = crypto.randomUUID();

    // Create the comment with explicit ID
    const createResult = await dbService.create('comments', newComment, { id: commentId });
    if (!createResult.success) {
      return {
        success: false,
        error: 'Failed to create comment'
      };
    }

    // Update parent comment reply count
    if (formData.parentId) {
      const parentResult = await dbService.read('comments', formData.parentId);
      if (parentResult.success && parentResult.data) {
        const parentData = parentResult.data.data || parentResult.data;
        const updatedParentData = {
          ...parentData,
          replies: (parentData?.replies || 0) + 1,
          updated_at: new Date()
        };
        await dbService.update('comments', formData.parentId, updatedParentData);
      }
    }

    // Update target's comment count
    const targetData = targetResult.data.data || targetResult.data;
    const updatedTargetData = {
      ...targetData,
      comments: (targetData?.comments || 0) + 1,
      updated_at: new Date()
    };
    await dbService.update(targetCollection, formData.targetId, updatedTargetData);

    const commentData = {
      id: commentId,
      ...newComment,
      createdAt: newComment.created_at,
      updatedAt: newComment.updated_at,
      editedAt: null,
    }

    return {
      success: true,
      data: commentData
    }

  } catch (error) {
    console.error('Error creating comment:', error)
    return {
      success: false,
      error: 'Failed to create comment'
    }
  }
}

export async function deleteComment(commentId: string): Promise<CreateCommentResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return {
        success: false,
        error: 'Database initialization failed'
      };
    }

    const dbService = getDatabaseService();

    // Get comment data
    const commentResult = await dbService.read('comments', commentId);
    if (!commentResult.success || !commentResult.data) {
      return {
        success: false,
        error: 'Comment not found'
      };
    }

    const commentData = commentResult.data.data || commentResult.data;

    // Check if user owns the comment or is admin
    if (commentData?.author_id !== session.user.id) {
      // TODO: Add admin role check
      return {
        success: false,
        error: 'Not authorized to delete this comment'
      }
    }

    // Soft delete the comment
    const updatedCommentData = {
      ...commentData,
      status: 'deleted',
      content: '[deleted]',
      updated_at: new Date()
    };

    await dbService.update('comments', commentId, updatedCommentData);

    // Update target's comment count
    if (commentData?.target_type && commentData?.target_id) {
      const targetCollection = getTargetCollection(commentData.target_type)
      if (targetCollection) {
        const targetResult = await dbService.read(targetCollection, commentData.target_id);
        if (targetResult.success && targetResult.data) {
          const targetData = targetResult.data.data || targetResult.data;
          const updatedTargetData = {
            ...targetData,
            comments: (targetData?.comments || 0) - 1,
            updated_at: new Date()
          };
          await dbService.update(targetCollection, commentData.target_id, updatedTargetData);
        }
      }
    }

    return {
      success: true
    }

  } catch (error) {
    console.error('Error deleting comment:', error)
    return {
      success: false,
      error: 'Failed to delete comment'
    }
  }
}

export async function updateComment(commentId: string, content: string): Promise<CreateCommentResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    if (!content || content.length > 2000) {
      return {
        success: false,
        error: 'Invalid content length'
      }
    }

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return {
        success: false,
        error: 'Database initialization failed'
      };
    }

    const dbService = getDatabaseService();

    // Get comment data
    const commentResult = await dbService.read('comments', commentId);
    if (!commentResult.success || !commentResult.data) {
      return {
        success: false,
        error: 'Comment not found'
      };
    }

    const commentData = commentResult.data.data || commentResult.data;

    // Check if user owns the comment
    if (commentData?.author_id !== session.user.id) {
      return {
        success: false,
        error: 'Not authorized to edit this comment'
      }
    }

    // Update the comment
    const updatedCommentData = {
      ...commentData,
      content: content.trim(),
      is_edited: true,
      edited_at: new Date(),
      updated_at: new Date()
    };

    await dbService.update('comments', commentId, updatedCommentData);

    const updatedData = {
      id: commentId,
      ...updatedCommentData,
      updatedAt: updatedCommentData.updated_at,
      editedAt: updatedCommentData.edited_at
    }

    return {
      success: true,
      data: updatedData
    }

  } catch (error) {
    console.error('Error updating comment:', error)
    return {
      success: false,
      error: 'Failed to update comment'
    }
  }
}

function getTargetCollection(targetType: string): string | null {
  switch (targetType) {
    case 'news':
      return 'news'
    case 'entity':
      return 'entities'
    case 'opportunity':
      return 'opportunities'
    case 'comment':
      return 'comments'
    default:
      return null
  }
}

'use server'

import { CommentActionState, CommentFormData } from '@/features/comments/types'

export type { CommentActionState } from '@/features/comments/types'

export async function createComment(
  prevState: CommentActionState | null,
  formData: FormData
): Promise<CommentActionState> {
  const content = formData.get('content') as string
  const targetId = formData.get('targetId') as string
  const targetType = formData.get('targetType') as string
  const parentId = formData.get('parentId') as string || undefined

  // Basic validation
  if (!content || !targetId || !targetType) {
    return {
      error: 'Content, target ID, and target type are required'
    }
  }

  if (content.length > 2000) {
    return {
      error: 'Comment is too long (max 2000 characters)'
    }
  }

  try {
    const commentData: CommentFormData = {
      content: content.trim(),
      targetId,
      targetType: targetType as any,
      parentId
    }

    // ✅ Use direct service call instead of HTTP request
    const { createComment } = await import('@/features/comments/services/comment-service')
    const result = await createComment(commentData)

    if (result.success && result.data) {
      return {
        success: true,
        message: 'Comment posted successfully',
        comment: result.data
      }
    } else {
      return {
        error: result.error || 'Failed to create comment'
      }
    }
  } catch (error) {
    console.error('Comment creation service call failed:', {
      error: error instanceof Error ? error.message : error
    })
    return {
      error: 'Failed to post comment. Please try again.'
    }
  }
}

export async function deleteComment(
  prevState: CommentActionState | null,
  formData: FormData
): Promise<CommentActionState> {
  const commentId = formData.get('commentId') as string

  if (!commentId) {
    return {
      error: 'Comment ID is required'
    }
  }

  try {
    // ✅ Use direct service call instead of HTTP request
    const { deleteComment: deleteCommentService } = await import('@/features/comments/services/comment-service')
    const result = await deleteCommentService(commentId)

    if (result.success) {
      return {
        success: true,
        message: 'Comment deleted successfully'
      }
    } else {
      return {
        error: result.error || 'Failed to delete comment'
      }
    }
  } catch (error) {
    console.error('Comment deletion service call failed:', {
      commentId,
      error: error instanceof Error ? error.message : error
    })
    return {
      error: 'Failed to delete comment. Please try again.'
    }
  }
}

export async function editComment(
  prevState: CommentActionState | null,
  formData: FormData
): Promise<CommentActionState> {
  const commentId = formData.get('commentId') as string
  const content = formData.get('content') as string

  if (!commentId || !content) {
    return {
      error: 'Comment ID and content are required'
    }
  }

  if (content.length > 2000) {
    return {
      error: 'Comment is too long (max 2000 characters)'
    }
  }

  try {
    // ✅ Use direct service call instead of HTTP request
    const { updateComment } = await import('@/features/comments/services/comment-service')
    const result = await updateComment(commentId, content.trim())

    if (result.success && result.data) {
      return {
        success: true,
        message: 'Comment updated successfully',
        comment: result.data
      }
    } else {
      return {
        error: result.error || 'Failed to update comment'
      }
    }
  } catch (error) {
    console.error('Comment editing service call failed:', {
      commentId,
      error: error instanceof Error ? error.message : error
    })
    return {
      error: 'Failed to update comment. Please try again.'
    }
  }
} 
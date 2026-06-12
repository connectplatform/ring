// Comments Service - domain layer for comment CRUD

import { auth } from '@/auth'
import { db } from '@/lib/database'
import { CommentFormData } from '@/features/comments/types'

interface CreateCommentResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

type CommentRow = Record<string, unknown> & { id: string }

export async function createComment(formData: CommentFormData): Promise<CreateCommentResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    if (!formData.content || !formData.targetId || !formData.targetType) {
      return { success: false, error: 'Content, targetId, and targetType are required' }
    }

    if (formData.content.length > 2000) {
      return { success: false, error: 'Comment content too long (max 2000 characters)' }
    }

    const targetCollection = getTargetCollection(formData.targetType)
    if (!targetCollection) {
      return { success: false, error: 'Invalid target type' }
    }

    const targetResult = await db().readDoc<CommentRow>(targetCollection, formData.targetId)
    if (!targetResult.success) {
      if (targetResult.metadata?.operation === 'initialize') {
        return { success: false, error: 'Database initialization failed' }
      }
      return { success: false, error: 'Target not found' }
    }
    if (!targetResult.data) {
      return { success: false, error: 'Target not found' }
    }

    let level = 0
    if (formData.parentId) {
      const parentResult = await db().readDoc<CommentRow>('comments', formData.parentId)
      if (!parentResult.success || !parentResult.data) {
        return { success: false, error: 'Parent comment not found' }
      }
      level = ((parentResult.data.level as number) || 0) + 1

      if (level > 3) {
        return { success: false, error: 'Comment nesting too deep (max 3 levels)' }
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
      level,
      likes: 0,
      replies: 0,
      status: 'active',
      is_edited: false,
      is_pinned: false,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const commentId = crypto.randomUUID()

    const createResult = await db().createDoc('comments', newComment, { id: commentId })
    if (!createResult.success) {
      return { success: false, error: 'Failed to create comment' }
    }

    if (formData.parentId) {
      const parentResult = await db().readDoc<CommentRow>('comments', formData.parentId)
      if (parentResult.success && parentResult.data) {
        await db().updateDoc('comments', formData.parentId, {
          ...parentResult.data,
          replies: ((parentResult.data.replies as number) || 0) + 1,
          updated_at: new Date(),
        })
      }
    }

    const targetData = targetResult.data
    await db().updateDoc(targetCollection, formData.targetId, {
      ...targetData,
      comments: ((targetData.comments as number) || 0) + 1,
      updated_at: new Date(),
    })

    const commentData = {
      id: commentId,
      ...newComment,
      createdAt: newComment.created_at,
      updatedAt: newComment.updated_at,
      editedAt: null,
    }

    return { success: true, data: commentData }
  } catch (error) {
    console.error('Error creating comment:', error)
    return { success: false, error: 'Failed to create comment' }
  }
}

export async function deleteComment(commentId: string): Promise<CreateCommentResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const commentResult = await db().readDoc<CommentRow>('comments', commentId)
    if (!commentResult.success || !commentResult.data) {
      return { success: false, error: 'Comment not found' }
    }

    const commentData = commentResult.data

    if (commentData.author_id !== session.user.id) {
      return { success: false, error: 'Not authorized to delete this comment' }
    }

    await db().updateDoc('comments', commentId, {
      ...commentData,
      status: 'deleted',
      content: '[deleted]',
      updated_at: new Date(),
    })

    if (commentData.target_type && commentData.target_id) {
      const targetCollection = getTargetCollection(commentData.target_type as string)
      if (targetCollection) {
        const targetResult = await db().readDoc<CommentRow>(
          targetCollection,
          commentData.target_id as string
        )
        if (targetResult.success && targetResult.data) {
          await db().updateDoc(targetCollection, commentData.target_id as string, {
            ...targetResult.data,
            comments: Math.max(0, ((targetResult.data.comments as number) || 0) - 1),
            updated_at: new Date(),
          })
        }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting comment:', error)
    return { success: false, error: 'Failed to delete comment' }
  }
}

export async function updateComment(commentId: string, content: string): Promise<CreateCommentResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    if (!content || content.length > 2000) {
      return { success: false, error: 'Invalid content length' }
    }

    const commentResult = await db().readDoc<CommentRow>('comments', commentId)
    if (!commentResult.success || !commentResult.data) {
      return { success: false, error: 'Comment not found' }
    }

    const commentData = commentResult.data

    if (commentData.author_id !== session.user.id) {
      return { success: false, error: 'Not authorized to edit this comment' }
    }

    const updatedCommentData = {
      ...commentData,
      content: content.trim(),
      is_edited: true,
      edited_at: new Date(),
      updated_at: new Date(),
    }

    await db().updateDoc('comments', commentId, updatedCommentData)

    return {
      success: true,
      data: {
        id: commentId,
        ...updatedCommentData,
        updatedAt: updatedCommentData.updated_at,
        editedAt: updatedCommentData.edited_at,
      },
    }
  } catch (error) {
    console.error('Error updating comment:', error)
    return { success: false, error: 'Failed to update comment' }
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

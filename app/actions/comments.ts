import { CommentActionState, CommentFormData } from '@/types/comments'

export type { CommentActionState } from '@/types/comments'

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

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commentData)
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        error: errorData.error || 'Failed to create comment'
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      message: 'Comment posted successfully',
      comment: data.data
    }
  } catch (error) {
    console.error('Error creating comment:', error)
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
    const response = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        error: errorData.error || 'Failed to delete comment'
      }
    }

    return {
      success: true,
      message: 'Comment deleted successfully'
    }
  } catch (error) {
    console.error('Error deleting comment:', error)
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
    const response = await fetch(`/api/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: content.trim() })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        error: errorData.error || 'Failed to update comment'
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      message: 'Comment updated successfully',
      comment: data.data
    }
  } catch (error) {
    console.error('Error updating comment:', error)
    return {
      error: 'Failed to update comment. Please try again.'
    }
  }
} 
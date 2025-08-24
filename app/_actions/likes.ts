'use server'

// Server action for handling likes
// This file must be marked with 'use server' to prevent bundling server code with client

export interface LikeActionState {
  error?: string
  success?: boolean
  message?: string
  newCount?: number
  isLiked?: boolean
}

export async function toggleLike(
  prevState: LikeActionState | null,
  formData: FormData
): Promise<LikeActionState> {
  const targetId = formData.get('targetId') as string
  const targetType = formData.get('targetType') as string
  const currentlyLiked = formData.get('currentlyLiked') === 'true'

  // Basic validation
  if (!targetId || !targetType) {
    return {
      error: 'Missing required information'
    }
  }

  if (!['entity', 'opportunity', 'comment', 'news'].includes(targetType)) {
    return {
      error: 'Invalid target type'
    }
  }

  try {
    // ✅ Use direct service call instead of HTTP request
    const { toggleLike } = await import('@/features/interactions/services/like-service')
    const result = await toggleLike(targetId, targetType)

    if (result.success) {
      return {
        success: true,
        message: result.message,
        newCount: result.likeCount,
        isLiked: result.liked
      }
    } else {
      return {
        error: result.error || 'Failed to update like'
      }
    }
    
  } catch (error) {
    console.error('Like toggle service call failed:', {
      targetType,
      targetId,
      error: error instanceof Error ? error.message : error
    })
    return {
      error: 'Failed to update like. Please try again.'
    }
  }
} 
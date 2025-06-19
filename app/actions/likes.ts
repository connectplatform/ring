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
    let response: Response

    // Route to appropriate API endpoint based on target type
    switch (targetType) {
      case 'news':
        response = await fetch(`/api/news/${targetId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        break
      
      case 'entity':
        // TODO: Implement entity like endpoint
        response = await fetch(`/api/entities/${targetId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        break
      
      case 'opportunity':
        // TODO: Implement opportunity like endpoint  
        response = await fetch(`/api/opportunities/${targetId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        break
      
      case 'comment':
        // TODO: Implement comment like endpoint
        response = await fetch(`/api/comments/${targetId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        break
      
      default:
        return {
          error: 'Unsupported target type'
        }
    }

    if (!response.ok) {
      const errorData = await response.json()
      return {
        error: errorData.error || 'Failed to update like'
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      message: data.message,
      newCount: data.likeCount,
      isLiked: data.liked
    }
  } catch (error) {
    console.error('Error toggling like:', error)
    return {
      error: 'Failed to update like. Please try again.'
    }
  }
} 
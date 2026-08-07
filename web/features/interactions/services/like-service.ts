// Like Service - Direct Database operations
// Extracted from API routes to follow Ring's architectural pattern:
// "Server Actions should call services directly; avoid HTTP requests to own API routes"

import { auth } from '@/auth'
import { db } from '@/lib/database'
import { revalidatePath } from 'next/cache'

interface LikeResult {
  success: boolean
  message?: string
  likeCount?: number
  liked?: boolean
  error?: string
}

interface LikeRow {
  id: string
  userId: string
  targetId: string
  targetType: string
}

interface LikableTarget {
  likes?: number
}

export async function toggleLike(targetId: string, targetType: string): Promise<LikeResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    if (!targetId || !targetType) {
      return {
        success: false,
        error: 'Target ID and type are required'
      }
    }

    if (!['entity', 'opportunity', 'comment', 'news'].includes(targetType)) {
      return {
        success: false,
        error: 'Invalid target type'
      }
    }

    const userId = session.user.id

    const targetCollection = getTargetCollection(targetType)
    if (!targetCollection) {
      return {
        success: false,
        error: 'Invalid target type'
      }
    }

    const targetDocResult = await db().findDocById<LikableTarget & Record<string, unknown>>(
      targetCollection,
      targetId
    )
    if (!targetDocResult.success || !targetDocResult.data) {
      return {
        success: false,
        error: 'Target not found'
      }
    }

    const likeQueryResult = await db().queryDocs<LikeRow & Record<string, unknown>>({
      collection: 'likes',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'targetId', operator: '==', value: targetId },
        { field: 'targetType', operator: '==', value: targetType }
      ]
    })

    if (!likeQueryResult.success || !likeQueryResult.data) {
      return {
        success: false,
        error: 'Failed to check like status'
      }
    }

    const isCurrentlyLiked = likeQueryResult.data.length > 0

    let finalLikeCount = 0
    let isLiked = false

    await db().transaction(async (txn) => {
      if (isCurrentlyLiked) {
        const likeDocId = likeQueryResult.data![0].id
        await txn.delete('likes', likeDocId)

        const targetDoc = await txn.read<LikableTarget>(targetCollection, targetId)
        const currentLikes = targetDoc?.data?.likes ?? 0

        await txn.update(targetCollection, targetId, {
          likes: Math.max(0, currentLikes - 1),
          updatedAt: new Date()
        })

        finalLikeCount = Math.max(0, currentLikes - 1)
        isLiked = false
      } else {
        await txn.create('likes', {
          userId,
          targetId,
          targetType,
          createdAt: new Date()
        })

        const targetDoc = await txn.read<LikableTarget>(targetCollection, targetId)
        const currentLikes = targetDoc?.data?.likes ?? 0

        await txn.update(targetCollection, targetId, {
          likes: currentLikes + 1,
          updatedAt: new Date()
        })

        finalLikeCount = currentLikes + 1
        isLiked = true
      }
    })

    revalidatePath(`/[locale]/${targetType}s/${targetId}`)

    return {
      success: true,
      message: isLiked ? 'Liked successfully' : 'Unliked successfully',
      likeCount: finalLikeCount,
      liked: isLiked
    }
  } catch (error) {
    console.error('Error toggling like:', error)
    return {
      success: false,
      error: 'Failed to update like status'
    }
  }
}

export async function getUserLikeStatus(targetId: string, targetType: string): Promise<{
  success: boolean
  liked?: boolean
  error?: string
}> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const userId = session.user.id

    const likeQueryResult = await db().queryDocs<LikeRow & Record<string, unknown>>({
      collection: 'likes',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'targetId', operator: '==', value: targetId },
        { field: 'targetType', operator: '==', value: targetType }
      ]
    })

    if (!likeQueryResult.success || !likeQueryResult.data) {
      return {
        success: false,
        error: 'Failed to get like status'
      }
    }

    return {
      success: true,
      liked: likeQueryResult.data.length > 0
    }
  } catch (error) {
    console.error('Error getting like status:', error)
    return {
      success: false,
      error: 'Failed to get like status'
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

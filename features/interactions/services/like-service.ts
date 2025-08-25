// Like Service - Direct Firestore operations
// Extracted from API routes to follow Ring's architectural pattern:
// "Server Actions should call services directly; avoid HTTP requests to own API routes"

import { auth } from '@/auth'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { FieldValue } from 'firebase-admin/firestore'

interface LikeResult {
  success: boolean
  message?: string
  likeCount?: number
  liked?: boolean
  error?: string
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

    const db = getAdminDb()
    const userId = session.user.id
    
    // Determine the target collection
    const targetCollection = getTargetCollection(targetType)
    if (!targetCollection) {
      return {
        success: false,
        error: 'Invalid target type'
      }
    }

    // Check if target exists
    const targetDoc = await db.collection(targetCollection).doc(targetId).get()
    if (!targetDoc.exists) {
      return {
        success: false,
        error: 'Target not found'
      }
    }

    // Check if user has already liked this target
    const likeDoc = await db.collection('likes')
      .where('userId', '==', userId)
      .where('targetId', '==', targetId)
      .where('targetType', '==', targetType)
      .get()

    const isCurrentlyLiked = !likeDoc.empty
    
    if (isCurrentlyLiked) {
      // Unlike - remove the like document
      const likeDocId = likeDoc.docs[0].id
      await db.collection('likes').doc(likeDocId).delete()
      
      // Decrement the like count on the target
      await db.collection(targetCollection).doc(targetId).update({
        likes: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp()
      })
      
      // Get updated like count
      const updatedTarget = await db.collection(targetCollection).doc(targetId).get()
      const likeCount = updatedTarget.data()?.likes || 0

      return {
        success: true,
        message: 'Unliked successfully',
        likeCount: likeCount,
        liked: false
      }
      
    } else {
      // Like - create a new like document
      const newLike = {
        userId: userId,
        targetId: targetId,
        targetType: targetType,
        createdAt: FieldValue.serverTimestamp()
      }
      
      await db.collection('likes').add(newLike)
      
      // Increment the like count on the target
      await db.collection(targetCollection).doc(targetId).update({
        likes: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      })
      
      // Get updated like count
      const updatedTarget = await db.collection(targetCollection).doc(targetId).get()
      const likeCount = updatedTarget.data()?.likes || 0

      return {
        success: true,
        message: 'Liked successfully',
        likeCount: likeCount,
        liked: true
      }
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

    const db = getAdminDb()
    const userId = session.user.id

    // Check if user has liked this target
    const likeDoc = await db.collection('likes')
      .where('userId', '==', userId)
      .where('targetId', '==', targetId)
      .where('targetType', '==', targetType)
      .get()

    return {
      success: true,
      liked: !likeDoc.empty
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

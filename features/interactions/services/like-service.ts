// Like Service - Direct Database operations
// Extracted from API routes to follow Ring's architectural pattern:
// "Server Actions should call services directly; avoid HTTP requests to own API routes"

import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { revalidatePath } from 'next/cache'

interface LikeResult {
  success: boolean
  message?: string
  likeCount?: number
  liked?: boolean
  error?: string
}

export async function toggleLike(targetId: string, targetType: string): Promise<LikeResult> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
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
    
    // Determine the target collection
    const targetCollection = getTargetCollection(targetType)
    if (!targetCollection) {
      return {
        success: false,
        error: 'Invalid target type'
      }
    }

    // Check if target exists
    const targetDocResult = await db.findById(targetCollection, targetId)
    if (!targetDocResult.success) {
      return {
        success: false,
        error: 'Target not found'
      }
    }

    // Check if user has already liked this target
    const likeQueryResult = await db.query({
      collection: 'likes',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'targetId', operator: '==', value: targetId },
        { field: 'targetType', operator: '==', value: targetType }
      ]
    })
    
    if (!likeQueryResult.success) {
      return {
        success: false,
        error: 'Failed to check like status'
      }
    }
    
    const isCurrentlyLiked = likeQueryResult.data.length > 0
    
    // Use transaction for atomic like/unlike operation (CRITICAL for data integrity!)
    let finalLikeCount = 0;
    let isLiked = false;
    
    await db.transaction(async (txn) => {
    if (isCurrentlyLiked) {
      // Unlike - remove the like document
        const likeDocId = likeQueryResult.data[0].id;
        await txn.delete('likes', likeDocId);
      
        // Read current target to get like count
        const targetDoc = await txn.read(targetCollection, targetId);
        const currentLikes = (targetDoc as any)?.likes || 0;
        
        // Decrement the like count (manual increment to replace FieldValue)
        await txn.update(targetCollection, targetId, {
          likes: Math.max(0, currentLikes - 1), // Prevent negative likes
          updatedAt: new Date()
        });
        
        finalLikeCount = Math.max(0, currentLikes - 1);
        isLiked = false;
      
    } else {
      // Like - create a new like document
        await txn.create('likes', {
        userId: userId,
        targetId: targetId,
        targetType: targetType,
          createdAt: new Date()
        });
        
        // Read current target to get like count
        const targetDoc = await txn.read(targetCollection, targetId);
        const currentLikes = (targetDoc as any)?.likes || 0;
        
        // Increment the like count (manual increment to replace FieldValue)
        await txn.update(targetCollection, targetId, {
          likes: currentLikes + 1,
          updatedAt: new Date()
        });
        
        finalLikeCount = currentLikes + 1;
        isLiked = true;
      }
    });
    
    // Revalidate after mutation (React 19 pattern)
    revalidatePath(`/[locale]/${targetType}s/${targetId}`);

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
    await initializeDatabase()
    const db = getDatabaseService()
    
    const session = await auth()
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const userId = session.user.id

    // Check if user has liked this target
    const likeQueryResult = await db.query({
      collection: 'likes',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'targetId', operator: '==', value: targetId },
        { field: 'targetType', operator: '==', value: targetType }
      ]
    })
    
    if (!likeQueryResult.success) {
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

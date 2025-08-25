// Comments Service - Direct Firestore operations
// Extracted from API routes to follow Ring's architectural pattern:
// "Server Actions should call services directly; avoid HTTP requests to own API routes"

import { auth } from '@/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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

    const db = getFirestore()
    
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

    const targetDoc = await db.collection(targetCollection).doc(formData.targetId).get()
    if (!targetDoc.exists) {
      return {
        success: false,
        error: 'Target not found'
      }
    }

    // Determine comment level
    let level = 0
    if (formData.parentId) {
      const parentComment = await db.collection('comments').doc(formData.parentId).get()
      if (!parentComment.exists) {
        return {
          success: false,
          error: 'Parent comment not found'
        }
      }
      level = (parentComment.data()?.level || 0) + 1
      
      // Limit nesting depth
      if (level > 3) {
        return {
          success: false,
          error: 'Comment nesting too deep (max 3 levels)'
        }
      }
    }

    const newComment = {
      content: formData.content.trim(),
      authorId: session.user.id,
      authorName: session.user.name || 'Anonymous',
      authorAvatar: session.user.image || null,
      targetId: formData.targetId,
      targetType: formData.targetType,
      parentId: formData.parentId || null,
      level: level,
      likes: 0,
      replies: 0,
      status: 'active',
      isEdited: false,
      isPinned: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await db.collection('comments').add(newComment)
    
    // Update parent comment reply count
    if (formData.parentId) {
      await db.collection('comments').doc(formData.parentId).update({
        replies: FieldValue.increment(1)
      })
    }
    
    // Update target's comment count
    await db.collection(targetCollection).doc(formData.targetId).update({
      comments: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    })

    const createdComment = await docRef.get()
    const commentData = {
      id: docRef.id,
      ...createdComment.data(),
      createdAt: new Date(),
      updatedAt: new Date(),
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

    const db = getFirestore()
    const commentRef = db.collection('comments').doc(commentId)
    const comment = await commentRef.get()

    if (!comment.exists) {
      return {
        success: false,
        error: 'Comment not found'
      }
    }

    const commentData = comment.data()
    
    // Check if user owns the comment or is admin
    if (commentData?.authorId !== session.user.id) {
      // TODO: Add admin role check
      return {
        success: false,
        error: 'Not authorized to delete this comment'
      }
    }

    // Soft delete the comment
    await commentRef.update({
      status: 'deleted',
      content: '[deleted]',
      updatedAt: FieldValue.serverTimestamp()
    })

    // Update target's comment count
    if (commentData?.targetType && commentData?.targetId) {
      const targetCollection = getTargetCollection(commentData.targetType)
      if (targetCollection) {
        await db.collection(targetCollection).doc(commentData.targetId).update({
          comments: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp()
        })
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

    const db = getFirestore()
    const commentRef = db.collection('comments').doc(commentId)
    const comment = await commentRef.get()

    if (!comment.exists) {
      return {
        success: false,
        error: 'Comment not found'
      }
    }

    const commentData = comment.data()
    
    // Check if user owns the comment
    if (commentData?.authorId !== session.user.id) {
      return {
        success: false,
        error: 'Not authorized to edit this comment'
      }
    }

    // Update the comment
    await commentRef.update({
      content: content.trim(),
      isEdited: true,
      editedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    })

    const updatedComment = await commentRef.get()
    const updatedData = {
      id: commentId,
      ...updatedComment.data(),
      updatedAt: new Date(),
      editedAt: new Date()
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

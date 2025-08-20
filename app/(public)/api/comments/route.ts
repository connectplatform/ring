import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { CommentFormData, CommentFilters } from '@/features/comments/types'

/**
 * GET /api/comments
 * Fetch comments with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const filters: CommentFilters = {
      targetId: searchParams.get('targetId') || '',
      targetType: searchParams.get('targetType') as any || 'news',
      parentId: searchParams.get('parentId') || undefined,
      status: searchParams.get('status') as any || 'active',
      authorId: searchParams.get('authorId') || undefined,
      limit: parseInt(searchParams.get('limit') || '10'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: searchParams.get('sortBy') as any || 'createdAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc',
    }

    if (!filters.targetId) {
      return NextResponse.json(
        { error: 'targetId is required' },
        { status: 400 }
      )
    }

    const db = getFirestore()
    const commentsCollection = db.collection('comments')
    
    let query = commentsCollection
      .where('targetId', '==', filters.targetId)
      .where('targetType', '==', filters.targetType)
      .where('status', '==', filters.status)

    // Add parent filter for nested comments
    if (filters.parentId) {
      query = query.where('parentId', '==', filters.parentId)
    } else {
      // Only top-level comments (no parent)
      query = query.where('parentId', '==', null)
    }

    // Apply sorting
    query = query.orderBy(filters.sortBy || 'createdAt', filters.sortOrder || 'desc')

    // Apply pagination
    if (filters.offset && filters.offset > 0) {
      query = query.offset(filters.offset)
    }
    
    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    const snapshot = await query.get()
    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      editedAt: doc.data().editedAt?.toDate(),
    }))

    return NextResponse.json({
      success: true,
      data: comments,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: comments.length,
      },
      filters: filters,
    })

  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/comments
 * Create a new comment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const formData: CommentFormData = await request.json()

    // Validate required fields
    if (!formData.content || !formData.targetId || !formData.targetType) {
      return NextResponse.json(
        { error: 'Content, targetId, and targetType are required' },
        { status: 400 }
      )
    }

    // Validate content length
    if (formData.content.length > 2000) {
      return NextResponse.json(
        { error: 'Comment content too long (max 2000 characters)' },
        { status: 400 }
      )
    }

    const db = getFirestore()
    
    // Check if target exists based on targetType
    let targetExists = false
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
        return NextResponse.json(
          { error: 'Invalid target type' },
          { status: 400 }
        )
    }

    const targetDoc = await db.collection(targetCollection).doc(formData.targetId).get()
    if (!targetDoc.exists) {
      return NextResponse.json(
        { error: 'Target not found' },
        { status: 404 }
      )
    }

    // Determine comment level
    let level = 0
    if (formData.parentId) {
      const parentComment = await db.collection('comments').doc(formData.parentId).get()
      if (!parentComment.exists) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        )
      }
      level = (parentComment.data()?.level || 0) + 1
      
      // Limit nesting depth
      if (level > 3) {
        return NextResponse.json(
          { error: 'Comment nesting too deep (max 3 levels)' },
          { status: 400 }
        )
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

    return NextResponse.json({
      success: true,
      data: commentData,
      message: 'Comment created successfully',
    })

  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
} 
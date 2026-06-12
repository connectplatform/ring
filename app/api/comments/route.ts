import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { CommentFormData, CommentFilters } from '@/features/comments/types'

type CommentRow = Record<string, unknown> & { id: string }

/**
 * GET /api/comments
 * Fetch comments with optional filtering
 */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const { searchParams } = new URL(request.url)
    
    const filters: CommentFilters = {
      targetId: searchParams.get('targetId') || '',
      targetType: searchParams.get('targetType') as CommentFilters['targetType'] || 'news',
      parentId: searchParams.get('parentId') || undefined,
      status: searchParams.get('status') as CommentFilters['status'] || 'active',
      authorId: searchParams.get('authorId') || undefined,
      limit: parseInt(searchParams.get('limit') || '10'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: searchParams.get('sortBy') as CommentFilters['sortBy'] || 'createdAt',
      sortOrder: searchParams.get('sortOrder') as CommentFilters['sortOrder'] || 'desc',
    }

    if (!filters.targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
    }

    const filtersArray = [
      { field: 'target_id', operator: '==' as const, value: filters.targetId },
      { field: 'target_type', operator: '==' as const, value: filters.targetType },
      { field: 'status', operator: '==' as const, value: filters.status }
    ]

    if (filters.parentId) {
      filtersArray.push({ field: 'parent_id', operator: '==' as const, value: filters.parentId })
    } else {
      filtersArray.push({ field: 'parent_id', operator: '==' as const, value: null })
    }

    if (filters.authorId) {
      filtersArray.push({ field: 'author_id', operator: '==' as const, value: filters.authorId })
    }

    const orderBy = [{
      field: 'created_at',
      direction: (filters.sortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
    }]

    const pagination = {
      limit: filters.limit || 10,
      offset: filters.offset || 0
    }

    const queryResult = await db().queryDocs<CommentRow>({
      collection: 'comments',
      filters: filtersArray,
      orderBy,
      pagination
    })

    if (!queryResult.success) {
      if (queryResult.metadata?.operation === 'initialize') {
        return NextResponse.json({ success: false, error: 'Database initialization failed' }, { status: 500 })
      }
      return NextResponse.json({ success: false, error: 'Failed to query comments' }, { status: 500 })
    }

    const comments = queryResult.data.map((comment) => ({
      ...comment,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      editedAt: comment.edited_at,
    }))

    return NextResponse.json({
      success: true,
      data: comments,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: comments.length,
      },
      filters,
    })

  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 })
  }
}

/**
 * POST /api/comments
 * Create a new comment
 */
export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const formData: CommentFormData = await request.json()

    if (!formData.content || !formData.targetId || !formData.targetType) {
      return NextResponse.json({ error: 'Content, targetId, and targetType are required' }, { status: 400 })
    }

    if (formData.content.length > 2000) {
      return NextResponse.json({ error: 'Comment content too long (max 2000 characters)' }, { status: 400 })
    }

    let targetCollection = ''
    switch (formData.targetType) {
      case 'news': targetCollection = 'news'; break
      case 'entity': targetCollection = 'entities'; break
      case 'opportunity': targetCollection = 'opportunities'; break
      case 'comment': targetCollection = 'comments'; break
      default:
        return NextResponse.json({ error: 'Invalid target type' }, { status: 400 })
    }

    const targetResult = await db().readDoc<CommentRow>(targetCollection, formData.targetId)
    if (!targetResult.success || !targetResult.data) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    let level = 0
    if (formData.parentId) {
      const parentResult = await db().readDoc<CommentRow>('comments', formData.parentId)
      if (!parentResult.success || !parentResult.data) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
      }
      level = ((parentResult.data.level as number) || 0) + 1
      if (level > 3) {
        return NextResponse.json({ error: 'Comment nesting too deep (max 3 levels)' }, { status: 400 })
      }
    }

    const commentId = crypto.randomUUID()

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

    const createResult = await db().createDoc('comments', newComment, { id: commentId })
    if (!createResult.success) {
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
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

    return NextResponse.json({
      success: true,
      data: commentData,
      message: 'Comment created successfully',
    })

  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}

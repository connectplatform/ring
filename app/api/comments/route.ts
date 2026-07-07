import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { CommentFormData, CommentFilters } from '@/features/comments/types'

type CommentRow = Record<string, unknown> & { id: string }

// ---------------------------------------------------------------------------
// Create-comment schema — validates the body at the route layer.
// targetType enum matches CommentTargetType; content capped at 2000 chars.
// ---------------------------------------------------------------------------
const createCommentSchema = z.object({
  content: z.string().min(1, 'content is required').max(2000, 'Comment content too long (max 2000 characters)'),
  targetId: z.string().min(1, 'targetId is required'),
  targetType: z.enum(['news', 'entity', 'opportunity', 'comment']),
  parentId: z.string().optional(),
}).passthrough()

/**
 * GET /api/comments
 * Fetch comments with optional filtering and pagination
 */
export async function GET(request: NextRequest) {
  await connection() // Establish database connection

  try {
    // Extract search parameters from request URL
    const { searchParams } = new URL(request.url)
    
    // Build filters object from search params, providing defaults
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

    // Enforce required parameter
    if (!filters.targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
    }

    // Prepare backend filters syntax
    const filtersArray = [
      { field: 'target_id', operator: '==' as const, value: filters.targetId },
      { field: 'target_type', operator: '==' as const, value: filters.targetType },
      { field: 'status', operator: '==' as const, value: filters.status }
    ]

    // Filter either by parentId or for root comments (parent_id=null)
    if (filters.parentId) {
      filtersArray.push({ field: 'parent_id', operator: '==' as const, value: filters.parentId })
    } else {
      filtersArray.push({ field: 'parent_id', operator: '==' as const, value: null })
    }

    // Optionally filter by author
    if (filters.authorId) {
      filtersArray.push({ field: 'author_id', operator: '==' as const, value: filters.authorId })
    }

    // Use sort info; NOTE: server side ignores sortBy (only sort on created_at)
    const orderBy = [{
      field: 'created_at',
      direction: (filters.sortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
    }]
    // TODO: Allow sorting on all allowed columns (if Next16/React19 features allow)

    // Prepare pagination arguments
    const pagination = {
      limit: filters.limit || 10,
      offset: filters.offset || 0
    }

    // Query the database for comments with provided filters, sorting, and pagination
    const queryResult = await db().queryDocs<CommentRow>({
      collection: 'comments',
      filters: filtersArray,
      orderBy,
      pagination
    })

    // Handle errors from DB query
    if (!queryResult.success) {
      if (queryResult.metadata?.operation === 'initialize') {
        return NextResponse.json({ success: false, error: 'Database initialization failed' }, { status: 500 })
      }
      return NextResponse.json({ success: false, error: 'Failed to query comments' }, { status: 500 })
    }

    // Format DB results for the response; convert snake_case to camelCase for client
    const comments = queryResult.data.map((comment) => ({
      ...comment,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      editedAt: comment.edited_at,
    }))

    // Return comments, pagination info, and active filters
    return NextResponse.json({
      success: true,
      data: comments,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: comments.length, // TODO: Implement accurate total count for pagination if DB supports it
      },
      filters,
    })

  } catch (error) {
    // Log and report errors
    console.error('Error fetching comments:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 })
  }
}

/**
 * POST /api/comments
 * Create a new comment after authentication and validation checks
 */
export async function POST(request: NextRequest) {
  await connection() // Establish database connection

  try {
    // Validate user authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Parse and validate incoming comment data with Zod
    const raw = await request.json()
    const parsed = createCommentSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Content, targetId, and targetType are required' },
        { status: 400 },
      )
    }

    const formData: CommentFormData = parsed.data

    // Map validated targetType to the correct collection (enum already constrains values)
    const targetCollectionMap: Record<string, string> = {
      news: 'news',
      entity: 'entities',
      opportunity: 'opportunities',
      comment: 'comments',
    }
    const targetCollection = targetCollectionMap[formData.targetType]!

    // Confirm the target (article/entity/etc.) exists
    const targetResult = await db().readDoc<CommentRow>(targetCollection, formData.targetId)
    if (!targetResult.success || !targetResult.data) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    // If replying, verify parent comment and set thread level (max 3)
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

    // Generate new comment ID
    const commentId = crypto.randomUUID()

    // Construct the comment object for insertion
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

    // Store new comment in the database
    const createResult = await db().createDoc('comments', newComment, { id: commentId })
    if (!createResult.success) {
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
    }

    // Optional: increment parent's reply count if this is a reply
    if (formData.parentId) {
      const parentResult = await db().readDoc<CommentRow>('comments', formData.parentId)
      // TODO: Use a DB atomic/mutation update if available (Next16 Data Functions etc.)
      if (parentResult.success && parentResult.data) {
        await db().updateDoc('comments', formData.parentId, {
          ...parentResult.data,
          replies: ((parentResult.data.replies as number) || 0) + 1,
          updated_at: new Date(),
        })
      }
    }

    // Increment the comment count for the target (post/entity/etc.)
    const targetData = targetResult.data
    await db().updateDoc(targetCollection, formData.targetId, {
      ...targetData,
      comments: ((targetData.comments as number) || 0) + 1,
      updated_at: new Date(),
    })

    // Build response object using camelCase keys for UI
    const commentData = {
      id: commentId,
      ...newComment,
      createdAt: newComment.created_at,
      updatedAt: newComment.updated_at,
      editedAt: null,
    }

    // Respond with the created comment
    return NextResponse.json({
      success: true,
      data: commentData,
      message: 'Comment created successfully',
    })

  } catch (error) {
    // Log and report errors
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}

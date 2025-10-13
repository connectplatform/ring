import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDatabaseService, initializeDatabase } from '@/lib/database'
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

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return NextResponse.json(
        { success: false, error: 'Database initialization failed' },
        { status: 500 }
      );
    }

    const dbService = getDatabaseService();

    // Build filters for database query
    const filtersArray = [
      { field: 'target_id', operator: '==' as const, value: filters.targetId },
      { field: 'target_type', operator: '==' as const, value: filters.targetType },
      { field: 'status', operator: '==' as const, value: filters.status }
    ];

    // Add parent filter for nested comments
    if (filters.parentId) {
      filtersArray.push({ field: 'parent_id', operator: '==' as const, value: filters.parentId });
    } else {
      // Only top-level comments (no parent)
      filtersArray.push({ field: 'parent_id', operator: '==' as const, value: null });
    }

    // Add author filter if specified
    if (filters.authorId) {
      filtersArray.push({ field: 'author_id', operator: '==' as const, value: filters.authorId });
    }

    // Build order by
    const orderBy = [{
      field: filters.sortBy === 'createdAt' ? 'created_at' : 'created_at',
      direction: (filters.sortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
    }];

    // Build pagination
    const pagination = {
      limit: filters.limit || 10,
      offset: filters.offset || 0
    };

    // Execute query
    const queryResult = await dbService.query({
      collection: 'comments',
      filters: filtersArray,
      orderBy,
      pagination
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to query comments' },
        { status: 500 }
      );
    }

    const comments = queryResult.data.map(comment => ({
      id: comment.id,
      ...comment.data,
      createdAt: comment.data?.created_at,
      updatedAt: comment.data?.updated_at,
      editedAt: comment.data?.edited_at,
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

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return NextResponse.json(
        { error: 'Database initialization failed' },
        { status: 500 }
      );
    }

    const dbService = getDatabaseService();

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
        return NextResponse.json(
          { error: 'Invalid target type' },
          { status: 400 }
        )
    }

    // Check if target exists
    const targetResult = await dbService.read(targetCollection, formData.targetId);
    if (!targetResult.success || !targetResult.data) {
      return NextResponse.json(
        { error: 'Target not found' },
        { status: 404 }
      );
    }

    // Determine comment level
    let level = 0
    if (formData.parentId) {
      const parentResult = await dbService.read('comments', formData.parentId);
      if (!parentResult.success || !parentResult.data) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }
      const parentData = parentResult.data.data || parentResult.data;
      level = (parentData?.level || 0) + 1;

      // Limit nesting depth
      if (level > 3) {
        return NextResponse.json(
          { error: 'Comment nesting too deep (max 3 levels)' },
          { status: 400 }
        );
      }
    }

    // Generate comment ID
    const commentId = crypto.randomUUID();

    const newComment = {
      content: formData.content.trim(),
      author_id: session.user.id,
      author_name: session.user.name || 'Anonymous',
      author_avatar: session.user.image || null,
      target_id: formData.targetId,
      target_type: formData.targetType,
      parent_id: formData.parentId || null,
      level: level,
      likes: 0,
      replies: 0,
      status: 'active',
      is_edited: false,
      is_pinned: false,
      created_at: new Date(),
      updated_at: new Date(),
    }

    // Create the comment
    const createResult = await dbService.create('comments', newComment, { id: commentId });
    if (!createResult.success) {
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    // Update parent comment reply count
    if (formData.parentId) {
      const parentResult = await dbService.read('comments', formData.parentId);
      if (parentResult.success && parentResult.data) {
        const parentData = parentResult.data.data || parentResult.data;
        const updatedParentData = {
          ...parentData,
          replies: (parentData?.replies || 0) + 1,
          updated_at: new Date()
        };
        await dbService.update('comments', formData.parentId, updatedParentData);
      }
    }

    // Update target's comment count
    const targetData = targetResult.data.data || targetResult.data;
    const updatedTargetData = {
      ...targetData,
      comments: (targetData?.comments || 0) + 1,
      updated_at: new Date()
    };
    await dbService.update(targetCollection, formData.targetId, updatedTargetData);

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
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
} 
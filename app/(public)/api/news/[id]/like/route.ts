import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { getDatabaseService, initializeDatabase } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: newsId } = params
    const userId = session.user.id

    if (!newsId) {
      return NextResponse.json(
        { error: 'Invalid news ID' },
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

    // Check if news article exists
    const newsResult = await dbService.read('news', newsId);

    if (!newsResult.success || !newsResult.data) {
      return NextResponse.json(
        { error: 'News article not found' },
        { status: 404 }
      );
    }

    const newsData = newsResult.data.data || newsResult.data;

    // Check if user already liked this article
    const likeQueryResult = await dbService.query({
      collection: 'news_likes',
      filters: [
        { field: 'news_id', operator: '==' as const, value: newsId },
        { field: 'user_id', operator: '==' as const, value: userId }
      ],
      pagination: { limit: 1 }
    });

    const existingLike = likeQueryResult.success && likeQueryResult.data.length > 0;
    const currentLikes = newsData?.likes || 0;

    let newLikeCount: number;
    let isNowLiked: boolean;

    if (existingLike) {
      // Remove like
      const likeId = likeQueryResult.data[0].id;
      await dbService.delete('news_likes', likeId);

      // Decrement like count
      const updatedNewsData = {
        ...newsData,
        likes: Math.max(0, currentLikes - 1),
        updated_at: new Date()
      };

      await dbService.update('news', newsId, updatedNewsData);

      newLikeCount = Math.max(0, currentLikes - 1);
      isNowLiked = false;
    } else {
      // Add like
      const likeData = {
        news_id: newsId,
        user_id: userId,
        created_at: new Date()
      };

      await dbService.create('news_likes', likeData);

      // Increment like count
      const updatedNewsData = {
        ...newsData,
        likes: currentLikes + 1,
        updated_at: new Date()
      };

      await dbService.update('news', newsId, updatedNewsData);

      newLikeCount = currentLikes + 1;
      isNowLiked = true;
    }

    return NextResponse.json({
      success: true,
      liked: isNowLiked,
      likeCount: newLikeCount,
      message: isNowLiked ? 'Article liked' : 'Article unliked'
    })

  } catch (error) {
    console.error('Error toggling news like:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    const { id: newsId } = params

    if (!newsId) {
      return NextResponse.json(
        { error: 'Invalid news ID' },
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

    // Get news article
    const newsResult = await dbService.read('news', newsId);

    if (!newsResult.success || !newsResult.data) {
      return NextResponse.json(
        { error: 'News article not found' },
        { status: 404 }
      );
    }

    const newsData = newsResult.data.data || newsResult.data;
    let isLiked = false

    // Check if current user liked this article
    if (session?.user?.id) {
      const likeQueryResult = await dbService.query({
        collection: 'news_likes',
        filters: [
          { field: 'news_id', operator: '==' as const, value: newsId },
          { field: 'user_id', operator: '==' as const, value: session.user.id }
        ],
        pagination: { limit: 1 }
      });

      isLiked = likeQueryResult.success && likeQueryResult.data.length > 0;
    }

    return NextResponse.json({
      likeCount: newsData?.likes || 0,
      isLiked,
      success: true
    })

  } catch (error) {
    console.error('Error fetching news likes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
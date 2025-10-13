import { auth } from '@/auth';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

/**
 * Gets the like status for a news article for the current authenticated user.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and gets their session.
 * 2. Validates the news article exists.
 * 3. Checks if the user has liked the article.
 * 4. Returns the like count and user's like status.
 * 
 * @param {string} newsId - The ID of the news article to check.
 * @returns {Promise<{ likeCount: number; isLiked: boolean }>} A promise that resolves to the like status.
 * @throws {Error} If the news article is not found or if there's an error accessing the database.
 */
export async function getNewsLikeStatus(newsId: string): Promise<{ likeCount: number; isLiked: boolean }> {
  try {
    console.log('Services: getNewsLikeStatus - Starting...', { newsId });

    // Step 1: Get session (optional for like status - can be viewed without auth)
    const session = await auth();
    console.log('Services: getNewsLikeStatus - Session checked', {
      hasSession: !!session,
      userId: session?.user?.id
    });

    // Step 2: Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      console.error('Services: getNewsLikeStatus - Database initialization failed:', initResult.error);
      throw new Error('Database initialization failed');
    }

    const dbService = getDatabaseService();

    // Step 3: Get news article from database
    const newsResult = await dbService.read('news', newsId);

    if (!newsResult.success || !newsResult.data) {
      console.error('Services: getNewsLikeStatus - News article not found', { newsId });
      throw new Error('News article not found');
    }

    const newsData = newsResult.data.data || newsResult.data;
    const likeCount = newsData?.likes || 0;

    // Step 4: Check if current user liked this article (if authenticated)
    let isLiked = false;
    if (session?.user?.id) {
      // Query news_likes table for user's like
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

    console.log('Services: getNewsLikeStatus - Like status retrieved', {
      newsId,
      likeCount,
      isLiked,
      hasUser: !!session?.user?.id
    });

    return { likeCount, isLiked };

  } catch (error) {
    console.error('Services: getNewsLikeStatus - Error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while fetching news like status');
  }
}

import { getServerAuthSession } from '@/auth';
import { getNewsCollection } from '@/lib/firestore-collections';
import { getFirestore } from 'firebase-admin/firestore';

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
    const session = await getServerAuthSession();
    console.log('Services: getNewsLikeStatus - Session checked', { 
      hasSession: !!session, 
      userId: session?.user?.id 
    });

    // Step 2: Validate news article exists and get like count
    const newsCollection = getNewsCollection();
    const newsDoc = await newsCollection.doc(newsId).get();

    if (!newsDoc.exists) {
      console.error('Services: getNewsLikeStatus - News article not found', { newsId });
      throw new Error('News article not found');
    }

    const newsData = newsDoc.data();
    const likeCount = newsData?.likes || 0;

    // Step 3: Check if current user liked this article (if authenticated)
    let isLiked = false;
    if (session?.user?.id) {
      const db = getFirestore();
      const userLike = await db.collection('news_likes')
        .where('newsId', '==', newsId)
        .where('userId', '==', session.user.id)
        .get();
      
      isLiked = !userLike.empty;
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

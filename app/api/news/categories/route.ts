import { NextRequest, NextResponse } from 'next/server';
import { getNewsCategoriesCollection } from '@/lib/firestore-collections';

/**
 * GET /api/news/categories
 * Fetch all news categories
 */
export async function GET(request: NextRequest) {
  try {
    const categoriesCollection = getNewsCategoriesCollection();
    const snapshot = await categoriesCollection.orderBy('name', 'asc').get();
    
    const categories = snapshot.docs.map(doc => doc.data());

    return NextResponse.json({
      success: true,
      data: categories,
    });

  } catch (error) {
    console.error('Error fetching news categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news categories' },
      { status: 500 }
    );
  }
} 
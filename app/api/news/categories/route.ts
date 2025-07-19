import { NextRequest, NextResponse } from 'next/server';
import { getNewsCategoriesCollection } from '@/lib/firestore-collections';
import { auth } from '@/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { NewsCategoryInfo, NewsCategory } from '@/features/news/types';

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

/**
 * POST /api/news/categories
 * Create a new news category (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { name, description, color, icon } = await request.json();

    // Validate required fields
    if (!name || !color || !icon) {
      return NextResponse.json(
        { success: false, error: 'Name, color, and icon are required' },
        { status: 400 }
      );
    }

    // Validate name format (should be kebab-case for NewsCategory)
    const categoryId = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() as NewsCategory;

    const categoriesCollection = getNewsCategoriesCollection();
    
    // Check if category already exists
    const existingCategory = await categoriesCollection.doc(categoryId).get();
    if (existingCategory.exists) {
      return NextResponse.json(
        { success: false, error: 'Category with this name already exists' },
        { status: 400 }
      );
    }

    // Create new category with all required fields
    const newCategory = {
      id: categoryId,
      name: name.trim(),
      description: description?.trim() || '',
      color: color.trim(),
      icon: icon.trim(),
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
    };

    await categoriesCollection.doc(categoryId).set(newCategory);

    const createdCategory = await categoriesCollection.doc(categoryId).get();

    return NextResponse.json({
      success: true,
      data: { id: categoryId, ...createdCategory.data() },
      message: 'Category created successfully',
    });

  } catch (error) {
    console.error('Error creating news category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create news category' },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse, connection} from 'next/server';
import {
  initializeDatabase,
  getDatabaseService,
} from '@/lib/database/DatabaseService';
import { NewsFormData } from '@/features/news/types';
import { auth } from '@/auth';

/**
 * GET /api/news/[id]
 * Fetch a specific news article by ID or slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const { id } = params;

    await initializeDatabase();
    const db = getDatabaseService();

    // Try to find by document ID first
    let articleResult = await db.read('news', id);
    let articleId = id;

    // If not found by ID, try to find by slug
    if (!articleResult.success || !articleResult.data) {
      const slugResult = await db.query({ collection: 'news' });
      // Filter by slug manually since query API may not support where clauses yet
      const slugMatch = slugResult.success && slugResult.data ?
        slugResult.data.find((doc: any) => doc.slug === id) : null;
      if (slugMatch) {
        articleResult = { success: true, data: slugMatch };
        articleId = slugMatch.id;
      }
      if (slugResult.success && slugResult.data && slugResult.data.length > 0) {
        articleResult = { success: true, data: slugResult.data[0] };
        articleId = slugResult.data[0].id;
      }
    }

    if (!articleResult.success || !articleResult.data) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    const article = articleResult.data;
    if (!article) {
      return NextResponse.json(
        { success: false, error: 'News article data not found' },
        { status: 404 }
      );
    }

    // Increment view count
    const currentViews = (article as any).views || 0;
    await db.update('news', articleId, {
      views: currentViews + 1,
      updatedAt: new Date(),
    });

    // Update the article data with incremented views
    (article as any).views = currentViews + 1;

    return NextResponse.json({
      success: true,
      data: article,
    });

  } catch (error) {
    console.error('Error fetching news article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news article' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/news/[id]
 * Update a specific news article (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const userRole = (session.user as any).role;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { id } = params;
    const formData: Partial<NewsFormData> = await request.json();

    await initializeDatabase();
    const db = getDatabaseService();

    const articleResult = await db.read('news', id);

    if (!articleResult.success || !articleResult.data) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update fields if provided
    if (formData.title !== undefined) updateData.title = formData.title;
    if (formData.content !== undefined) updateData.content = formData.content;
    if (formData.excerpt !== undefined) updateData.excerpt = formData.excerpt;
    if (formData.category !== undefined) updateData.category = formData.category;
    if (formData.tags !== undefined) updateData.tags = formData.tags;
    if (formData.featuredImage !== undefined) updateData.featuredImage = formData.featuredImage;
    if (formData.gallery !== undefined) updateData.gallery = formData.gallery;
    if (formData.visibility !== undefined) updateData.visibility = formData.visibility;
    if (formData.featured !== undefined) updateData.featured = formData.featured;
    if (formData.seo !== undefined) updateData.seo = formData.seo;

    // Handle status change
    if (formData.status !== undefined) {
      updateData.status = formData.status;
      
      // Set publishedAt when publishing
      if (formData.status === 'published' && !(articleResult.data as any).publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    // Handle slug update
    if (formData.slug !== undefined) {
      // Check if new slug already exists (excluding current article)
      const existingSlugResult = await db.query({ collection: 'news' });
      const slugExists = existingSlugResult.success && existingSlugResult.data &&
        existingSlugResult.data.some((doc: any) => doc.slug === formData.slug && doc.id !== id);
      if (slugExists) {
        return NextResponse.json(
          { success: false, error: 'Article with this slug already exists' },
          { status: 400 }
        );
      }
      updateData.slug = formData.slug;
    }

    // Update the article
    await db.update('news', id, updateData);

    // Fetch updated article
    const updatedResult = await db.read('news', id);

    return NextResponse.json({
      success: true,
      data: updatedResult.data,
      message: 'News article updated successfully',
    });

  } catch (error) {
    console.error('Error updating news article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update news article' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/news/[id]
 * Delete a specific news article (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const userRole = (session.user as any).role;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { id } = params;

    await initializeDatabase();
    const db = getDatabaseService();

    const articleResult = await db.read('news', id);

    if (!articleResult.success || !articleResult.data) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    // Delete the article
    await db.delete('news', id);

    return NextResponse.json({
      success: true,
      message: 'News article deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting news article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete news article' },
      { status: 500 }
    );
  }
}
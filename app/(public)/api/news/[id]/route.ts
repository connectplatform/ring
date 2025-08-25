import { NextRequest, NextResponse } from 'next/server';
import { 
  getCachedDocument,
  getCachedNewsBySlug,
  getCachedCollectionAdvanced,
  updateDocument,
  deleteDocument
} from '@/lib/services/firebase-service-manager';
import { NewsFormData } from '@/features/news/types';
import { auth } from '@/auth';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/news/[id]
 * Fetch a specific news article by ID or slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Try to find by document ID first
    let articleDoc = await getCachedDocument('news', id);
    let articleId = id;
    
    // If not found by ID, try to find by slug
    if (!articleDoc || !articleDoc.exists) {
      const slugDoc = await getCachedNewsBySlug(id);
      if (slugDoc && slugDoc.exists) {
        articleDoc = slugDoc;
        articleId = slugDoc.id;
      }
    }

    if (!articleDoc || !articleDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    const article = articleDoc.data();
    if (!article) {
      return NextResponse.json(
        { success: false, error: 'News article data not found' },
        { status: 404 }
      );
    }

    // Increment view count using firebase-service-manager
    await updateDocument('news', articleId, {
      views: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update the article data with incremented views
    article.views = (article.views || 0) + 1;

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

    const articleDoc = await getCachedDocument('news', id);

    if (!articleDoc || !articleDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
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
      if (formData.status === 'published' && !articleDoc.data()?.publishedAt) {
        updateData.publishedAt = FieldValue.serverTimestamp();
      }
    }

    // Handle slug update
    if (formData.slug !== undefined) {
      // Check if new slug already exists (excluding current article)
      const existingSlugSnapshot = await getCachedCollectionAdvanced('news', {
        where: [{ field: 'slug', operator: '==', value: formData.slug }]
      });
      
      const slugExists = existingSlugSnapshot.docs.some(doc => doc.id !== id);
      if (slugExists) {
        return NextResponse.json(
          { success: false, error: 'Article with this slug already exists' },
          { status: 400 }
        );
      }
      updateData.slug = formData.slug;
    }

    // Update the article using firebase-service-manager
    await updateDocument('news', id, updateData);
    
    // Fetch updated article
    const updatedDoc = await getCachedDocument('news', id);

    return NextResponse.json({
      success: true,
      data: updatedDoc.data(),
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
    const articleDoc = await getCachedDocument('news', id);

    if (!articleDoc || !articleDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    // Delete the article using firebase-service-manager
    await deleteDocument('news', id);

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
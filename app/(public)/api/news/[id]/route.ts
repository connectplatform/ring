import { NextRequest, NextResponse } from 'next/server';
import { getNewsCollection } from '@/lib/firestore-collections';
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
    const newsCollection = getNewsCollection();

    // Try to find by document ID first
    let articleDoc = await newsCollection.doc(id).get();
    
    // If not found by ID, try to find by slug
    if (!articleDoc.exists) {
      const slugQuery = await newsCollection.where('slug', '==', id).limit(1).get();
      if (!slugQuery.empty) {
        articleDoc = slugQuery.docs[0];
      }
    }

    if (!articleDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    const article = articleDoc.data();

    // Increment view count
    await articleDoc.ref.update({
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

    const newsCollection = getNewsCollection();
    const articleDoc = await newsCollection.doc(id).get();

    if (!articleDoc.exists) {
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
      const existingSlug = await newsCollection
        .where('slug', '==', formData.slug)
        .get();
      
      const slugExists = existingSlug.docs.some(doc => doc.id !== id);
      if (slugExists) {
        return NextResponse.json(
          { success: false, error: 'Article with this slug already exists' },
          { status: 400 }
        );
      }
      updateData.slug = formData.slug;
    }

    // Update the article
    await articleDoc.ref.update(updateData);
    
    // Fetch updated article
    const updatedDoc = await articleDoc.ref.get();

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
    const newsCollection = getNewsCollection();
    const articleDoc = await newsCollection.doc(id).get();

    if (!articleDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    // Delete the article
    await articleDoc.ref.delete();

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
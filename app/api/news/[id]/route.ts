import { NextRequest, NextResponse, connection} from 'next/server';
import { 
  getCachedDocument,
  getCachedNewsBySlug,
  getCachedCollectionAdvanced,
  updateDocument,
  deleteDocument
} from '@/lib/services/firebase-service-manager';
import { NewsFormData } from '@/features/news/types';
import { auth } from '@/auth';
import { isSuperadmin } from '@/features/auth/user-role';
import { canEditNewsArticle, canDeleteNewsArticle, canSetNewsVisibility } from '@/features/news/lib/news-permissions';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/news/[id]
 * Fetch a specific news article by ID or slug
 */
export async function GET(
  request: NextRequest, context: { params: Promise<{ id: string }> }
) {
  await connection() // Next.js 16: opt out of prerendering

  const { id } = await context.params

  try {
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

    // Soft-deleted articles are hidden from all except superadmin
    if (article.status === 'deleted') {
      const session = await auth();
      const userRole = (session?.user as any)?.role;
      if (!isSuperadmin(userRole)) {
        return NextResponse.json(
          { success: false, error: 'News article not found' },
          { status: 404 }
        );
      }
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
 * Update a specific news article (admin or article author — field-level guards for visibility)
 */
export async function PUT(
  request: NextRequest, context: { params: Promise<{ id: string }> }
) {
  await connection() // Next.js 16: opt out of prerendering

  const { id } = await context.params

  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData: Partial<NewsFormData> = await request.json();

    const articleDoc = await getCachedDocument('news', id);

    if (!articleDoc || !articleDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    const articleData = articleDoc.data();
    if (!articleData) {
      return NextResponse.json(
        { success: false, error: 'News article data not found' },
        { status: 404 }
      );
    }

    // Check if user is admin OR the article author
    const userRole = (session.user as any).role;
    const userId = session.user.id || session.user.email || '';
    if (!canEditNewsArticle(userRole, String(articleData.authorId ?? ''), userId)) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to edit this article' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Update fields if provided — all safe for article authors
    if (formData.title !== undefined) updateData.title = formData.title;
    if (formData.content !== undefined) updateData.content = formData.content;
    if (formData.excerpt !== undefined) updateData.excerpt = formData.excerpt;
    if (formData.category !== undefined) updateData.category = formData.category;
    if (formData.tags !== undefined) updateData.tags = formData.tags;
    if (formData.featuredImage !== undefined) updateData.featuredImage = formData.featuredImage;
    if (formData.gallery !== undefined) updateData.gallery = formData.gallery;
    if (formData.seo !== undefined) updateData.seo = formData.seo;
    if (formData.featured !== undefined) updateData.featured = formData.featured;

    // Visibility — role-aware via canSetNewsVisibility (confidential/site-wide blocked for non-privileged)
    if (formData.visibility !== undefined) {
      if (!canSetNewsVisibility(userRole, formData.visibility)) {
        return NextResponse.json(
          { success: false, error: 'Access denied. Your role cannot set this news visibility level.' },
          { status: 403 }
        );
      }
      updateData.visibility = formData.visibility;
    }

    // Status — article author manages their own lifecycle
    if (formData.status !== undefined) {
      updateData.status = formData.status;
      
      // Set publishedAt when publishing
      if (formData.status === 'published' && !articleData.publishedAt) {
        updateData.publishedAt = FieldValue.serverTimestamp();
      }
    }

    // Slug — author can update with uniqueness check
    if (formData.slug !== undefined) {
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

    // Invalidate news-stats cache + revalidate admin paths
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId: id,
      event: formData.status === 'published' ? 'published' : 'updated',
    })

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
 * Delete a specific news article (admin or the article author)
 */
export async function DELETE(
  request: NextRequest, context: { params: Promise<{ id: string }> }
) {
  await connection() // Next.js 16: opt out of prerendering

  const { id } = await context.params

  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const articleDoc = await getCachedDocument('news', id);

    if (!articleDoc || !articleDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'News article not found' },
        { status: 404 }
      );
    }

    const articleData = articleDoc.data();
    if (!articleData) {
      return NextResponse.json(
        { success: false, error: 'News article data not found' },
        { status: 404 }
      );
    }

    // Check if user is admin OR the article author
    const userRole = (session.user as any).role;
    const userId = session.user.id || session.user.email || '';
    if (!canDeleteNewsArticle(userRole, String(articleData.authorId ?? ''), userId)) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to delete this article' },
        { status: 403 }
      );
    }

    // Soft delete: mark as deleted for forensics (6-month retention before final purge)
    await updateDocument('news', id, {
      status: 'deleted' as NewsFormData['status'],
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: session.user.id || session.user.email || '',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Invalidate news-stats cache + revalidate admin paths
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId: id,
      event: 'deleted',
    })

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
import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { assertKnownUserRole, isSuperadmin } from '@/features/auth/user-role';
import { canCreateNewsArticle } from '@/features/news/lib/news-permissions';
import { revalidatePath } from 'next/cache';
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination';
import { db } from '@/lib/database';
import { NewsFilters, NewsFormData } from '@/features/news/types';
import { mapNewsDocument } from '@/lib/news/map-news-document';

type NewsRow = Record<string, unknown> & { id: string };

/**
 * GET /api/news
 * Fetch news articles with optional filtering
 */
export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth();
    const userRole = session?.user?.role
      ? assertKnownUserRole(session.user.role)
      : null;
    const isSuperAdmin = userRole ? isSuperadmin(userRole) : false;

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const filters: NewsFilters = {
      category: searchParams.get('category') as any || undefined,
      status: searchParams.get('status') as any || 'published',
      visibility: searchParams.get('visibility') as any || undefined,
      featured: searchParams.get('featured') === 'true' ? true : undefined,
      authorId: searchParams.get('authorId') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '10'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: searchParams.get('sortBy') as any || 'publishedAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc',
    };

    const startAfter = searchParams.get('startAfter') || undefined;
    const useCursorPagination = Boolean(startAfter) || searchParams.get('pagination') === 'cursor';

    // Parse tags if provided
    const tagsParam = searchParams.get('tags');
    if (tagsParam) {
      filters.tags = tagsParam.split(',').map(tag => tag.trim());
    }

    // Build query filters
    const queryFilters: Array<{ field: string; operator: string; value: unknown }> = [];

    if (filters.category) {
      queryFilters.push({ field: 'category', operator: '==', value: filters.category });
    }

    if (filters.status) {
      queryFilters.push({ field: 'status', operator: '==', value: filters.status });
    } else {
      // Exclude deleted articles from default listing (superadmin can explicitly query status=deleted)
      queryFilters.push({ field: 'status', operator: '!=', value: 'deleted' });
    }

    if (filters.visibility) {
      queryFilters.push({ field: 'visibility', operator: '==', value: filters.visibility });
    }

    if (filters.featured !== undefined) {
      queryFilters.push({ field: 'featured', operator: '==', value: filters.featured });
    }

    if (filters.authorId) {
      queryFilters.push({ field: 'authorId', operator: '==', value: filters.authorId });
    }

    const sortField = filters.sortBy || 'publishedAt';

    if (startAfter) {
      try {
        const cursorResult = await db().findDocById('news', startAfter);
        if (cursorResult.success && cursorResult.data) {
          const cursorValue = cursorResult.data[sortField];
          if (cursorValue !== undefined && cursorValue !== null) {
            queryFilters.push({
              field: sortField,
              operator: filters.sortOrder === 'asc' ? '>' : '<',
              value: cursorValue,
            });
          }
        }
      } catch {
        /* first-page semantics */
      }
    }

    // Query database (READ - Server Component can cache)
    const result = await db().queryDocs<NewsRow>({
      collection: 'news',
      filters: queryFilters,
      orderBy: [{ field: sortField, direction: filters.sortOrder || 'desc' }],
      pagination: {
        limit: filters.limit || 10,
        offset: useCursorPagination ? 0 : (filters.offset || 0),
      },
    });

    if (!result.success) {
      throw result.error || new Error('Failed to fetch news articles')
    }

    let articles: NewsRow[] = (result.data ?? []).filter((article) => article.title);

    // Filter by search term if provided (client-side filtering for now)
    let filteredArticles = articles;
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredArticles = articles.filter(article =>
        (String(article.title || '')).toLowerCase().includes(searchTerm) ||
        (String(article.excerpt || '')).toLowerCase().includes(searchTerm) ||
        (String(article.content || '')).toLowerCase().includes(searchTerm) ||
        ((article.tags as string[]) || []).some((tag: string) => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Filter by tags if provided
    if (filters.tags && filters.tags.length > 0) {
      filteredArticles = filteredArticles.filter(article =>
        filters.tags!.some(tag => ((article.tags as string[]) || []).includes(tag))
      );
    }

    const limit = filters.limit || 10;
    const { nextCursor, hasMore } = computePaginationCursor(
      filteredArticles,
      limit,
      (article) => article.id,
    );

    const mappedArticles = filteredArticles.map((row) => mapNewsDocument(row));

    return NextResponse.json({
      success: true,
      data: mappedArticles,
      items: mappedArticles,
      cursor: hasMore ? nextCursor : null,
      hasMore,
      pagination: {
        limit,
        offset: useCursorPagination ? undefined : filters.offset,
        total: mappedArticles.length,
      },
      filters: filters,
    });

  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news articles' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/news
 * Create a new news article (admin only)
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin (you may need to adjust this based on your user role system)
    // For now, we'll assume the user role is stored in the session
    const userRole = assertKnownUserRole((session.user as { role?: string }).role);
    if (!canCreateNewsArticle(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to create news articles' },
        { status: 403 }
      );
    }

    const formData: NewsFormData = await request.json();

    // Validate required fields
    if (!formData.title || !formData.content || !formData.excerpt) {
      return NextResponse.json(
        { success: false, error: 'Title, content, and excerpt are required' },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    const slug = formData.slug || formData.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Check if slug already exists
    const slugResult = await db().queryDocs<NewsRow>({
      collection: 'news',
      filters: [{ field: 'slug', operator: '==', value: slug }],
      pagination: { limit: 1 }
    });

    if (slugResult.success && slugResult.data.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Article with this slug already exists' },
        { status: 400 }
      );
    }

    const now = new Date()
    const newArticle = {
      title: formData.title,
      slug: slug,
      content: formData.content,
      excerpt: formData.excerpt,
      authorId: session.user.id || session.user.email || '',
      authorName: session.user.name || 'Unknown Author',
      category: formData.category || 'other',
      tags: formData.tags || [],
      featuredImage: formData.featuredImage || null,
      featuredImageAsset: formData.featuredImageAsset || null,
      gallery: formData.gallery || [],
      status: formData.status || 'draft',
      visibility: formData.visibility || 'public',
      featured: formData.featured || false,
      views: 0,
      likes: 0,
      comments: 0,
      publishedAt: formData.status === 'published' ? now : null,
      createdAt: now,
      updatedAt: now,
      seo: formData.seo || null,
    };

    const createResult = await db().createDoc('news', newArticle);
    if (!createResult.success) {
      throw createResult.error || new Error('Failed to create news article')
    }

    // Revalidate (React 19 pattern - MUTATION!)
    revalidatePath('/[locale]/news')
    revalidatePath(`/[locale]/news/${slug}`)

    // Invalidate news-stats cache + revalidate admin paths
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId: createResult.data?.id,
      event: 'created',
    })

    return NextResponse.json({
      success: true,
      data: createResult.data,
      message: 'News article created successfully',
    });

  } catch (error) {
    console.error('Error creating news article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create news article' },
      { status: 500 }
    );
  }
}

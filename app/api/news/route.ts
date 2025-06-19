import { NextRequest, NextResponse } from 'next/server';
import { getNewsCollection } from '@/lib/firestore-collections';
import { NewsFilters, NewsFormData } from '@/features/news/types';
import { auth } from '@/auth';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/news
 * Fetch news articles with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse tags if provided
    const tagsParam = searchParams.get('tags');
    if (tagsParam) {
      filters.tags = tagsParam.split(',').map(tag => tag.trim());
    }

    const newsCollection = getNewsCollection();
    let query = newsCollection.orderBy(filters.sortBy || 'publishedAt', filters.sortOrder || 'desc');

    // Apply filters
    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }
    
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    
    if (filters.visibility) {
      query = query.where('visibility', '==', filters.visibility);
    }
    
    if (filters.featured !== undefined) {
      query = query.where('featured', '==', filters.featured);
    }
    
    if (filters.authorId) {
      query = query.where('authorId', '==', filters.authorId);
    }

    // Apply pagination
    if (filters.offset && filters.offset > 0) {
      query = query.offset(filters.offset);
    }
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    const articles = snapshot.docs.map(doc => doc.data());

    // Filter by search term if provided (client-side filtering for now)
    let filteredArticles = articles;
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredArticles = articles.filter(article => 
        article.title.toLowerCase().includes(searchTerm) ||
        article.excerpt.toLowerCase().includes(searchTerm) ||
        article.content.toLowerCase().includes(searchTerm) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Filter by tags if provided
    if (filters.tags && filters.tags.length > 0) {
      filteredArticles = filteredArticles.filter(article =>
        filters.tags!.some(tag => article.tags.includes(tag))
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredArticles,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: filteredArticles.length,
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
    const userRole = (session.user as any).role;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
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

    const newsCollection = getNewsCollection();
    
    // Check if slug already exists
    const existingSlug = await newsCollection.where('slug', '==', slug).get();
    if (!existingSlug.empty) {
      return NextResponse.json(
        { success: false, error: 'Article with this slug already exists' },
        { status: 400 }
      );
    }

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
      gallery: formData.gallery || [],
      status: formData.status || 'draft',
      visibility: formData.visibility || 'public',
      featured: formData.featured || false,
      views: 0,
      likes: 0,
      comments: 0,
      publishedAt: formData.status === 'published' ? FieldValue.serverTimestamp() : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      seo: formData.seo || null,
    };

    const docRef = await newsCollection.add(newArticle as any);
    const createdArticle = await docRef.get();

    return NextResponse.json({
      success: true,
      data: createdArticle.data(),
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
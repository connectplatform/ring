// News Service - Direct Firestore operations
// Extracted from API routes to follow Ring's architectural pattern:
// "Server Actions should call services directly; avoid HTTP requests to own API routes"

import { auth } from '@/auth'
import { getCachedNewsCollection, getCachedNewsBySlug, getCachedNewsById, createDocument, updateDocument, deleteDocument } from '@/lib/services/firebase-service-manager'
import { NewsFilters, NewsFormData, NewsArticle } from '@/features/news/types'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from '@/lib/logger'

interface CreateNewsResult {
  success: boolean
  data?: NewsArticle
  error?: string
  message?: string
}

interface UpdateNewsResult {
  success: boolean
  data?: NewsArticle
  error?: string
  message?: string
}

export async function createNewsArticle(formData: NewsFormData): Promise<CreateNewsResult> {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Check if user is admin (you may need to adjust this based on your user role system)
    const userRole = (session.user as any).role
    if (userRole !== 'admin') {
      return {
        success: false,
        error: 'Admin access required'
      }
    }

    // Validate required fields
    if (!formData.title || !formData.content || !formData.excerpt) {
      return {
        success: false,
        error: 'Title, content, and excerpt are required'
      }
    }

    // Generate slug if not provided
    const slug = formData.slug || formData.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Check if slug already exists
    const existingSlug = await getCachedNewsBySlug(slug)
    if (existingSlug) {
      return {
        success: false,
        error: 'Article with this slug already exists'
      }
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
    }

    const docRef = await createDocument('news', newArticle)
    const createdDoc = await getCachedNewsById(docRef.id)
    const createdArticle = createdDoc

    return {
      success: true,
      data: createdArticle.data() as NewsArticle,
      message: 'News article created successfully'
    }

  } catch (error) {
    logger.error('Error creating news article:', error)
    return {
      success: false,
      error: 'Failed to create news article'
    }
  }
}

export async function updateNewsArticle(articleId: string, formData: NewsFormData): Promise<UpdateNewsResult> {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Check if user is admin or article author
    const userRole = (session.user as any).role
    const articleDoc = await getCachedNewsById(articleId)
    
    if (!articleDoc || !articleDoc.exists) {
      return {
        success: false,
        error: 'Article not found'
      }
    }

    const articleData = articleDoc.data()
    const isAuthor = articleData?.authorId === session.user.id
    const isAdmin = userRole === 'admin'
    
    if (!isAuthor && !isAdmin) {
      return {
        success: false,
        error: 'Not authorized to edit this article'
      }
    }

    // Validate required fields
    if (!formData.title || !formData.content || !formData.excerpt) {
      return {
        success: false,
        error: 'Title, content, and excerpt are required'
      }
    }

    // Generate slug if changed
    const slug = formData.slug || formData.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Check if slug already exists (excluding current article)
    if (slug !== articleData?.slug) {
      const existingSlug = await getCachedNewsBySlug(slug)
      if (existingSlug) {
        return {
          success: false,
          error: 'Article with this slug already exists'
        }
      }
    }

    const updateData = {
      title: formData.title,
      slug: slug,
      content: formData.content,
      excerpt: formData.excerpt,
      category: formData.category || 'other',
      tags: formData.tags || [],
      featuredImage: formData.featuredImage || null,
      gallery: formData.gallery || [],
      status: formData.status || 'draft',
      visibility: formData.visibility || 'public',
      featured: formData.featured || false,
      publishedAt: formData.status === 'published' && !articleData?.publishedAt 
        ? FieldValue.serverTimestamp() 
        : articleData?.publishedAt,
      updatedAt: FieldValue.serverTimestamp(),
      seo: formData.seo || null,
    }

    await updateDocument('news', articleId, updateData)
    const updatedArticle = await getCachedNewsById(articleId)

    return {
      success: true,
      data: updatedArticle.data() as NewsArticle,
      message: 'News article updated successfully'
    }

  } catch (error) {
    logger.error('Error updating news article:', error)
    return {
      success: false,
      error: 'Failed to update news article'
    }
  }
}

export async function getNewsArticles(filters: NewsFilters = {}): Promise<{
  success: boolean
  data?: NewsArticle[]
  pagination?: any
  filters?: NewsFilters
  error?: string
}> {
  try {
    // Build query options for getCachedNewsCollection
    const options: any = {
      orderBy: [{ field: filters.sortBy || 'publishedAt', direction: filters.sortOrder || 'desc' }],
      where: []
    };

    // Apply filters
    if (filters.category) {
      options.where.push({ field: 'category', operator: '==', value: filters.category });
    }
    
    if (filters.status) {
      options.where.push({ field: 'status', operator: '==', value: filters.status });
    }
    
    if (filters.visibility) {
      options.where.push({ field: 'visibility', operator: '==', value: filters.visibility });
    }
    
    if (filters.featured !== undefined) {
      options.where.push({ field: 'featured', operator: '==', value: filters.featured });
    }
    
    if (filters.authorId) {
      options.where.push({ field: 'authorId', operator: '==', value: filters.authorId });
    }

    // Apply pagination (limit only, offset not supported by getCachedNewsCollection)
    if (filters.limit) {
      options.limit = filters.limit;
    }

    const snapshot = await getCachedNewsCollection(options)
    const articles = snapshot.docs.map(doc => doc.data() as NewsArticle)

    // Filter by search term if provided (client-side filtering for now)
    let filteredArticles = articles
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filteredArticles = articles.filter(article => 
        article.title.toLowerCase().includes(searchTerm) ||
        article.excerpt.toLowerCase().includes(searchTerm) ||
        article.content.toLowerCase().includes(searchTerm) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    }

    // Filter by tags if provided
    if (filters.tags && filters.tags.length > 0) {
      filteredArticles = filteredArticles.filter(article =>
        filters.tags!.some(tag => article.tags.includes(tag))
      )
    }

    return {
      success: true,
      data: filteredArticles,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: filteredArticles.length,
      },
      filters: filters,
    }

  } catch (error) {
      logger.error('Error fetching news:', error)
    return {
      success: false,
      error: 'Failed to fetch news articles'
    }
  }
}

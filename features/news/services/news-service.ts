// News Service - Ring-native DatabaseService implementation
// Server Actions pattern: Direct service calls, no HTTP routing

import { cache } from 'react'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { NewsFilters, NewsFormData, NewsArticle } from '@/features/news/types'
import { UserRole } from '@/features/auth/user-role'
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

// Author permission helper functions
function canCreateArticles(userRole: UserRole): boolean {
  return [UserRole.MEMBER, UserRole.CONFIDENTIAL, UserRole.ADMIN, UserRole.SUPERADMIN].includes(userRole)
}

function canEditArticle(userRole: UserRole, articleAuthorId: string, currentUserId: string): boolean {
  const isAdmin = [UserRole.ADMIN, UserRole.SUPERADMIN].includes(userRole)
  const isAuthor = articleAuthorId === currentUserId
  return isAdmin || isAuthor
}

function canDeleteArticle(userRole: UserRole, articleAuthorId: string, currentUserId: string): boolean {
  const isAdmin = [UserRole.ADMIN, UserRole.SUPERADMIN].includes(userRole)
  const isAuthor = articleAuthorId === currentUserId
  return isAdmin || isAuthor
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

    // Check if user can create articles (MEMBER+ roles)
    const userRole = (session.user as any).role as UserRole
    if (!canCreateArticles(userRole)) {
      return {
        success: false,
        error: 'MEMBER status or higher required to create articles'
      }
    }

    // Validate required fields
    if (!formData.title || !formData.content || !formData.excerpt) {
      return {
        success: false,
        error: 'Title, content, and excerpt are required'
      }
    }

    await initializeDatabase()
    const db = getDatabaseService()
    
    // Generate slug if not provided
    const slug = formData.slug || formData.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Check if slug already exists
    const slugResult = await db.query({
      collection: 'news',
      filters: [{ field: 'slug', operator: '==', value: slug }],
      pagination: { limit: 1 }
    })
    
    if (slugResult.success && slugResult.data.length > 0) {
      return {
        success: false,
        error: 'Article with this slug already exists'
      }
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
      locale: 'en', // Default to English, can be extended for multi-locale support
    }

    const createResult = await db.create('news', newArticle)
    if (!createResult.success) {
      throw createResult.error || new Error('Failed to create news article')
    }

    // Revalidate news pages (React 19 pattern - MUTATION!)

    return {
      success: true,
      data: createResult.data as any as NewsArticle,
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

    await initializeDatabase()
    const db = getDatabaseService()

    // Check if user can edit this article
    const userRole = (session.user as any).role as UserRole
    const articleResult = await db.read('news', articleId)

    if (!articleResult.success || !articleResult.data) {
      return {
        success: false,
        error: 'Article not found'
      }
    }

    const articleData = articleResult.data as any
    if (!canEditArticle(userRole, articleData?.authorId, session.user.id)) {
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
      const slugResult = await db.query({
        collection: 'news',
        filters: [{ field: 'slug', operator: '==', value: slug }],
        pagination: { limit: 1 }
      })
      
      if (slugResult.success && slugResult.data.length > 0) {
        return {
          success: false,
          error: 'Article with this slug already exists'
        }
      }
    }

    const now = new Date()
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
        ? now 
        : articleData?.publishedAt,
      updatedAt: now,
      seo: formData.seo || null,
    }

    const updateResult = await db.update('news', articleId, updateData)
    if (!updateResult.success) {
      throw updateResult.error || new Error('Failed to update news article')
    }

    // Revalidate news pages (React 19 pattern - MUTATION!)

    return {
      success: true,
      data: updateResult.data as any as NewsArticle,
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

/**
 * Get news articles with filters
 * READ operation - uses React 19 cache() for performance
 */
export const getNewsArticles = cache(async (filters: NewsFilters = {}): Promise<{
  success: boolean
  data?: NewsArticle[]
  pagination?: any
  filters?: NewsFilters
  error?: string
}> => {
  try {

    await initializeDatabase()
    const db = getDatabaseService()
    
    // Build query filters for DatabaseService
    const queryFilters: any[] = []
    
    if (filters.category) {
      queryFilters.push({ field: 'category', operator: '==', value: filters.category })
    }
    if (filters.status) {
      queryFilters.push({ field: 'status', operator: '==', value: filters.status })
    }
    if (filters.visibility) {
      queryFilters.push({ field: 'visibility', operator: '==', value: filters.visibility })
    }
    if (filters.featured !== undefined) {
      queryFilters.push({ field: 'featured', operator: '==', value: filters.featured })
    }
    if (filters.authorId) {
      queryFilters.push({ field: 'authorId', operator: '==', value: filters.authorId })
    }

    const queryResult = await db.query({
      collection: 'news',
      filters: queryFilters,
      orderBy: [{ field: filters.sortBy || 'publishedAt', direction: filters.sortOrder || 'desc' }],
      pagination: { limit: filters.limit || 50, offset: (filters as any).offset || 0 }
    })

    if (!queryResult.success) {
      throw queryResult.error || new Error('Failed to fetch news articles')
    }

    let articles = queryResult.data as any[] as NewsArticle[]

    // Server-side search filtering
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      articles = articles.filter(article => 
        article.title.toLowerCase().includes(searchTerm) ||
        article.excerpt.toLowerCase().includes(searchTerm) ||
        article.content.toLowerCase().includes(searchTerm) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    }

    // Tag filtering
    if (filters.tags && filters.tags.length > 0) {
      articles = articles.filter(article =>
        filters.tags!.some(tag => article.tags.includes(tag))
      )
    }

    return {
      success: true,
      data: articles,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: articles.length,
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
})

/**
 * Get articles by author (for "My News" section)
 * READ operation - uses React 19 cache() for performance
 */
export const getMyArticles = cache(async (authorId: string, filters: NewsFilters = {}): Promise<{
  success: boolean
  data?: NewsArticle[]
  pagination?: any
  stats?: {
    totalArticles: number
    publishedArticles: number
    draftArticles: number
    totalViews: number
    totalLikes: number
  }
  error?: string
}> => {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    // Get all articles by this author
    const authorResult = await db.query({
      collection: 'news',
      filters: [{ field: 'authorId', operator: '==', value: authorId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: filters.limit || 50, offset: filters.offset || 0 }
    })

    if (!authorResult.success) {
      throw authorResult.error || new Error('Failed to fetch articles')
    }

    let articles = authorResult.data as any[] as NewsArticle[]

    // Apply status filter if provided
    if (filters.status) {
      articles = articles.filter(article => article.status === filters.status)
    }

    // Calculate stats
    const totalArticles = articles.length
    const publishedArticles = articles.filter(a => a.status === 'published').length
    const draftArticles = articles.filter(a => a.status === 'draft').length
    const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0)
    const totalLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0)

    return {
      success: true,
      data: articles,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: articles.length,
      },
      stats: {
        totalArticles,
        publishedArticles,
        draftArticles,
        totalViews,
        totalLikes
      }
    }

  } catch (error) {
    logger.error('Error fetching my articles:', error)
    return {
      success: false,
      error: 'Failed to fetch your articles'
    }
  }
})

/**
 * Get user article statistics
 * READ operation - uses React 19 cache() for performance
 */
export const getUserArticleStats = cache(async (authorId: string): Promise<{
  success: boolean
  stats?: {
    totalArticles: number
    publishedArticles: number
    draftArticles: number
    archivedArticles: number
    totalViews: number
    totalLikes: number
    totalComments: number
    averageViews: number
    averageLikes: number
    mostViewedArticle: NewsArticle | null
    recentActivity: {
      date: string
      articles: number
      views: number
      likes: number
    }[]
  }
  error?: string
}> => {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    // Get all articles by this author
    const result = await db.query({
      collection: 'news',
      filters: [{ field: 'authorId', operator: '==', value: authorId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }]
    })

    if (!result.success) {
      throw result.error || new Error('Failed to fetch articles for stats')
    }

    const articles = result.data as any[] as NewsArticle[]

    // Calculate comprehensive stats
    const totalArticles = articles.length
    const publishedArticles = articles.filter(a => a.status === 'published').length
    const draftArticles = articles.filter(a => a.status === 'draft').length
    const archivedArticles = articles.filter(a => a.status === 'archived').length

    const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0)
    const totalLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0)
    const totalComments = articles.reduce((sum, a) => sum + (a.comments || 0), 0)

    const averageViews = totalArticles > 0 ? Math.round(totalViews / totalArticles) : 0
    const averageLikes = totalArticles > 0 ? Math.round(totalLikes / totalArticles) : 0

    // Find most viewed article
    const mostViewedArticle = articles.reduce((max, current) =>
      (current.views || 0) > (max.views || 0) ? current : max,
      articles[0] || null
    )

    // Calculate recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentArticles = articles.filter(a => {
      if (!a.createdAt) return false
      const createdDate = a.createdAt instanceof Date ? a.createdAt :
                         (a.createdAt as any).toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any)
      return createdDate >= thirtyDaysAgo
    })

    // Group by date for activity chart
    const activityMap = new Map<string, { articles: number, views: number, likes: number }>()

    recentArticles.forEach(article => {
      const createdDate = article.createdAt instanceof Date ? article.createdAt :
                         (article.createdAt as any).toDate ? (article.createdAt as any).toDate() : new Date(article.createdAt as any)
      const date = createdDate.toISOString().split('T')[0]
      const existing = activityMap.get(date) || { articles: 0, views: 0, likes: 0 }
      activityMap.set(date, {
        articles: existing.articles + 1,
        views: existing.views + (article.views || 0),
        likes: existing.likes + (article.likes || 0)
      })
    })

    const recentActivity = Array.from(activityMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      success: true,
      stats: {
        totalArticles,
        publishedArticles,
        draftArticles,
        archivedArticles,
        totalViews,
        totalLikes,
        totalComments,
        averageViews,
        averageLikes,
        mostViewedArticle,
        recentActivity
      }
    }

  } catch (error) {
    logger.error('Error fetching user article stats:', error)
    return {
      success: false,
      error: 'Failed to fetch article statistics'
    }
  }
})

/**
 * Delete news article
 * Authors can delete their own articles, admins can delete any
 */
export async function deleteNewsArticle(articleId: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    await initializeDatabase()
    const db = getDatabaseService()

    // Check permissions
    const userRole = (session.user as any).role as UserRole
    const articleResult = await db.read('news', articleId)

    if (!articleResult.success || !articleResult.data) {
      return {
        success: false,
        error: 'Article not found'
      }
    }

    const articleData = articleResult.data as any
    if (!canDeleteArticle(userRole, articleData?.authorId, session.user.id)) {
      return {
        success: false,
        error: 'Not authorized to delete this article'
      }
    }

    // Delete the article
    const deleteResult = await db.delete('news', articleId)
    if (!deleteResult.success) {
      throw deleteResult.error || new Error('Failed to delete article')
    }

    // Revalidate paths

    return {
      success: true,
      message: 'Article deleted successfully'
    }

  } catch (error) {
    logger.error('Error deleting news article:', error)
    return {
      success: false,
      error: 'Failed to delete article'
    }
  }
}

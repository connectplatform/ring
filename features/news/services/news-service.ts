// News Service - Ring-native DatabaseService implementation
// Server Actions pattern: Direct service calls, no HTTP routing

import { cache } from 'react'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import {
  NewsFilters,
  NewsFormData,
  NewsArticle,
  MainPageStatus,
  NewsContentType,
} from '@/features/news/types'
import { UserRole } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'
import { translitSlug } from '@/lib/news/translit-slug'
import { mapNewsDocument } from '@/lib/news/map-news-document'

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

export interface NewsArticleAuthor {
  id: string
  name: string
}

export interface CreateNewsArticleExtras {
  locale?: string
  translationGroupId?: string
  availableTranslations?: string[]
  audioUrl?: string
  promoteToMainPage?: boolean
  mainPageStatus?: MainPageStatus
  contentType?: NewsContentType
}

function buildArticleSlug(title: string, explicitSlug?: string): string {
  if (explicitSlug?.trim()) {
    return explicitSlug.trim()
  }
  const asciiSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  if (asciiSlug) return asciiSlug
  return translitSlug(title)
}

export async function createNewsArticleForAuthor(
  formData: NewsFormData,
  author: NewsArticleAuthor,
  extras?: CreateNewsArticleExtras
): Promise<CreateNewsResult> {
  try {
    if (!formData.title || !formData.content || !formData.excerpt) {
      return {
        success: false,
        error: 'Title, content, and excerpt are required',
      }
    }

    const slug = buildArticleSlug(formData.title, formData.slug)

    const slugResult = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'slug', operator: '==', value: slug }],
      pagination: { limit: 1 },
    })

    if (slugResult.success && slugResult.data && slugResult.data.length > 0) {
      return {
        success: false,
        error: 'Article with this slug already exists',
      }
    }

    const now = new Date()
    const locale = extras?.locale || formData.locale || 'en'
    const newArticle = {
      title: formData.title,
      slug,
      content: formData.content,
      excerpt: formData.excerpt,
      authorId: author.id,
      authorName: author.name,
      category: formData.category || 'other',
      tags: formData.tags || [],
      featuredImage: formData.featuredImage || null,
      audioUrl: formData.audioUrl || extras?.audioUrl || null,
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
      locale,
      translationGroupId: extras?.translationGroupId,
      availableTranslations: extras?.availableTranslations ?? [locale],
      contentType: extras?.contentType ?? formData.contentType,
      blogUsername: formData.blogUsername,
      promoteToMainPage: extras?.promoteToMainPage ?? formData.promoteToMainPage ?? false,
      mainPageStatus: extras?.mainPageStatus,
    }

    const createResult = await db().createDoc('news', newArticle)
    if (!createResult.success || !createResult.data) {
      throw createResult.error || new Error('Failed to create news article')
    }

    return {
      success: true,
      data: mapNewsDocument(createResult.data),
      message: 'News article created successfully',
    }
  } catch (error) {
    logger.error('Error creating news article for author:', error)
    return {
      success: false,
      error: 'Failed to create news article',
    }
  }
}

export async function createNewsArticle(formData: NewsFormData): Promise<CreateNewsResult> {
  try {
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const userRole = (session.user as { role?: UserRole }).role as UserRole
    if (!canCreateArticles(userRole)) {
      return {
        success: false,
        error: 'MEMBER status or higher required to create articles',
      }
    }

    return createNewsArticleForAuthor(formData, {
      id: session.user.id || session.user.email || '',
      name: session.user.name || 'Unknown Author',
    })
  } catch (error) {
    logger.error('Error creating news article:', error)
    return {
      success: false,
      error: 'Failed to create news article',
    }
  }
}

export async function updateNewsArticle(articleId: string, formData: NewsFormData): Promise<UpdateNewsResult> {
  try {
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const userRole = (session.user as { role?: UserRole }).role as UserRole
    const articleResult = await db().readDoc<Record<string, unknown>>('news', articleId)

    if (!articleResult.success || !articleResult.data) {
      return {
        success: false,
        error: 'Article not found',
      }
    }

    const articleData = articleResult.data
    if (!canEditArticle(userRole, String(articleData.authorId ?? ''), session.user.id)) {
      return {
        success: false,
        error: 'Not authorized to edit this article',
      }
    }

    if (!formData.title || !formData.content || !formData.excerpt) {
      return {
        success: false,
        error: 'Title, content, and excerpt are required',
      }
    }

    const slug = formData.slug || formData.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    if (slug !== articleData.slug) {
      const slugResult = await db().queryDocs({
        collection: 'news',
        filters: [{ field: 'slug', operator: '==', value: slug }],
        pagination: { limit: 1 },
      })

      if (slugResult.success && slugResult.data && slugResult.data.length > 0) {
        return {
          success: false,
          error: 'Article with this slug already exists',
        }
      }
    }

    const now = new Date()
    const updateData = {
      title: formData.title,
      slug,
      content: formData.content,
      excerpt: formData.excerpt,
      category: formData.category || 'other',
      tags: formData.tags || [],
      featuredImage: formData.featuredImage || null,
      gallery: formData.gallery || [],
      status: formData.status || 'draft',
      visibility: formData.visibility || 'public',
      featured: formData.featured || false,
      publishedAt: formData.status === 'published' && !articleData.publishedAt
        ? now
        : articleData.publishedAt,
      updatedAt: now,
      seo: formData.seo || null,
    }

    const updateResult = await db().updateDoc('news', articleId, updateData)
    if (!updateResult.success || !updateResult.data) {
      throw updateResult.error || new Error('Failed to update news article')
    }

    return {
      success: true,
      data: mapNewsDocument(updateResult.data),
      message: 'News article updated successfully',
    }
  } catch (error) {
    logger.error('Error updating news article:', error)
    return {
      success: false,
      error: 'Failed to update news article',
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
  pagination?: { limit?: number; offset?: number; total: number }
  filters?: NewsFilters
  error?: string
}> => {
  try {
    const queryFilters: { field: string; operator: string; value: unknown }[] = []

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

    const queryResult = await db().queryDocs({
      collection: 'news',
      filters: queryFilters,
      orderBy: [{ field: filters.sortBy || 'publishedAt', direction: filters.sortOrder || 'desc' }],
      pagination: { limit: filters.limit || 50, offset: filters.offset || 0 },
    })

    if (!queryResult.success || !queryResult.data) {
      throw queryResult.error || new Error('Failed to fetch news articles')
    }

    let articles = queryResult.data.map((row) => mapNewsDocument(row))

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      articles = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm) ||
        article.excerpt.toLowerCase().includes(searchTerm) ||
        article.content.toLowerCase().includes(searchTerm) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    }

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
      filters,
    }
  } catch (error) {
    logger.error('Error fetching news:', error)
    return {
      success: false,
      error: 'Failed to fetch news articles',
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
  pagination?: { limit?: number; offset?: number; total: number }
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
    const authorResult = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'authorId', operator: '==', value: authorId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: filters.limit || 50, offset: filters.offset || 0 },
    })

    if (!authorResult.success || !authorResult.data) {
      throw authorResult.error || new Error('Failed to fetch articles')
    }

    let articles = authorResult.data.map((row) => mapNewsDocument(row))

    if (filters.status) {
      articles = articles.filter(article => article.status === filters.status)
    }

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
        totalLikes,
      },
    }
  } catch (error) {
    logger.error('Error fetching my articles:', error)
    return {
      success: false,
      error: 'Failed to fetch your articles',
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
    const result = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'authorId', operator: '==', value: authorId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
    })

    if (!result.success || !result.data) {
      throw result.error || new Error('Failed to fetch articles for stats')
    }

    const articles = result.data.map((row) => mapNewsDocument(row))

    const totalArticles = articles.length
    const publishedArticles = articles.filter(a => a.status === 'published').length
    const draftArticles = articles.filter(a => a.status === 'draft').length
    const archivedArticles = articles.filter(a => a.status === 'archived').length

    const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0)
    const totalLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0)
    const totalComments = articles.reduce((sum, a) => sum + (a.comments || 0), 0)

    const averageViews = totalArticles > 0 ? Math.round(totalViews / totalArticles) : 0
    const averageLikes = totalArticles > 0 ? Math.round(totalLikes / totalArticles) : 0

    const mostViewedArticle = articles.reduce((max, current) =>
      (current.views || 0) > (max.views || 0) ? current : max,
      articles[0] || null
    )

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const toDate = (value: NewsArticle['createdAt']): Date => {
      if (!value) return new Date(0)
      if (value instanceof Date) return value
      if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate()
      }
      return new Date(String(value))
    }

    const recentArticles = articles.filter(a => {
      if (!a.createdAt) return false
      return toDate(a.createdAt) >= thirtyDaysAgo
    })

    const activityMap = new Map<string, { articles: number; views: number; likes: number }>()

    recentArticles.forEach(article => {
      const createdDate = toDate(article.createdAt)
      const date = createdDate.toISOString().split('T')[0]
      const existing = activityMap.get(date) || { articles: 0, views: 0, likes: 0 }
      activityMap.set(date, {
        articles: existing.articles + 1,
        views: existing.views + (article.views || 0),
        likes: existing.likes + (article.likes || 0),
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
        recentActivity,
      },
    }
  } catch (error) {
    logger.error('Error fetching user article stats:', error)
    return {
      success: false,
      error: 'Failed to fetch article statistics',
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
        error: 'Authentication required',
      }
    }

    const userRole = (session.user as { role?: UserRole }).role as UserRole
    const articleResult = await db().readDoc<Record<string, unknown>>('news', articleId)

    if (!articleResult.success || !articleResult.data) {
      return {
        success: false,
        error: 'Article not found',
      }
    }

    const articleData = articleResult.data
    if (!canDeleteArticle(userRole, String(articleData.authorId ?? ''), session.user.id)) {
      return {
        success: false,
        error: 'Not authorized to delete this article',
      }
    }

    const deleteResult = await db().deleteDoc('news', articleId)
    if (!deleteResult.success) {
      throw deleteResult.error || new Error('Failed to delete article')
    }

    return {
      success: true,
      message: 'Article deleted successfully',
    }
  } catch (error) {
    logger.error('Error deleting news article:', error)
    return {
      success: false,
      error: 'Failed to delete article',
    }
  }
}

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
import { assertKnownUserRole, isSuperadmin, resolveSessionUserRole } from '@/features/auth/user-role'
import {
  canCreateNewsArticle,
  canDeleteNewsArticle,
  canEditNewsArticle,
  assertNewsVisibilityPatch,
} from '@/features/news/lib/news-permissions'
import {
  buildNewsVisibilityFilters,
  filterNewsForDiscovery,
} from '@/features/news/lib/news-visibility-filter'
import { logger } from '@/lib/logger'
import { translitSlug } from '@/lib/news/translit-slug'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import { UserRolesArray } from '@/features/auth/user-role'
import { normalizeBlogHandle } from '@/lib/blog/blog-path'

// Interface for the result of creating a news article
interface CreateNewsResult {
  success: boolean
  data?: NewsArticle
  error?: string
  message?: string
}

// Interface for the result of updating a news article
interface UpdateNewsResult {
  success: boolean
  data?: NewsArticle
  error?: string
  message?: string
}

// Author permission helpers live in news-permissions.ts

// Interface for representing a news article's author
export interface NewsArticleAuthor {
  id: string
  name: string
}

// Extra options for creating a news article
export interface CreateNewsArticleExtras {
  locale?: string
  translationGroupId?: string
  availableTranslations?: string[]
  audioUrl?: string
  promoteToMainPage?: boolean
  mainPageStatus?: MainPageStatus
  contentType?: NewsContentType
}

/**
 * Create a (sanitized) slug for the article based on the title or explicit slug.
 * If no slug is specified, performs transliteration for maximum compatibility.
 * This helps ensure URLs are user-friendly and unique.
 */
function buildArticleSlug(title: string, explicitSlug?: string): string {
  if (explicitSlug?.trim()) {
    // Prefer explicit slug if provided and non-empty
    return explicitSlug.trim()
  }
  // Normalize title to a URL-friendly slug with ascii characters
  const asciiSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  if (asciiSlug) return asciiSlug
  // Fallback to transliteration for non-latin titles
  return translitSlug(title)
}

/**
 * Create a news article using the provided author and optional extras.
 * Checks for required fields and handles slug uniqueness.
 * Returns a result with success/data or error message.
 */
export async function createNewsArticleForAuthor(
  formData: NewsFormData,
  author: NewsArticleAuthor,
  extras?: CreateNewsArticleExtras
): Promise<CreateNewsResult> {
  try {
    // Validate required fields for news article creation
    if (!formData.title || !formData.content || !formData.excerpt) {
      return {
        success: false,
        error: 'Title, content, and excerpt are required',
      }
    }

    const slug = buildArticleSlug(formData.title, formData.slug)

    // Check for duplicate slug (unique article URL requirement)
    const slugResult = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'slug', operator: '==', value: slug }],
      pagination: { limit: 1 },
    })

    if (slugResult.success && slugResult.data && slugResult.data.length > 0) {
      // Article with identical slug found, return error
      return {
        success: false,
        error: 'Article with this slug already exists',
      }
    }

    // Build new article document with all the provided fields/defaults
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
      featuredImageAsset: formData.featuredImageAsset || null,
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
      ...(formData.versions ? { versions: formData.versions } : {}),
    }

    // Create article document in database
    const createResult = await db().createDoc('news', newArticle)
    if (!createResult.success || !createResult.data) {
      throw createResult.error || new Error('Failed to create news article')
    }

    const mapped = mapNewsDocument(createResult.data)
    const createdId = mapped.id

    // Attach initial markdown version commit when caller did not supply versions
    if (!formData.versions && createdId) {
      try {
        const {
          appendCommit,
          toEmbeddedVersions,
        } = await import('@/lib/versioning')
        const { doc: commit0 } = appendCommit(null, {
          entityType: 'news_article',
          entityId: createdId,
          createdBy: author.id,
          content: formData.content.trim(),
          contentFormat: 'markdown',
          label: 'Create',
        })
        const versionWrite = await db().updateDoc('news', createdId, {
          versions: toEmbeddedVersions(commit0),
        })
        if (versionWrite.success && versionWrite.data) {
          return {
            success: true,
            data: mapNewsDocument(versionWrite.data),
            message: 'News article created successfully',
          }
        }
      } catch (versionError) {
        logger.error('Failed to attach initial news version commit', versionError)
      }
    }

    return {
      success: true,
      data: mapped,
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

/**
 * Create a news article for the currently authenticated user.
 * Ensures the user has the proper role/permissions.
 */
export async function createNewsArticle(formData: NewsFormData): Promise<CreateNewsResult> {
  try {
    const session = await auth()

    // Auth required to create news
    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const userRole = assertKnownUserRole(session.user.role)
    // Permission: only preapproved roles can create articles
    if (!canCreateNewsArticle(userRole)) {
      return {
        success: false,
        error: 'Member, confidential, admin or superadmin role required to create articles',
      }
    }

    // Use user's ID or email as unique reference; stamp blogUsername for /[username]/[slug]
    const username =
      typeof session.user.username === 'string' ? session.user.username.trim() : ''
    return createNewsArticleForAuthor(
      {
        ...formData,
        blogUsername:
          formData.blogUsername ||
          (username ? normalizeBlogHandle(username) : undefined),
      },
      {
        id: session.user.id || session.user.email || '',
        name: session.user.name || 'Unknown Author',
      },
    )
  } catch (error) {
    logger.error('Error creating news article:', error)
    return {
      success: false,
      error: 'Failed to create news article',
    }
  }
}

/**
 * Update a news article.
 * Verifies authentication, permission, and checks unique slug unless unchanged.
 */
export async function updateNewsArticle(articleId: string, formData: NewsFormData): Promise<UpdateNewsResult> {
  try {
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const userRole = assertKnownUserRole(session.user.role)
    // Fetch article from DB by ID
    const articleResult = await db().readDoc<Record<string, unknown>>('news', articleId)

    if (!articleResult.success || !articleResult.data) {
      return {
        success: false,
        error: 'Article not found',
      }
    }

    const articleData = articleResult.data
    // Only author or authorized admin can edit
    if (!canEditNewsArticle(userRole, String(articleData.authorId ?? ''), session.user.id)) {
      return {
        success: false,
        error: 'Not authorized to edit this article',
      }
    }

    // Basic content validation
    if (!formData.title || !formData.content || !formData.excerpt) {
      return {
        success: false,
        error: 'Title, content, and excerpt are required',
      }
    }

    // Check if new status/visibility is allowed for this user's role
    assertNewsVisibilityPatch(userRole, { visibility: formData.visibility })

    // Generate the new slug (or keep the original if not changed)
    const slug = formData.slug || formData.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // If slug changed, check for collision
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

    // Generate update payload, preserve previous publish date if not transitioning draft->published
    const now = new Date()
    const updateData = {
      title: formData.title,
      slug,
      content: formData.content,
      excerpt: formData.excerpt,
      category: formData.category || 'other',
      tags: formData.tags || [],
      featuredImage: formData.featuredImage || null,
      featuredImageAsset: formData.featuredImageAsset || null,
      gallery: formData.gallery || [],
      status: formData.status || 'draft',
      visibility: formData.visibility || 'public',
      featured: formData.featured || false,
      publishedAt: formData.status === 'published' && !articleData.publishedAt
        ? now
        : articleData.publishedAt,
      updatedAt: now,
      seo: formData.seo || null,
      ...(formData.versions ? { versions: formData.versions } : {}),
    }

    // Perform update in database
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
 * Get news articles with filters.
 * Utilizes React 19's cache() for built-in deduplication and improved server action caching performance.
 * Filters and sorts articles based on provided NewsFilters; optionally applies search and tag filtering as well.
 * Applies role-based visibility filtering and discovery logic before returning to the frontend.
 * 
 * // TODO: When Next.js supports partial hydration and async/streaming directly from cache() calls,
 * migrate filter/search to client for large datasets; currently will scale to ~100-200 articles/query fine.
 */
export const getNewsArticles = cache(async (filters: NewsFilters = {}): Promise<{
  success: boolean
  data?: NewsArticle[]
  pagination?: { limit?: number; offset?: number; total: number }
  filters?: NewsFilters
  error?: string
}> => {
  try {
    // Try to obtain session, can be unauthenticated (show public news)
    const session = await auth()
    const userRole = session?.user
      ? assertKnownUserRole(session.user.role)
      : UserRolesArray.visitor as UserRolesArray
    const userId = session?.user?.id

    // Build up DB query filters based on NewsFilters
    const queryFilters: { field: string; operator: string; value: unknown }[] = []

    if (filters.category) {
      queryFilters.push({ field: 'category', operator: '==', value: filters.category })
    }
    if (filters.status) {
      // Explicit filter by status
      queryFilters.push({ field: 'status', operator: '==', value: filters.status })
    } else if (!isSuperadmin(userRole)) {
      // Non-superadmins: hide soft-deleted articles
      queryFilters.push({ field: 'status', operator: '!=', value: 'deleted' })
    }
    if (filters.visibility) {
      queryFilters.push({ field: 'visibility', operator: '==', value: filters.visibility })
    } else {
      // Otherwise, build permission-based visibility (e.g. public, member-only)
      queryFilters.push(...buildNewsVisibilityFilters(userRole))
    }
    if (filters.featured !== undefined) {
      queryFilters.push({ field: 'featured', operator: '==', value: filters.featured })
    }
    if (filters.authorId) {
      queryFilters.push({ field: 'authorId', operator: '==', value: filters.authorId })
    }

    // Query sorted by publish date (or other user-provided sort)
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

    // If search term specified, further filter client-side by basic fields/tags text match
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      articles = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm) ||
        article.excerpt.toLowerCase().includes(searchTerm) ||
        article.content.toLowerCase().includes(searchTerm) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    }

    // If filtering by tags, ensure article tags array overlaps filter
    if (filters.tags && filters.tags.length > 0) {
      articles = articles.filter(article =>
        filters.tags!.some(tag => article.tags.includes(tag))
      )
    }

    // Enforce final role-based filtering/censorship as needed
    articles = filterNewsForDiscovery(articles, { userRole, userId })

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
 * Get articles by author (for "My News" section).
 * Uses React 19's cache() for memoizing/stale-while-revalidate perf.
 * Also generates stats (counts, views, likes) for UI summary.
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
    // Query articles for this author's ID only, sorted newest first
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

    // Filter by a specific status (e.g., published, draft)
    if (filters.status) {
      articles = articles.filter(article => article.status === filters.status)
    }

    // Collect user stats for quick analytic displays
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
 * Get extended statistics for a user's articles.
 * Reads all articles by author, computes statistics such as averages,
 * most-viewed article, and recent 30-day author activity by day.
 * Uses React 19 cache() for server performance.
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
    // Query all news by this user (for stats, not pagination)
    const result = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'authorId', operator: '==', value: authorId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
    })

    if (!result.success || !result.data) {
      throw result.error || new Error('Failed to fetch articles for stats')
    }

    const articles = result.data.map((row) => mapNewsDocument(row))

    // Compute detailed user stats from article array
    const totalArticles = articles.length
    const publishedArticles = articles.filter(a => a.status === 'published').length
    const draftArticles = articles.filter(a => a.status === 'draft').length
    const archivedArticles = articles.filter(a => a.status === 'archived').length

    const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0)
    const totalLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0)
    const totalComments = articles.reduce((sum, a) => sum + (a.comments || 0), 0)

    const averageViews = totalArticles > 0 ? Math.round(totalViews / totalArticles) : 0
    const averageLikes = totalArticles > 0 ? Math.round(totalLikes / totalArticles) : 0

    // Find article with the most views
    const mostViewedArticle = articles.reduce((max, current) =>
      (current.views || 0) > (max.views || 0) ? current : max,
      articles[0] || null
    )

    // Build recent activity for the past 35 days (supports 4-week weekday comparison)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 35)

    // Helper function to robustly parse date fields from document data
    const toDate = (value: NewsArticle['createdAt']): Date => {
      if (!value) return new Date(0)
      if (value instanceof Date) return value
      if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate()
      }
      return new Date(String(value))
    }

    // Get only recent articles (last 30 days)
    const recentArticles = articles.filter(a => {
      if (!a.createdAt) return false
      return toDate(a.createdAt) >= thirtyDaysAgo
    })

    // Aggregate counts/metrics per day over last 30 days
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

    // Convert activityMap to sorted array
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
 * Soft delete a news article.
 * - Only authors can delete their own articles,
 * - admins, moderators, etc. can delete any.
 * - Article is not physically removed, but marked as deleted for forensics/retention.
 */
export async function deleteNewsArticle(articleId: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const session = await auth()

    // Require auth for deleting news
    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Check user role and permissions
    const userRole = assertKnownUserRole(session.user.role)
    const articleResult = await db().readDoc<Record<string, unknown>>('news', articleId)

    if (!articleResult.success || !articleResult.data) {
      return {
        success: false,
        error: 'Article not found',
      }
    }

    const articleData = articleResult.data
    // Only allow delete if author or admin allowed
    if (!canDeleteNewsArticle(userRole, String(articleData.authorId ?? ''), session.user.id)) {
      return {
        success: false,
        error: 'Not authorized to delete this article',
      }
    }

    // Soft delete: mark as deleted (retention before potential purge)
    const now = new Date()
    const deleteResult = await db().updateDoc('news', articleId, {
      status: 'deleted',
      deletedAt: now,
      deletedBy: session.user.id || session.user.email || '',
      updatedAt: now,
    })
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

/**
 * Bump article.views after a successful public article render.
 * RSC pages must call this (legacy GET /api/news/[id] is not on the read path).
 */
export async function recordArticlePageView(articleId: string): Promise<void> {
  if (!articleId) return
  try {
    const current = await db().readDoc('news', articleId)
    if (!current.success || !current.data) return
    const views = Number((current.data as { views?: number }).views ?? 0)
    await db().updateDoc('news', articleId, {
      views: views + 1,
      updatedAt: new Date(),
    })
  } catch (error) {
    logger.warn('recordArticlePageView failed', { articleId, error })
  }
}

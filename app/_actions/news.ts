'use server'

// File: _actions/news.ts
// Main server actions for news article CRUD, stats, and category management.

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { NewsArticle, NewsCategory, NewsStatus, NewsVisibility, NewsSEO } from '@/features/news/types'
import { isPlatformAdmin, assertKnownUserRole } from '@/features/auth/user-role'
import {
  canCreateNewsArticle,
  canSetNewsVisibility,
} from '@/features/news/lib/news-permissions'
import { normalizeBlogHandle } from '@/lib/blog/blog-path'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  coerceMediaImageAsset,
  coerceMediaImageAssetList,
  pickImageSrc,
} from '@/lib/file/media-asset'

export interface ArticleFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  article?: NewsArticle
}

// Handles both "create" and "edit" flows for articles.
export async function saveArticle(
  prevState: ArticleFormState | null,
  formData: FormData
): Promise<ArticleFormState> {
  try {
    // Get current user session (required admin only)
    const session = await auth()
    if (!session?.user?.id) {
      return {
        error: 'Authentication required'
      }
    }

    // Extract input mode, article ID and locale
    const mode = formData.get('mode') as 'create' | 'edit'
    const articleId = formData.get('articleId') as string
    const locale = formData.get('locale') as string

    // Role check (must be platform admin for create, admin OR owner for edit)
    const userRole = assertKnownUserRole(session.user.role)
    const userId = session.user.id
    const isAdmin = isPlatformAdmin(userRole)

    if (mode === 'create') {
      // Members+ / confidential / admins (see canCreateNewsArticle)
      if (!canCreateNewsArticle(userRole)) {
        return {
          error: 'Member access required to create news articles',
        }
      }
    } else if (mode === 'edit' && articleId) {
      // For edits: must be admin OR the article owner
      const { db } = await import('@/lib/database')
      const { mapNewsDocument } = await import('@/lib/news/map-news-document')
      const articleResult = await db().readDoc('news', articleId)
      
      if (!articleResult.success || !articleResult.data) {
        return {
          error: 'Article not found'
        }
      }

      const existingArticle = mapNewsDocument(articleResult.data)
      const isOwner = existingArticle.authorId === userId
      
      if (!isAdmin && !isOwner) {
        return {
          error: 'You do not have permission to edit this article'
        }
      }
    }

    // Extract main form fields for article
    const title = formData.get('title') as string
    const slug = formData.get('slug') as string
    const content = formData.get('content') as string
    const excerpt = formData.get('excerpt') as string
    const category = formData.get('category') as NewsCategory
    const status = formData.get('status') as NewsStatus
    const visibility = formData.get('visibility') as NewsVisibility
    const featured = formData.get('featured') === 'true'
    const featuredImageRaw = (formData.get('featuredImage') as string) || ''

    // Parse tags as comma-separated string -> array
    const tagsString = formData.get('tags') as string
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []

    // Parse MediaImageAsset payloads (JSON preferred; coerce string/legacy too)
    let featuredImageAsset = undefined as ReturnType<typeof coerceMediaImageAsset>
    const featuredImageAssetField = formData.get('featuredImageAsset')
    if (typeof featuredImageAssetField === 'string' && featuredImageAssetField.trim()) {
      try {
        featuredImageAsset = coerceMediaImageAsset(JSON.parse(featuredImageAssetField))
      } catch {
        featuredImageAsset = coerceMediaImageAsset(featuredImageAssetField)
      }
    }
    if (!featuredImageAsset) {
      featuredImageAsset = coerceMediaImageAsset(featuredImageRaw)
    }

    const featuredImage = featuredImageAsset?.url || featuredImageRaw || ''

    let gallery = [] as ReturnType<typeof coerceMediaImageAssetList>
    const galleryField = formData.get('gallery')
    if (typeof galleryField === 'string' && galleryField.trim()) {
      try {
        gallery = coerceMediaImageAssetList(JSON.parse(galleryField))
      } catch {
        // Legacy comma-separated URL list
        gallery = coerceMediaImageAssetList(
          galleryField.split(',').map((u) => u.trim()).filter(Boolean),
        )
      }
    }

    const ogFromAsset = featuredImageAsset
      ? pickImageSrc(featuredImageAsset, 'og')
      : featuredImage

    // Parse SEO meta, fallback to main field values for defaults
    const seoOgImageField = (formData.get('seoOgImage') as string) || ''
    const seo: NewsSEO = {
      metaTitle: formData.get('seoMetaTitle') as string || title,
      metaDescription: formData.get('seoMetaDescription') as string || excerpt,
      keywords: (formData.get('seoKeywords') as string || '').split(',').map(k => k.trim()).filter(Boolean),
      canonicalUrl: formData.get('seoCanonicalUrl') as string || '',
      ogImage: seoOgImageField || featuredImageAsset?.derivatives?.og || ogFromAsset || featuredImage,
      ogTitle: formData.get('seoOgTitle') as string || title,
      ogDescription: formData.get('seoOgDescription') as string || excerpt,
      twitterTitle: formData.get('seoTwitterTitle') as string || title,
      twitterDescription: formData.get('seoTwitterDescription') as string || excerpt,
      twitterImage: formData.get('seoTwitterImage') as string || featuredImage
    }

    // --- Field validation ---
    const fieldErrors: Record<string, string> = {}
    if (!title?.trim()) {
      fieldErrors.title = 'Title is required'
    }
    if (!slug?.trim()) {
      fieldErrors.slug = 'Slug is required'
    }
    if (!content?.trim()) {
      fieldErrors.content = 'Content is required'
    }
    if (!excerpt?.trim()) {
      fieldErrors.excerpt = 'Excerpt is required'
    } else if (excerpt.length > 300) {
      fieldErrors.excerpt = 'Excerpt must be less than 300 characters'
    }
    if (Object.keys(fieldErrors).length > 0) {
      return {
        fieldErrors
      }
    }

    // Enforce visibility by role (members cannot set site-wide / confidential casually)
    if (!canSetNewsVisibility(userRole, visibility)) {
      return { error: 'Your role cannot set this visibility level' }
    }

    // Non-admins cannot mark featured / site-wide featured placement
    const resolvedFeatured = isAdmin ? featured : false

    const username =
      typeof session.user.username === 'string' ? session.user.username.trim() : ''
    const blogUsername = username ? normalizeBlogHandle(username) : undefined

    // Construct payload for article creation or update
    const articleData = {
      title: title.trim(),
      slug: slug.trim(),
      content: content.trim(),
      excerpt: excerpt.trim(),
      category,
      tags,
      featuredImage: featuredImage || '',
      featuredImageAsset: featuredImageAsset || undefined,
      gallery,
      status,
      visibility,
      featured: resolvedFeatured,
      seo,
      ...(mode === 'create' && blogUsername ? { blogUsername } : {}),
      // If creating, initialize counters and createdAt
      ...(mode === 'create' && {
        views: 0,
        likes: 0,
        comments: 0,
        createdAt: new Date(),
      }),
      // Always update updatedAt
      updatedAt: new Date(),
    }

    // Use service layer for DB access (dynamic import)
    // TODO: Consider native React19/Next16 Loading UI while awaiting import
    const { createNewsArticle, updateNewsArticle } = await import('@/features/news/services/news-service')

    // Save or update the article
    const result = mode === 'create' 
      ? await createNewsArticle(articleData)
      : await updateNewsArticle(articleId, articleData)

    if (!result.success) {
      return {
        error: result.error || 'Failed to save article'
      }
    }

    // Invalidate article cache + revalidate all relevant admin/news paths
    // Uses Next.js 16 `revalidateTag(tag, 'max')` pattern via syncNewsDiscovery
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId: result.data?.id || articleId,
      event: mode === 'create' ? 'created' : 'updated',
      locale,
    })

    const savedArticle = result.data
    void savedArticle

    // Admins stay in admin news; member authors return to My News
    const validLocale = (locale || 'en') as Locale
    redirect(
      isAdmin ? ROUTES.ADMIN_NEWS(validLocale) : ROUTES.MY_NEWS(validLocale),
    )

  } catch (error: any) {
    // Properly rethrow Next.js redirect "errors" so Next handles them correctly
    if (error.message?.includes('NEXT_REDIRECT')) {
      throw error
    }
    // Log error and return generic message
    console.error('Error saving article:', error)
    return {
      error: 'Failed to save article. Please try again.'
    }
  }
}

// Publish = set status to 'published', then save as usual
export async function publishArticle(
  prevState: ArticleFormState | null,
  formData: FormData
): Promise<ArticleFormState> {
  // Set status for publishing; reuse saveArticle logic for validation and storage
  formData.set('status', 'published')
  return saveArticle(prevState, formData)
}

// Delete article by ID + locale, invalidate caches/paths
export async function deleteArticle(
  articleId: string,
  locale: string
): Promise<{
 success: boolean; error?: string }> {
  try {
    // Require authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const userRole = assertKnownUserRole(session.user.role)
    const userId = session.user.id

    // Fetch the article to check ownership
    const { db } = await import('@/lib/database')
    const { mapNewsDocument } = await import('@/lib/news/map-news-document')
    const articleResult = await db().readDoc('news', articleId)
    
    if (!articleResult.success || !articleResult.data) {
      return {
        success: false,
        error: 'Article not found'
      }
    }

    const article = mapNewsDocument(articleResult.data)
    
    // Check permissions: admin OR article owner
    const isAdmin = isPlatformAdmin(userRole)
    const isOwner = article.authorId === userId
    
    if (!isAdmin && !isOwner) {
      return {
        success: false,
        error: 'You do not have permission to delete this article'
      }
    }

    // Use dynamic import for service
    const { deleteNewsArticle } = await import('@/features/news/services/news-service')
    const result = await deleteNewsArticle(articleId)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete article'
      }
    }

    // Sync news + revalidate admin/news path caches
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId,
      event: 'deleted',
      locale,
    })

    // Revalidate paths (client-facing news, user's news dashboard)
    const { revalidatePath } = await import('next/cache')
    revalidatePath(`/${locale}/my-news`)
    revalidatePath(`/${locale}/news`)

    return { success: true }
  } catch (error) {
    console.error('Error deleting article:', error)
    return {
      success: false,
      error: 'Failed to delete article. Please try again.'
    }
  }
}

// Fetch currently logged-in user's articles given locale and optional filters
export async function getMyArticlesAction(
  locale: string,
  filters?: { status?: NewsStatus }
): Promise<{
 success: boolean; data?: NewsArticle[]; error?: string }> {
  try {
    // Require authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Fetch user's articles via service
    const { getMyArticles } = await import('@/features/news/services/news-service')
    const result = await getMyArticles(session.user.id, filters)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch articles'
      }
    }

    // Return articles to client
    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error fetching my articles:', error)
    return {
      success: false,
      error: 'Failed to fetch articles. Please try again.'
    }
  }
}

// Fetch user stats for their articles
export async function getUserArticleStatsAction(
  locale: string
): Promise<{
 success: boolean; stats?: any; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Retrieve article stats via service
    const { getUserArticleStats } = await import('@/features/news/services/news-service')
    const result = await getUserArticleStats(session.user.id)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch stats'
      }
    }

    return { success: true, stats: result.stats }
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return {
      success: false,
      error: 'Failed to fetch stats. Please try again.'
    }
  }
}

// Category management actions (create, update, delete).
// NOTE: These could be refactored to share validation logic if more category fields are added later.
export interface CategoryFormState {
  success?: boolean
  error?: string
  message?: string
}

// Fetch all categories (admin-only, shared resource)
export async function getCategoriesAction(): Promise<{
  success: boolean
  data?: import('@/features/news/types').NewsCategoryInfo[]
  error?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const userRole = assertKnownUserRole(session.user.role)
    if (!isPlatformAdmin(userRole)) {
      return { success: false, error: 'Admin access required' }
    }

    const { getCategories } = await import('@/features/news/services/news-category-service')
    const categories = await getCategories()
    return { success: true, data: categories }
  } catch (error) {
    console.error('Error fetching categories:', error)
    return { success: false, error: 'Failed to fetch categories' }
  }
}

// Create a category for news articles (admin-only)
export async function createCategoryAction(
  prevState: CategoryFormState | null,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { error: 'Authentication required' }
    }

    const userRole = assertKnownUserRole(session.user.role)
    if (!isPlatformAdmin(userRole)) {
      return { error: 'Admin access required to manage categories' }
    }

    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const color = formData.get('color') as string
    const icon = formData.get('icon') as string

    if (!name?.trim()) {
      return { error: 'Category name is required' }
    }

    const { createCategory } = await import('@/features/news/services/news-category-service')
    const result = await createCategory({ name, description, color, icon })

    return {
      success: result.success,
      message: result.message,
      error: result.error,
    }
  } catch (error) {
    console.error('Error creating category:', error)
    return { error: 'Failed to create category' }
  }
}

// Update an existing category by ID (admin-only)
export async function updateCategoryAction(
  prevState: CategoryFormState | null,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { error: 'Authentication required' }
    }

    const userRole = assertKnownUserRole(session.user.role)
    if (!isPlatformAdmin(userRole)) {
      return { error: 'Admin access required to manage categories' }
    }

    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const color = formData.get('color') as string
    const icon = formData.get('icon') as string

    if (!id || !name?.trim()) {
      return { error: 'Category ID and name are required' }
    }

    const { updateCategory } = await import('@/features/news/services/news-category-service')
    const result = await updateCategory(id, { name, description, color, icon })

    return {
      success: result.success,
      message: result.message,
      error: result.error,
    }
  } catch (error) {
    console.error('Error updating category:', error)
    return { error: 'Failed to update category' }
  }
}

// Delete a news article category by ID (admin-only)
export async function deleteCategoryAction(categoryId: string): Promise<CategoryFormState> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { error: 'Authentication required' }
    }

    const userRole = assertKnownUserRole(session.user.role)
    if (!isPlatformAdmin(userRole)) {
      return { error: 'Admin access required to manage categories' }
    }

    const { deleteCategory } = await import('@/features/news/services/news-category-service')
    const result = await deleteCategory(categoryId)

    return {
      success: result.success,
      message: result.message,
      error: result.error,
    }
  } catch (error) {
    console.error('Error deleting category:', error)
    return { error: 'Failed to delete category' }
  }
}
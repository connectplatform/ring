'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { NewsArticle, NewsCategory, NewsStatus, NewsVisibility, NewsSEO } from '@/features/news/types'
import { UserRole } from '@/features/auth/types'

export interface ArticleFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  article?: NewsArticle
}

export async function saveArticle(
  prevState: ArticleFormState | null,
  formData: FormData
): Promise<ArticleFormState> {

  try {
    // Get current user session - Admin only action
    const session = await auth()
    if (!session?.user?.id) {
      return {
        error: 'Authentication required'
      }
    }

    // Check admin role
    const userRole = (session.user as any)?.role as UserRole
    if (!userRole || userRole !== UserRole.ADMIN) {
      return {
        error: 'Admin access required to manage news articles'
      }
    }

    const mode = formData.get('mode') as 'create' | 'edit'
    const articleId = formData.get('articleId') as string
    const locale = formData.get('locale') as string
  
  // Extract form data
  const title = formData.get('title') as string
  const slug = formData.get('slug') as string
  const content = formData.get('content') as string
  const excerpt = formData.get('excerpt') as string
  const category = formData.get('category') as NewsCategory
  const status = formData.get('status') as NewsStatus
  const visibility = formData.get('visibility') as NewsVisibility
  const featured = formData.get('featured') === 'true'
  const featuredImage = formData.get('featuredImage') as string
  
  // Parse tags and gallery
  const tagsString = formData.get('tags') as string
  const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : []
  
  const galleryString = formData.get('gallery') as string
  const gallery = galleryString ? galleryString.split(',').filter(Boolean) : []
  
  // Parse SEO data
  const seo: NewsSEO = {
    metaTitle: formData.get('seoMetaTitle') as string || title,
    metaDescription: formData.get('seoMetaDescription') as string || excerpt,
    keywords: (formData.get('seoKeywords') as string || '').split(',').map(k => k.trim()).filter(Boolean),
    canonicalUrl: formData.get('seoCanonicalUrl') as string || '',
    ogImage: formData.get('seoOgImage') as string || featuredImage,
    ogTitle: formData.get('seoOgTitle') as string || title,
    ogDescription: formData.get('seoOgDescription') as string || excerpt,
    twitterTitle: formData.get('seoTwitterTitle') as string || title,
    twitterDescription: formData.get('seoTwitterDescription') as string || excerpt,
    twitterImage: formData.get('seoTwitterImage') as string || featuredImage
  }

  // Validation
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

    const articleData = {
      title: title.trim(),
      slug: slug.trim(),
      content: content.trim(),
      excerpt: excerpt.trim(),
      category,
      tags,
      featuredImage: featuredImage || '',
      gallery,
      status,
      visibility,
      featured,
      seo,
      ...(mode === 'create' && {
        views: 0,
        likes: 0,
        comments: 0,
        createdAt: new Date(),
      }),
      updatedAt: new Date(),
    }

    // ✅ Use direct service call instead of HTTP request
    const { createNewsArticle, updateNewsArticle } = await import('@/features/news/services/news-service')
    
    const result = mode === 'create' 
      ? await createNewsArticle(articleData)
      : await updateNewsArticle(articleId, articleData)

    if (!result.success) {
      return {
        error: result.error || 'Failed to save article'
      }
    }

    const savedArticle = result.data
    
    // Redirect to admin panel after successful save
    redirect(`/${locale}/admin/news`)
    
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error
    }
    
    console.error('Error saving article:', error)
    return {
      error: 'Failed to save article. Please try again.'
    }
  }
}

export async function publishArticle(
  prevState: ArticleFormState | null,
  formData: FormData
): Promise<ArticleFormState> {

  // Set status to published and save
  formData.set('status', 'published')
  return saveArticle(prevState, formData)
}

export async function deleteArticle(
  articleId: string,
  locale: string
): Promise<{
 success: boolean; error?: string }> {
  try {
    // Get current user session
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Import service function
    const { deleteNewsArticle } = await import('@/features/news/services/news-service')

    const result = await deleteNewsArticle(articleId)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete article'
      }
    }

    // Revalidate paths after successful deletion
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

export async function getMyArticlesAction(
  locale: string,
  filters?: { status?: NewsStatus }
): Promise<{
 success: boolean; data?: NewsArticle[]; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const { getMyArticles } = await import('@/features/news/services/news-service')
    const result = await getMyArticles(session.user.id, filters)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch articles'
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error fetching my articles:', error)
    return {
      success: false,
      error: 'Failed to fetch articles. Please try again.'
    }
  }
}

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
'use server'

import { redirect } from 'next/navigation'
import { NewsArticle, NewsCategory, NewsStatus, NewsVisibility, NewsSEO } from '@/features/news/types'

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

  try {
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

    const url = mode === 'create' 
      ? '/api/news' 
      : `/api/news/${articleId}`
    
    const method = mode === 'create' ? 'POST' : 'PUT'

    const response = await fetch(`${process.env.NEXTAUTH_URL}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(articleData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        error: errorData.error || 'Failed to save article'
      }
    }

    const savedArticle = await response.json()
    
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
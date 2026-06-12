import type { NewsArticle, NewsCategoryInfo } from '@/features/news/types'
import { getBrandName } from '@/lib/site-branding'
import { normalizeVikkaNewsData } from '@/lib/news/vikka-field-normalize'

/** Normalize PostgreSQL JSONB row → NewsArticle for UI */
export function mapNewsDocument(
  row: { id: string; data?: Record<string, unknown> } & Record<string, unknown>,
  options?: { locale?: string; vikkaCompat?: boolean }
): NewsArticle {
  let d = (row.data ?? row) as Record<string, unknown>
  if (options?.vikkaCompat || process.env.NEXT_PUBLIC_NEWS_VIKKA_COMPAT === 'true') {
    d = normalizeVikkaNewsData(d, options?.locale ?? String(d.locale ?? 'uk'))
  }
  const defaultAuthor = process.env.NEXT_PUBLIC_NEWS_DEFAULT_AUTHOR || getBrandName()
  return {
    id: row.id,
    title: String(d.title ?? ''),
    slug: String(d.slug ?? ''),
    content: String(d.content ?? ''),
    excerpt: String(d.excerpt ?? ''),
    authorId: String(d.authorId ?? ''),
    authorName: String(d.authorName ?? defaultAuthor),
    category: d.category as NewsArticle['category'],
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    featuredImage: d.featuredImage as string | undefined,
    audioUrl: d.audioUrl as string | undefined,
    gallery: d.gallery as string[] | undefined,
    status: d.status as NewsArticle['status'],
    visibility: d.visibility as NewsArticle['visibility'],
    featured: Boolean(d.featured),
    views: Number(d.views ?? 0),
    likes: Number(d.likes ?? 0),
    comments: Number(d.comments ?? 0),
    publishedAt: d.publishedAt as NewsArticle['publishedAt'],
    createdAt: d.createdAt as NewsArticle['createdAt'],
    updatedAt: d.updatedAt as NewsArticle['updatedAt'],
    seo: d.seo as NewsArticle['seo'],
    locale: d.locale as string | undefined,
    translationGroupId: d.translationGroupId as string | undefined,
    availableTranslations: d.availableTranslations as string[] | undefined,
    contentType: d.contentType as NewsArticle['contentType'],
    blogUsername: d.blogUsername as string | undefined,
    promoteToMainPage: Boolean(d.promoteToMainPage),
    mainPageStatus: d.mainPageStatus as NewsArticle['mainPageStatus'],
    mainPageStatusHistory: d.mainPageStatusHistory as NewsArticle['mainPageStatusHistory'],
    siteWideSlug: d.siteWideSlug as string | undefined,
    siteWideCategory: d.siteWideCategory as string | undefined,
    aiScore: d.aiScore as NewsArticle['aiScore'],
    payment: d.payment as NewsArticle['payment'],
  }
}

export function mapNewsCategoryDocument(row: { id: string; data?: Record<string, unknown> }): NewsCategoryInfo {
  const d = (row.data ?? row) as Record<string, unknown>
  return {
    id: row.id,
    name: String(d.name ?? row.id),
    description: String(d.description ?? ''),
    color: String(d.color ?? 'bg-gray-500'),
    icon: String(d.icon ?? '📰'),
    createdAt: d.createdAt as NewsCategoryInfo['createdAt'],
    updatedAt: d.updatedAt as NewsCategoryInfo['updatedAt'],
  }
}

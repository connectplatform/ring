import type { NewsArticle, NewsCategoryInfo } from '@/features/news/types'
import { getBrandName } from '@/lib/site-branding'
import {
  coerceMediaImageAsset,
  coerceMediaImageAssetList,
  type MediaImageAsset,
} from '@/lib/file/media-asset'

function denormalizedFeatured(
  featuredImageAsset: MediaImageAsset | undefined,
  featuredImage: unknown,
): string | undefined {
  if (featuredImageAsset?.url) return featuredImageAsset.url
  if (typeof featuredImage === 'string' && featuredImage.trim()) return featuredImage.trim()
  return undefined
}

/**
 * Normalize PostgreSQL JSONB row → NewsArticle for UI.
 * CamelCase fields only — no snake_case / Vikka dual-compat alias reads.
 * Image fields coerced to MediaImageAsset (SSOT).
 */
export function mapNewsDocument(
  row: { id: string; data?: Record<string, unknown> } & Record<string, unknown>,
  options?: { locale?: string },
): NewsArticle {
  const d = (row.data ?? row) as Record<string, unknown>
  const defaultAuthor = process.env.NEXT_PUBLIC_NEWS_DEFAULT_AUTHOR || getBrandName()

  const featuredImageAsset =
    coerceMediaImageAsset(d.featuredImageAsset) ||
    coerceMediaImageAsset(d.featuredImage)
  const galleryRaw = d.gallery
  const galleryAssets = coerceMediaImageAssetList(galleryRaw)
  const featuredImage = denormalizedFeatured(featuredImageAsset, d.featuredImage)

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
    featuredImage,
    featuredImageAsset,
    audioUrl: d.audioUrl as string | undefined,
    gallery: galleryAssets.length > 0 ? galleryAssets : undefined,
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
    locale: (d.locale as string | undefined) ?? options?.locale,
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
    deletedAt: d.deletedAt as NewsArticle['deletedAt'],
    deletedBy: d.deletedBy as string | undefined,
    versions: d.versions as NewsArticle['versions'],
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

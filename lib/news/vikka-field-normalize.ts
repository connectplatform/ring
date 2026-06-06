import { translitSlug } from '@/lib/news/translit-slug'

/** Map legacy vikka snake_case JSONB → canonical camelCase for unified news module */
export function normalizeVikkaNewsData(raw: Record<string, unknown>, locale: string): Record<string, unknown> {
  const title = String(raw.title ?? '')
  const slug =
    String(raw.slug ?? raw.wpPostName ?? '') ||
    translitSlug(title)
  const siteWideSlug = String(raw.siteWideSlug ?? translitSlug(slug || title))

  return {
    ...raw,
    title,
    slug,
    siteWideSlug,
    locale: String(raw.locale ?? locale),
    publishedAt: raw.publishedAt ?? raw.published_at ?? raw.createdAt,
    createdAt: raw.createdAt ?? raw.created_at ?? raw.published_at,
    updatedAt: raw.updatedAt ?? raw.updated_at,
    authorId: raw.authorId ?? raw.author_id ?? '',
    authorName: raw.authorName ?? raw.author_name ?? 'Vikka',
    featuredImage: raw.featuredImage ?? raw.featured_image ?? raw.featured_image_cdn,
    views: Number(raw.views ?? raw.view_count ?? 0),
    category: raw.category ?? raw.category_slug ?? 'other',
  }
}

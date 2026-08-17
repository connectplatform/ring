import type { Metadata } from 'next'
// Sets locale on the request context for next-intl i18n
import { setRequestLocale } from 'next-intl/server'
// Provides locale routing info and helpers
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import Link from 'next/link'
import { NewsList } from '@/features/news/components/news-list'
import { FeaturedCarousel } from '@/features/news/components/featured-carousel'
import NewsPageWrapper from '@/components/wrappers/news-page-wrapper'
import { db } from '@/lib/database'
import { auth } from '@/auth'
import { buildNewsVisibilityFilters } from '@/features/news/lib/news-visibility-filter'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { hasRoleAtLeast } from '@/features/auth/types'
import { mapNewsDocument, mapNewsCategoryDocument } from '@/lib/news/map-news-document'
import { NewsArticle, NewsCategoryInfo } from '@/features/news/types'
import { PLATFORM_CATEGORY_INFO } from '@/features/news/lib/platform-category-info'
import { LocalePageProps, LocaleMetadataProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import { loadTranslations } from '@/i18n/load-translations'
import { Rss } from 'lucide-react'

const categoryInfo = PLATFORM_CATEGORY_INFO

// Type for route params for eventual extension (currently empty)
type NewsParams = {}

// TODO: If scalability needed, migrate to React cache() or Next.js fetch caching for network/db requests

/**
 * Fetches initial news articles (max 12), applying user role for visibility filtering.
 * Uses server-only authentication and DB access.
 */
async function getInitialNews(): Promise<NewsArticle[]> {
  try {
    // Get current session and resolve user role
    const session = await auth()
    // Use the highest role given, fallback to visitor role if unauthenticated
    const userRole = session?.user
      ? hasRoleAtLeast(session.user.role as UserRolesArray, UserRolesArray.visitor as UserRolesArray)
      : UserRolesArray.visitor as UserRolesArray

    // Query the news collection with filters and ordering for news feed
    const result = await db().queryDocs({
      collection: 'news',
      filters: [
        { field: 'status', operator: '==', value: 'published' },
        ...buildNewsVisibilityFilters(userRole as UserRolesArray),
      ],
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      pagination: { limit: 12 },
    })

    if (!result.success) {
      // Log error and prevent throwing to avoid server error breaking the page
      console.error('Error fetching news:', result.error)
      return []
    }

    // Transform each doc to NewsArticle type for uniform rendering
    return result.data.map((row) => mapNewsDocument(row))
  } catch (error) {
    // Defensive catch in case of major DB/network/auth errors
    console.error('Error fetching initial news:', error)
    return []
  }
}

/**
 * Fetches list of news categories from DB, sorted by name ascending.
 */
async function getNewsCategories(): Promise<NewsCategoryInfo[]> {
  try {
    const result = await db().queryDocs({
      collection: 'news_categories',
      orderBy: [{ field: 'name', direction: 'asc' }],
    })

    if (!result.success) {
      // Log and fallback empty
      console.error('Error fetching categories:', result.error)
      return []
    }

    // Normalizes Mongo/firestore/etc doc shape to NewsCategoryInfo
    return result.data.map((row) => mapNewsCategoryDocument(row))
  } catch (error) {
    console.error('Error fetching news categories:', error)
    return []
  }
}

// TODO: After Next.js 16+ stable, refactor this to use generateMetadata as a top-level `export const generateMetadata = ...`
// Accepts locale via route params (async supported for edge compatibility)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await the params as a Promise (Next 13+ dynamic route pattern)
  const { locale: localeParam } = await params
  // Get valid locale (falls back to default if not recognized)
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale) // i18n: set context for current request
  // Generate metadata for SEO (including OpenGraph/Twitter etc)
  return buildLocalizedMetadata({
    locale,
    path: 'news.list',
    variables: { 
      count: '12' // Expose count for internationalized title/meta
    },
    pathname: '/news',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

/**
 * NewsPage: Main entry for /news route (i18n server component).
 * Loads translations and article data in parallel, then renders header, carousel, and full list.
 * @param props.locale - locale code from dynamic route
 */
export default async function NewsPage(props: LocalePageProps<NewsParams>) {
  // Get params & searchParams (for future extensibility: paging/filtering by query, etc)
  const params = await props.params
  const searchParams = await props.searchParams // Currently unused, but ready for filter/search
  // Validate locale (fallback to default if absent/invalid)
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  // For tracing/debug: print resolved locale to server logs
  console.log('NewsPage: Using locale', locale)
  // Load translations for this locale eagerly (can be streamed in future)
  const translations = await loadTranslations(locale)

  // Fetch articles + categories in parallel for efficiency (React server pattern)
  const [initialArticles, categories] = await Promise.all([
    getInitialNews(),
    getNewsCategories(),
  ])

  // TODO: If categories/articleCount should be hydrated, perform aggregation in backend and merge counts into categoryInfo

  return (
    <NewsPageWrapper 
      locale={locale}
      categoryInfo={categoryInfo}
      translations={translations}
    >
      {/* Sticky header with background and blurred border, optimized for top nav */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
        <div className="container mx-auto px-6 py-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {/* Fallback to default English if translation missing */}
              {translations.news?.title || 'News & Updates'}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              {translations.news?.description ||
                'Stay informed with the latest news, platform updates, partnership announcements, and community highlights from Ring Platform.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="container mx-auto px-6 max-w-5xl">
        {/* Carousel of featured articles (use initialArticles for now) */}
        <FeaturedCarousel
          articles={initialArticles}
          locale={locale}
          translations={translations}
        />

        {/* Main Articles List Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">
            {translations.news?.allArticles || 'All Articles'}
          </h2>
          <NewsList
            initialArticles={initialArticles}
            categories={categories}
            showFilters={true}
            showSearch={true}
            limit={12}
            locale={locale}
          />
        </div>
      </div>
    </NewsPageWrapper>
  )
}
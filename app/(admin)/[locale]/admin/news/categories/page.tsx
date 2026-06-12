import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { Locale } from '@/i18n/shared';
import { CategoriesManager } from '@/features/news/components/categories-manager'
import { db } from '@/lib/database'
import { mapNewsCategoryDocument } from '@/lib/news/map-news-document'
import { NewsCategoryInfo } from '@/features/news/types'
import NewsWrapper from '@/components/wrappers/news-wrapper'
import { connection } from 'next/server'
import { routing } from '@/i18n/routing';
import { ROUTES } from '@/constants/routes';
import { getTranslations } from 'next-intl/server';
import { isPlatformAdmin } from '@/features/auth/user-role';

/**
 * Get news categories - Server Component async/await (React 19)
 */
async function getNewsCategories(): Promise<NewsCategoryInfo[]> {
  try {
    const result = await db().queryDocs({
      collection: 'newsCategories',
      orderBy: [{ field: 'name', direction: 'asc' }],
    })

    if (!result.success) return []
    return result.data.map((row) => mapNewsCategoryDocument(row))
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'news.category',
    pathname: '/admin/news/categories',
    robots: { index: false, follow: false },
  })
}

export default async function AdminNewsCategoriesPage({ 
  params 
}: { 
  params: Promise<{ locale: Locale }> 
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale = routing.locales.includes(locale) ? locale : routing.defaultLocale
  const t = await getTranslations('modules.admin.newsCategories')
  
  // Check authentication and admin role
  const session = await auth()
  
  if (!session?.user) {
    redirect(`${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_NEWS_CATEGORIES(validLocale))}`)
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }
  
  const categories = await getNewsCategories()

  // Prepare stats for the news wrapper sidebar
  const stats = {
    totalArticles: categories.length, // Total categories
    publishedArticles: categories.length, // All categories are "active"
    draftArticles: 0, // Categories don't have draft status
    recentViews: 0 // Could be implemented later if needed
  }

  return (
    <NewsWrapper
      pageContext="categories"
      stats={stats}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title') || 'Categories Management'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('subtitle') || 'Manage news article categories, colors, and organization'}
        </p>
      </div>

      <CategoriesManager
        initialCategories={categories}
        locale={validLocale}
      />
    </NewsWrapper>
  )
} 
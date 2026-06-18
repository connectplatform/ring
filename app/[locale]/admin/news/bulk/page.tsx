import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { auth } from '@/auth'
import type { Locale } from '@/i18n/shared';
import { BulkOperationsManager } from '@/features/news/components/bulk-operations-manager'
import { db } from '@/lib/database'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import { NewsArticle } from '@/features/news/types'
import NewsWrapper from '@/components/wrappers/news-wrapper'
import { connection } from 'next/server'
import { routing } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { isPlatformAdmin } from '@/features/auth/user-role';

/**
 * Get news articles for bulk operations - Server Component async/await (React 19)
 */
async function getNewsArticles(): Promise<NewsArticle[]> {
  try {
    const result = await db().queryDocs({
      collection: 'news',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 100 },
    })

    if (!result.success) return []
    return result.data.map((row) => mapNewsDocument(row))
  } catch (error) {
    console.error('Error fetching articles for bulk operations:', error)
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
    path: 'admin',
    pathname: '/admin/news/bulk',
    robots: { index: false, follow: false },
  })
}

export default async function AdminNewsBulkPage({ 
  params 
}: { 
  params: Promise<{ locale: Locale }> 
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale)
  const t = await getTranslations('modules.admin.bulkOperations')
  
  // Check authentication and admin role
  const session = await auth()
  
  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale) + `?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_NEWS_BULK(validLocale))}`)
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }
  
  const articles = await getNewsArticles()

  // Prepare stats for the news wrapper sidebar
  const stats = {
    totalArticles: articles.length,
    publishedArticles: articles.filter(article => article.status === 'published').length,
    draftArticles: articles.filter(article => article.status === 'draft').length,
    recentViews: articles.reduce((sum, article) => sum + (article.views || 0), 0) // Total views
  }

  return (
    <NewsWrapper
      pageContext="bulk"
      stats={stats}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('subtitle')}
        </p>
      </div>

      <BulkOperationsManager
        initialArticles={articles}
        locale={validLocale}
      />
    </NewsWrapper>
  )
} 
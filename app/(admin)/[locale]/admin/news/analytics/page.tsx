import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import { NewsAnalyticsDashboard } from '@/features/news/components/news-analytics-dashboard'
import { db } from '@/lib/database'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import { NewsArticle, NewsAnalytics, NewsCategory } from '@/features/news/types'
import NewsWrapper from '@/components/wrappers/news-wrapper'
import { connection } from 'next/server'
import { isPlatformAdmin } from '@/features/auth/user-role'

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  return new Date()
}

/**
 * Get news analytics - Server Component async/await (React 19)
 */
async function getNewsAnalytics(): Promise<NewsAnalytics> {
  try {
    const result = await db().queryDocs({ collection: 'news' })
    if (!result.success) throw result.error || new Error('Query failed')

    const articles = result.data.map((row) => mapNewsDocument(row)) as NewsArticle[]

    // Calculate analytics
    const totalArticles = articles.length
    const totalViews = articles.reduce((sum, article) => sum + (article.views || 0), 0)
    const totalLikes = articles.reduce((sum, article) => sum + (article.likes || 0), 0)
    const totalComments = articles.reduce((sum, article) => sum + (article.comments || 0), 0)

    // Get popular articles (top 10 by views)
    const popularArticles = articles
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)

    // Category distribution
    const categoryCount: Record<string, number> = {}
    articles.forEach(article => {
      categoryCount[article.category] = (categoryCount[article.category] || 0) + 1
    })

    const topCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category: category as NewsCategory, count }))
      .sort((a, b) => b.count - a.count)

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentActivity = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      const dayArticles = articles.filter(article => {
        const articleDate = toDate(article.createdAt)
        return articleDate.toDateString() === date.toDateString()
      })

      recentActivity.push({
        date: date.toISOString().split('T')[0],
        views: dayArticles.reduce((sum, article) => sum + (article.views || 0), 0),
        likes: dayArticles.reduce((sum, article) => sum + (article.likes || 0), 0),
        comments: dayArticles.reduce((sum, article) => sum + (article.comments || 0), 0)
      })
    }

    return {
      totalArticles,
      totalViews,
      totalLikes,
      totalComments,
      popularArticles,
      topCategories,
      recentActivity
    }
  } catch (error) {
    console.error('Error fetching news analytics:', error)
    return {
      totalArticles: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      popularArticles: [],
      topCategories: [],
      recentActivity: []
    }
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
    path: 'admin.analytics',
    pathname: '/admin/news/analytics',
    robots: { index: false, follow: false },
  })
}

export default async function AdminNewsAnalyticsPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale)
  const t = await getTranslations('modules.admin.matcher')
  
  // Check authentication and admin role
  const session = await auth()
  
  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale) + `?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_NEWS_ANALYTICS(validLocale))}`)
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }
  
  const analytics = await getNewsAnalytics()

  // Prepare stats for the news wrapper sidebar
  const stats = {
    totalArticles: analytics.totalArticles,
    publishedArticles: analytics.totalArticles, // Analytics shows all published articles
    draftArticles: 0, // Analytics don't show draft status
    recentViews: analytics.totalViews // Total views from analytics
  }

  return (
    <NewsWrapper
      pageContext="analytics"
      stats={stats}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('analytics.title') || 'News Analytics'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive insights and performance metrics for your news content
        </p>
      </div>

      <NewsAnalyticsDashboard
        analytics={analytics}
        locale={validLocale}
      />
    </NewsWrapper>
  )
} 
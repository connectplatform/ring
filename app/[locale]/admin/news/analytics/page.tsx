import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isValidLocale, defaultLocale, loadTranslations } from '@/utils/i18n-server'
import { NewsAnalyticsDashboard } from '@/features/news/components/NewsAnalyticsDashboard'
import { getNewsCollection } from '@/lib/firestore-collections'
import { NewsArticle, NewsAnalytics, NewsCategory } from '@/features/news/types'

async function getNewsAnalytics(): Promise<NewsAnalytics> {
  try {
    const newsCollection = getNewsCollection()
    const snapshot = await newsCollection.get()
    const articles = snapshot.docs.map(doc => doc.data()) as NewsArticle[]

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
        const articleDate = article.createdAt.toDate()
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

export default async function AdminNewsAnalyticsPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  const t = await loadTranslations(validLocale)
  
  // Check authentication and admin role
  const session = await auth()
  
  if (!session?.user) {
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/news/analytics`)
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    redirect(`/${validLocale}/unauthorized`)
  }
  
  const analytics = await getNewsAnalytics()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          News Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive insights and performance metrics for your news content
        </p>
      </div>

      <NewsAnalyticsDashboard 
        analytics={analytics}
        locale={validLocale}
        translations={t}
      />
    </div>
  )
} 
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import { BulkOperationsManager } from '@/features/news/components/bulk-operations-manager'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { NewsArticle } from '@/features/news/types'
import NewsWrapper from '@/components/wrappers/news-wrapper'
import { connection } from 'next/server'

/**
 * Get news articles for bulk operations - Server Component async/await (React 19)
 */
async function getNewsArticles(): Promise<NewsArticle[]> {
  try {
    // Initialize database service with proper error handling
    const initResult = await initializeDatabase()
    if (!initResult.success) {
      console.error('Database initialization failed:', initResult.error)
      return [] // Graceful degradation
    }
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'news',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 100 }
    })
    
    if (!result.success) return []
    return result.data as any[] as NewsArticle[]
  } catch (error) {
    console.error('Error fetching articles for bulk operations:', error)
    return []
  }
}

export default async function AdminNewsBulkPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  const t = await loadTranslations(validLocale)
  
  // Check authentication and admin role
  const session = await auth()
  
  if (!session?.user) {
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/news/bulk`)
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    redirect(`/${validLocale}/unauthorized`)
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
      translations={t}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t.modules.admin.bulkOperations?.title || 'Bulk Operations'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage multiple news articles simultaneously with batch operations
        </p>
      </div>

      <BulkOperationsManager
        initialArticles={articles}
        locale={validLocale}
        translations={t}
      />
    </NewsWrapper>
  )
} 
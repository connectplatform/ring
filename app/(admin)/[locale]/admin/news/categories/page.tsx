import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import { CategoriesManager } from '@/features/news/components/categories-manager'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { NewsCategoryInfo } from '@/features/news/types'
import NewsWrapper from '@/components/wrappers/news-wrapper'
import { connection } from 'next/server'

/**
 * Get news categories - Server Component async/await (React 19)
 */
async function getNewsCategories(): Promise<NewsCategoryInfo[]> {
  try {
    // Initialize database service with proper error handling
    const initResult = await initializeDatabase()
    if (!initResult.success) {
      console.error('Database initialization failed:', initResult.error)
      return [] // Graceful degradation
    }
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'newsCategories',
      orderBy: [{ field: 'name', direction: 'asc' }]
    })
    
    if (!result.success) return []
    return result.data as any[] as NewsCategoryInfo[]
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

export default async function AdminNewsCategoriesPage({ 
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
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/news/categories`)
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    redirect(`/${validLocale}/unauthorized`)
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
      translations={t}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t.modules.admin.newsCategories?.title || 'Categories Management'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t.modules.admin.newsCategories?.subtitle || 'Manage news article categories, colors, and organization'}
        </p>
      </div>

      <CategoriesManager
        initialCategories={categories}
        locale={validLocale}
        translations={t}
      />
    </NewsWrapper>
  )
} 
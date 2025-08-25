import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import { BulkOperationsManager } from '@/features/news/components/bulk-operations-manager'
import { getCachedNewsCollection } from '@/lib/services/firebase-service-manager'
import { NewsArticle } from '@/features/news/types'

async function getNewsArticles(): Promise<NewsArticle[]> {
  try {
    const snapshot = await getCachedNewsCollection({
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit: 100 // Limit for performance in bulk operations
    })
    
    return snapshot.docs.map(doc => doc.data())
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Bulk Operations
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
    </div>
  )
} 
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import { CategoriesManager } from '@/features/news/components/categories-manager'
import { getNewsCategoriesCollection } from '@/lib/firestore-collections'
import { NewsCategoryInfo } from '@/features/news/types'

async function getNewsCategories(): Promise<NewsCategoryInfo[]> {
  try {
    const categoriesCollection = getNewsCategoriesCollection()
    const snapshot = await categoriesCollection.orderBy('name', 'asc').get()
    return snapshot.docs.map(doc => doc.data())
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Categories Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage news article categories, colors, and organization
        </p>
      </div>

      <CategoriesManager 
        initialCategories={categories}
        locale={validLocale}
        translations={t}
      />
    </div>
  )
} 
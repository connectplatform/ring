import { getRingSeoBranding } from '@/lib/ring-config-core'
import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { db } from '@/lib/database'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import type { NewsArticle } from '@/features/news/types'
import { ArticleEditor } from '@/features/news/components/article-editor'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'
import { connection } from 'next/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { isPlatformAdmin } from '@/features/auth/user-role'

// TODO: Apply Next.js 16 Middleware for authentication and locale extraction to centralize logic.
// TODO: Migrate getArticle to a React 19 Server Action and refactor component props for direct server-side data fetching.
//       See: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions

/**
 * Fetches an article document by its ID from the database and maps it to the NewsArticle shape.
 * Returns null if the fetch fails or article does not exist.
 *
 * @param id - The unique article ID to look up
 * @returns NewsArticle or null
 */
async function getArticle(id: string): Promise<NewsArticle | null> {
  try {
    // Fetch article document from 'news' collection using provided id
    // TODO: Refactor this to use Next.js server actions as soon as stable across all consumers
    const result = await db().readDoc('news', id)

    if (!result.success || !result.data) {
      // Not found or unsuccessful DB call
      return null
    }

    // Map raw DB document to NewsArticle type
    return mapNewsDocument(result.data)
  } catch (error) {
    // Log to server for debugging
    console.error('Error fetching article:', error)
    return null
  }
}

/**
 * Next.js Metadata generator. Dynamically computes metadata including article title for SEO.
 *
 * @param params - Route params containing locale and id
 * @returns Metadata object for Next.js
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  // Next.js 16: Opt out of prerendering so server context (auth/session) and dynamic data are available.
  await connection()

  // Await route parameters
  const { locale, id } = await params

  // Defensive check and fallback to default locale if invalid
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  // Load translation function scoped to admin module
  const t = await getTranslations('modules.admin')

  // Fetch article data for metadata description
  const article = await getArticle(id)

  // Return dynamic metadata, includes translated title and description
  return {
    title: `${t('createArticle')} | ${getRingSeoBranding().siteName}`,
    description: article?.title ? `Edit article: ${article.title}` : 'Edit article',
  }
}

/**
 * News Article Edit Page - Admin only
 * This Next.js Server Component verifies authentication, authorisation, fetches article data and renders the Admin UI.
 *
 * - Redirects to login if session is missing
 * - Redirects to unauthorized page if user is not admin
 * - Shows 404 if article is missing
 */
export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  // Next.js 16: Opt out of prerendering so all server context is available
  await connection()

  // Await route parameters, gives locale and article id
  const { locale, id } = await params

  // Locale validation with fallback to default locale if invalid
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  // Translation function for admin UI
  const t = await getTranslations('modules.admin')

  // Authentication check: fetch current user session (SSR, not CSR)
  const session = await auth() // TODO: Move to Next.js 16 middleware for centralised server boundary checks

  // If there's no authenticated user, send to login page with callback
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(
        ROUTES.ADMIN_NEWS_EDIT(id, validLocale)
      )}`,
    )
  }

  // If user is signed in but not platform admin, send to unauthorized page
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  // Fetch article data from database
  const article = await getArticle(id)

  // 404 page if article doesn't exist or couldn't load
  if (!article) {
    notFound()
  }

  // Build admin labels for localization (sidebar, navigation etc)
  const adminLabels = buildModulesAdminLabels(t)

  // Render admin wrapper and article editor component
  return (
    <AdminWrapper locale={validLocale} pageContext="news" labels={adminLabels}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          {/* Page header and context about editing */}
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('createArticle')}
          </h1>
          <p className="text-muted-foreground">
            Edit article: {article.title}
          </p>
        </div>

        {/* Article editor in 'edit' mode, passes fetched article and locale */}
        <ArticleEditor
          mode="edit"
          article={article}
          locale={validLocale}
        />
      </div>
    </AdminWrapper>
  )
}
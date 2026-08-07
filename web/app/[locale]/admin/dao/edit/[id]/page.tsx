import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { AdminPoolForm } from '@/features/public-pools/components/admin-pool-form'
import { getPublicPoolById } from '@/features/public-pools/services/public-pool-service'

// Page metadata generation for Next.js
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  await connection() // Ensure DB connection (TODO: Consider moving connection management higher up if using React 19/Next 16 server actions)
  const { id } = await params
  const pool = await getPublicPoolById(id) // Fetch pool by ID
  const t = await getTranslations('modules.dao.admin.edit') // Get translations for page title
  return { 
    // Set page title depending if pool exists
    title: pool ? `${t('title')}: ${pool.title}` : `${t('title')} | Admin` 
  }
}

// Main page component for editing DAO/pool as an admin
export default async function AdminDaoEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection() // Ensure DB connection (TODO: See if this is needed per request in Next 16/React 19 layout)
  const { locale: localeParam, id } = await params
  // Determine valid locale, fallback to default
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale) // Set detected locale for current request (server context)

  // Authenticate user session
  const session = await auth()
  if (!session?.user) {
    // Redirect to login with callback if not authenticated
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_DAO_EDIT(id, locale))}`,
    )
  }
  // Check platform admin permission before proceeding
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  // Fetch the pool by ID to edit
  const pool = await getPublicPoolById(id)
  if (!pool) {
    // Show 404 page if pool doesn't exist
    notFound()
  }

  // Translation helpers and label building for admin UI
  const t = await getTranslations('modules.admin')
  const tDao = await getTranslations('modules.dao.admin.edit')
  const labels = buildModulesAdminLabels(t)

  // Render wrapped admin UI for editing pool
  return (
    <AdminWrapper locale={locale} pageContext="dao" labels={labels}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {tDao('title')}
        </h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {pool.pool_slug}
        </p>
      </div>
      {/* Edit form for pool entity */}
      <AdminPoolForm mode="edit" locale={locale} pool={pool} />
    </AdminWrapper>
  )
  // TODO: With Next 16/React 19, consider using server actions for form and possibly moving auth logic to middleware or new "protected route" patterns.
}

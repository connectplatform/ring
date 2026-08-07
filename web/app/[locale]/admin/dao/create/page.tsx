import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { AdminPoolForm } from '@/features/public-pools/components/admin-pool-form'
import { getTranslations } from 'next-intl/server'

// Generates the page metadata (for the <head>), used for SEO and browser tab title.
// It fetches translations for DAO admin creation and sets the title accordingly.
export async function generateMetadata(): Promise<Metadata> {
  await connection() // Ensure DB or backend service connection is established
  const t = await getTranslations('modules.dao.admin.create') // Fetch translation function
  return { title: `${t('title')} | Admin` } // Use translated title with "| Admin" suffix
}

// Main page component for the DAO creation page in the admin panel.
export default async function AdminDaoCreatePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Ensure backend connection is ready

  // Extract the locale from parameters; use default if invalid
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request's locale for subsequent server-side logic
  setRequestLocale(locale)

  // Authenticate the user/session
  const session = await auth()
  // If not authenticated, redirect to login with callback to this page
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_DAO_CREATE(locale))}`,
    )
  }
  // If authenticated user is not a platform admin, redirect to unauthorized page
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  // Fetch translation functions for labels and DAO create content
  const t = await getTranslations('modules.admin')
  const tDao = await getTranslations('modules.dao.admin.create')

  // Build label set for admin modules using translations
  const labels = buildModulesAdminLabels(t)

  // Render admin wrapper and DAO creation form
  return (
    <AdminWrapper locale={locale} pageContext="dao" labels={labels}>
      <div className="mb-8">
        {/* Page Title */}
        <h1 className="text-3xl font-bold text-foreground">{tDao('title')}</h1>
        {/* Page Description */}
        <p className="mt-2 text-muted-foreground">{tDao('description')}</p>
      </div>
      {/* Render DAO creation form in "create" mode */}
      <AdminPoolForm mode="create" locale={locale} />
    </AdminWrapper>
  )
}

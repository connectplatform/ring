import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { listPublicPools } from '@/features/public-pools/services/public-pool-service'
import AdminDaoClient from './admin-dao-client'

// Generates static metadata for the admin DAO page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection() // Ensure DB or server connection is initialized
  return { title: 'Public pools | Admin' } // Returns static page title
}

// Main component for the DAO admin page
export default async function AdminDaoPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Always ensure DB/server connection is ready

  // Extract the locale parameter from Next.js params object
  const { locale: localeParam } = await params
  // Confirm the requested locale is supported, default to fallback otherwise
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request locale for next-intl
  setRequestLocale(locale)

  // Check authentication for the current session
  const session = await auth()
  if (!session?.user) {
    // If not logged in, redirect to the login page, preserving return URL
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_DAO(locale))}`,
    )
  }
  // Check user is platform admin, otherwise redirect to unauthorized page
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  // Get localization function for admin module
  const t = await getTranslations('modules.admin')
  // Fetch up to 200 public pools for the admin view
  const pools = await listPublicPools({ limit: 200 })
  // Generate labels for admin modules using localization
  const labels = buildModulesAdminLabels(t)

  // Render the admin wrapper and inject necessary props
  return (
    <AdminWrapper locale={locale} pageContext="dao" labels={labels}>
      <AdminDaoClient pools={pools} locale={locale} />
    </AdminWrapper>
  )
}

// TODO: Use Next.js 16+ server actions for authentication and data loading to reduce server round-trips and streamline code.
// TODO: Consider using the new "generateMetadata" convention for dynamic metadata based on props, if/when Next supports locale in metadata generation.
// TODO: Use React 19's new async function components and server-side hooks when migrating for better type safety and improved semantics.
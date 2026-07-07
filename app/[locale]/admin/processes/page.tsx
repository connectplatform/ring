import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { ProcessesClient } from '@/features/admin/processes/processes-client'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'

// TODO: In Next.js 13+ with app directory, consider using generateMetadata directly as an export in page.js/tsx, and possibly move locale resolution to Next.js middleware for more central locale handling

/**
 * Generates localized SEO metadata for the admin processes page.
 * @param params Promise resolving to params, including the locale.
 * @returns Localized metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Awaiting params to get the locale parameter
  const { locale: localeParam } = await params

  // Validate locale against available locales, default to fallback if not found
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request-scoped locale for translations
  setRequestLocale(locale)

  // Fetch localized strings for titles and descriptions
  const t = await getTranslations('modules.admin.processes')

  // Build the SEO metadata with localization and robots directives
  return buildLocalizedMetadata({
    locale,
    path: 'admin',
    pathname: '/admin/processes',
    fallback: {
      title: t('title'),
      description: t('subtitle'),
    },
    robots: { index: false, follow: false },
  })
}

/**
 * Server action for the admin processes listing page.
 * Handles authentication, authorization, and locale validation.
 * @param params Promise resolving to params, including the locale.
 */
export default async function AdminProcessesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // Establish server/database/API connection if needed.
  // Note: Replace with actual connection logic as needed for your backend.
  await connection() // MOCK CODE, TODO: Replace with proper database API/library connection if necessary.

  // Extract locale param from promise.
  const { locale } = await params

  // Validate locale against allowed locales, fallback to default if invalid.
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  // Authenticate the user session.
  const session = await auth()
  if (!session?.user) {
    // No authenticated user found; redirect to login for correct locale.
    redirect(ROUTES.LOGIN(validLocale))
    // TODO: When React 19 server actions stabilize, replace imperative redirect with error boundary + throw redirect for cleaner SSR handling.
  }

  // Authorize user role strictly: only allow superadmins.
  if (assertKnownUserRole(session.user.role as UserRolesArray) !== UserRolesArray.superadmin) {
    // User is not authorized; redirect to Unauthorized page.
    redirect(ROUTES.UNAUTHORIZED(validLocale))
    // TODO: On Next.js 16+, consider using middleware for high-level role-based access control (RBAC).
  }

  // Render the main ProcessesClient component for the current locale.
  // TODO: With React 19, consider using <Suspense> for data dependencies in ProcessesClient (if it does data fetching).
  return <ProcessesClient locale={validLocale} />
}

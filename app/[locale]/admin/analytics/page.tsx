import type { Metadata } from 'next'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { connection } from 'next/server'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { getRingSeoBranding } from '@/lib/ring-config-core'
import { getPlatformAnalytics } from '@/features/analytics/services/get-platform-analytics'
import AdminAnalyticsClient from './admin-analytics-client'

// TODO: Consider applying Next.js 16 Middleware for authentication and locale extraction
// TODO: If possible, switch to React 19 Server Actions for authentication and analytics data
//       See: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions

/**
 * Generates dynamic metadata for the analytics admin page.
 * Uses translations and branding from the current locale and system config.
 *
 * @param params - Contains the locale string as set by Next.js routing
 * @returns SEO Metadata including title, description and robots rules
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await route parameters as these are passed asynchronously
  const { locale: localeParam } = await params

  // Validate incoming locale, fallback to default if invalid
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request-level locale for proper SSR translation hydration
  setRequestLocale(locale)

  // Retrieve current branding configuration (site name, etc)
  const branding = getRingSeoBranding()

  // Obtain translation function for the analytics admin module
  const t = await getTranslations('modules.admin.webAnalytics')

  // Compose and return SEO metadata using translations and branding
  return buildLocalizedMetadata({
    locale,
    path: 'admin.analytics', // analytics path for optional granular SEO handling
    pathname: '/admin/analytics',
    fallback: {
      // Title uses branding and translation
      title: `${t('title', { projectName: branding.siteName })} | Admin`,
      description: t('subtitle'),
    },
    // Set to noindex, noarchive, noimageindex etc for admin area
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
  })
}

// TODO: Convert to native React 19 Server Action or apply Next 16 Middleware for these concerns
// TODO: Consider colocating authentication, locale, and connection calls in a single server utility

/**
 * Main server component for the analytics admin page.
 * Handles authentication, locale validation, data prefetching, and SSR label hydration.
 *
 * @param params - Contains the async route params for locale
 * @returns JSX for the admin analytics page
 */
export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // Ensure any required DB/platform connection is established before continuing
  // (e.g., initializing connection pool, dependency checks, etc)
  await connection()

  // Await and extract locale parameter from URL
  const { locale } = await params
  // Validate locale against known config or fallback
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  // Authenticate the current session and user
  const session = await auth()
  if (!session?.user) {
    // Redirect unauthenticated users to login page.
    // The callbackUrl preserves navigation flow after auth.
    redirect(
      ROUTES.LOGIN(validLocale) +
      `?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_ANALYTICS(validLocale))}`
    )
  }

  // Authorization check: permit only platform admins
  if (!isPlatformAdmin(session.user.role)) {
    // Redirect unauthorized users to a generic unauthorized page
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  // Set this request's locale for all server-rendered translations
  setRequestLocale(validLocale)

  // Fetch translation namespace for the admin module
  const t = await getTranslations('modules.admin')

  // Build navigation and UI label schema using translation function
  const adminLabels = buildModulesAdminLabels(t)

  // Fetch the current project or organization's name for display
  const projectName = getRingSeoBranding().siteName

  // Fetch analytics data for display (last 7 days)
  // TODO: Make date ranges dynamic (e.g., from query parameters, user controls).
  // TODO: Utilize Next 16 native fetch caching (see: https://nextjs.org/docs/app/api-reference/fetch/caching)
  const analytics = await getPlatformAnalytics('7d')

  // Render page shell with SSR-provided analytics and labels
  return (
    <AdminWrapper locale={validLocale} pageContext="analytics" labels={adminLabels}>
      <AdminAnalyticsClient
        projectName={projectName}
        data={analytics}
        labels={adminLabels}
      />
    </AdminWrapper>
  )
}

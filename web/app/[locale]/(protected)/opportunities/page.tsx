import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import OpportunitiesWrapper from '@/components/wrappers/opportunities-wrapper'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import type { LocalePageProps } from '@/utils/page-props'

/**
 * Opportunities Page - Server Component
 * - Ensures locale and SEO metadata are set up using Next.js and custom helpers
 * - Handles authentication, RBAC, and efficient data-fetching
 * - Implements robust error handling and safe defaults for pagination/filtering
 * - OpportunitiesWrapper is rendered as a server component
 * 
 * // TODO: Use Next.js 16 server actions for mutating logic when adding create/edit/delete features.
 * // TODO: Refactor to fully leverage React 19's Suspense and streaming for paginated/large dataset rendering:
 * //   - Move data-fetching to a suspending boundary (e.g. use React.lazy, Loading.js for skeleton/partial hydration)
 * //   - Convert OpportunitiesWrapper into a server component leveraging React 19 features (if not already).
 * //   - Use Next's partial prerendering or async server component props, if available and beneficial.
 */

/**
 * Generates SEO metadata for /opportunities based on detected locale.
 * Uses server-side detection to ensure correct i18n content for bots/crawlers.
 * 
 * // TODO: When Next.js supports static segment metadata per-locale, migrate to `export const metadata = {...}`
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params

  // Check if the incoming locale is valid, fall back if not (supports SSR/SSG).
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the detected/validated locale for downstream Next Intl localization.
  setRequestLocale(locale)

  // Generate correct i18n-aware metadata for the /opportunities list route.
  return buildLocalizedMetadata({
    locale,
    path: 'opportunities.list',   // Used for SEO page title/description lookup
    pathname: '/opportunities',
    robots: { index: false, follow: false }, // Opt-out of indexing for this page
  })
}

export default async function OpportunitiesPage(props: LocalePageProps<{}>) {
  // MOCK CODE, TODO: Replace with production-ready database/session provider
  // - Remove direct connection() call if serverless
  // - Integrate with new Next.js 16 Data Cache or App Router DB/session API
  // - Refactor to avoid await on every rendering for performance
  await connection() // MOCK CODE, TODO: 1) Replace this with serverless/session lifecycle helpers. 2) Support per-request DB caching via Next16. 3) Remove/block on demand connection in large scale.

  // Extract and resolve locale and search params provided via Next.js context (typed)
  const params = await props.params
  const searchParams = await props.searchParams

  // Ensure the locale is acceptable and fallback to default if not present/invalid
  const locale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)

  // Authenticate the user via the Next.js custom auth logic
  // If not authenticated, perform SSR server redirect to login page
  const session = await auth()
  if (!session?.user) {
    // Redirect user to login, with callback to bring them back to opportunities after login
    redirect(`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.OPPORTUNITIES(locale))}`)
  }

  // Parse pagination and filtering variables from query params (safe defaults)
  const limit = Number(searchParams.limit ?? '20')
  const startAfter = typeof searchParams.startAfter === 'string' ? searchParams.startAfter : undefined

  // Initialize opportunity results and error state
  let initialOpportunities: any[] = []
  let initialError: string | null = null
  let lastVisible: string | null = null

  try {
    // Dynamically import the RBAC-aware query logic for this user role
    // - Enables tree-shaking and future code-splitting for custom role logic
    // - Can be refactored to a server action in Next 16
    const { getOpportunitiesForRole } = await import('@/features/opportunities/services/get-opportunities')
    
    // Safely coerce/validate the user role for RBAC
    const userRole = assertKnownUserRole(session.user.role as UserRolesArray)
    
    // Query the backend for opportunities list, with pagination
    const result = await getOpportunitiesForRole({
      userRole,
      limit,
      startAfter,
    })
    initialOpportunities = result.opportunities
    lastVisible = result.lastVisible
  } catch (error) {
    // Gracefully handle and report backend/query errors
    // TODO: Improve error surface for i18n and client reporting (see React 19 Error Boundaries)
    console.error('OpportunitiesPage: Failed to load opportunities', error)
    initialError = 'Failed to load opportunities. Please try again.'
  }

  // Render OpportunitiesWrapper as a server/async component
  // TODO: Migrate OpportunitiesWrapper to use React 19's streaming (e.g. Loading.js for skeleton), if large lists
  // TODO: With Next 16, opportunities queries can be inside a <Suspense> boundary for streaming UI.
  return (
    <OpportunitiesWrapper
      locale={locale}
      searchParams={searchParams}
      initialOpportunities={initialOpportunities}
      initialError={initialError}
      lastVisible={lastVisible}
      initialLimit={limit}
    />
  )
}

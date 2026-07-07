import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import EntitiesWrapper from '@/components/wrappers/entities-wrapper'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { resolveSessionUserRole } from '@/features/auth/user-role'
import type { LocalePageProps } from '@/utils/page-props'

// TODO: Use Next.js 16 Server Actions once mutation is added for entities (create/edit/delete). Recommend colocating server actions with UI where possible.
// TODO: Convert filtering + pagination data-fetching to use React 19 `use()` in client Components and React 19 async Server Components for progressive rendering and streaming.
// TODO: Refactor EntitiesWrapper to a Server Component or Client Suspense boundary with async loading for entity pagination (see below for implementation suggestions).

/**
 * Generates SEO metadata for the /entities page, with proper locale support.
 * This uses async server-side locale detection.
 * 
 * TODO: Once Next.js supports config-based segment metadata, consider moving to `export const metadata = ...` in a route segment file,
 * which can also take advantage of static analysis and automatic locale integration.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // params is a promise to a params object with {locale}
  const { locale: localeParam } = await params
  // Validate and normalize locale, fall back to default if needed
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  // Set the detected locale for this request, for use by all nested intl-using components
  setRequestLocale(locale)
  // Build and return i18n-aware SEO metadata for this route
  return buildLocalizedMetadata({
    locale,
    path: 'entities.list',
    pathname: '/entities',
    robots: { index: false, follow: false },
  })
}

/**
 * Server component for displaying and paginating filtered entity lists.
 * Handles authentication, safe locale detection, RBAC, and fetches initial data for EntitiesWrapper.
 */
export default async function EntitiesPage(props: LocalePageProps<{}>) {
  // STUB: Ensure DB connection/session for request lifecycle.
  // TODO: Replace this with actual serverless DB/session management suited for your hosting (see step-by-step below).
  // 1. If running in serverless (Vercel/edge), abstract DB connection to a connection-pool aware hook/module.
  // 2. Remove or move this to app-level middleware once connection/session is managed globally.
  await connection()

  // Await route params and search parameters from Next.js context
  const params = await props.params
  const searchParams = await props.searchParams

  // Derive the user's actual locale, fallback to default if needed
  // Ensures all downstream components can safely use a valid locale
  const locale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)

  // Server-side authentication – users must be signed in to view entities
  const session = await auth()
  if (!session?.user) {
    // Redirect to the login page, preserving intended callback/return link
    redirect(`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ENTITIES(locale))}`)
  }

  // Resolve user role for RBAC (Role-Based Access Control)
  // If the resolver performs asynchronous logic (e.g. reads from DB/session), change to an await call
  // TODO: If role resolution relies on data that could change often, consider caching at session load
  const userRole = resolveSessionUserRole(session)

  // Pagination and filtering setup: safely parse all query params, with defaults for missing/invalid
  const page = Number(searchParams.page ?? '1')
  const limit = Number(searchParams.limit ?? '20')
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'dateAdded'
  const filter = typeof searchParams.filter === 'string' ? searchParams.filter : 'all'
  const startAfter = typeof searchParams.startAfter === 'string' ? searchParams.startAfter : undefined

  // Construct the backend entity filters, handling types and ensuring valid filter values.
  const entityFilters = {
    search: typeof searchParams.q === 'string' ? searchParams.q : undefined,
    types:
      typeof searchParams.types === 'string'
        ? (searchParams.types.split(',').filter(Boolean) as import('@/features/entities/types').EntityType[])
        : undefined,
    location: typeof searchParams.location === 'string' ? searchParams.location : undefined,
    sortBy: sort as import('@/features/entities/services/get-entities').EntityFilters['sortBy'],
    sortOrder: searchParams.sortOrder === 'asc' ? 'asc' as const : 'desc' as const,
  }

  // Prepare state for initial entity list/pagination
  let initialEntities: any[] = []
  let initialError: string | null = null
  let totalEntities = 0
  let lastVisible: string | null = null

  try {
    // Dynamically import the entity loading logic so that unused RBAC code is tree-shaken out
    // TODO: If possible, switch this to a static import and use React 19 async Server Components for streaming partial data (see below).
    const { getEntitiesForRole } = await import('@/features/entities/services/get-entities')

    // Validate and assert the user's effective role for RBAC
    const effectiveUserRole = assertKnownUserRole(userRole as UserRolesArray)

    // Fetch the entities for this user, role, and current filters
    // TODO: In the future, migrate this async operation into a dedicated Server Component (or a Client Component with React 19's `use()`).
    const result = await getEntitiesForRole({
      userRole: effectiveUserRole,
      limit,
      startAfter,
      filters: entityFilters,
    })

    // Assign loaded data for use in EntitiesWrapper below
    initialEntities = result.entities
    totalEntities = result.totalCount ?? result.entities.length
    lastVisible = result.lastVisible
  } catch (error) {
    // Error handling for entity loading logic: log and set generic message for UI display
    console.error('EntitiesPage: Failed to load entities', error)
    initialError = 'Failed to load entities. Please try again.'
  }

  // Consistent UX: always show at least one page, regardless of data
  const totalPages = Math.max(
    1,
    Math.ceil((totalEntities || initialEntities.length || 1) / Math.max(1, limit))
  )

  // TODO (now actionably possible in Next16/React19): Switch EntitiesWrapper to server or client component using React 19 Suspense and streaming, 
  // for loading skeleton UIs under pagination/filter changes while next page is resolving.
  // Eg: Convert EntitiesWrapper to:
  //   1. An async server component receiving the same props (with static import of getEntitiesForRole and await inside component)
  //   2. Use React <Suspense fallback={<EntitiesSkeleton />}><EntitiesWrapper ... /></Suspense> for smooth progressive pagination.

  // Render the entities data. EntitiesWrapper will receive initial state only (hydrated client-side if user pages/filters further).
  return (
    <EntitiesWrapper
      initialEntities={initialEntities}
      initialError={initialError}
      page={page}
      totalPages={totalPages}
      totalEntities={totalEntities || initialEntities.length}
      lastVisible={lastVisible}
      initialLimit={limit}
      initialSort={sort}
      initialFilter={filter}
    />
  )
}

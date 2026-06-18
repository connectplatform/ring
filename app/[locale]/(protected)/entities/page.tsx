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
import { UserRole } from '@/features/auth/types'
import { resolveSessionUserRole } from '@/features/auth/user-role'
import type { LocalePageProps } from '@/utils/page-props'


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'entities.list',
    pathname: '/entities',
    robots: { index: false, follow: false },
  })
}

export default async function EntitiesPage(props: LocalePageProps<{}>) {
  await connection()

  const params = await props.params
  const searchParams = await props.searchParams
  const locale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)

  const session = await auth()
  if (!session?.user) {
    redirect(`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ENTITIES(locale))}`)
  }

  const page = Number(searchParams.page ?? '1')
  const limit = Number(searchParams.limit ?? '20')
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'dateAdded'
  const filter = typeof searchParams.filter === 'string' ? searchParams.filter : 'all'
  const startAfter = typeof searchParams.startAfter === 'string' ? searchParams.startAfter : undefined

  let initialEntities: any[] = []
  let initialError: string | null = null
  let totalEntities = 0
  let lastVisible: string | null = null

  try {
    const { getEntitiesForRole } = await import('@/features/entities/services/get-entities')
    const userRole = resolveSessionUserRole(session.user.role)
    const result = await getEntitiesForRole({
      userRole,
      limit,
      startAfter,
      filters: {
        sortBy: sort as any,
      },
    })
    initialEntities = result.entities
    totalEntities = result.totalCount ?? result.entities.length
    lastVisible = result.lastVisible
  } catch (error) {
    console.error('EntitiesPage: Failed to load entities', error)
    initialError = 'Failed to load entities. Please try again.'
  }

  const totalPages = Math.max(1, Math.ceil((totalEntities || initialEntities.length || 1) / Math.max(1, limit)))

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

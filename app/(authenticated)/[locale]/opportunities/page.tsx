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
import { UserRole } from '@/features/auth/types'
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
    path: 'opportunities.list',
    pathname: '/opportunities',
    robots: { index: false, follow: false },
  })
}

export default async function OpportunitiesPage(props: LocalePageProps<{}>) {
  await connection()

  const params = await props.params
  const searchParams = await props.searchParams
  const locale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)

  const session = await auth()
  if (!session?.user) {
    redirect(`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.OPPORTUNITIES(locale))}`)
  }

  const limit = Number(searchParams.limit ?? '20')
  const startAfter = typeof searchParams.startAfter === 'string' ? searchParams.startAfter : undefined

  let initialOpportunities: any[] = []
  let initialError: string | null = null
  let lastVisible: string | null = null

  try {
    const { getOpportunitiesForRole } = await import('@/features/opportunities/services/get-opportunities')
    const userRole = (session.user.role as UserRole) || UserRole.SUBSCRIBER
    const result = await getOpportunitiesForRole({
      userRole,
      limit,
      startAfter,
    })
    initialOpportunities = result.opportunities
    lastVisible = result.lastVisible
  } catch (error) {
    console.error('OpportunitiesPage: Failed to load opportunities', error)
    initialError = 'Failed to load opportunities. Please try again.'
  }

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

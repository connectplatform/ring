import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { auth as getAuthSession } from '@/auth'
import type { Session } from 'next-auth'
import { OpportunitySubmenuCounts, SerializedOpportunity } from '@/features/opportunities/types'
import MyOpportunitiesWrapper from '@/components/wrappers/my-opportunities-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'
import {
  type MyOpportunitiesCounts,
  type MyOpportunitiesView,
  parseMyOpportunitiesView,
} from '@/features/opportunities/lib/lifecycle-status'

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
    path: 'opportunities.my',
    pathname: '/opportunities/my',
    robots: { index: false, follow: false },
  })
}

export default async function MyOpportunitiesPage(props: LocalePageProps<Record<string, never>>) {
  await connection()

  const params = await props.params
  const searchParams = await props.searchParams
  const validLocale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)

  const authSession = (await getAuthSession()) as Session | null
  if (!authSession?.user) {
    localizedRedirect({
      locale: validLocale,
      href: '/login',
      query: {
        callbackUrl: ROUTES.MY_OPPORTUNITIES(validLocale),
      },
    })
  }

  const limit = parseInt(String(searchParams.limit ?? '50'), 10) || 50
  const startAfter = searchParams.startAfter as string | undefined
  const viewParam = (searchParams.view ?? searchParams.filter ?? searchParams.tab) as
    | string
    | undefined
  const view: MyOpportunitiesView = parseMyOpportunitiesView(viewParam)

  let opportunities: SerializedOpportunity[] = []
  let lastVisible: string | null = null
  let counts: OpportunitySubmenuCounts = {
    all: 0,
    saved: 0,
    applied: 0,
    posted: 0,
    drafts: 0,
    expired: 0,
  }
  let lifecycleCounts: MyOpportunitiesCounts = {
    all: 0,
    drafts: 0,
    pending: 0,
    active: 0,
    archived: 0,
  }
  let error: string | null = null

  try {
    const { getMyOpportunities: getMyOpportunitiesService } = await import(
      '@/features/opportunities/services/get-user-opportunities'
    )
    const data = await getMyOpportunitiesService(view, limit, startAfter)
    opportunities = data.opportunities
    lastVisible = data.lastVisible
    counts = data.counts
    lifecycleCounts = data.lifecycleCounts
  } catch (e) {
    logger.error('MyOpportunitiesPage: Error:', e)
    error =
      e instanceof Error && e.message === 'UNAUTHORIZED'
        ? 'You must be logged in to view your opportunities.'
        : 'Failed to load your opportunities. Please try again later.'
  }

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900" />
        </div>
      }
    >
      <MyOpportunitiesWrapper
        locale={validLocale}
        initialOpportunities={opportunities}
        initialError={error}
        lastVisible={lastVisible}
        initialLimit={limit}
        initialView={view}
        counts={counts}
        lifecycleCounts={lifecycleCounts}
      />
    </Suspense>
  )
}

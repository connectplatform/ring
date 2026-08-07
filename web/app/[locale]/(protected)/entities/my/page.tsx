import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { auth as getAuthSession } from '@/auth'
import type { Session } from 'next-auth'
import type { SerializedEntity } from '@/features/entities/types'
import MyEntitiesWrapper from '@/components/wrappers/my-entities-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'
import {
  type MyEntitiesView,
  type MyEntitiesCounts,
  parseMyEntitiesView,
} from '@/features/entities/lib/my-entities-views'

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
    path: 'entities.my',
    pathname: '/entities/my',
    robots: { index: false, follow: false },
  })
}

export default async function MyEntitiesPage(props: LocalePageProps<Record<string, never>>) {
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
        callbackUrl: ROUTES.MY_ENTITIES(validLocale),
      },
    })
  }

  const limit = parseInt(String(searchParams.limit ?? '50'), 10) || 50
  const viewParam = (searchParams.view ?? searchParams.tab) as string | undefined
  const view: MyEntitiesView = parseMyEntitiesView(viewParam)

  let entities: SerializedEntity[] = []
  let lastVisible: string | null = null
  let counts: MyEntitiesCounts = { all: 0, store: 0, member: 0 }
  let error: string | null = null

  try {
    const { getMyEntities } = await import('@/features/entities/services/get-user-entities')
    const data = await getMyEntities(view, limit)
    entities = data.entities
    lastVisible = data.lastVisible
    counts = data.counts
  } catch (e) {
    logger.error('MyEntitiesPage: Error:', e)
    error =
      e instanceof Error &&
      (e.name === 'EntityAuthError' || e.message === 'UNAUTHORIZED')
        ? 'You must be logged in to view your entities.'
        : 'Failed to load your entities. Please try again later.'
  }

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900" />
        </div>
      }
    >
      <MyEntitiesWrapper
        locale={validLocale}
        initialEntities={entities}
        initialError={error}
        lastVisible={lastVisible}
        initialLimit={limit}
        initialView={view}
        counts={counts}
      />
    </Suspense>
  )
}

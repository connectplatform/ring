import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { LocalFavoritesIsland } from '@/features/store/components/local-favorites-island'
import { getCurrentProjectUserDataService } from '@/features/auth/services/project-user-data-service'
import type { UserFavorite } from '@/features/auth/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bookmark, Heart, Newspaper } from 'lucide-react'

interface FavoritesPageProps {
  params: Promise<{ locale: string }>
}

function favoriteIdOf(row: UserFavorite | Record<string, unknown>): string {
  const record = row as Record<string, unknown>
  return String(record.favoriteId || record.favorite_id || '')
}

function favoriteTypeOf(row: UserFavorite | Record<string, unknown>): string {
  const record = row as Record<string, unknown>
  return String(record.favoriteType || record.favorite_type || '')
}

export async function generateMetadata({ params }: FavoritesPageProps): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'favorites',
    pathname: '/favorites',
    robots: { index: false, follow: false },
  })
}

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  await connection()
  const { locale: localeParam } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    localizedRedirect({
      locale,
      href: '/login',
      query: { callbackUrl: ROUTES.FAVORITES(locale) },
    })
  }

  const t = await getTranslations('modules.opportunities')
  const projectSlug = process.env.NEXT_PUBLIC_PROJECT_SLUG || 'ring-platform.org'
  const service = getCurrentProjectUserDataService()
  let products: Array<UserFavorite | Record<string, unknown>> = []
  let content: Array<UserFavorite | Record<string, unknown>> = []
  try {
    const [productRows, contentRows] = await Promise.all([
      service.getUserFavorites(session!.user.id, projectSlug, 'product'),
      service.getUserFavorites(session!.user.id, projectSlug, 'content'),
    ])
    products = productRows
    content = contentRows
  } catch {
    products = []
    content = []
  }

  return (
    <RingRightRailLayout showRightRail={false} flushCenterPane>
      <DavinciCenterPane>
        <h1 className="text-2xl font-bold tracking-tight">{t('favoritesHubTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('favoritesHubDescription')}</p>

        <Card className="mt-6">
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <Bookmark className="h-5 w-5" />
              <h2 className="text-lg font-semibold">{t('savedOpportunities')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t('favoritesSavedOpportunitiesHint')}</p>
            <Button asChild>
              <Link href={`${ROUTES.MY_OPPORTUNITIES(locale)}?view=saved`}>
                {t('favoritesSavedOpportunitiesLink')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              <h2 className="text-lg font-semibold">{t('favoritesProducts')}</h2>
            </div>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('favoritesEmptyProducts')}</p>
            ) : (
              <ul className="space-y-2">
                {products.map((row) => {
                  const id = favoriteIdOf(row)
                  return (
                    <li key={`${favoriteTypeOf(row)}-${id}`}>
                      <Link href={ROUTES.STORE_PRODUCT(id, locale)} className="text-sm hover:underline">
                        {id}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            <LocalFavoritesIsland locale={locale} />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="space-y-3 py-6">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              <h2 className="text-lg font-semibold">{t('favoritesContent')}</h2>
            </div>
            {content.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('favoritesEmptyContent')}</p>
            ) : (
              <ul className="space-y-2">
                {content.map((row) => {
                  const id = favoriteIdOf(row)
                  return (
                    <li key={`${favoriteTypeOf(row)}-${id}`}>
                      <Link href={`${ROUTES.NEWS(locale)}/${encodeURIComponent(id)}`} className="text-sm hover:underline">
                        {id}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}

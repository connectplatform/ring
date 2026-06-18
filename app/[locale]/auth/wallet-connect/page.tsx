import type { Metadata } from 'next'
import { auth } from '@/auth'
import { WalletConnectAuth } from '@/features/auth/components/wallet-connect-auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { redirectPostAuth } from '@/lib/auth/safe-post-auth-redirect'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { LocalePageProps } from '@/utils/page-props'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'

type WalletConnectParams = Record<string, never>

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value[0]) return value[0]
  return undefined
}

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
    path: 'auth.walletConnect',
    pathname: '/auth/wallet-connect',
    robots: { index: false, follow: false },
  })
}

export default async function WalletConnectPage(props: LocalePageProps<WalletConnectParams>) {
  await connection()

  const params = await props.params
  const searchParams = await props.searchParams

  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const rawFrom = searchParams.from ?? searchParams.callbackUrl ?? searchParams.returnTo
  const from =
    typeof rawFrom === 'string'
      ? rawFrom
      : Array.isArray(rawFrom) && rawFrom[0]
        ? rawFrom[0]
        : undefined

  const session = await auth()
  if (session?.user && !session.user.needsOnboarding) {
    redirectPostAuth(from, locale)
  }

  const tPages = await getTranslations('pages.walletConnect')

  return (
    <div className="min-h-[100dvh] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">{tPages('title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{tPages('subtitle')}</p>
        </div>
        <WalletConnectAuth locale={locale} from={from} />
      </div>
    </div>
  )
}

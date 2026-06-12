import type { Metadata } from 'next'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { redirectPostAuth } from '@/lib/auth/safe-post-auth-redirect'
import { connection } from 'next/server'

type LoginParams = Record<string, never>

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
    path: 'auth.login',
    pathname: '/login',
    robots: { index: false, follow: false },
  })
}

export default async function LoginPage(props: LocalePageProps<LoginParams>) {
  await connection()

  const params = await props.params
  const searchParams = await props.searchParams

  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  const rawFrom = searchParams.from ?? searchParams.callbackUrl ?? searchParams.returnTo
  const from =
    typeof rawFrom === 'string'
      ? rawFrom
      : Array.isArray(rawFrom) && rawFrom[0]
        ? rawFrom[0]
        : undefined

  const session = await auth()
  const hasOAuthCallbackParams = Boolean(
    firstSearchParam(searchParams.code) ||
      firstSearchParam(searchParams.state) ||
      firstSearchParam(searchParams.error) ||
      firstSearchParam(searchParams.session_state),
  )
  if (session?.user && !hasOAuthCallbackParams) {
    redirectPostAuth(from, locale)
  }

  const tPages = await getTranslations('pages')
  const authError = firstSearchParam(searchParams.error)

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">{tPages('login.title')}</h1>
          <p className="text-muted-foreground">{tPages('login.subtitle')}</p>
        </div>
        <UnifiedLoginInline from={from} variant="hero" locale={locale} initialAuthError={authError} />
      </div>
    </div>
  )
}

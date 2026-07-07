import type { Metadata } from 'next'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LoginAuthenticatedRedirect } from '@/features/auth/components/login-authenticated-redirect'
import { connection } from 'next/server'

type RegisterParams = Record<string, never>

/**
 * Helper to get the first value of a search parameter.
 * Handles both string and string[] (array from URLSearchParams).
 */
function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value[0]) return value[0]
  return undefined
}

// TODO: Next.js 16 and React 19 support the new Metadata API with generateMetadata static export. Consider switching to static export if feasible.

/**
 * Build page metadata for /register, using requested locale or fallback to default.
 * Disables indexing for registration.
 */
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
    path: 'auth.register',
    pathname: '/register',
    robots: { index: false, follow: false },
  })
}

/**
 * Registration entry — same auth surface as login.
 * Logged-in users are bounced client-side (never create a second account).
 */
export default async function RegisterPage(props: LocalePageProps<RegisterParams>) {
  // TODO: With React 19+ Next 16, see if intercepting and redirecting logged-in users server-side is preferable to a client-side bounce.

  // Ensures DB or session connectivity before proceeding. Will throw if unauthenticated/connection fails.
  await connection()

  // Resolve URL params and search params from Next.js context.
  const params = await props.params
  const searchParams = await props.searchParams

  // Select a valid locale, fallback to default.
  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  // Extract "from" parameter from multiple possible sources in search params
  // (common in OAuth or redirection URLs).
  const rawFrom = searchParams.from ?? searchParams.callbackUrl ?? searchParams.returnTo
  const from =
    typeof rawFrom === 'string'
      ? rawFrom
      : Array.isArray(rawFrom) && rawFrom[0]
        ? rawFrom[0]
        : undefined

  // Detects if this page load is a callback after OAuth, disabling redirect if so.
  const hasOAuthCallbackParams = Boolean(
    firstSearchParam(searchParams.code) ||
      firstSearchParam(searchParams.state) ||
      firstSearchParam(searchParams.error) ||
      firstSearchParam(searchParams.session_state),
  )

  // Fetches translation dictionary for the "pages" namespace.
  const tPages = await getTranslations('pages')
  // Extract error codes (used for displaying auth errors)
  const authError = firstSearchParam(searchParams.error)

  return (
    <>
      {/* If user already logged in, they are redirected (unless this is an OAuth callback roundtrip) */}
      <LoginAuthenticatedRedirect
        from={from}
        locale={locale}
        disabled={hasOAuthCallbackParams}
      />
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">
              {/* Registration and login share title translations; fallback to login if registration title missing. */}
              {tPages('register.title', { defaultValue: tPages('login.title') })}
            </h1>
            <p className="text-muted-foreground">
              {/* Subtitle works as above, fallback from registration to login string. */}
              {tPages('register.subtitle', { defaultValue: tPages('login.subtitle') })}
            </p>
          </div>
          <UnifiedLoginInline
            from={from}
            variant="hero"
            locale={locale}
            initialAuthError={authError}
          />
        </div>
      </div>
    </>
  )
}

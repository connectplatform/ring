import { NextResponse, NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { routing, type Locale } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import {
  applyIntlMiddlewareOutcome,
  detectLanguageSwitch,
  intlMiddleware,
  isIntlSelfReferentialRedirect,
  stripLocaleFromPathname,
  finalizeIntlResponse,
  nextWithPathHeaders,
  stampPreferredLocaleCookie,
  withUpstreamPathHeaders,
} from '@/lib/proxy-intl'
import {
  REF_COOKIE_MAX_AGE_SECONDS,
  REF_COOKIE_NAME,
  REF_VISIBLE_COOKIE_NAME,
} from '@/features/refcodes/constants'
import { acceptPrefersMarkdown } from '@/lib/docs/docs-agent-accept'
import { sessionTokenCookieCandidates } from '@/lib/auth/auth-cookie-names'

/**
 * next-intl + optimistic session-cookie gate for /profile and /settings,
 * plus soft needsOnboarding redirect for protected app routes.
 * Role checks and GIS live in layouts and Server Components (auth()).
 * Next.js 16: proxy.ts replaces middleware.ts.
 */
export default async function proxy(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl

    if (
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.includes('.')
    ) {
      return NextResponse.next()
    }

    // Docs Accept: text/markdown → same API as /.md twin (AWS-style negotiation).
    // Only when markdown q > html q so browsers keep HTML.
    {
      const localeFromPathEarly = pathname.split('/')[1] || routing.defaultLocale
      const localeEarly = routing.locales.includes(localeFromPathEarly as Locale)
        ? localeFromPathEarly
        : routing.defaultLocale
      const strippedEarly = stripLocaleFromPathname(pathname)
      if (
        (strippedEarly === '/docs' || strippedEarly.startsWith('/docs/')) &&
        acceptPrefersMarkdown(req.headers.get('accept'))
      ) {
        const slugPart =
          strippedEarly === '/docs' ? '' : strippedEarly.replace(/^\/docs\/?/, '')
        const destPath = slugPart
          ? `/api/docs/markdown/${localeEarly}/${slugPart}`
          : `/api/docs/markdown/${localeEarly}`
        return NextResponse.rewrite(new URL(destPath, req.url))
      }
    }

    const intlReq = withUpstreamPathHeaders(req)
    let i18nResponse = intlMiddleware(intlReq)
    if (i18nResponse) {
      const status = i18nResponse.status
      if (status >= 300 && status < 400) {
        if (isIntlSelfReferentialRedirect(intlReq, i18nResponse)) {
          i18nResponse = applyIntlMiddlewareOutcome(intlReq, i18nResponse)
        } else {
          return stampPreferredLocaleCookie(req, i18nResponse)
        }
      }
    }

    const localeFromPath = pathname.split('/')[1] || routing.defaultLocale
    const locale = routing.locales.includes(localeFromPath as Locale)
      ? localeFromPath
      : routing.defaultLocale

    const stripped = stripLocaleFromPathname(pathname)

    const sessionToken = sessionTokenCookieCandidates(
      intlReq.nextUrl.protocol === 'https:',
    )
      .map((name) => intlReq.cookies.get(name)?.value)
      .find(Boolean)
    const isLoggedIn = !!sessionToken

    const isLanguageSwitch = detectLanguageSwitch(intlReq, stripped)

    const protectedRoutes = ['/profile', '/settings']

    if (protectedRoutes.includes(stripped) && !isLoggedIn && !isLanguageSwitch) {
      const url = new URL(ROUTES.LOGIN(locale as Locale), intlReq.nextUrl.origin)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }

    // Soft-gate: incomplete vitals → onboarding (login/onboarding/API stay public)
    const onboardingExempt =
      stripped.startsWith('/login') ||
      stripped.startsWith('/auth') ||
      stripped.startsWith('/register') ||
      stripped === '/'
    if (isLoggedIn && !onboardingExempt && !isLanguageSwitch) {
      const token = await getToken({
        req: intlReq,
        secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      })
      if (token?.needsOnboarding === true) {
        const url = new URL(`/${locale}/login/onboarding`, intlReq.nextUrl.origin)
        url.searchParams.set('from', pathname)
        return NextResponse.redirect(url)
      }
    }

    const response = finalizeIntlResponse(req, intlReq, i18nResponse)
    const refParam = intlReq.nextUrl.searchParams.get('ref')?.trim()
    if (refParam && !intlReq.cookies.get(REF_COOKIE_NAME)?.value) {
      response.cookies.set(REF_COOKIE_NAME, refParam, {
        maxAge: REF_COOKIE_MAX_AGE_SECONDS,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      })
      response.cookies.set(REF_VISIBLE_COOKIE_NAME, refParam, {
        maxAge: REF_COOKIE_MAX_AGE_SECONDS,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      })
    }
    return response
  } catch (error) {
    console.error('Proxy error:', error)
    return nextWithPathHeaders(req)
  }
}

export const config = {
  // Skip Next proxy for APIs, Next internals, and static public assets.
  // Without this, missing public files still get locale HTML shells for /scripts/*.js
  // (Unexpected token '<' in the browser). Explicit prefixes keep the early-return path honest.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|scripts/|icons/|images/|fonts|styles/|acknowledgements/|firebase-messaging-sw\\.js|push-sw\\.js|.*\\..*).*)',
  ],
}

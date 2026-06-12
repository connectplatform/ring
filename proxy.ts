import { NextResponse, NextRequest } from 'next/server'
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
  withUpstreamPathHeaders,
} from '@/lib/proxy-intl'
import {
  REF_COOKIE_MAX_AGE_SECONDS,
  REF_COOKIE_NAME,
  REF_VISIBLE_COOKIE_NAME,
} from '@/features/refcodes/constants'

/**
 * next-intl + optimistic session-cookie gate for /profile and /settings only.
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

    const intlReq = withUpstreamPathHeaders(req)
    let i18nResponse = intlMiddleware(intlReq)
    if (i18nResponse) {
      const status = i18nResponse.status
      if (status >= 300 && status < 400) {
        if (isIntlSelfReferentialRedirect(intlReq, i18nResponse)) {
          i18nResponse = applyIntlMiddlewareOutcome(intlReq, i18nResponse)
        } else {
          return i18nResponse
        }
      }
    }

    const localeFromPath = pathname.split('/')[1] || routing.defaultLocale
    const locale = routing.locales.includes(localeFromPath as Locale)
      ? localeFromPath
      : routing.defaultLocale

    const stripped = stripLocaleFromPathname(pathname)

    const sessionToken =
      intlReq.cookies.get('next-auth.session-token')?.value ||
      intlReq.cookies.get('__Secure-next-auth.session-token')?.value
    const isLoggedIn = !!sessionToken

    const isLanguageSwitch = detectLanguageSwitch(intlReq, stripped)

    const protectedRoutes = ['/profile', '/settings']

    if (protectedRoutes.includes(stripped) && !isLoggedIn && !isLanguageSwitch) {
      const url = new URL(ROUTES.LOGIN(locale as Locale), intlReq.nextUrl.origin)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

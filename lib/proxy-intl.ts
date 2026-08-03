import { NextResponse, NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing, type Locale } from '@/i18n/routing'
import { stripHreflangLinkHeaders } from '@/lib/hreflang'

/** Shared next-intl middleware instance for proxy.ts (localePrefix: as-needed). */
export const intlMiddleware = createMiddleware(routing)

/**
 * Prefer explicit `ring-locale` over Accept-Language by syncing `NEXT_LOCALE`
 * onto the request cookie jar before next-intl resolves unprefixed paths.
 */
export function withRingLocalePreferred(req: NextRequest): NextRequest {
  const preferred = req.cookies.get('ring-locale')?.value
  if (!preferred || !routing.locales.includes(preferred as Locale)) {
    return req
  }
  if (req.cookies.get('NEXT_LOCALE')?.value === preferred) {
    return req
  }

  const headers = new Headers(req.headers)
  const rebuilt = req.cookies
    .getAll()
    .filter((c) => c.name !== 'NEXT_LOCALE')
    .map((c) => `${c.name}=${c.value}`)
  rebuilt.push(`NEXT_LOCALE=${preferred}`)
  headers.set('cookie', rebuilt.join('; '))
  return new NextRequest(req.nextUrl, { headers })
}

/** Clone request so downstream `headers()` (RSC) sees pathname before next-intl forwards headers. */
export function withUpstreamPathHeaders(req: NextRequest): NextRequest {
  const preferred = withRingLocalePreferred(req)
  const headers = new Headers(preferred.headers)
  headers.set('x-pathname', preferred.nextUrl.pathname)
  headers.set('x-url', preferred.nextUrl.toString())
  return new NextRequest(preferred.nextUrl, { headers })
}

/**
 * next-intl + `localePrefix: 'as-needed'` can return a 307 whose Location equals the
 * current URL while setting `x-middleware-rewrite` — browsers loop on Location.
 */
export function isIntlSelfReferentialRedirect(
  req: NextRequest,
  response: NextResponse,
): boolean {
  const loc = response.headers.get('location')
  if (!loc) return false
  try {
    const target = new URL(loc, req.nextUrl.origin)
    return (
      target.origin === req.nextUrl.origin &&
      target.pathname === req.nextUrl.pathname &&
      target.search === req.nextUrl.search
    )
  } catch {
    return false
  }
}

/**
 * Apply next-intl internal rewrite without following a self-referential redirect.
 *
 * Matches next-intl v4's own `next()` pattern: forward ONLY request headers,
 * NOT the full `NextRequest` object (whose `.nextUrl` carries the unprefixed
 * pathname).  Passing the full request has caused regressions in Next.js 16
 * where `params` extraction reads `intlReq.nextUrl.pathname` (no `/en/`
 * prefix for the default locale) instead of the rewrite URL, making the
 * `[locale]` segment empty → route unmatched → 404.
 *
 * @see https://github.com/amannn/next-intl/blob/v4.8.3/packages/next-intl/src/middleware/middleware.tsx
 */
export function applyIntlMiddlewareOutcome(
  req: NextRequest,
  intlResponse: NextResponse,
): NextResponse {
  const rewritePath = intlResponse.headers.get('x-middleware-rewrite')
  if (rewritePath) {
    const rewriteUrl = new URL(rewritePath, req.nextUrl)
    // next-intl passes `{ headers }` — not a full Request.  Doing so avoids
    // Next.js 16 route‑param extraction reading the source URL.
    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: req.headers },
    })
    intlResponse.headers.forEach((value, key) => {
      if (key === 'location' || key === 'x-middleware-rewrite') return
      response.headers.set(key, value)
    })
    return response
  }
  return intlResponse
}

/** Strip locale segment from raw `req.nextUrl.pathname` (routing.locales-aware). */
export function stripLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/')
  const hasLocalePrefix = routing.locales.includes(segments[1] as Locale)
  return hasLocalePrefix ? `/${segments.slice(2).join('/')}` || '/' : pathname
}

export function stripLocalePrefix(path: string): string {
  const segments = path.split('/')
  return routing.locales.includes(segments[1] as Locale)
    ? `/${segments.slice(2).join('/')}` || '/'
    : path
}

export function resolveLocaleFromPathname(pathname: string): string {
  const localeFromPath = pathname.split('/')[1] || routing.defaultLocale
  return routing.locales.includes(localeFromPath as Locale)
    ? localeFromPath
    : routing.defaultLocale
}

export function detectLanguageSwitch(
  req: NextRequest,
  strippedPath: string,
): boolean {
  const referer = req.headers.get('referer')
  if (!referer || !referer.includes(req.nextUrl.origin)) return false
  try {
    const refPath = new URL(referer).pathname
    const curPath = req.nextUrl.pathname
    return refPath !== curPath && stripLocalePrefix(refPath) === strippedPath
  } catch {
    return false
  }
}

/**
 * Run next-intl middleware; return rewrite outcome when redirect is self-referential.
 * Returns null when caller should return the redirect response as-is.
 */
export function runIntlMiddlewarePhase(
  req: NextRequest,
): NextResponse | null {
  const intlReq = withUpstreamPathHeaders(req)
  const i18nResponse = intlMiddleware(intlReq)
  if (!i18nResponse) return null
  const status = i18nResponse.status
  if (status >= 300 && status < 400) {
    if (isIntlSelfReferentialRedirect(intlReq, i18nResponse)) {
      return stampPathHeadersOnResponse(applyIntlMiddlewareOutcome(intlReq, i18nResponse), req)
    }
    return stampPathHeadersOnResponse(i18nResponse, req)
  }
  return null
}

/** Expose pathname to RSC `headers()` — hreflang, scoped i18n, SEO diagnostics. */
export function stampPathHeadersOnResponse(
  response: NextResponse,
  req: NextRequest,
): NextResponse {
  response.headers.set('x-pathname', req.nextUrl.pathname)
  response.headers.set('x-url', req.nextUrl.toString())
  stripHreflangLinkHeaders(response.headers)
  return response
}

/** Forward the request with path headers (request + response) for layouts reading `headers()`. */
export function nextWithPathHeaders(req: NextRequest, intlReq?: NextRequest): NextResponse {
  const request = intlReq ?? withUpstreamPathHeaders(req)
  // `next()` is a passthrough (URL unchanged) so no locale-prefix mismatch.
  // Pass the full NextRequest — headers carry x-pathname/x-url.
  return stampPathHeadersOnResponse(NextResponse.next({ request }), req)
}

/** Finalize intl rewrite or fall through with path headers stamped. */
export function finalizeIntlResponse(
  req: NextRequest,
  intlReq: NextRequest,
  intlResponse: NextResponse | null | undefined,
): NextResponse {
  let response: NextResponse
  if (intlResponse) {
    // Rewrites must forward `intlReq` (carries x-pathname) or RSC `headers()` falls back to `/`
    // and scoped i18n loads `public-home` — dropping namespaces like deployment-calculator.
    if (intlResponse.headers.get('x-middleware-rewrite')) {
      response = stampPathHeadersOnResponse(applyIntlMiddlewareOutcome(intlReq, intlResponse), req)
    } else {
      const passthrough = NextResponse.next({ request: intlReq })
      intlResponse.cookies.getAll().forEach((cookie) => passthrough.cookies.set(cookie))
      response = stampPathHeadersOnResponse(passthrough, req)
    }
  } else {
    response = nextWithPathHeaders(req, intlReq)
  }
  return stampPreferredLocaleCookie(req, response)
}

/**
 * Persist NEXT_LOCALE from ring-locale so the next bare-path hit does not
 * renegotiate via Accept-Language after an explicit language choice.
 */
export function stampPreferredLocaleCookie(
  req: NextRequest,
  response: NextResponse,
): NextResponse {
  const preferred = req.cookies.get('ring-locale')?.value
  if (!preferred || !routing.locales.includes(preferred as Locale)) {
    return response
  }
  if (req.cookies.get('NEXT_LOCALE')?.value === preferred) {
    return response
  }
  response.cookies.set('NEXT_LOCALE', preferred, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return response
}

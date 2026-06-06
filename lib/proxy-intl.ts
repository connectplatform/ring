import { NextResponse, NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing, type Locale } from '@/i18n/routing'

/** Shared next-intl middleware instance for proxy.ts (localePrefix: as-needed). */
export const intlMiddleware = createMiddleware(routing)

/** Clone request so downstream `headers()` (RSC) sees pathname before next-intl forwards headers. */
export function withUpstreamPathHeaders(req: NextRequest): NextRequest {
  const headers = new Headers(req.headers)
  headers.set('x-pathname', req.nextUrl.pathname)
  headers.set('x-url', req.nextUrl.toString())
  return new NextRequest(req.nextUrl, { headers })
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

/** Apply next-intl internal rewrite without following a self-referential redirect. */
export function applyIntlMiddlewareOutcome(
  req: NextRequest,
  intlResponse: NextResponse,
): NextResponse {
  const rewritePath = intlResponse.headers.get('x-middleware-rewrite')
  if (rewritePath) {
    const rewriteUrl = new URL(rewritePath, req.nextUrl)
    const response = NextResponse.rewrite(rewriteUrl, { request: req })
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
  return response
}

/** Forward the request with path headers (request + response) for layouts reading `headers()`. */
export function nextWithPathHeaders(req: NextRequest, intlReq?: NextRequest): NextResponse {
  const request = intlReq ?? withUpstreamPathHeaders(req)
  return stampPathHeadersOnResponse(NextResponse.next({ request }), req)
}

/** Finalize intl rewrite or fall through with path headers stamped. */
export function finalizeIntlResponse(
  req: NextRequest,
  intlReq: NextRequest,
  intlResponse: NextResponse | null | undefined,
): NextResponse {
  if (intlResponse) {
    return stampPathHeadersOnResponse(intlResponse, req)
  }
  return nextWithPathHeaders(req, intlReq)
}

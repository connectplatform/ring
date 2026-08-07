/**
 * Post-auth navigation: Zod schemas enforce path-traversal and open-redirect rules.
 * URL vs relative string is split with `URL` + origin allowlist, then validated.
 */
import { z, type ZodError } from 'zod'
import { withLocale, ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { defaultLocale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { localizedRedirect, type LocalizedRedirectHref } from '@/lib/i18n-server-redirect'

const localeIdList = routing.locales as readonly string[]

function isValidLocaleString(s: string | undefined): s is Locale {
  return s != null && localeIdList.includes(s)
}

/** Strip a leading locale segment so next-intl navigation does not double-prefix (`/uk/uk/...`). */
export function stripLocalePrefix(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  const segs = path.split('/').filter(Boolean)
  if (segs[0] && isValidLocaleString(segs[0])) {
    return segs.length > 1 ? `/${segs.slice(1).join('/')}` : '/'
  }
  return path
}

function appOriginOrNull(): string | null {
  if (typeof process === 'undefined' || !process.env.NEXT_PUBLIC_APP_URL) {
    return null
  }
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL).origin
  } catch {
    return null
  }
}

/** In-app path only (no auth / API / system routes). */
export const postAuthPathnameZ = z
  .string()
  .refine((p) => p.startsWith('/'), 'Path must be absolute in-app (leading /).')
  .refine((p) => !p.startsWith('//') && !p.includes('..'), 'Invalid path (no parent traversal).')
  .refine(
    (p) =>
      !p.startsWith('/api') &&
      !p.startsWith('/_next') &&
      !p.startsWith('/_vercel'),
    'Path must not target API or system routes.',
  )
  .refine(
    (p) => p !== '/login' && p !== '/register' && p !== '/forgot-password',
    'Path must not be a sign-in flow.',
  )
  .refine(
    (p) => !p.startsWith('/auth/') && !p.includes('/auth/status/'),
    'Path must not be an auth status URL.',
  )

const postAuthQueryZ = z.string().max(4096).refine((q) => !q.includes('//'), 'Query string looks unsafe.')

export const postAuthPathSearchZ = z.object({
  path: postAuthPathnameZ,
  search: z.union([z.literal(''), postAuthQueryZ]),
})

export type PostAuthPathSearch = z.infer<typeof postAuthPathSearchZ>

function splitReturnToToPathSearch(raw: string): { path: string; search: string } | null {
  const s = raw.trim()
  if (s.length === 0) {
    return null
  }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    let u: URL
    try {
      u = new URL(s)
    } catch {
      return null
    }
    const appO = appOriginOrNull()
    if (appO) {
      if (u.origin !== appO) {
        return null
      }
    } else if (typeof window === 'undefined' || u.origin !== window.location.origin) {
      return null
    }
    return { path: u.pathname, search: u.search }
  }
  const q = s.indexOf('?')
  if (q === -1) {
    return { path: s, search: '' }
  }
  return { path: s.slice(0, q), search: s.slice(q) }
}

export function parseReturnToToPathSearch(
  returnTo: string | null | undefined,
):
  | { success: true; data: PostAuthPathSearch }
  | { success: false; error: ZodError } {
  if (returnTo == null) {
    return { success: false, error: new z.ZodError([{ code: 'custom', message: 'empty', path: [] }]) }
  }
  const asString = String(returnTo).trim()
  if (asString === '') {
    return { success: false, error: new z.ZodError([{ code: 'custom', message: 'empty', path: [] }]) }
  }
  const parts = splitReturnToToPathSearch(asString)
  if (parts == null) {
    return { success: false, error: new z.ZodError([{ code: 'custom', message: 'parse', path: [] }]) }
  }
  const v = postAuthPathSearchZ.safeParse(parts)
  if (!v.success) {
    return { success: false, error: v.error }
  }
  return { success: true, data: v.data }
}

function resolveLogicalPostAuthPath(returnTo: string | undefined): PostAuthPathSearch | null {
  const parsed = parseReturnToToPathSearch(returnTo)
  if (!parsed.success) {
    return null
  }
  const { path, search } = parsed.data
  if (!path || path === '/undefined') {
    return null
  }
  return { path: stripLocalePrefix(path), search }
}

/**
 * Logical in-app path for `returnTo` query params (no locale prefix).
 * Prevents `/uk/uk/profile` when auth status re-applies locale on navigation.
 */
export function safePostAuthReturnTo(returnTo: string | undefined, _currentLocale?: Locale): string {
  const logical = resolveLogicalPostAuthPath(returnTo)
  if (!logical) {
    return '/profile'
  }
  return `${logical.path}${logical.search || ''}`
}

/** Logical pathname (+ optional query) for next-intl `redirect` / `router.push`. */
export function postAuthLogicalTarget(
  returnTo: string | undefined,
): { pathname: string; query?: Record<string, string> } {
  const logical = resolveLogicalPostAuthPath(returnTo)
  if (!logical) {
    return { pathname: '/profile' }
  }
  if (!logical.search) {
    return { pathname: logical.path }
  }
  const query = Object.fromEntries(
    new URLSearchParams(logical.search.replace(/^\?/, '')),
  ) as Record<string, string>
  return Object.keys(query).length > 0
    ? { pathname: logical.path, query }
    : { pathname: logical.path }
}

/** Server post-login redirect via next-intl (`localizedRedirect`). */
export function redirectPostAuth(returnTo: string | undefined, locale: Locale): never {
  const { pathname, query } = postAuthLogicalTarget(returnTo)
  localizedRedirect({
    locale,
    href: pathname as LocalizedRedirectHref,
    query,
  })
}

/** Safe, locale-consistent post-login target (full path for `next/link` without intl `Link`). */
export function safePostAuthRedirect(returnTo: string | undefined, currentLocale: Locale): string {
  const lo = isValidLocaleString(String(currentLocale)) ? currentLocale : (defaultLocale as Locale)
  const fallback = ROUTES.PROFILE(lo)

  const logical = resolveLogicalPostAuthPath(returnTo)
  if (!logical) {
    return fallback
  }

  const localized = withLocale(lo, logical.path)
  if (!localized) {
    return fallback
  }

  return `${localized}${logical.search || ''}` || fallback
}

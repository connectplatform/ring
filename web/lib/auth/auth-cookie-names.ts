/**
 * Clone-prefixed Auth.js cookie names (localhost multi-clone DX).
 * `ring-greenfood-live` → `greenfood-live.next-auth.session-token`
 * so JWTSessionError is not shared across clones on :3000.
 */
import concrete from '@/ring-config.json'

export function authCookieSlug(): string {
  const name = String(
    (concrete as { clone?: { name?: string } }).clone?.name ?? '',
  ).trim()
  if (!name) return ''
  return name.replace(/^ring-/, '')
}

/** Unprefixed Auth.js v4-compat names this codebase historically used. */
const AUTH_COOKIE_STEM = {
  sessionToken: 'next-auth.session-token',
  callbackUrl: 'next-auth.callback-url',
  csrfToken: 'next-auth.csrf-token',
} as const

function prefixedStem(stem: string): string {
  const slug = authCookieSlug()
  return slug ? `${slug}.${stem}` : stem
}

export function authSessionTokenCookieName(useSecureCookies: boolean): string {
  const stem = prefixedStem(AUTH_COOKIE_STEM.sessionToken)
  return useSecureCookies ? `__Secure-${stem}` : stem
}

export function authCallbackUrlCookieName(useSecureCookies: boolean): string {
  const stem = prefixedStem(AUTH_COOKIE_STEM.callbackUrl)
  return useSecureCookies ? `__Secure-${stem}` : stem
}

export function authCsrfTokenCookieName(useSecureCookies: boolean): string {
  const stem = prefixedStem(AUTH_COOKIE_STEM.csrfToken)
  return useSecureCookies ? `__Secure-${stem}` : stem
}

/** Edge/proxy: read this clone's session cookie, then legacy unprefixed names. */
export function sessionTokenCookieCandidates(useSecureCookies: boolean): string[] {
  const named = authSessionTokenCookieName(useSecureCookies)
  const unprefixed = useSecureCookies
    ? `__Secure-${AUTH_COOKIE_STEM.sessionToken}`
    : AUTH_COOKIE_STEM.sessionToken
  const extra = [
    AUTH_COOKIE_STEM.sessionToken,
    `__Secure-${AUTH_COOKIE_STEM.sessionToken}`,
    'authjs.session-token',
    '__Secure-authjs.session-token',
  ]
  return [...new Set([named, unprefixed, ...extra])]
}

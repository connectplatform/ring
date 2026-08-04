/**
 * Username referral share tags.
 *
 * Format: `{pathname}#username` (e.g. /store/product-slug#ray).
 *
 * Why `#` (not `?ref=`):
 * - Keeps marketing paths clean and avoids colliding with app query params.
 * - Hash is browser-only (never sent to Next.js proxy). Capture happens in
 *   {@link ReferralAttributionEffect} → POST /api/refcodes/track → Set-Cookie.
 *
 * Dual-path: `?ref=` still works via proxy.ts for server-side first-touch.
 */

export const REFERRAL_USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/

/** Normalize a username tag (strip @, lowercase). */
export function normalizeReferralUsername(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/^@+/, '')
  if (!REFERRAL_USERNAME_PATTERN.test(trimmed)) return null
  return trimmed.toLowerCase()
}

/** Read `#username` from a URL hash (leading # optional). */
export function parseReferralHash(hash: string | null | undefined): string | null {
  if (!hash) return null
  const body = hash.startsWith('#') ? hash.slice(1) : hash
  // Ignore empty / route-style hashes (e.g. #section)
  const candidate = body.split(/[/?&]/)[0] ?? ''
  return normalizeReferralUsername(candidate)
}

/**
 * Append or replace the referral fragment on any absolute/relative URL.
 * Preserves existing search params; replaces any prior hash.
 */
export function appendReferralFragment(
  url: string,
  username: string | null | undefined,
): string {
  const tag = normalizeReferralUsername(username)
  if (!tag) return url

  const hashIdx = url.indexOf('#')
  const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url
  return `${base}#${tag}`
}

/** Build a locale-aware homepage share URL with `#username` (primary share link). */
export function buildUsernameShareUrl(params: {
  origin: string
  locale: string
  defaultLocale?: string
  username: string
}): string {
  const tag = normalizeReferralUsername(params.username)
  if (!tag) return params.origin

  const defaultLocale = params.defaultLocale ?? 'en'
  const prefix =
    params.locale && params.locale !== defaultLocale ? `/${params.locale}` : ''
  return appendReferralFragment(`${params.origin}${prefix}/`, tag)
}

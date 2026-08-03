/**
 * Parse `[product=$url_or_id]` markers for product_card interactive inserts.
 * Pure — no DB. Hydration happens server-side after resolve.
 */

export type ProductCardMarkerRef = {
  raw: string
  value: string
  productId: string | null
}

export type ParseProductCardMarkersResult = {
  cleanedText: string
  refs: ProductCardMarkerRef[]
}

/** Matches [product=…] with URL, path, or raw id. */
const PRODUCT_MARKER_RE = /\[product=([^\]]+)\]/gi

/** Store routes that are never product ids (false positives under /store/…). */
const RESERVED_STORE_SEGMENTS = new Set([
  'cart',
  'checkout',
  'wishlist',
  'favorites',
  'orders',
  'vendors',
  'vendor',
  'search',
  'category',
  'categories',
])

function looksLikeUrlOrPath(value: string): boolean {
  return (
    value.includes('://') ||
    value.startsWith('/') ||
    /^[a-z]{2}(?:-[a-z]{2})?\/store\//i.test(value) ||
    /^store\//i.test(value)
  )
}

/**
 * Extract product id from store URL/path or raw id.
 * Examples: https://x/en/store/abc → abc; /store/abc → abc; abc → abc
 * Rejects non-store URLs (never treat full URL as id) and reserved /store segments.
 */
export function resolveProductIdFromRef(value: string): string | null {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null

  const unquoted = trimmed.replace(/^['"]|['"]$/g, '').trim()
  if (!unquoted) return null

  const isUrlish = looksLikeUrlOrPath(unquoted)

  try {
    const asUrl = unquoted.includes('://')
      ? new URL(unquoted)
      : unquoted.startsWith('/')
        ? new URL(unquoted, 'https://ring.local')
        : null
    if (asUrl) {
      const parts = asUrl.pathname.split('/').filter(Boolean)
      const storeIdx = parts.findIndex((p) => p === 'store')
      if (storeIdx >= 0 && parts[storeIdx + 1]) {
        const id = decodeURIComponent(parts[storeIdx + 1]).split('?')[0] || ''
        if (id && !RESERVED_STORE_SEGMENTS.has(id.toLowerCase())) return id
        return null
      }
      // URL/path without /store/ — do not fall through to raw-id of the whole URL
      if (isUrlish) return null
    }
  } catch {
    if (isUrlish) return null
  }

  const pathMatch = unquoted.match(/(?:^|\/)store\/([^/?#\s]+)/i)
  if (pathMatch?.[1]) {
    const id = decodeURIComponent(pathMatch[1])
    if (RESERVED_STORE_SEGMENTS.has(id.toLowerCase())) return null
    return id
  }

  if (isUrlish) return null

  // Raw CRM id (no spaces, not a reserved word)
  if (
    !/\s/.test(unquoted) &&
    unquoted.length >= 1 &&
    unquoted.length <= 128 &&
    !RESERVED_STORE_SEGMENTS.has(unquoted.toLowerCase())
  ) {
    return unquoted
  }

  return null
}

export function parseProductCardMarkers(text: string): ParseProductCardMarkersResult {
  const refs: ProductCardMarkerRef[] = []
  const seen = new Set<string>()

  const cleanedText = String(text || '')
    .replace(PRODUCT_MARKER_RE, (_full, rawValue: string) => {
      const value = String(rawValue || '').trim()
      const productId = resolveProductIdFromRef(value)
      const key = productId || value
      if (!seen.has(key)) {
        seen.add(key)
        refs.push({ raw: `[product=${value}]`, value, productId })
      }
      return ''
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  return { cleanedText, refs }
}

export function textHasProductCardMarkers(text: string): boolean {
  PRODUCT_MARKER_RE.lastIndex = 0
  return PRODUCT_MARKER_RE.test(String(text || ''))
}

/** Strip complete markers for streaming UI (avoid flashing raw [product=…] tokens). */
export function stripProductCardMarkersForDisplay(text: string): string {
  return String(text || '')
    .replace(PRODUCT_MARKER_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

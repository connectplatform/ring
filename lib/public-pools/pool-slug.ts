import { createHash } from 'crypto'

export function kebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Stable slug for docs future-feature widgets. */
export function deriveFutureFeaturePoolSlug(docPath: string, featureName: string): string {
  const doc = docPath.replace(/^\/+/, '').replace(/\\/g, '/')
  return `future-feature:${doc}:${kebabCase(featureName)}`
}

export function derivePublicPoolDocumentId(cloneId: string, poolSlug: string): string {
  const hash = createHash('sha256').update(`${cloneId}:${poolSlug}`).digest('hex').slice(0, 32)
  return `pp_${hash}`
}

export function derivePublicPoolSignalId(poolId: string, userId: string): string {
  return `pps_${poolId}_${userId}`
}

/** URL-safe segment for `/dao/[slug]` (pool_slug may contain `:` and `/`). */
export function encodePoolSlugForRoute(poolSlug: string): string {
  return encodeURIComponent(poolSlug)
}

export function decodePoolSlugFromRoute(segment: string): string {
  return decodeURIComponent(segment)
}

/**
 * Stable filter fingerprints for feed session invalidation.
 */

import type { CursorFeedModuleId } from '@/lib/pagination/types'

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((k) => `${k}:${stableSerialize(record[k])}`).join(',')}}`
  }
  return String(value)
}

export function buildFilterFingerprint(
  moduleId: CursorFeedModuleId,
  filters: Record<string, unknown> | URLSearchParams,
): string {
  if (filters instanceof URLSearchParams) {
    const entries = [...filters.entries()]
      .filter(([key]) => !['page', 'startAfter', 'afterId', 'offset', 'limit'].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
    return `${moduleId}|${entries.map(([k, v]) => `${k}=${v}`).join('&')}`
  }

  return `${moduleId}|${stableSerialize(filters)}`
}

/** Opportunities / entities URL rails — shared exclude list for pagination params. */
export function fingerprintFromSearchParams(
  moduleId: CursorFeedModuleId,
  searchParams: URLSearchParams,
): string {
  return buildFilterFingerprint(moduleId, searchParams)
}

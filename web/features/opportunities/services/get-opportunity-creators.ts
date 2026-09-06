import { cache } from 'react'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import type { OpportunityCreatorSummary } from '@/features/opportunities/types'

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function isPublicProfile(raw: Record<string, unknown>): boolean {
  return raw.publicProfile === true || raw.publicProfile === 'true' || raw.publicProfile === 1
}

function toCreatorSummary(id: string, raw: Record<string, unknown>): OpportunityCreatorSummary {
  const username = firstString(raw.username)
  // Empty name lets the card choose a localized fallback (Member / Private User).
  const name = firstString(raw.name, raw.displayName, username) || ''
  const avatar = firstString(
    raw.photoURL,
    raw.photo_url,
    raw.image,
    raw.avatarThumb,
  )
  return {
    id,
    name,
    avatar,
    ...(isPublicProfile(raw) && username ? { username } : {}),
  }
}

/**
 * Batch-resolve public-safe creator snapshots for opportunity feed cards.
 * Never throws. Missing / failed lookups are omitted.
 */
export const getOpportunityCreatorSummaries = cache(
  async (ids: string[]): Promise<Record<string, OpportunityCreatorSummary>> => {
    const uniqueIds = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))]
    if (uniqueIds.length === 0) return {}

    try {
      const result = await db().queryDocs<Record<string, unknown>>({
        collection: 'users',
        filters: [{ field: 'id', operator: 'in', value: uniqueIds }],
      })

      if (!result.success || !result.data) {
        logger.warn('getOpportunityCreatorSummaries: query failed', {
          error: result.error?.message,
          count: uniqueIds.length,
        })
        return {}
      }

      const map: Record<string, OpportunityCreatorSummary> = {}
      for (const row of result.data) {
        const id = String(row.id || '')
        if (!id) continue
        map[id] = toCreatorSummary(id, row)
      }
      return map
    } catch (error) {
      logger.error('getOpportunityCreatorSummaries: Error', {
        error: error instanceof Error ? error.message : error,
        count: uniqueIds.length,
      })
      return {}
    }
  },
)

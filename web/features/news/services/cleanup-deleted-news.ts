/**
 * Cleanup Deleted News Articles — Cron Handler
 *
 * Hard-purges news articles that have been soft-deleted (status='deleted')
 * for more than 6 months. This ensures forensic retention while preventing
 * unbounded database growth.
 *
 * READS:   news collection where status == 'deleted' AND deletedAt < 6 months ago
 * WRITES:  hard delete of matched documents via db()
 * SAFETY:  idempotent, max 500 documents per run
 */
import 'server-only'

import { db } from '@/lib/database'

const MAX_PURGE_BATCH = 500
const RETENTION_MONTHS = 6

export interface CleanupDeletedNewsResult {
  purged: number
  duration: number
  note: string
}

export async function cleanupDeletedNews(): Promise<CleanupDeletedNewsResult> {
  const startTime = Date.now()

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS)

  const result = await db().findDocs<{ status?: string; deletedAt?: Date | string }>(
    'news',
    [
      { field: 'status', operator: '==', value: 'deleted' },
      { field: 'deletedAt', operator: '<', value: cutoff },
    ],
    { limit: MAX_PURGE_BATCH },
  )

  if (!result.success) {
    throw result.error || new Error('Failed to query soft-deleted news for purge')
  }

  const rows = result.data ?? []
  if (rows.length === 0) {
    return {
      purged: 0,
      duration: Date.now() - startTime,
      note: 'No articles eligible for final purge',
    }
  }

  let purged = 0
  for (const row of rows) {
    if (!row.id) continue
    const del = await db().deleteDoc('news', row.id)
    if (del.success) purged += 1
  }

  return {
    purged,
    duration: Date.now() - startTime,
    note: `Purged ${purged} articles soft-deleted before ${cutoff.toISOString().split('T')[0]} (${RETENTION_MONTHS}-month retention)`,
  }
}

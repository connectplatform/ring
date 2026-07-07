/**
 * Cleanup Deleted News Articles — Cron Handler
 *
 * Hard-purges news articles that have been soft-deleted (status='deleted')
 * for more than 6 months. This ensures forensic retention while preventing
 * unbounded database growth.
 *
 * READS:   news collection where status == 'deleted' AND deletedAt < 6 months ago
 * WRITES:  batch delete of matched documents
 * SAFETY:  idempotent, max 500 documents per run
 */
import 'server-only'

import { getAdminDb } from '@/lib/firebase-admin.server'
import { Timestamp } from 'firebase-admin/firestore'

const MAX_PURGE_BATCH = 500
const RETENTION_MONTHS = 6

export interface CleanupDeletedNewsResult {
  purged: number
  duration: number
  note: string
}

export async function cleanupDeletedNews(): Promise<CleanupDeletedNewsResult> {
  const startTime = Date.now()

  // Compute the cutoff date for retention
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS)
  const cutoffTimestamp = Timestamp.fromDate(cutoff)

  const db = getAdminDb()
  const newsRef = db.collection('news')

  // Query articles soft-deleted before the retention cutoff
  const snapshot = await newsRef
    .where('status', '==', 'deleted')
    .where('deletedAt', '<', cutoffTimestamp)
    .limit(MAX_PURGE_BATCH)
    .get()

  if (snapshot.empty) {
    return {
      purged: 0,
      duration: Date.now() - startTime,
      note: 'No articles eligible for final purge',
    }
  }

  // Batch hard-delete eligible documents
  const batch = db.batch()
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref)
  })
  await batch.commit()

  return {
    purged: snapshot.size,
    duration: Date.now() - startTime,
    note: `Purged ${snapshot.size} articles soft-deleted before ${cutoff.toISOString().split('T')[0]} (${RETENTION_MONTHS}-month retention)`,
  }
}

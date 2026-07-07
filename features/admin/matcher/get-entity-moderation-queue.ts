import 'server-only'

import { auth } from '@/auth'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { EntityPermissionError } from '@/lib/errors'
import { db } from '@/lib/database'
import type { EntityReportRecord } from '@/features/entities/lib/entity-moderation-types'
import { mapDbRowToSerializedEntity } from '@/features/entities/lib/entity-db-mapper'

/**
 * Encapsulates the data for each item in the moderation queue
 */
export interface EntityModerationQueueItem {
  entityId: string
  entityName: string
  reportCount: number
  moderationStatus: string
  lastReportedAt?: string
  reports: EntityReportRecord[]
}

/**
 * Maps a database row from the "entity_reports" collection to an EntityReportRecord instance.
 * Handles null/undefined values and type casting for safety.
 */
function mapReportRow(row: Record<string, unknown> & { id: string }): EntityReportRecord {
  // Note: If 'row' shape expands, validate all fields before conversion to avoid runtime errors.
  return {
    id: String(row.id ?? ''),
    entityId: String(row.entityId ?? ''),
    reporterUserId: String(row.reporterUserId ?? ''),
    category: row.category as EntityReportRecord['category'], // TODO: Consider adding validation for allowed categories
    reason: String(row.reason ?? ''),
    status: (row.status as EntityReportRecord['status']) ?? 'open',
    createdAt: String(row.createdAt ?? ''),
  }
}

/**
 * Gathers and returns the moderation queue for entities, grouped by entityId,
 * summarized and sorted by report time. Only accessible to admins/superadmins.
 * 
 * @returns {Promise<EntityModerationQueueItem[]>} Array of moderation queue items, sorted by most recent report.
 */
export async function getEntityModerationQueue(): Promise<EntityModerationQueueItem[]> {
  // Authenticate user and verify role for admin access.
  const session = await auth()
  const role = assertKnownUserRole(session?.user?.role as UserRolesArray)
  if (!session?.user || (role !== UserRolesArray.admin && role !== UserRolesArray.superadmin)) {
    // Not an admin/superadmin: Throw permissions error.
    throw new EntityPermissionError('Admin access required')
  }

  // Fetch up to 500 reports, ordered by newest first.
  const reportsResult = await db().queryDocs<Record<string, unknown>>({
    collection: 'entity_reports',
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    pagination: { limit: 500 },
  })

  // Group all valid reports by their entityId.
  const reportsByEntity = new Map<string, EntityReportRecord[]>()
  if (reportsResult.success && reportsResult.data) {
    for (const row of reportsResult.data) {
      const report = mapReportRow(row as Record<string, unknown> & { id: string })
      if (!report.entityId) continue // Skip reports missing entityId.
      const list = reportsByEntity.get(report.entityId) ?? []
      list.push(report)
      reportsByEntity.set(report.entityId, list)
    }
  }

  // Generate a list of unique entityIds from reports.
  const entityIds = [...reportsByEntity.keys()]
  if (entityIds.length === 0) {
    // If there are no reports, return an empty queue.
    return []
  }

  const items: EntityModerationQueueItem[] = []

  // For each entity, attempt to load its latest info and populate moderation meta.
  // TODO: Optimize N+1 DB query here by batching 'findDocById' calls if db() supports batch fetch.
  for (const entityId of entityIds) {
    // Fetch entity details from the database; could be optimized (see above).
    const entityResult = await db().findDocById<Record<string, unknown>>('entities', entityId)

    // Fallbacks in case entity record is missing
    let entityName = entityId
    let reportCount = reportsByEntity.get(entityId)?.length ?? 0
    let moderationStatus = 'reported'
    let lastReportedAt: string | undefined

    if (entityResult.success && entityResult.data) {
      // Map DB entity record into app's serialized format for more reliable field access.
      const entity = mapDbRowToSerializedEntity(entityId, entityResult.data)
      entityName = entity.name
      reportCount = entity.reportCount ?? reportCount // Prefer up-to-date DB reportCount, fallback to local count.
      moderationStatus = entity.moderationStatus ?? 'reported'
      lastReportedAt = entity.lastReportedAt
    }
    // Compose the result object for the moderation queue.
    items.push({
      entityId,
      entityName,
      reportCount,
      moderationStatus,
      lastReportedAt,
      reports: reportsByEntity.get(entityId) ?? [],
    })
  }

  // Sort the moderation items by lastReportedAt if present, otherwise by the most recent report creation time.
  // Items with no timestamps always go last.
  items.sort((a, b) => {
    const aTime = a.lastReportedAt ?? a.reports[0]?.createdAt ?? ''
    const bTime = b.lastReportedAt ?? b.reports[0]?.createdAt ?? ''
    return bTime.localeCompare(aTime)
  })

  // Return the moderation queue.
  return items
}

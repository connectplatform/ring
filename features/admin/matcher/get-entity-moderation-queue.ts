import 'server-only'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { EntityPermissionError } from '@/lib/errors'
import { db } from '@/lib/database'
import type { EntityReportRecord } from '@/features/entities/lib/entity-moderation-types'
import { mapDbRowToSerializedEntity } from '@/features/entities/lib/entity-db-mapper'

export interface EntityModerationQueueItem {
  entityId: string
  entityName: string
  reportCount: number
  moderationStatus: string
  lastReportedAt?: string
  reports: EntityReportRecord[]
}

function mapReportRow(row: Record<string, unknown> & { id: string }): EntityReportRecord {
  return {
    id: String(row.id ?? ''),
    entityId: String(row.entityId ?? ''),
    reporterUserId: String(row.reporterUserId ?? ''),
    category: row.category as EntityReportRecord['category'],
    reason: String(row.reason ?? ''),
    status: (row.status as EntityReportRecord['status']) ?? 'open',
    createdAt: String(row.createdAt ?? ''),
  }
}

export async function getEntityModerationQueue(): Promise<EntityModerationQueueItem[]> {
  const session = await auth()
  const role = session?.user?.role as UserRole | undefined
  if (!session?.user || (role !== UserRole.ADMIN && role !== UserRole.SUPERADMIN)) {
    throw new EntityPermissionError('Admin access required')
  }

  const reportsResult = await db().queryDocs<Record<string, unknown>>({
    collection: 'entity_reports',
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    pagination: { limit: 500 },
  })

  const reportsByEntity = new Map<string, EntityReportRecord[]>()
  if (reportsResult.success && reportsResult.data) {
    for (const row of reportsResult.data) {
      const report = mapReportRow(row as Record<string, unknown> & { id: string })
      if (!report.entityId) continue
      const list = reportsByEntity.get(report.entityId) ?? []
      list.push(report)
      reportsByEntity.set(report.entityId, list)
    }
  }

  const entityIds = [...reportsByEntity.keys()]
  if (entityIds.length === 0) {
    return []
  }

  const items: EntityModerationQueueItem[] = []

  for (const entityId of entityIds) {
    const entityResult = await db().findDocById<Record<string, unknown>>('entities', entityId)

    let entityName = entityId
    let reportCount = reportsByEntity.get(entityId)?.length ?? 0
    let moderationStatus = 'reported'
    let lastReportedAt: string | undefined

    if (entityResult.success && entityResult.data) {
      const entity = mapDbRowToSerializedEntity(entityId, entityResult.data)
      entityName = entity.name
      reportCount = entity.reportCount ?? reportCount
      moderationStatus = entity.moderationStatus ?? 'reported'
      lastReportedAt = entity.lastReportedAt
    }

    items.push({
      entityId,
      entityName,
      reportCount,
      moderationStatus,
      lastReportedAt,
      reports: reportsByEntity.get(entityId) ?? [],
    })
  }

  items.sort((a, b) => {
    const aTime = a.lastReportedAt ?? a.reports[0]?.createdAt ?? ''
    const bTime = b.lastReportedAt ?? b.reports[0]?.createdAt ?? ''
    return bTime.localeCompare(aTime)
  })

  return items
}

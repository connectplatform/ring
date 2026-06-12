import 'server-only'

import { cache } from 'react'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { db } from '@/lib/database'
import { EntityAuthError, EntityPermissionError, logRingError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { notifyMatcherEntityModeration } from '@/lib/ai/matcher-moderation-notify'
import { syncEntityDiscovery } from '@/features/entities/lib/entity-mutation-sync'
import type { EntityReportCategory } from '@/features/entities/lib/entity-moderation-types'
import type { SerializedEntity } from '@/features/entities/types'
import { mapDbDocumentToSerializedEntity } from '@/features/entities/lib/entity-db-mapper'

export const getUserBlockedEntityIds = cache(async (userId: string): Promise<string[]> => {
  try {
    const result = await db().readDoc<{ blockedEntityIds?: string[] } & { id: string }>(
      'users',
      userId,
    )
    if (!result.success || !result.data) return []

    return Array.isArray(result.data.blockedEntityIds) ? result.data.blockedEntityIds : []
  } catch (error) {
    logRingError(error, 'getUserBlockedEntityIds')
    return []
  }
})

async function appendUserBlockedEntity(userId: string, entityId: string): Promise<void> {
  const current = await getUserBlockedEntityIds(userId)
  if (current.includes(entityId)) return

  const result = await db().updateDoc('users', userId, {
    blockedEntityIds: [...current, entityId],
  }, { merge: true })

  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to update user block list')
  }
}

async function removeUserBlockedEntity(userId: string, entityId: string): Promise<void> {
  const current = await getUserBlockedEntityIds(userId)
  if (!current.includes(entityId)) return

  const result = await db().updateDoc('users', userId, {
    blockedEntityIds: current.filter((id) => id !== entityId),
  }, { merge: true })

  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to update user block list')
  }
}

async function loadEntityForModeration(entityId: string): Promise<SerializedEntity | null> {
  const result = await db().findDocById('entities', entityId)
  if (!result.success || !result.data) return null
  return mapDbDocumentToSerializedEntity(result.data)
}

export async function reportEntity(params: {
  entityId: string
  category: EntityReportCategory
  reason: string
}): Promise<{ success: boolean; globallyBlocked: boolean }> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new EntityAuthError('Authentication required')
  }

  const reporterUserId = session.user.id
  const { entityId, category, reason } = params

  if (!reason.trim() || reason.trim().length < 10) {
    throw new Error('Please provide a detailed reason (at least 10 characters).')
  }

  const entity = await loadEntityForModeration(entityId)
  if (!entity) {
    throw new Error('Entity not found')
  }

  if (entity.addedBy === reporterUserId) {
    throw new EntityPermissionError('You cannot report your own entity')
  }

  const reportId = `er_${entityId}_${reporterUserId}_${Date.now()}`
  const createdAt = new Date().toISOString()

  const createReportResult = await db().createDoc(
    'entity_reports',
    {
      entityId,
      reporterUserId,
      category,
      reason: reason.trim(),
      status: 'open',
      createdAt,
    },
    { id: reportId },
  )

  if (!createReportResult.success) {
    throw new Error(createReportResult.error?.message || 'Failed to record entity report')
  }

  const reportCount = (entity.reportCount ?? 0) + 1
  const currentStatus = entity.moderationStatus ?? 'active'

  const updateEntityResult = await db().updateDoc('entities', entityId, {
    reportCount,
    lastReportedAt: createdAt,
    ...(currentStatus === 'active' ? { moderationStatus: 'reported' as const } : {}),
  }, { merge: true })

  if (!updateEntityResult.success) {
    throw new Error(updateEntityResult.error?.message || 'Failed to update entity moderation fields')
  }

  await notifyMatcherEntityModeration({
    type: 'entity_reported',
    entityId,
    actorUserId: reporterUserId,
    category,
    reason: reason.trim(),
    entityName: entity.name,
  })

  await syncEntityDiscovery({ entityId, event: 'updated' })

  logger.info('reportEntity: recorded', { entityId, reporterUserId, category, reportCount })

  return { success: true, globallyBlocked: false }
}

/** Personal hide — entity excluded from this user's search/lists only. */
export async function blockEntityForUser(entityId: string): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new EntityAuthError('Authentication required')
  }

  const entity = await loadEntityForModeration(entityId)
  if (!entity) {
    throw new Error('Entity not found')
  }

  if (entity.addedBy === session.user.id) {
    throw new EntityPermissionError('You cannot block your own entity')
  }

  await appendUserBlockedEntity(session.user.id, entityId)

  await notifyMatcherEntityModeration({
    type: 'entity_user_blocked',
    entityId,
    actorUserId: session.user.id,
    entityName: entity.name,
  })

  return { success: true }
}

export async function unblockEntityForUser(entityId: string): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new EntityAuthError('Authentication required')
  }

  await removeUserBlockedEntity(session.user.id, entityId)
  return { success: true }
}

/** Admin-only global block. */
export async function adminBlockEntity(
  entityId: string,
  reason: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new EntityAuthError('Authentication required')
  }

  const role = session.user.role as UserRole
  if (role !== UserRole.ADMIN && role !== UserRole.SUPERADMIN) {
    throw new EntityPermissionError('Admin access required')
  }

  const blockedAt = new Date().toISOString()

  const blockResult = await db().updateDoc('entities', entityId, {
    moderationStatus: 'blocked',
    blockedAt,
    blockedReason: reason.trim() || 'Blocked by administrator',
  }, { merge: true })

  if (!blockResult.success) {
    throw new Error(blockResult.error?.message || 'Failed to block entity')
  }

  await notifyMatcherEntityModeration({
    type: 'entity_blocked',
    entityId,
    actorUserId: session.user.id,
    reason: reason.trim(),
  })

  await syncEntityDiscovery({ entityId, event: 'status_changed' })
  return { success: true }
}

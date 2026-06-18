import 'server-only'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { getSerializedEntityById } from '@/features/entities/services/get-entity-by-id'
import type { SerializedEntity, StoreMetrics, StoreVerification } from '@/features/entities/types'
import { db } from '@/lib/database'
import { EntityAuthError, EntityPermissionError } from '@/lib/errors'

export interface EntityAnalytics {
  entityId: string
  name: string
  memberCount: number
  opportunityIds: number
  linkedOpportunities: number
  verificationStatus: SerializedEntity['verificationStatus']
  identityVerified: boolean
  moderationStatus: SerializedEntity['moderationStatus']
  reportCount: number
  storeActivated: boolean
  storeMetrics?: StoreMetrics
  storeVerification?: StoreVerification
  generatedAt: string
}

async function assertEntityAnalyticsAccess(entity: SerializedEntity, userId: string, role: UserRole) {
  const isAdmin = role === UserRole.admin || role === UserRole.superadmin
  const isOwner = entity.addedBy === userId
  const isMember = Array.isArray(entity.members) && entity.members.includes(userId)

  if (!isAdmin && !isOwner && !isMember) {
    throw new EntityPermissionError('You do not have permission to view entity analytics')
  }
}

/**
 * Aggregate entity performance metrics for owners, members, and admins.
 */
export async function getEntityAnalytics(entityId: string): Promise<EntityAnalytics> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new EntityAuthError('Authentication required')
  }

  const entity = await getSerializedEntityById(entityId)
  if (!entity) {
    throw new Error('Entity not found')
  }

  await assertEntityAnalyticsAccess(
    entity,
    session.user.id,
    session.user.role as UserRole,
  )

  let linkedOpportunities = 0
  try {
    const countResult = await db().countDocs('opportunities', [
      { field: 'organizationId', operator: '=', value: entityId },
    ])
    linkedOpportunities = countResult.success ? (countResult.data ?? 0) : 0
  } catch (error) {
    console.warn('getEntityAnalytics: opportunity count failed', error)
  }

  return {
    entityId,
    name: entity.name,
    memberCount: entity.members?.length ?? 0,
    opportunityIds: entity.opportunities?.length ?? 0,
    linkedOpportunities,
    verificationStatus: entity.verificationStatus ?? 'none',
    identityVerified: Boolean(entity.storeVerification?.identityVerified),
    moderationStatus: entity.moderationStatus ?? 'active',
    reportCount: entity.reportCount ?? 0,
    storeActivated: Boolean(entity.storeActivated),
    storeMetrics: entity.storeMetrics,
    storeVerification: entity.storeVerification,
    generatedAt: new Date().toISOString(),
  }
}

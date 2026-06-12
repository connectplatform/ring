import type { SerializedEntity } from '@/features/entities/types'
import type { EntityModerationStatus } from '@/features/entities/lib/entity-moderation-types'
import { UserRole } from '@/features/auth/types'

export interface EntityVisibilityContext {
  userId?: string
  userRole?: UserRole
  blockedEntityIds?: string[]
}

export function getEntityModerationStatus(
  entity: SerializedEntity,
): EntityModerationStatus {
  const status = (entity as SerializedEntity & { moderationStatus?: EntityModerationStatus })
    .moderationStatus
  return status ?? 'active'
}

/** Globally blocked entities are hidden from discovery except admins. */
export function isEntityGloballyBlocked(entity: SerializedEntity): boolean {
  return getEntityModerationStatus(entity) === 'blocked'
}

export function isEntityBlockedByUser(
  entityId: string,
  blockedEntityIds?: string[],
): boolean {
  return Array.isArray(blockedEntityIds) && blockedEntityIds.includes(entityId)
}

/**
 * Whether an entity should appear in list/search results for the current viewer.
 */
export function isEntityVisibleInDiscovery(
  entity: SerializedEntity,
  ctx: EntityVisibilityContext,
): boolean {
  const role = ctx.userRole ?? UserRole.VISITOR

  if (role === UserRole.ADMIN || role === UserRole.SUPERADMIN) {
    return true
  }

  if (isEntityGloballyBlocked(entity)) {
    return false
  }

  if (ctx.userId && isEntityBlockedByUser(entity.id, ctx.blockedEntityIds)) {
    return false
  }

  return true
}

export function filterEntitiesForDiscovery<T extends SerializedEntity>(
  entities: T[],
  ctx: EntityVisibilityContext,
): T[] {
  return entities.filter((entity) => isEntityVisibleInDiscovery(entity, ctx))
}

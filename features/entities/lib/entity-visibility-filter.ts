import type { SerializedEntity } from '@/features/entities/types'
import type { EntityModerationStatus } from '@/features/entities/lib/entity-moderation-types'
import {
  UserRole,
  assertKnownUserRole,
  hasConfidentialAccess,
  isPlatformAdmin,
  parseUserRole,
} from '@/features/auth/user-role'

export type EntityVisibility = SerializedEntity['visibility']

export type DbFilter = { field: string; operator: string; value: unknown }

export interface EntityVisibilityContext {
  userId?: string
  userRole: UserRole
  blockedEntityIds?: string[]
}

export interface EntityViewRow {
  id?: string
  visibility?: EntityVisibility | string
  isConfidential?: boolean
  addedBy?: string
  moderationStatus?: EntityModerationStatus
}

const VISIBILITY_LADDER: Record<string, EntityVisibility[]> = {
  [UserRole.visitor]: ['public'],
  [UserRole.subscriber]: ['public', 'subscriber'],
  [UserRole.member]: ['public', 'subscriber', 'member'],
}

export function getEntityModerationStatus(
  entity: SerializedEntity | EntityViewRow,
): EntityModerationStatus {
  const status = (entity as SerializedEntity & { moderationStatus?: EntityModerationStatus })
    .moderationStatus
  return status ?? 'active'
}

/** Globally blocked entities are hidden from discovery except admins/owners. */
export function isEntityGloballyBlocked(entity: SerializedEntity | EntityViewRow): boolean {
  return getEntityModerationStatus(entity as SerializedEntity) === 'blocked'
}

export function isEntityBlockedByUser(
  entityId: string,
  blockedEntityIds?: string[],
): boolean {
  return Array.isArray(blockedEntityIds) && blockedEntityIds.includes(entityId)
}

function isEntityConfidentialRow(entity: EntityViewRow): boolean {
  return entity.isConfidential === true || entity.visibility === 'confidential'
}

/**
 * Returns allowed visibility values for list/search filters, or null when unrestricted.
 */
export function getAllowedEntityVisibilityValues(
  role: string | null | undefined,
): EntityVisibility[] | null {
  const parsed = parseUserRole(role) ?? UserRole.visitor
  if (isPlatformAdmin(parsed) || parsed === UserRole.confidential) {
    return null
  }
  return VISIBILITY_LADDER[parsed] ?? ['public']
}

/** Build DB where filters for entity list/search by role. */
export function buildEntityVisibilityFilters(
  role: string | null | undefined,
): DbFilter[] {
  const filters: DbFilter[] = []
  const allowed = getAllowedEntityVisibilityValues(role)
  const parsed = parseUserRole(role) ?? UserRole.visitor

  if (allowed) {
    if (allowed.length === 1) {
      filters.push({ field: 'visibility', operator: 'in', value: allowed })
    } else {
      filters.push({ field: 'visibility', operator: 'in', value: allowed })
    }
  }

  if (!hasConfidentialAccess(parsed)) {
    filters.push({ field: 'isConfidential', operator: '==', value: false })
  }

  return filters
}

/**
 * Row-level access after fetch (by-id, slug detail, batch).
 * Auth is required upstream; this gates visibility + confidentiality.
 */
export function canViewEntity(
  entity: EntityViewRow,
  ctx: Pick<EntityVisibilityContext, 'userRole'>,
): boolean {
  const userRole = assertKnownUserRole(ctx.userRole)

  if (isEntityConfidentialRow(entity) && !hasConfidentialAccess(userRole)) {
    return false
  }

  const allowed = getAllowedEntityVisibilityValues(userRole)
  if (!allowed) {
    return true
  }

  const visibility = (entity.visibility ?? 'public') as EntityVisibility
  if (visibility === 'confidential' && !hasConfidentialAccess(userRole)) {
    return false
  }

  return allowed.includes(visibility)
}

/**
 * Whether an entity should appear in list/search results for the current viewer.
 * Composes role visibility + moderation + per-user blocks.
 */
export function isEntityVisibleInDiscovery(
  entity: SerializedEntity,
  ctx: EntityVisibilityContext,
): boolean {
  const userRole = assertKnownUserRole(ctx.userRole)

  if (isPlatformAdmin(userRole)) {
    return true
  }

  if (!canViewEntity(entity, { userRole })) {
    return false
  }

  if (isEntityGloballyBlocked(entity)) {
    const isOwner = Boolean(ctx.userId && entity.addedBy === ctx.userId)
    return isOwner
  }

  if (ctx.userId && entity.id && isEntityBlockedByUser(entity.id, ctx.blockedEntityIds)) {
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

import type { SerializedEntity } from '@/features/entities/types'
import type { EntityModerationStatus } from '@/features/entities/lib/entity-moderation-types'
import {
  UserRolesArray,
  assertKnownUserRole,
  hasConfidentialAccess,
  isPlatformAdmin,
  parseUserRolesArray,
  resolveSessionUserRole,
} from '@/features/auth/user-role'

// Define visible states for an entity.
export type EntityVisibility = SerializedEntity['visibility']

// Generic database filter type.
export type DbFilter = { field: string; operator: string; value: unknown }

// Context object to capture necessary data for entity visibility evaluation.
export interface EntityVisibilityContext {
  userId?: string                   // id of current viewer, if any
  userRole: UserRolesArray          // role(s) of current viewer
  blockedEntityIds?: string[]       // optional: list of blocked entity ids by the user
}

// Basic shape of an entity row, for use in filtering/rendering.
export interface EntityViewRow {
  id?: string
  visibility?: EntityVisibility | string
  isConfidential?: boolean
  addedBy?: string
  moderationStatus?: EntityModerationStatus
}

// Maps user roles to which visibilities are accessible to them.
// E.g., 'visitor' can only see 'public', but 'member' sees all tiers below.
const VISIBILITY_LADDER: Record<string, EntityVisibility[]> = {
  [UserRolesArray.visitor]: ['public'],
  [UserRolesArray.subscriber]: ['public', 'subscriber'],
  [UserRolesArray.member]: ['public', 'subscriber', 'member'],
}

/**
 * Get the moderation status of an entity, defaulting to 'active' if missing.
 */
export function getEntityModerationStatus(
  entity: SerializedEntity | EntityViewRow,
): EntityModerationStatus {
  // Returns 'active' if moderationStatus is undefined.
  const status = (entity as SerializedEntity & { moderationStatus?: EntityModerationStatus })
    .moderationStatus
  return status ?? 'active'
}

/**
 * Determines if an entity is globally blocked (by admin moderation).
 * Blocked entities are not visible except to admins & owners.
 */
export function isEntityGloballyBlocked(entity: SerializedEntity | EntityViewRow): boolean {
  // STUB: relies on getEntityModerationStatus - ensure that moderation flows set this value.
  return getEntityModerationStatus(entity as SerializedEntity) === 'blocked'
}

/**
 * Determines whether this entityId is in the user's block list.
 */
export function isEntityBlockedByUser(
  entityId: string,
  blockedEntityIds?: string[],
): boolean {
  // Will return false if blockedEntityIds is not an array or not provided.
  return Array.isArray(blockedEntityIds) && blockedEntityIds.includes(entityId)
}

/**
 * Helper to check if row should be treated as confidential.
 */
function isEntityConfidentialRow(entity: EntityViewRow): boolean {
  return entity.isConfidential === true || entity.visibility === 'confidential'
}

/**
 * Checks which entity visibilities are allowed for a user role.
 * Returns array of visibilities for basic roles, or null for admins (no restriction).
 */
export function getAllowedEntityVisibilityValues(
  role: string | null | undefined,
): EntityVisibility[] | null {
  // Try to parse the role string, fall back to session-derived user role.
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (!parsed) return null       // No role found, unrestricted.
  if (isPlatformAdmin(parsed) || parsed === UserRolesArray.confidential) {
    // Admin and 'confidential' have no restriction.
    return null
  }
  // Fallback: if somehow role doesn't resolve, only 'public' is allowed.
  return VISIBILITY_LADDER[parsed as UserRolesArray] ?? ['public']
}

/**
 * DB-layer where() filters for entities a user can see.
 * - Adds visibility clause.
 * - If user can't see confidential, adds clause to ensure isConfidential false.
 */
export function buildEntityVisibilityFilters(
  role: string | null | undefined,
): DbFilter[] {
  const filters: DbFilter[] = []
  const allowed = getAllowedEntityVisibilityValues(role)
  const parsed = parseUserRolesArray(role) ?? UserRolesArray.visitor

  // Add visibility filter (all roles except admin/confidential)
  if (allowed) {
    filters.push({ field: 'visibility', operator: 'in', value: allowed })
  }

  // If user does NOT have confidential access, filter out confidential.
  if (!hasConfidentialAccess(parsed)) {
    filters.push({ field: 'isConfidential', operator: '==', value: false })
  }

  return filters
}

/**
 * Checks whether a single entity row is visible to the user (after fetch).
 * - Checks confidential rules
 * - Checks allowed visibility array 
 */
export function canViewEntity(
  entity: EntityViewRow,
  ctx: Pick<EntityVisibilityContext, 'userRole'>,
): boolean {
  // Ensure the userRole supplied is a valid/known value.
  const userRole = assertKnownUserRole(ctx.userRole)

  // If entity is confidential, check if user has confidential access.
  if (isEntityConfidentialRow(entity) && !hasConfidentialAccess(userRole)) {
    return false
  }

  // Get list of visibilities allowed to this user.
  const allowed = getAllowedEntityVisibilityValues(userRole)
  if (!allowed) {
    // Unlimited viewing (admins, 'confidential' role)
    return true
  }

  // Default visibility is 'public' if missing.
  const visibility = (entity.visibility ?? 'public') as EntityVisibility
  // Redundant: already covered above, but adds safety.
  if (visibility === 'confidential' && !hasConfidentialAccess(userRole)) {
    return false
  }

  // Can see if in allowed values for this role.
  return allowed.includes(visibility)
}

/**
 * Determines if an entity is discoverable for the current user in lists/search.
 * Composes role-based, moderation, and per-user block logic.
 */
export function isEntityVisibleInDiscovery(
  entity: SerializedEntity,
  ctx: EntityVisibilityContext,
): boolean {
  const userRole = assertKnownUserRole(ctx.userRole)

  // Admins can always see everything.
  if (isPlatformAdmin(userRole)) {
    return true
  }

  // Use canViewEntity to enforce role/visibility/confidential filters.
  if (!canViewEntity(entity, { userRole })) {
    return false
  }

  // Exclude globally blocked entities unless user is the owner.
  if (isEntityGloballyBlocked(entity)) {
    // Only owner can see their own blocked items.
    const isOwner = Boolean(ctx.userId && entity.addedBy === ctx.userId)
    return isOwner
  }

  // Blocked entities do not show up for the user who blocked them.
  if (ctx.userId && entity.id && isEntityBlockedByUser(entity.id, ctx.blockedEntityIds)) {
    return false
  }

  // Otherwise it's visible in discovery.
  return true
}

/**
 * Filters a whole entity list for discovery, based on context.
 * - Only includes entities visible to current user.
 */
export function filterEntitiesForDiscovery<T extends SerializedEntity>(
  entities: T[],
  ctx: EntityVisibilityContext,
): T[] {
  // TODO: For improved scalability, consider useMemo() or server-side cache selectors (React19/Next16 SSR).
  // TODO: Use React19 use() for async data sources if applicable in future (currently not relevant for sync filter).
  return entities.filter((entity) => isEntityVisibleInDiscovery(entity, ctx))
}

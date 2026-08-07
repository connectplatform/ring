import type { OpportunityVisibility } from '@/features/opportunities/types'
import {
  UserRolesArray,
  assertKnownUserRole,
  hasConfidentialAccess,
  isPlatformAdmin,
  parseUserRolesArray,
  resolveSessionUserRole,
} from '@/features/auth/user-role'

export interface OpportunityVisibilityContext {
  userRole: UserRolesArray
  userId?: string
}

export type DbFilter = { field: string; operator: string; value: unknown }

const VISIBILITY_LADDER: Record<string, OpportunityVisibility[]> = {
  [UserRolesArray.visitor]: ['public'],
  [UserRolesArray.subscriber]: ['public', 'subscriber'],
  [UserRolesArray.member]: ['public', 'subscriber', 'member'],
}

/**
 * Returns allowed visibility values for list/search filters, or null when unrestricted.
 */
export function getAllowedVisibilityValues(
  role: string | null | undefined,
): OpportunityVisibility[] | null {
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (isPlatformAdmin(parsed as UserRolesArray) || parsed === UserRolesArray.confidential) {
    return null
  }
  return VISIBILITY_LADDER[parsed as UserRolesArray] ?? ['public']
}

/** Build DB where filters for opportunity list/search by role. */
export function buildOpportunityVisibilityFilters(
  role: string | null | undefined,
): DbFilter[] {
  const filters: DbFilter[] = []
  const allowed = getAllowedVisibilityValues(role)
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role) ?? UserRolesArray.visitor
  return filters
}

export interface OpportunityViewRow {
  visibility?: OpportunityVisibility | string
  isConfidential?: boolean
  createdBy?: string
}

/**
 * Row-level access after fetch (by-id, slug detail).
 * Auth is required upstream; this gates visibility + confidentiality.
 */
export function canViewOpportunity(
  opportunity: OpportunityViewRow,
  ctx: OpportunityVisibilityContext,
): boolean {
  const userRole = assertKnownUserRole(ctx.userRole)

  if (opportunity.isConfidential && !hasConfidentialAccess(userRole)) {
    return false
  }

  const allowed = getAllowedVisibilityValues(userRole)
  if (!allowed) {
    return true
  }

  const visibility = (opportunity.visibility ?? 'public') as OpportunityVisibility
  return allowed.includes(visibility)
}

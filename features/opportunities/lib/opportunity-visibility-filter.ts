import type { OpportunityVisibility } from '@/features/opportunities/types'
import {
  UserRole,
  assertKnownUserRole,
  hasConfidentialAccess,
  isPlatformAdmin,
  parseUserRole,
} from '@/features/auth/user-role'

export interface OpportunityVisibilityContext {
  userRole: UserRole
  userId?: string
}

export type DbFilter = { field: string; operator: string; value: unknown }

const VISIBILITY_LADDER: Record<string, OpportunityVisibility[]> = {
  [UserRole.visitor]: ['public'],
  [UserRole.subscriber]: ['public', 'subscriber'],
  [UserRole.member]: ['public', 'subscriber', 'member'],
}

/**
 * Returns allowed visibility values for list/search filters, or null when unrestricted.
 */
export function getAllowedVisibilityValues(
  role: string | null | undefined,
): OpportunityVisibility[] | null {
  const parsed = parseUserRole(role) ?? UserRole.visitor
  if (isPlatformAdmin(parsed) || parsed === UserRole.confidential) {
    return null
  }
  return VISIBILITY_LADDER[parsed] ?? ['public']
}

/** Build DB where filters for opportunity list/search by role. */
export function buildOpportunityVisibilityFilters(
  role: string | null | undefined,
): DbFilter[] {
  const filters: DbFilter[] = []
  const allowed = getAllowedVisibilityValues(role)
  const parsed = parseUserRole(role) ?? UserRole.visitor

  if (allowed) {
    if (allowed.length === 1) {
      filters.push({ field: 'visibility', operator: '==', value: allowed[0] })
    } else {
      filters.push({ field: 'visibility', operator: 'in', value: allowed })
    }
  }

  if (!hasConfidentialAccess(parsed)) {
    filters.push({ field: 'isConfidential', operator: '==', value: false })
  }

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

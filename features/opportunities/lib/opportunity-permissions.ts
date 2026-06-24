import {
  UserRole,
  getRoleLevel,
  hasConfidentialAccess,
  hasMemberPrivileges,
  hasRoleAtLeast,
  isPlatformAdmin,
  parseUserRole,
  ROLE_LEVEL,
} from '@/features/auth/user-role'
import type { OpportunityVisibility } from '@/features/opportunities/types'
import { getAllowedVisibilityValues } from '@/features/opportunities/lib/opportunity-visibility-filter'

export type OpportunityCreateType =
  | 'request'
  | 'cv'
  | 'offer'
  | 'ring_customization'
  | string

const REQUEST_TYPES = new Set(['request'])
const MEMBER_OFFER_TYPES = new Set([
  'offer',
  'partnership',
  'volunteer',
  'mentorship',
  'resource',
  'event',
  'ring_customization',
])
const SUBSCRIBER_TYPES = new Set(['cv'])

/** Server-side permission check for opportunity creation by type. */
export function canCreateOpportunityType(
  role: string | null | undefined,
  opportunityType: string,
): boolean {
  const parsed = parseUserRole(role)
  if (!parsed || parsed === UserRole.visitor) return false

  if (MEMBER_OFFER_TYPES.has(opportunityType)) {
    return hasMemberPrivileges(parsed)
  }
  if (REQUEST_TYPES.has(opportunityType) || SUBSCRIBER_TYPES.has(opportunityType)) {
    return hasRoleAtLeast(parsed, UserRole.subscriber)
  }
  // Unknown types: platform admins may create; others denied at service layer
  return getRoleLevel(parsed) >= ROLE_LEVEL[UserRole.admin]
}

export interface OpportunityVisibilityPatch {
  visibility?: OpportunityVisibility
  isConfidential?: boolean
}

/** Whether a role may assign the given visibility / confidentiality on PATCH. */
export function canSetOpportunityVisibility(
  role: string | null | undefined,
  nextVisibility: OpportunityVisibility | undefined,
  options: { isConfidential?: boolean } = {},
): boolean {
  const parsed = parseUserRole(role)
  if (!parsed) return false

  const wantsConfidential =
    options.isConfidential === true || nextVisibility === 'confidential'

  if (wantsConfidential) {
    return hasConfidentialAccess(parsed)
  }

  if (!nextVisibility) {
    return true
  }

  const allowed = getAllowedVisibilityValues(parsed)
  if (!allowed) {
    return true
  }

  return allowed.includes(nextVisibility)
}

/** Fail-closed guard for visibility fields on opportunity updates. */
export function assertOpportunityVisibilityPatch(
  role: string | null | undefined,
  patch: OpportunityVisibilityPatch,
): void {
  const { visibility, isConfidential } = patch
  if (visibility === undefined && isConfidential === undefined) {
    return
  }

  if (!canSetOpportunityVisibility(role, visibility, { isConfidential })) {
    throw new Error('Access denied. Your role cannot set this visibility level.')
  }
}

/** Server-side permission check for creating confidential opportunities. */
export function canCreateOpportunityConfidential(
  role: string | null | undefined,
): boolean {
  return hasConfidentialAccess(role)
}

/** Owner, platform admin, or confidential role may edit an opportunity. */
export function canEditOpportunity(
  role: string | null | undefined,
  createdBy: string,
  currentUserId: string,
): boolean {
  const parsed = parseUserRole(role)
  if (!parsed) return false
  if (createdBy === currentUserId) return true
  if (isPlatformAdmin(parsed)) return true
  return parsed === UserRole.confidential
}

/** Same gate as edit for delete authorization. */
export function canDeleteOpportunity(
  role: string | null | undefined,
  createdBy: string,
  currentUserId: string,
): boolean {
  return canEditOpportunity(role, createdBy, currentUserId)
}

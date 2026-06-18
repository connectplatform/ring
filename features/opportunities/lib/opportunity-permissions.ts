import {
  UserRole,
  getRoleLevel,
  hasMemberPrivileges,
  hasRoleAtLeast,
  parseUserRole,
  ROLE_LEVEL,
} from '@/features/auth/user-role'

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

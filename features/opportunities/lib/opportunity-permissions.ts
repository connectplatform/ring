// TODO:
// - Consider switching to React 19 server actions for security-critical mutations (see: https://react.dev/learn/server-actions).
// - Migrate to Next.js 16 middleware for async RBAC enforcement at API edges if/when available.
// - Codemods: Use type-narrowing with discriminated unions on role param for safer permission flows.
// - Possible: Replace 'throw' errors with Next's server-safe error boundary handling in future Next versions.

import {
  UserRolesArray,
  getRoleLevel,
  hasConfidentialAccess,
  hasMemberPrivileges,
  hasRoleAtLeast,
  isPlatformAdmin,
  parseUserRolesArray,
  resolveSessionUserRole,
  ROLE_LEVEL,
} from '@/features/auth/user-role'
import type { OpportunityVisibility } from '@/features/opportunities/types'
import { getAllowedVisibilityValues } from '@/features/opportunities/lib/opportunity-visibility-filter'

// Defines the allowed opportunity types for creation
export type OpportunityCreateType =
  | 'request'
  | 'cv'
  | 'offer'
  | 'ring_customization'
  | 'program'
  | string // allows for extensibility on opportunity types

// Sets for fast type lookup
const REQUEST_TYPES = new Set(['request']) // Types only requestable by certain roles
const MEMBER_OFFER_TYPES = new Set([
  // Types available to members and higher roles
  'offer',
  'partnership',
  'volunteer',
  'mentorship',
  'resource',
  'event',
  'ring_customization',
  'program', // institution program / investment
])
const SUBSCRIBER_TYPES = new Set(['cv']) // Types available to subscribers and higher

/** 
 * Checks server-side permissions to create an opportunity of the given type.
 * Returns true if the user's role is sufficient.
 */
export function canCreateOpportunityType(
  role: string | null | undefined,
  opportunityType: string,
): boolean {
  // Attempt to parse the role into a known enum or resolve it via session
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  // Deny if role couldn't be resolved, or is a non-logged-in visitor
  if (!parsed || parsed === UserRolesArray.visitor) return false

  // Check for critical types allowed for member-offer roles
  if (MEMBER_OFFER_TYPES.has(opportunityType)) {
    return hasMemberPrivileges(parsed as UserRolesArray)
  }

  // For request or subscriber types, require at least a subscriber-level role
  if (REQUEST_TYPES.has(opportunityType) || SUBSCRIBER_TYPES.has(opportunityType)) {
    return hasRoleAtLeast(parsed, UserRolesArray.subscriber)
  }

  // For unknown or special types:
  // Only allow platform admins to create, others denied (also validated server-side)
  return (
    getRoleLevel(parsed as UserRolesArray) >=
    ROLE_LEVEL[UserRolesArray.admin as keyof typeof ROLE_LEVEL]
  )
}

export interface OpportunityVisibilityPatch {
  visibility?: OpportunityVisibility
  isConfidential?: boolean
}

/** 
 * Checks if the given role can assign a certain visibility (or toggle confidentiality) on PATCH.
 * Returns true if setting is permitted.
 */
export function canSetOpportunityVisibility(
  role: string | null | undefined,
  nextVisibility: OpportunityVisibility | undefined,
  options: { isConfidential?: boolean } = {},
): boolean {
  // Parse and resolve user role for context
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (!parsed) return false

  // Confidential needs special privilege: either explicit flag or "confidential" visibility
  const wantsConfidential = options.isConfidential === true || nextVisibility === 'confidential'

  if (wantsConfidential) {
    // Only users with confidential access can set confidential status or visibility
    return hasConfidentialAccess(parsed as UserRolesArray)
  }

  // Not specifying visibility means "don't care" - allow (handled by backend as well)
  if (!nextVisibility) {
    return true
  }

  // Fetch allowed visibility options for this role
  const allowed = getAllowedVisibilityValues(parsed as UserRolesArray)
  if (!allowed) {
    // Fallback: if not defined, allow (but server should validate also)
    return true
  }

  // Only permit visibilities that are allowed for the role
  return allowed.includes(nextVisibility)
}

/**
 * Guard: Throws if `role` is not allowed to set this visibility or confidentiality.
 * Use to prevent logic bugs or access escalation on the server.
 * @throws Error if permission denied
 */
export function assertOpportunityVisibilityPatch(
  role: string | null | undefined,
  patch: OpportunityVisibilityPatch,
): void {
  const { visibility, isConfidential } = patch
  // If neither field is present, treat as no-op, allow
  if (visibility === undefined && isConfidential === undefined) {
    return
  }
  // Guard check, throws on failure
  if (!canSetOpportunityVisibility(role, visibility, { isConfidential })) {
    throw new Error('Access denied. Your role cannot set this visibility level.')
  }
}

/**
 * Server-side: checks if the current role can create a confidential opportunity.
 */
export function canCreateOpportunityConfidential(
  role: string | null | undefined,
): boolean {
  // Parse role, deny if missing/invalid
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (!parsed) return false
  // Only allow if the role grants confidential access
  return hasConfidentialAccess(parsed as UserRolesArray)
}

/**
 * Checks if a user can edit an opportunity: must be owner, platform admin, or have confidential role.
 */
export function canEditOpportunity(
  role: string | null | undefined,
  createdBy: string,
  currentUserId: string,
): boolean {
  // Attempt to resolve the role from input (auth/session)
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  // Deny if user is not logged in or role unrecognized
  if (!parsed) return false
  // Allow: user owns the opportunity
  if (createdBy === currentUserId) return true
  // Allow: user is a platform admin
  if (isPlatformAdmin(parsed as UserRolesArray)) return true
  // Allow: user is explicitly a 'confidential' role (legacy logic)
  return parsed === UserRolesArray.confidential
}

/**
 * Guard for deleting opportunities.
 * Same logic as edit: only owner, admin, or confidential roles.
 * Throws if unauthorized.
 * @throws Error if permission denied
 */
export function canDeleteOpportunity(
  role: string | null | undefined,
  createdBy: string,
  currentUserId: string,
): boolean {
  // Delegate to edit logic; throws error if not authorized.
  if (!canEditOpportunity(role, createdBy, currentUserId)) {
    throw new Error('Access denied. Your role cannot delete this opportunity.')
  }
  // If allowed, return true for confirmation
  return true
}

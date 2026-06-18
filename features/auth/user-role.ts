/**
 * UserRole SSOT — enum + hierarchy + validation helpers.
 *
 * Edge-safe: middleware imports only this file (not features/auth/types.ts).
 * App code may import from here or re-export via features/auth/types.
 */

export enum UserRole {
  visitor = 'visitor',
  subscriber = 'subscriber',
  member = 'member',
  confidential = 'confidential',
  admin = 'admin',
  superadmin = 'superadmin',
}

export const USER_ROLE_VALUES = new Set<string>(Object.values(UserRole))

/** All enum values — use for validation and admin pickers that need every role. */
export const ALL_USER_ROLES = Object.values(UserRole) as UserRole[]

/** Roles assignable via admin UI (excludes visitor + superadmin). */
export const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.subscriber,
  UserRole.member,
  UserRole.confidential,
  UserRole.admin,
]

/** Roles that may access confidential entities/opportunities routes. */
export const CONFIDENTIAL_ACCESS_ROLES: UserRole[] = [
  UserRole.confidential,
  UserRole.admin,
  UserRole.superadmin,
]

/** Platform staff roles (admin APIs, moderation). */
export const PLATFORM_ADMIN_ROLES: UserRole[] = [UserRole.admin, UserRole.superadmin]

/** Roles purchasable via WayForPay (confidential/superadmin are admin-granted). */
export const UPGRADEABLE_ROLES: UserRole[] = [UserRole.subscriber, UserRole.member]

/** Canonical role levels — aligned with user-resolve ROLE_PRIORITY. */
export const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.visitor]: 0,
  [UserRole.subscriber]: 1,
  [UserRole.member]: 2,
  [UserRole.confidential]: 3,
  [UserRole.admin]: 4,
  [UserRole.superadmin]: 5,
}

export class InvalidUserRoleError extends Error {
  constructor(role: unknown) {
    super(`Invalid user role: ${String(role)}`)
    this.name = 'InvalidUserRoleError'
  }
}

/** Exact lowercase enum match after trim; null if missing or invalid. */
export function parseUserRole(role: unknown): UserRole | null {
  if (typeof role !== 'string') return null
  const trimmed = role.trim()
  return USER_ROLE_VALUES.has(trimmed) ? (trimmed as UserRole) : null
}

/** JWT/session: valid stored role or subscriber default for authenticated users. */
export function resolveSessionUserRole(role: unknown): UserRole {
  return parseUserRole(role) ?? UserRole.subscriber
}

export function isKnownUserRole(role: unknown): role is UserRole {
  return parseUserRole(role) !== null
}

/** Fail-closed validation for server services. */
export function assertKnownUserRole(role: unknown): UserRole {
  const parsed = parseUserRole(role)
  if (!parsed) throw new InvalidUserRoleError(role)
  return parsed
}

export function getRoleLevel(role: string | null | undefined): number {
  const parsed = parseUserRole(role)
  return parsed ? ROLE_LEVEL[parsed] : 0
}

export function hasRoleAtLeast(
  role: string | null | undefined,
  minimum: UserRole,
): boolean {
  return getRoleLevel(role) >= ROLE_LEVEL[minimum]
}

export function hasMemberPrivileges(role: string | null | undefined): boolean {
  return hasRoleAtLeast(role, UserRole.member)
}

/** Admin UI + most admin APIs; use strict superadmin-only where required (e.g. settings). */
export function isPlatformAdmin(role: string | undefined | null): boolean {
  const parsed = parseUserRole(role)
  return parsed === UserRole.admin || parsed === UserRole.superadmin
}

export function hasConfidentialAccess(role: string | null | undefined): boolean {
  const parsed = parseUserRole(role)
  return (
    parsed === UserRole.confidential ||
    parsed === UserRole.admin ||
    parsed === UserRole.superadmin
  )
}

/** True when there is no authenticated session user. */
export function isGuest(session: { user?: unknown } | null | undefined): boolean {
  return !session?.user
}

/** Subscriber+ — gate for opening the opportunity type picker. */
export function canAccessOpportunityCreation(role: string | null | undefined): boolean {
  if (!role) return false
  return hasRoleAtLeast(role, UserRole.subscriber)
}

/** UI prop for opportunity type cards (member-only types unlocked). */
export function opportunitySelectorUserRole(
  role: string | null | undefined,
): 'member' | 'subscriber' {
  return hasMemberPrivileges(role) ? 'member' : 'subscriber'
}

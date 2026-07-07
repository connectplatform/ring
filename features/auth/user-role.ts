/**
 * UserRolesArray Single Source of Truth (SSOT): enum, hierarchy, and validation helpers.
 *
 * SECURITY NOTICE:
 * - ALL_USER_ROLES_SET must be used for ALL role membership checks to prevent prototype pollution attacks.
 * - ADMIN_GUI_ASSIGNABLE_ROLES MUST be the only reference for roles assignable in the admin UI—visitor/superadmin are purposely excluded to prevent privilege abuse or lockout.
 * - All arrays are deeply frozen at runtime, protecting against in-memory manipulation or accidental mutation.
 *
 * Do NOT duplicate/redefine role lists elsewhere! Always import from this module.
 * ALWAYS trim and strictly match user input via ALL_USER_ROLES_SET for *any* input coming from untrusted sources.
 */

// Enum to represent all possible user roles for the platform
export enum UserRolesArray {
  visitor = 'visitor',         // Non-authenticated, viewing-only users
  subscriber = 'subscriber',   // Paying basic subscriber
  member = 'member',           // Elevated status with more access
  confidential = 'confidential', // Access to confidential resources
  admin = 'admin',             // Platform admin (not superadmin)
  superadmin = 'superadmin',   // Top-level platform admin
}

// Freeze the enum to prevent modification at runtime
Object.freeze(UserRolesArray);

// Globally frozen array of user roles for all logic that needs the enum list (ordered)
export const ALL_USER_ROLES: readonly UserRolesArray[] = Object.freeze([
  UserRolesArray.visitor,
  UserRolesArray.subscriber,
  UserRolesArray.member,
  UserRolesArray.confidential,
  UserRolesArray.admin,
  UserRolesArray.superadmin,
]);

/**
 * Internal Set instance for efficient and secure membership checks.
 * Always use this Set for validating role strings from untrusted sources!
 * Excludes 'visitor' because 'visitor' is not a real role a user can hold in persistent state.
 * Prototype pollution attacks and accidental bypasses are blocked using strict .has checks on this Set ONLY!
 */
const allUserRolesSetInternal = new Set<UserRolesArray>([
  UserRolesArray.subscriber,
  UserRolesArray.member,
  UserRolesArray.confidential,
  UserRolesArray.admin,
  UserRolesArray.superadmin,
]);
// Freeze the set so it cannot be mutated at runtime
Object.freeze(allUserRolesSetInternal);

// Public ReadonlySet exposed for all membership checks
export const ALL_USER_ROLES_SET: ReadonlySet<UserRolesArray> = allUserRolesSetInternal;

// Set of roles assignable in admin UI (visitor & superadmin are EXCLUDED for security)
// Always use this for listing choices in admin users assign-role dropdowns etc.
export const ADMIN_GUI_ASSIGNABLE_ROLES_SET: ReadonlySet<UserRolesArray> = Object.freeze(
  new Set([
    UserRolesArray.subscriber,
    UserRolesArray.member,
    UserRolesArray.confidential,
    UserRolesArray.admin,
  ])
);

// Array form of above
export const ADMIN_GUI_ASSIGNABLE_ROLES: readonly UserRolesArray[] = Object.freeze([
  UserRolesArray.subscriber,
  UserRolesArray.member,
  UserRolesArray.confidential,
  UserRolesArray.admin,
]);

// Roles with ability to see confidential resources
export const CONFIDENTIAL_ACCESS_ROLES: readonly UserRolesArray[] = Object.freeze([
  UserRolesArray.confidential,
  UserRolesArray.admin,
  UserRolesArray.superadmin,
]);

// Roles considered application/platform-wide administrators
export const PLATFORM_ADMIN_ROLES: readonly UserRolesArray[] = Object.freeze([
  UserRolesArray.admin,
  UserRolesArray.superadmin,
]);

// Roles that are eligible to be upgraded by the user/admin
export const UPGRADEABLE_ROLES: readonly UserRolesArray[] = Object.freeze([
  UserRolesArray.subscriber,
  UserRolesArray.member,
]);

// Map each role to a numeric hierarchy level (higher = more privilege)
export const ROLE_LEVEL: Readonly<Record<UserRolesArray, number>> = Object.freeze({
  [UserRolesArray.visitor]: 0,
  [UserRolesArray.subscriber]: 1,
  [UserRolesArray.member]: 2,
  [UserRolesArray.confidential]: 3,
  [UserRolesArray.admin]: 4,
  [UserRolesArray.superadmin]: 5,
});

// Custom error for role validation, to give clear feedback when access checks fail
export class InvalidUserRoleError extends Error {
  constructor(role: unknown) {
    super(`Invalid user role: ${String(role)}`);
    this.name = 'InvalidUserRoleError';
  }
}

/**
 * Parses and validates a user role.
 * Returns the UserRolesArray enum value if valid, or null if invalid.
 * All untrusted input MUST be strictly checked using ALL_USER_ROLES_SET.has after trimming.
 */
export function parseUserRolesArray(role: unknown): UserRolesArray | null {
  if (typeof role !== 'string') return null;
  const trimmed = role.trim();
  // Prevents prototype pollution and loose equality attacks
  return ALL_USER_ROLES_SET.has(trimmed as UserRolesArray) ? (trimmed as UserRolesArray) : null;
}

/**
 * Resolves unknown or absent roles to 'visitor' (the baseline guest role).
 * Always leverage parseUserRolesArray for validation before resolving.
 */
export function resolveSessionUserRole(role: unknown): UserRolesArray {
  const parsed = parseUserRolesArray(role);
  return parsed ?? UserRolesArray.visitor;
}

/**
 * Type guard for whether a role is a strictly valid member of ALL_USER_ROLES_SET.
 */
export function isKnownUserRole(role: unknown): role is UserRolesArray {
  return parseUserRolesArray(role) !== null;
}

/**
 * Asserts that the role is known and valid.
 * Throws InvalidUserRoleError with the input if not, to support callsites needing hard guarantees.
 */
export function assertKnownUserRole(role: unknown): UserRolesArray {
  const parsed = parseUserRolesArray(role);
  if (!parsed) throw new InvalidUserRoleError(role);
  return parsed;
}

/**
 * Returns the numeric hierarchy of a given role.
 * Unknown or unprivileged roles default to visitor (level 0).
 * This enables privilege checks via numeric comparison.
 */
export function getRoleLevel(role: string | null | undefined): number {
  const parsed = parseUserRolesArray(role);
  return parsed ? ROLE_LEVEL[parsed] : 0;
}

/**
 * Returns true if the role's privilege level is >= the required minimum.
 * Both input and comparison are validated securely using enum and mapping, not indexOf or includes.
 */
export function hasRoleAtLeast(
  role: string | null | undefined,
  minimum: UserRolesArray,
): boolean {
  return getRoleLevel(role) >= ROLE_LEVEL[minimum];
}

/**
 * Returns true if the role has member or greater privileges (member, confidential, admin, superadmin).
 */
export function hasMemberPrivileges(role: string | null | undefined): boolean {
  return hasRoleAtLeast(role, UserRolesArray.member);
}

/**
 * Returns true if the role is platform admin level (admin or superadmin).
 * Used for admin-boundary gating logic.
 */
export function isPlatformAdmin(role: string | undefined | null): boolean {
  const parsed = parseUserRolesArray(role);
  // Only admin or superadmin qualify as platform admin
  return (
    parsed === UserRolesArray.admin || parsed === UserRolesArray.superadmin
  );
}

/**
 * Returns true if the role is superadmin only.
 */
export function isSuperadmin(role: string | null | undefined): boolean {
  return parseUserRolesArray(role) === UserRolesArray.superadmin;
}

/**
 * Throws if the input role is not an admin or superadmin.
 * Used throughout app for endpoint authorization with early error throwing.
 */
export function assertPlatformAdmin(role: unknown): UserRolesArray {
  const parsed = assertKnownUserRole(role);
  if (!isPlatformAdmin(parsed)) {
    throw new Error('Platform admin access required');
  }
  return parsed;
}

/**
 * Throws if the input role is not a superadmin.
 * Always uses strict parsing for security.
 */
export function assertSuperadmin(role: unknown): UserRolesArray {
  const parsed = assertKnownUserRole(role);
  if (!isSuperadmin(parsed)) {
    throw new Error('Superadmin access required');
  }
  return parsed;
}

/**
 * Returns true if the role has access to confidential resources.
 * Only valid for confidential, admin, or superadmin.
 */
export function hasConfidentialAccess(role: string | null | undefined): boolean {
  const parsed = parseUserRolesArray(role);
  return (
    parsed === UserRolesArray.confidential ||
    parsed === UserRolesArray.admin ||
    parsed === UserRolesArray.superadmin
  );
}

/**
 * Returns true if the session object is missing or has no user (guest session).
 * 
 * TODO: In future Next.js/React Server Actions, evaluate use of server-side context hooks for session status.
 */
export function isGuest(session: { user?: unknown } | null | undefined): boolean {
  // Checks if session is non-null and has a user object; returns true if not.
  return !session?.user;
}

/**
 * Returns true if the given role is at least 'subscriber'.
 * Used to restrict features (ex: opportunity creation) to registered, non-guest users.
 */
export function canAccessOpportunityCreation(role: string | null | undefined): boolean {
  const parsed = parseUserRolesArray(role);
  // Subscriber and above can access
  return hasRoleAtLeast(parsed, UserRolesArray.subscriber);
}

/**
 * Discriminates user-facing membership state for UI components:
 * Returns 'member' if the role is member or better, else 'subscriber'.
 * 
 * TODO: Change to use memoized selectors if this function becomes a React selector in context.
 */
export function opportunitySelectorUserRole(
  role: string | null | undefined,
): 'member' | 'subscriber' {
  // Returns 'member' for member and above, otherwise 'subscriber'
  return hasMemberPrivileges(role) ? 'member' : 'subscriber';
}

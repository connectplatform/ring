import {
  hasConfidentialAccess,
  hasMemberPrivileges,
  isPlatformAdmin,
  parseUserRolesArray,  
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'
import type { NewsVisibility } from '@/features/news/types'
import { getAllowedNewsVisibilityValues } from '@/features/news/lib/news-visibility-filter'

// TODO: Use React19/Next16 native server-only "use server" directive for all function exports meant for server only
// TODO: Mark all permission checking utilities with proper JSDoc @server annotations if/when supported

/**
 * Checks if the current user (via role) can create a news article.
 * @param role - serialized input role string, null, or undefined
 * @returns true if role has create privileges
 */
export function canCreateNewsArticle(role: string | null | undefined): boolean {
  // Try to parse the role using available helper, fallback to session resolver
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (!parsed) return false // No role parsed, deny access

  // Allow creation if: user has member privileges, is an admin, or is confidential
  return (
    hasMemberPrivileges(parsed) ||
    isPlatformAdmin(parsed) ||
    parsed === UserRolesArray.confidential
  )
}

/**
 * Checks if the user can edit a news article, based on role and authorship.
 * @param role - current user role string
 * @param articleAuthorId - ID of article's author
 * @param currentUserId - ID of user attempting edit
 * @returns true if user has edit permission
 */
export function canEditNewsArticle(
  role: string | null | undefined,
  articleAuthorId: string,
  currentUserId: string,
): boolean {
  // Parse role string or resolve from session
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (!parsed) return false // No role resolved: deny access

  // Allow edit if user is platform admin, or if user is the author
  return isPlatformAdmin(parsed) || articleAuthorId === currentUserId
}

/**
 * Checks if the user can delete a news article.
 * Deletion privileges are identical to edit privileges.
 * @returns true if user can delete
 */
export function canDeleteNewsArticle(
  role: string | null | undefined,
  articleAuthorId: string,
  currentUserId: string,
): boolean {
  // Directly reuse edit-permission logic
  return canEditNewsArticle(role, articleAuthorId, currentUserId)
}

/**
 * Checks if user can approve publication to the main page.
 * @param role - current user role string
 * @returns true if user has approval privileges (only platform admin)
 */
export function canApproveMainPagePublication(role: string | null | undefined): boolean {
  // Only platform admins may approve
  return isPlatformAdmin(role)
}

// If needed, extend for future patch fields (structure for patch requests).
export interface NewsVisibilityPatch {
  visibility?: NewsVisibility
}

/**
 * Tests if a user is allowed to set a specific visibility level for a news article.
 * @param role - string or null/undefined user role
 * @param nextVisibility - the visibility level being set
 * @returns true if role can set desired visibility
 */
export function canSetNewsVisibility(
  role: string | null | undefined,
  nextVisibility: NewsVisibility | undefined,
): boolean {
  // Parse/extract user role info
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (!parsed) return false // No role parsed: deny access

  // Confidential news is limited to confidential-access users
  if (nextVisibility === 'confidential') {
    return hasConfidentialAccess(parsed as UserRolesArray)
  }

  // 'site-wide' visibility is platform admin only
  if (nextVisibility === 'site-wide') {
    return isPlatformAdmin(parsed as UserRolesArray)
  }

  // If nothing set, skip restriction (may be patch-removal or noop)
  if (!nextVisibility) {
    return true
  }

  // Query allowed visibility values for this user role
  const allowed = getAllowedNewsVisibilityValues(parsed as UserRolesArray)

  // If allowed not resolved (should not happen), fallback to true for backwards compatible permissiveness
  if (!allowed) {
    return true
  }

  // Members/admins may set blog-only visibility
  if (nextVisibility === 'blog-only') {
    return hasMemberPrivileges(parsed as UserRolesArray) || isPlatformAdmin(parsed as UserRolesArray)
  }

  // Otherwise, restrict to allowed visibilities
  return allowed.includes(nextVisibility)
}

/**
 * Asserts (throws error) if user cannot set the requested visibility.
 * Provides a runtime gate for server logic to deny mutation.
 * @throws Error if permission denied
 */
export function assertNewsVisibilityPatch(
  role: string | null | undefined,
  patch: NewsVisibilityPatch,
): void {
  const { visibility } = patch

  // If no visibility to set, no assertion needed (noop patch)
  if (visibility === undefined) {
    return
  }

  // If not allowed, block with error
  if (!canSetNewsVisibility(role, visibility)) {
    throw new Error('Access denied. Your role cannot set this news visibility level.')
  }
}

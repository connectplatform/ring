import {
  hasMemberPrivileges,
  isPlatformAdmin,
  parseUserRolesArray,
  resolveSessionUserRole,
} from '@/features/auth/user-role'

/** Any authenticated member may propose a revision on published articles. */
export function canProposeRevision(role: string | null | undefined): boolean {
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (!parsed) return false
  return (
    hasMemberPrivileges(parsed) ||
    isPlatformAdmin(parsed)
  )
}

/** Author or platform admin may accept/reject pending revisions. */
export function canResolveRevision(
  role: string | null | undefined,
  articleAuthorId: string,
  currentUserId: string,
): boolean {
  if (!currentUserId) return false
  if (articleAuthorId === currentUserId) return true
  return isPlatformAdmin(role)
}

/** Owner/admin manage invites (scaffolded; invite UI later). */
export function canManageCollaborators(
  role: string | null | undefined,
  articleAuthorId: string,
  currentUserId: string,
): boolean {
  return canResolveRevision(role, articleAuthorId, currentUserId)
}

/**
 * Who may read pending revision payloads (full HTML proposals).
 * Author/admin, or the proposer of that specific revision.
 */
export function canViewRevision(
  role: string | null | undefined,
  articleAuthorId: string,
  currentUserId: string,
  proposerId?: string,
): boolean {
  if (!currentUserId) return false
  if (canResolveRevision(role, articleAuthorId, currentUserId)) return true
  if (proposerId && proposerId === currentUserId) return true
  return false
}

import {
  hasConfidentialAccess,
  hasMemberPrivileges,
  isPlatformAdmin,
  parseUserRole,
  UserRole,
} from '@/features/auth/user-role'
import type { NewsVisibility } from '@/features/news/types'
import { getAllowedNewsVisibilityValues } from '@/features/news/lib/news-visibility-filter'

/** Server-side permission check for news article creation. */
export function canCreateNewsArticle(role: string | null | undefined): boolean {
  const parsed = parseUserRole(role)
  if (!parsed) return false
  return (
    hasMemberPrivileges(parsed) ||
    isPlatformAdmin(parsed) ||
    parsed === UserRole.confidential
  )
}

export function canEditNewsArticle(
  role: string | null | undefined,
  articleAuthorId: string,
  currentUserId: string,
): boolean {
  const parsed = parseUserRole(role)
  if (!parsed) return false
  return isPlatformAdmin(parsed) || articleAuthorId === currentUserId
}

export function canDeleteNewsArticle(
  role: string | null | undefined,
  articleAuthorId: string,
  currentUserId: string,
): boolean {
  return canEditNewsArticle(role, articleAuthorId, currentUserId)
}

export function canApproveMainPagePublication(role: string | null | undefined): boolean {
  return isPlatformAdmin(role)
}

export interface NewsVisibilityPatch {
  visibility?: NewsVisibility
}

export function canSetNewsVisibility(
  role: string | null | undefined,
  nextVisibility: NewsVisibility | undefined,
): boolean {
  const parsed = parseUserRole(role)
  if (!parsed) return false

  if (nextVisibility === 'confidential') {
    return hasConfidentialAccess(parsed)
  }

  if (nextVisibility === 'site-wide') {
    return isPlatformAdmin(parsed)
  }

  if (!nextVisibility) {
    return true
  }

  const allowed = getAllowedNewsVisibilityValues(parsed)
  if (!allowed) {
    return true
  }

  if (nextVisibility === 'blog-only') {
    return hasMemberPrivileges(parsed) || isPlatformAdmin(parsed)
  }

  return allowed.includes(nextVisibility)
}

export function assertNewsVisibilityPatch(
  role: string | null | undefined,
  patch: NewsVisibilityPatch,
): void {
  const { visibility } = patch
  if (visibility === undefined) {
    return
  }

  if (!canSetNewsVisibility(role, visibility)) {
    throw new Error('Access denied. Your role cannot set this news visibility level.')
  }
}

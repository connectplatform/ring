import type { NewsVisibility } from '@/features/news/types'
import {
  UserRole,
  assertKnownUserRole,
  hasConfidentialAccess,
  isPlatformAdmin,
  parseUserRole,
} from '@/features/auth/user-role'

export type DbFilter = { field: string; operator: string; value: unknown }

export interface NewsVisibilityContext {
  userId?: string
  userRole: UserRole
}

export interface NewsViewRow {
  id?: string
  visibility?: NewsVisibility | string
  authorId?: string
  status?: string
}

/** Main-site discovery ladder (includes promoted site-wide content). */
const MAIN_DISCOVERY_LADDER: Record<string, NewsVisibility[]> = {
  [UserRole.visitor]: ['public', 'site-wide'],
  [UserRole.subscriber]: ['public', 'subscriber', 'site-wide'],
  [UserRole.member]: ['public', 'subscriber', 'member', 'site-wide'],
}

/**
 * Returns allowed visibility values for list/search filters, or null when unrestricted.
 */
export function getAllowedNewsVisibilityValues(
  role: string | null | undefined,
): NewsVisibility[] | null {
  const parsed = parseUserRole(role) ?? UserRole.visitor
  if (isPlatformAdmin(parsed) || parsed === UserRole.confidential) {
    return null
  }
  return MAIN_DISCOVERY_LADDER[parsed] ?? ['public', 'site-wide']
}

/** Build DB where filters for news list/search by role (main discovery surfaces). */
export function buildNewsVisibilityFilters(
  role: string | null | undefined,
): DbFilter[] {
  const filters: DbFilter[] = []
  const allowed = getAllowedNewsVisibilityValues(role)
  const parsed = parseUserRole(role) ?? UserRole.visitor

  if (allowed) {
    filters.push({ field: 'visibility', operator: 'in', value: allowed })
  }

  if (!hasConfidentialAccess(parsed)) {
    filters.push({ field: 'visibility', operator: '!=', value: 'confidential' })
  }

  return filters
}

/**
 * Row-level access after fetch (by-id, slug detail).
 */
export function canViewNewsArticle(
  article: NewsViewRow,
  ctx: NewsVisibilityContext,
): boolean {
  const userRole = assertKnownUserRole(ctx.userRole)
  const visibility = (article.visibility ?? 'public') as NewsVisibility

  if (visibility === 'confidential' && !hasConfidentialAccess(userRole)) {
    return false
  }

  if (visibility === 'blog-only') {
    return (
      isPlatformAdmin(userRole) ||
      Boolean(ctx.userId && article.authorId && ctx.userId === article.authorId)
    )
  }

  if (visibility === 'site-wide') {
    return true
  }

  const allowed = getAllowedNewsVisibilityValues(userRole)
  if (!allowed) {
    return true
  }

  return allowed.includes(visibility)
}

export function filterNewsForDiscovery<T extends NewsViewRow>(
  articles: T[],
  ctx: NewsVisibilityContext,
): T[] {
  return articles.filter((article) => canViewNewsArticle(article, ctx))
}

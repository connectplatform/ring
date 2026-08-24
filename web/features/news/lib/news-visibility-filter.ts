import type { NewsVisibility } from '@/features/news/types'
import {
  UserRolesArray,
  hasConfidentialAccess,
  isPlatformAdmin,
  parseUserRolesArray,
  resolveSessionUserRole,
} from '@/features/auth/user-role'

// Defines a database filter used for querying news.
// Example: { field: 'visibility', operator: 'in', value: [...] }
export type DbFilter = { field: string; operator: string; value: unknown }

// Context required to determine news visibility for a specific user.
export interface NewsVisibilityContext {
  userId?: string // Optional identifier for user (used for author checks)
  // Guest/logged-out viewers may be missing, undefined, or session-only `visitor`.
  userRole?: UserRolesArray | string | null
}

// Row structure for news articles, including visibility & author metadata
export interface NewsViewRow {
  id?: string
  visibility?: NewsVisibility | string // Can be undefined, fallback to 'public'
  authorId?: string // Author's userId
  status?: string // Optional status not used in visibility logic
}

// Main-site discovery ladders — which visibility levels are shown to which roles
const MAIN_DISCOVERY_LADDER: Record<string, NewsVisibility[]> = {
  [UserRolesArray.visitor]: ['public', 'site-wide'],
  [UserRolesArray.subscriber]: ['public', 'subscriber', 'site-wide'],
  [UserRolesArray.member]: ['public', 'subscriber', 'member', 'site-wide'],
}

/**
 * Gets allowed visibility values based on role, for UI filtering or DB queries.
 * Returns null if unrestricted (eg: admin or confidential access).
 *
 * @param role - a user role as string, null, or undefined
 * @returns array of allowed visibilities, or null if user can see all
 */
export function getAllowedNewsVisibilityValues(
  role: string | null | undefined,
): NewsVisibility[] | null {
  // Try to parse user role from input, fall back to session-based resolution
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)

  // If user is platform admin or has 'confidential', allow all visibilities (null = no DB restriction)
  if (isPlatformAdmin(parsed as UserRolesArray) || parsed === UserRolesArray.confidential) {
    return null
  }

  // Fall back to the appropriate visibility ladder for the parsed role
  // If role is not recognized, default to 'public' and 'site-wide'
  return MAIN_DISCOVERY_LADDER[parsed] ?? ['public', 'site-wide']
}

/**
 * Construct DB filters for news list/search surfaces based on user role.
 * Only filters visibility surface, DOES NOT guarantee full security.
 *
 * @param role - user role as string/null/undefined
 * @returns array of DbFilters for main-surface queries
 */
export function buildNewsVisibilityFilters(
  role: string | null | undefined,
): DbFilter[] {
  const filters: DbFilter[] = []
  const allowed = getAllowedNewsVisibilityValues(role)
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)

  // If no valid role could be parsed, return empty filter set (nothing visible)
  if (!parsed) return []

  // If allowed is non-null, restrict to that visibility set, otherwise allow all
  if (allowed) {
    filters.push({ field: 'visibility', operator: 'in', value: allowed })
  }

  // If the user does not have confidential access, explicitly exclude 'confidential'
  // This is defensive in case legacy data has nonstandard visibilities.
  if (!hasConfidentialAccess(parsed as UserRolesArray)) {
    filters.push({ field: 'visibility', operator: '!=', value: 'confidential' })
  }

  return filters
}

/**
 * Enforces per-row access control (used after DB fetch, eg: for by-id/slug pages).
 * Ensures security regardless of DB surface guards.
 * 
 * TODO: Consider memoizing allowed visibilities if repeatedly checking many articles (React 19: useMemo or useTransition for batching).
 *
 * @param article - Article row to check
 * @param ctx - User context (id, roles)
 * @returns true if user can view article, false otherwise
 */
export function canViewNewsArticle(
  article: NewsViewRow,
  ctx: NewsVisibilityContext,
): boolean {
  // Session-only visitor/missing/unknown roles resolve to guest. Do not throw on public news.
  const userRole = resolveSessionUserRole(ctx.userRole)
  // Default to 'public' visibility if undefined in row data.
  const visibility = (article.visibility ?? 'public') as NewsVisibility

  // Check: If confidential and user does not have access, block.
  if (visibility === 'confidential' && !hasConfidentialAccess(userRole)) {
    return false
  }

  // If 'blog-only', only admins or the author can view.
  if (visibility === 'blog-only') {
    return (
      isPlatformAdmin(userRole) || // Platform admins can always view
      Boolean(ctx.userId && article.authorId && ctx.userId === article.authorId) // Author can view their own blog-only posts
    )
  }

  // Site-wide content is always visible to all logged-in + anonymous users.
  if (visibility === 'site-wide') {
    return true
  }

  // For all other cases, check if allowed for this user role.
  const allowed = getAllowedNewsVisibilityValues(userRole)
  if (!allowed) {
    // If unrestricted, user may view any
    return true
  }

  return allowed.includes(visibility)
}

/**
 * Filters a news article array in-memory, using full access logic per article.
 *
 * @param articles - Array of NewsViewRow (or subclass)
 * @param ctx - user and role context
 * @returns Array of articles user can view
 *
 * TODO: If used in a React/Next-based state, switch to React.useMemo for perf if static per render.
 */
export function filterNewsForDiscovery<T extends NewsViewRow>(
  articles: T[],
  ctx: NewsVisibilityContext,
): T[] {
  return articles.filter((article) => canViewNewsArticle(article, ctx))
}

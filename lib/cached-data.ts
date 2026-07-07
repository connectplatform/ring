import { unstable_cache, revalidateTag } from 'next/cache'
import { getEntitiesForRole } from '@/features/entities/services/get-entities'
import { getOpportunitiesForRole } from '@/features/opportunities/services/get-opportunities'
import { UserRolesArray } from '@/features/auth/user-role'

export const getCachedEntitiesForRole = (roleKey: UserRolesArray) =>
  unstable_cache(
    async (limit: number = 20, startAfter?: string) => {
      return getEntitiesForRole({ userRole: roleKey, limit, startAfter })
    },
    ['entities-list', roleKey],
    { tags: ['entities-list', `entities-role-${roleKey}`] }
  )

export const getCachedOpportunitiesForRole = (roleKey: UserRolesArray) =>
  unstable_cache(
    async (limit: number = 20, startAfter?: string) => {
      console.log('Cached data: getCachedOpportunitiesForRole called with:', { roleKey, limit, startAfter });
      try {
        const result = await getOpportunitiesForRole({ userRole: roleKey, limit, startAfter });
        console.log('Cached data: getOpportunities result:', {
          opportunityCount: result.opportunities.length,
          hasLastVisible: !!result.lastVisible
        });
        return result;
      } catch (error) {
        console.error('Cached data: Error in getOpportunities:', error);
        throw error;
      }
    },
    ['opportunities-list', roleKey],
    { tags: ['opportunities-list', `opportunities-role-${roleKey}`] }
  )

export function invalidateEntitiesCache(roleKeys: string[] = []) {
  revalidateTag('entities-list', 'max')
  for (const role of roleKeys) revalidateTag(`entities-role-${role}`, 'max')
}

export function invalidateOpportunitiesCache(roleKeys: string[] = []) {
  revalidateTag('opportunities-list', 'max')
  for (const role of roleKeys) revalidateTag(`opportunities-role-${role}`, 'max')
}

/**
 * Invalidate news-stats cache (admin sidebar lightweight aggregate).
 * Call after any news article create / update / delete / status change.
 */
export function invalidateNewsStatsCache() {
  revalidateTag('news-stats', 'max')
}



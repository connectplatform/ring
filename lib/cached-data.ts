import { unstable_cache, revalidateTag } from 'next/cache'
import { getEntitiesForRole } from '@/features/entities/services/get-entities'
import { getOpportunitiesForRole } from '@/features/opportunities/services/get-opportunities'
import { UserRole } from '@/features/auth/types'

export const getCachedEntitiesForRole = (roleKey: UserRole) =>
  unstable_cache(
    async (limit: number = 20, startAfter?: string) => {
      return getEntitiesForRole({ userRole: roleKey, limit, startAfter })
    },
    ['entities-list', roleKey],
    { tags: ['entities-list', `entities-role-${roleKey}`] }
  )

export const getCachedOpportunitiesForRole = (roleKey: UserRole) =>
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
  revalidateTag('entities-list')
  for (const role of roleKeys) revalidateTag(`entities-role-${role}`)
}

export function invalidateOpportunitiesCache(roleKeys: string[] = []) {
  revalidateTag('opportunities-list')
  for (const role of roleKeys) revalidateTag(`opportunities-role-${role}`)
}



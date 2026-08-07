import 'server-only'

import { getUserBlockedEntityIds } from '@/features/entities/services/entity-moderation'

/**
 * Skip matcher notifications when the recipient blocked the posting organization (entity).
 */
export async function shouldSuppressMatcherNotificationForUser(
  userId: string,
  organizationId?: string | null,
): Promise<boolean> {
  if (!organizationId) return false
  const blocked = await getUserBlockedEntityIds(userId)
  return blocked.includes(organizationId)
}

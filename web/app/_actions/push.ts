'use server'

import { auth } from '@/auth'
import {
  unregisterPushSubscriptionForUser,
  upsertPushSubscriptionForUser,
  type UnregisterPushSubscriptionParams,
  type UpsertPushSubscriptionParams,
  type UpsertPushSubscriptionResult,
} from '@/lib/notifications/push-subscription-db'

/**
 * Server Action: upsert RFC Web Push subscription for the current user.
 * userId from auth() only.
 */
export async function upsertPushSubscription(
  params: UpsertPushSubscriptionParams,
): Promise<UpsertPushSubscriptionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Authentication required' }
  }
  return upsertPushSubscriptionForUser(session.user.id, params)
}

export async function unregisterPushSubscription(
  params: UnregisterPushSubscriptionParams,
): Promise<UpsertPushSubscriptionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Authentication required' }
  }
  return unregisterPushSubscriptionForUser(session.user.id, params)
}

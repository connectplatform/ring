'use server'

import { auth } from '@/auth'
import {
  upsertFcmTokenForUser,
  type UpsertFcmTokenParams,
  type UpsertFcmTokenResult,
} from '@/lib/notifications/fcm-token-db'

/**
 * Server Action: upsert FCM token for the current user.
 * React app should use this as the primary path; API route is for non-React clients and is rate-limited.
 * userId is derived from auth() only — never pass userId from the client.
 */
export async function upsertFcmToken(params: UpsertFcmTokenParams): Promise<UpsertFcmTokenResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Authentication required' }
  }
  return upsertFcmTokenForUser(session.user.id, params)
}

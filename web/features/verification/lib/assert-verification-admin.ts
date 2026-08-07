import 'server-only'

import { auth } from '@/auth'
import { assertKnownUserRole, isPlatformAdmin } from '@/features/auth/user-role'
import { EntityPermissionError } from '@/lib/errors'

/** Admin reviewer gate for verification queue and KYC actions. */
export async function assertVerificationAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(assertKnownUserRole(session.user.role))) {
    throw new EntityPermissionError('Admin access required')
  }
  return session.user.id
}

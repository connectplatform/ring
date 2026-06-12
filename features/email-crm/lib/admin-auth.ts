import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'

export async function requireEmailAdmin() {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized', status: 401 as const }
  if (!isPlatformAdmin(session.user.role)) {
    return { error: 'Admin access required', status: 403 as const }
  }
  return { session }
}

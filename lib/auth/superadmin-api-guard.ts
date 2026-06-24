import { auth } from '@/auth'
import { UserRole } from '@/features/auth/user-role'
import { NextResponse } from 'next/server'

type SuperadminSession = NonNullable<Awaited<ReturnType<typeof auth>>>

type SuperadminGuardResult =
  | { ok: true; session: SuperadminSession }
  | { ok: false; response: NextResponse }

export async function requireSuperadminApi(): Promise<SuperadminGuardResult> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (session.user.role !== UserRole.superadmin) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, session }
}

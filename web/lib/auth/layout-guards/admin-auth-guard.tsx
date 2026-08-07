import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'

interface AdminAuthGuardProps {
  locale: Locale
  children: React.ReactNode
}

/** Requires platform admin role. */
export async function AdminAuthGuard({ locale, children }: AdminAuthGuardProps) {
  await connection()

  const session = await auth()
  if (!session) {
    localizedRedirect({ locale, href: '/login' })
  }

  if (!isPlatformAdmin(session.user.role)) {
    localizedRedirect({ locale, href: '/unauthorized' })
  }

  return <>{children}</>
}

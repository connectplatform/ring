import { auth } from '@/auth'
import { resolveSessionAccountStatus } from '@/lib/auth/resolve-session-account-status'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'

interface SuspendedAccountGuardProps {
  locale: Locale
  children: React.ReactNode
}

/** Only suspended accounts may access the (account) minimal shell. */
export async function SuspendedAccountGuard({ locale, children }: SuspendedAccountGuardProps) {
  await connection()

  const session = await auth()
  if (!session) {
    localizedRedirect({ locale, href: '/login' })
  }

  const { status } = await resolveSessionAccountStatus(session, { live: true })

  if (status !== 'SUSPENDED') {
    localizedRedirect({ locale, href: '/' })
  }

  return <>{children}</>
}

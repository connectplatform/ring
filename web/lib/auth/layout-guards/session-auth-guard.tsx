import { auth } from '@/auth'
import { resolveSessionAccountStatus } from '@/lib/auth/resolve-session-account-status'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'

interface SessionAuthGuardProps {
  locale: Locale
  children: React.ReactNode
}

/** Requires authenticated session; redirects suspended users to account restore shell. */
export async function SessionAuthGuard({ locale, children }: SessionAuthGuardProps) {
  await connection()

  const session = await auth()
  if (!session) {
    localizedRedirect({ locale, href: '/login' })
  }

  const { status } = await resolveSessionAccountStatus(session, { live: true })
  if (status === 'SUSPENDED') {
    localizedRedirect({ locale, href: '/account/suspended' })
  }

  return <>{children}</>
}

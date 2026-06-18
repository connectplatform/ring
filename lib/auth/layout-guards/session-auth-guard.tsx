import { auth } from '@/auth'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'

interface SessionAuthGuardProps {
  locale: Locale
  children: React.ReactNode
}

/** Requires authenticated session; redirects to login when absent. */
export async function SessionAuthGuard({ locale, children }: SessionAuthGuardProps) {
  await connection()

  const session = await auth()
  if (!session) {
    localizedRedirect({ locale, href: '/login' })
  }

  return <>{children}</>
}

import { auth } from '@/auth'
import { CONFIDENTIAL_ACCESS_ROLES } from '@/features/auth/user-role'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import { headers } from 'next/headers'
import type { Locale } from '@/i18n/shared'

interface ConfidentialAuthGuardProps {
  locale: Locale
  children: React.ReactNode
}

const ALLOWED_CONFIDENTIAL_ROLES: readonly string[] = CONFIDENTIAL_ACCESS_ROLES

function toRoleList(role: unknown): string[] {
  if (!role) return []
  if (Array.isArray(role)) return role.filter((value): value is string => typeof value === 'string')
  if (typeof role === 'string') return [role]
  return []
}

function hasAnyRole(role: unknown, allowedRoles: readonly string[]): boolean {
  const roles = toRoleList(role)
  return roles.some((value) => allowedRoles.includes(value))
}

/** Requires confidential-access role (confidential, admin, superadmin). */
export async function ConfidentialAuthGuard({ locale, children }: ConfidentialAuthGuardProps) {
  await connection()

  const headersList = await headers()
  const session = await auth()

  if (!session?.user) {
    const rawFrom =
      headersList.get('x-pathname') || headersList.get('x-url') || headersList.get('referer') || `/${locale}`
    const normalizedFrom = rawFrom.startsWith('http') ? new URL(rawFrom).pathname : rawFrom
    localizedRedirect({
      locale,
      href: '/login',
      query: { from: normalizedFrom },
    })
  }

  if (!hasAnyRole(session.user.role, ALLOWED_CONFIDENTIAL_ROLES)) {
    localizedRedirect({ locale, href: '/unauthorized' })
  }

  return <>{children}</>
}

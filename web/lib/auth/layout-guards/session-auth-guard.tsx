import { auth } from '@/auth'
import { resolveSessionAccountStatus } from '@/lib/auth/resolve-session-account-status'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { stripLocaleFromPathname } from '@/lib/proxy-intl'
import { ROUTES } from '@/constants/routes'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'

interface SessionAuthGuardProps {
  locale: Locale
  children: React.ReactNode
}

function isPublicReadProtectedGroupPath(strippedPathname: string): boolean {
  if (strippedPathname === '/entities' || strippedPathname === '/opportunities') {
    return true
  }
  if (
    /^\/entities\/[^/]+$/.test(strippedPathname) &&
    strippedPathname !== '/entities/add' &&
    strippedPathname !== '/entities/my'
  ) {
    return true
  }
  if (
    /^\/opportunities\/[^/]+$/.test(strippedPathname) &&
    strippedPathname !== '/opportunities/add' &&
    strippedPathname !== '/opportunities/my'
  ) {
    return true
  }
  return false
}

/** Browser path plus query, so login can return to `/entities/add` or `/opportunities/add?type=…`. */
function callbackPathFromHeaders(reqHeaders: Headers): string {
  const rawUrl = reqHeaders.get('x-url') || ''
  try {
    if (rawUrl) {
      const url = new URL(rawUrl)
      return `${stripLocaleFromPathname(url.pathname)}${url.search}`
    }
  } catch {
    /* fall through to pathname header */
  }
  const rawPath = reqHeaders.get('x-pathname') || '/'
  return stripLocaleFromPathname(rawPath) || '/'
}

/** Requires authenticated session; redirects suspended users to account restore shell. */
export async function SessionAuthGuard({ locale, children }: SessionAuthGuardProps) {
  await connection()

  const session = await auth()
  if (!session) {
    const reqHeaders = await headers()
    const rawPathname = reqHeaders.get('x-pathname') || ''
    const stripped = rawPathname ? stripLocaleFromPathname(rawPathname) : ''
    if (stripped && isPublicReadProtectedGroupPath(stripped)) {
      return <>{children}</>
    }
    const callbackUrl = callbackPathFromHeaders(reqHeaders)
    redirect(`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const { status } = await resolveSessionAccountStatus(session, { live: true })
  if (status === 'SUSPENDED') {
    localizedRedirect({ locale, href: '/account/suspended' })
  }

  return <>{children}</>
}

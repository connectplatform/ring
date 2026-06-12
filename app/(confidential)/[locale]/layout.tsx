import React, { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { NotificationProvider } from '@/features/notifications/components/notification-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import Navigation from '@/components/navigation/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { notFound } from 'next/navigation'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { setupResourcePreloading } from '@/lib/preload/setup'
import { getMessages } from 'next-intl/server'
import { auth } from '@/auth'
import { connection } from 'next/server'
import { headers } from 'next/headers'
import { UserRole } from '@/features/auth/types'
import { AppContentShell } from '@/components/layout/ring-app-shell'

interface ConfidentialLocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

const ALLOWED_CONFIDENTIAL_ROLES: readonly string[] = [
  UserRole.CONFIDENTIAL,
  UserRole.ADMIN,
  UserRole.SUPERADMIN,
]

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

/**
 * Next.js 16 Streaming Confidential Layout: Auth + role guard in Suspense boundary.
 */
export default async function ConfidentialLocaleLayout({ children, params }: ConfidentialLocaleLayoutProps) {
  const { locale } = await params

  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  const validLocale = locale as Locale
  setRequestLocale(validLocale)

  setupResourcePreloading()
  const messages = await getMessages()

  return (
    <I18nProvider locale={validLocale} messages={messages}>
      <NotificationProvider>
        <div className="flex flex-col min-h-screen">
          <Navigation />
          <Suspense
            fallback={
              <main className="flex-grow md:pl-(--sidebar-total-w)">
                <div className="animate-pulse p-6 space-y-4">
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                  <div className="h-64 bg-muted rounded"></div>
                </div>
              </main>
            }
          >
            <ConfidentialAuthGuard locale={validLocale}>
              {children}
            </ConfidentialAuthGuard>
          </Suspense>
        </div>
      </NotificationProvider>
    </I18nProvider>
  )
}

/** Auth guard - routes through route-group contract */
async function ConfidentialAuthGuard({
  children,
  locale,
}: {
  children: React.ReactNode
  locale: Locale
}) {
  await connection()

  const headersList = await headers()
  const session = await auth()

  if (!session?.user) {
    const rawFrom = headersList.get('x-pathname') || headersList.get('x-url') || headersList.get('referer') || `/${locale}`
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

  return (
    <main className="flex-grow md:pl-(--sidebar-total-w)">
      <AppContentShell>{children}</AppContentShell>
    </main>
  )
}


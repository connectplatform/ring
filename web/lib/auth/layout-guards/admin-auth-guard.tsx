import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import { headers } from 'next/headers'
import type { Locale } from '@/i18n/shared'

interface AdminAuthGuardProps {
  locale: Locale
  children: React.ReactNode
}

function isVendorStoreEditor(pathname: string): boolean {
  return /\/admin\/store\/(settings|promotions)\/?$/.test(pathname)
}

/** Platform admin, plus vendor operators on store settings and promotions. */
export async function AdminAuthGuard({ locale, children }: AdminAuthGuardProps) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    localizedRedirect({ locale, href: '/login' })
  }

  if (!isPlatformAdmin(session.user.role)) {
    const pathname = (await headers()).get('x-pathname') || ''
    if (!isVendorStoreEditor(pathname)) {
      localizedRedirect({ locale, href: '/unauthorized' })
    }
    const { getVendorEntity } = await import('@/features/entities/services/vendor-entity')
    const vendor = await getVendorEntity(session.user.id)
    if (!vendor?.id) {
      localizedRedirect({ locale, href: '/unauthorized' })
    }
  }

  return <>{children}</>
}

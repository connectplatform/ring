import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { connection } from 'next/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { isPlatformAdmin } from '@/features/auth/user-role'
import AdminVerificationClient from './verification-client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'admin.verification',
    pathname: '/admin/verification',
    robots: { index: false, follow: false, noarchive: true, nosnippet: true, noimageindex: true },
  })
}

export default async function VerificationAdminPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  await connection()

  const { locale } = await params
  const validLocale = routing.locales.includes(locale) ? locale : routing.defaultLocale
  const session = await auth()

  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(`${ROUTES.ADMIN(validLocale)}/verification`)}`,
    )
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  return <AdminVerificationClient />
}

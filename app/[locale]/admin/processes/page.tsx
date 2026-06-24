import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/user-role'
import { ProcessesClient } from '@/features/admin/processes/processes-client'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'

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
  const t = await getTranslations('modules.admin.processes')
  return buildLocalizedMetadata({
    locale,
    path: 'admin',
    pathname: '/admin/processes',
    fallback: {
      title: t('title'),
      description: t('subtitle'),
    },
    robots: { index: false, follow: false },
  })
}

export default async function AdminProcessesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  const session = await auth()
  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale))
  }
  if (session.user.role !== UserRole.superadmin) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  return <ProcessesClient locale={validLocale} />
}

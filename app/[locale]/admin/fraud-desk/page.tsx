import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { isPlatformAdmin } from '@/features/auth/user-role'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { FraudDeskClient } from '@/features/fraud/components/fraud-desk-client'
import { connection } from 'next/server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  const t = await getTranslations({ locale, namespace: 'modules.admin.fraudDesk' })
  return { title: t('title') }
}

export default async function AdminFraudDeskPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    redirect(`/${locale === routing.defaultLocale ? '' : locale}/unauthorized`.replace('//', '/'))
  }

  const t = await getTranslations('modules.admin')
  const labels = buildModulesAdminLabels((key) => t(key))

  return (
    <AdminWrapper locale={locale} pageContext="fraud-desk" labels={labels}>
      <FraudDeskClient locale={locale} />
    </AdminWrapper>
  )
}

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import AdminRefcodesClient from './admin-refcodes-client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  return { title: 'Referral Rewards | Admin' }
}

export default async function AdminRefcodesPage({
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
  if (!session?.user) {
    redirect(ROUTES.LOGIN(locale))
  }
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const t = await getTranslations('modules.admin')
  const [pending, stats, recent, failed] = await Promise.all([
    ReferralRewardService.listPendingApproval(),
    ReferralRewardService.getAdminStats(),
    ReferralRewardService.listRecent(25),
    ReferralRewardService.listByStatus('failed', 10),
  ])
  const labels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper labels={labels} locale={locale} pageContext="refcodes">
      <AdminRefcodesClient pending={pending} recent={recent} failed={failed} stats={stats} />
    </AdminWrapper>
  )
}

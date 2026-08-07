import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { isSuperadmin } from '@/features/auth/user-role'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { connection } from 'next/server'
import { Web3TokenDashboard } from '@/features/admin/web3/components/web3-token-dashboard'

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
    path: 'admin',
    pathname: '/admin/web3',
    robots: { index: false, follow: false },
  })
}

export default async function Web3AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const session = await auth()
  if (!session?.user) redirect(ROUTES.LOGIN(locale))
  if (!isSuperadmin(session.user.role)) redirect(ROUTES.UNAUTHORIZED(locale))

  const t = await getTranslations('modules.admin')
  const tWeb3 = await getTranslations('modules.admin.web3')
  const adminLabels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={locale} pageContext="web3" labels={adminLabels}>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{tWeb3('title')}</h1>
          <p className="text-muted-foreground mt-1">{tWeb3('subtitle')}</p>
        </div>
        <Web3TokenDashboard />
      </div>
    </AdminWrapper>
  )
}

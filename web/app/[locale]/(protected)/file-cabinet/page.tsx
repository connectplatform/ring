import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { hasMemberPrivileges } from '@/features/auth/user-role'
import { MemberUpgradeGate } from '@/components/membership/member-upgrade-gate'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import FileCabinetWrapper from '@/components/wrappers/file-cabinet-wrapper'
import { ROUTES } from '@/constants/routes'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

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
    path: 'fileCabinet',
    pathname: '/file-cabinet',
    robots: { index: false, follow: false },
    fallback: {
      title: 'File Cabinet',
      description: 'Your personal Ring file manager',
    },
  })
}

export default async function FileCabinetPage(props: LocalePageProps) {
  await connection()
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale) + `?callbackUrl=${encodeURIComponent(ROUTES.FILE_CABINET(locale))}`)
  }

  if (!hasMemberPrivileges(session.user.role)) {
    return (
      <DavinciCenterPane>
        <MemberUpgradeGate returnTo={ROUTES.FILE_CABINET(locale)} />
      </DavinciCenterPane>
    )
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading cabinet…</div>}>
      <FileCabinetWrapper scope="own" />
    </Suspense>
  )
}

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { hasRoleAtLeast, UserRolesArray } from '@/features/auth/user-role'
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
    path: 'profile.shared',
    pathname: '/profile/shared',
    robots: { index: false, follow: false },
    fallback: {
      title: 'Shared Files',
      description: 'Files shared with you as co-editor',
    },
  })
}

export default async function ProfileSharedPage(props: LocalePageProps) {
  await connection()
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale) + `?callbackUrl=${encodeURIComponent(ROUTES.PROFILE_SHARED(locale))}`)
  }

  if (!hasRoleAtLeast(session.user.role, UserRolesArray.subscriber)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading shared files…</div>}>
      <FileCabinetWrapper scope="shared" />
    </Suspense>
  )
}

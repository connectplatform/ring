import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { FileCabinetGalleryManager } from '@/features/file-cabinet/components/file-cabinet-gallery-manager'
import { ROUTES } from '@/constants/routes'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { hasMemberPrivileges } from '@/features/auth/user-role'
import { MemberUpgradeGate } from '@/components/membership/member-upgrade-gate'

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
    path: 'profile.gallery',
    pathname: '/profile/gallery',
    robots: { index: false, follow: false },
    fallback: {
      title: 'Gallery',
      description: 'Curate public images from your File Cabinet',
    },
  })
}

export default async function ProfileGalleryPage(props: LocalePageProps) {
  await connection() // Next.js 16 cacheComponents: opt out of prerendering
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale) + `?callbackUrl=${encodeURIComponent(ROUTES.PROFILE_GALLERY(locale))}`)
  }

  if (!hasMemberPrivileges(session.user.role)) {
    return (
      <DavinciCenterPane>
        <MemberUpgradeGate returnTo={ROUTES.PROFILE_GALLERY(locale)} />
      </DavinciCenterPane>
    )
  }

  const username = (session.user as { username?: string })?.username
  const publicImgHref = username
    ? ROUTES.PUBLIC_PROFILE_IMG(username, locale)
    : undefined

  return (
    <DavinciCenterPane
      header={
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
          <p className="text-sm text-muted-foreground">
            Publish selected cabinet media. Public items use Ring CDN{' '}
            <code className="text-xs">/files/{'{fileId}'}</code> URLs.
          </p>
        </div>
      }
    >
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading gallery…</div>}>
        <FileCabinetGalleryManager publicImgHref={publicImgHref} />
      </Suspense>
    </DavinciCenterPane>
  )
}

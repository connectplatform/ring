import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { setRequestLocale } from 'next-intl/server'
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/types'
import MembershipContent from '@/features/auth/components/membership-content'
import type { AuthUser } from '@/features/auth/types'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { connection } from 'next/server'

interface MembershipPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

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
    path: 'membership',
    pathname: '/membership',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: { index: false, follow: false },
  })
}

export default async function MembershipPage(props: MembershipPageProps) {
  await connection()

  const params = await props.params
  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  const session = await auth()

  if (!session?.user) {
    redirect(ROUTES.LOGIN(locale))
  }

  const user = session.user as AuthUser

  if (
    user.role === UserRole.MEMBER ||
    user.role === UserRole.CONFIDENTIAL ||
    user.role === UserRole.ADMIN
  ) {
    redirect(ROUTES.PROFILE(locale))
  }

  return (
    <AboutWrapper locale={locale}>
      <MembershipContent user={user} locale={locale} />
    </AboutWrapper>
  )
}

import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { setRequestLocale } from 'next-intl/server'
import { ROUTES } from '@/constants/routes'
import { hasMemberPrivileges } from '@/features/auth/user-role'
import { resolveSessionUserRole } from '@/features/auth/user-role'
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

  const userRole = resolveSessionUserRole(user.role)

  if (hasMemberPrivileges(userRole)) {
    redirect(ROUTES.PROFILE(locale))
  }

  return (
    <AboutWrapper locale={locale}>
      <MembershipContent user={user} locale={locale} />
    </AboutWrapper>
  )
}

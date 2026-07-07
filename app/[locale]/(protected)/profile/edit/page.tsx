import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'
import UserProfileForm from '@/features/auth/components/user-profile-form'
import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'

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
    path: 'profile',
    pathname: '/profile/edit',
    robots: { index: false, follow: false },
  })
}

export default async function ProfileEditPage(props: LocalePageProps) {
  await connection()

  const params = await props.params
  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <UserProfileForm />
    </div>
  )
}

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import type { Locale } from '@/i18n/shared'
import AuthStatusPage from '@/components/auth/auth-status-page'
import { defaultLocale } from '@/i18n/shared'


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
    path: 'auth.status',
    variables: { 
      action: 'Sign Out',
      status: 'Success'
    },
    pathname: '/auth/signout',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

export default async function SignOutStatusPage({ 
  params 
}: { 
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const validLocale = locale === defaultLocale ? locale as Locale : defaultLocale as Locale
  
  return (
      <AuthStatusPage 
        action="signout"
        status="success"
        locale={validLocale}
      />
  )
}

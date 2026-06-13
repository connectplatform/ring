import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'
import AuthStatusPage from '@/components/auth/auth-status-page'
import { defaultLocale } from '@/i18n/shared'
import { notFound } from 'next/navigation'

// Valid auth action types
const VALID_ACTIONS = [
  'login',
  'register', 
  'verify',
  'reset-password',
  'kyc'
] as const

// Valid status types per action
const VALID_STATUSES = {
  login: ['success', 'failed', 'blocked', 'expired'],
  register: ['success', 'pending_verification', 'failed', 'email_sent'],
  verify: ['success', 'failed', 'expired', 'already_verified'],
  'reset-password': ['email_sent', 'success', 'failed', 'expired', 'invalid_token'],
  kyc: ['not_started', 'pending', 'under_review', 'approved', 'rejected', 'expired']
} as const

type AuthAction = typeof VALID_ACTIONS[number]
type AuthStatus = typeof VALID_STATUSES[AuthAction][number]


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; action: string; status: string }>
}): Promise<Metadata> {
  const { locale: localeParam, action, status } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'auth.status',
    variables: { action, status: status.charAt(0).toUpperCase() + status.slice(1) },
    pathname: '/auth/status',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

export default async function AuthStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await connection() // Next.js 16: searchParams is per-request dynamic data
  const { locale, action, status } = await params
  const resolvedSearchParams = await searchParams
  
  // Validate action parameter
  if (!VALID_ACTIONS.includes(action as AuthAction)) {
    notFound()
  }
  
  // Validate status parameter for the given action
  const validStatuses = VALID_STATUSES[action as AuthAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound()
  }
  
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale

  // Extract relevant query parameters
  const email = typeof resolvedSearchParams.email === 'string' ? resolvedSearchParams.email : undefined
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : undefined
  const requestId = typeof resolvedSearchParams.requestId === 'string' ? resolvedSearchParams.requestId : undefined
  const returnTo = typeof resolvedSearchParams.returnTo === 'string' ? resolvedSearchParams.returnTo : undefined
  
  return (
      <AuthStatusPage 
        action={action as AuthAction}
        status={status as AuthStatus}
        locale={validLocale}
        email={email}
        token={token}
        requestId={requestId}
        returnTo={returnTo}
      />
  )
}

// Note: No generateStaticParams() - auth status pages are per-request dynamic
// (they read searchParams for email, token, requestId, returnTo)

import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import AuthStatusPage from '@/components/auth/AuthStatusPage'
import { generatePageMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import type { Metadata } from 'next'
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
  login: ['success', 'failed', 'pending', 'blocked', 'expired'],
  register: ['success', 'pending_verification', 'failed', 'email_sent'],
  verify: ['success', 'failed', 'expired', 'already_verified'],
  'reset-password': ['email_sent', 'success', 'failed', 'expired', 'invalid_token'],
  kyc: ['not_started', 'pending', 'under_review', 'approved', 'rejected', 'expired']
} as const

type AuthAction = typeof VALID_ACTIONS[number]
type AuthStatus = typeof VALID_STATUSES[AuthAction][number]

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }> 
}): Promise<Metadata> {
  const { locale, action, status } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Generate SEO metadata with dynamic action and status values
  return generatePageMetadata(validLocale, 'auth.status', { 
    action: action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' '),
    status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  })
}

export default function AuthStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale, action, status } = use(params)
  const resolvedSearchParams = use(searchParams)
  
  // Validate action parameter
  if (!VALID_ACTIONS.includes(action as AuthAction)) {
    notFound()
  }
  
  // Validate status parameter for the given action
  const validStatuses = VALID_STATUSES[action as AuthAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound()
  }
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
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

// Generate static params for all valid auth action/status combinations
export async function generateStaticParams() {
  const params = []
  
  for (const locale of ['en', 'uk'] as const) {
    for (const action of VALID_ACTIONS) {
      for (const status of VALID_STATUSES[action]) {
        params.push({ locale, action, status })
      }
    }
  }
  
  return params
}

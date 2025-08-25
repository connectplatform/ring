import React from 'react'
import type { Locale } from '@/i18n-config'
import AuthStatusPage from '@/components/auth/AuthStatusPage'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
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

// Metadata will be handled inline using React 19 native approach

export default async function AuthStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
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
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get SEO metadata for the auth status
  const seoData = await getSEOMetadata(
    validLocale, 
    'auth.status', 
    { 
      action: action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' '),
      status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    }
  )
  
  // Extract relevant query parameters
  const email = typeof resolvedSearchParams.email === 'string' ? resolvedSearchParams.email : undefined
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : undefined
  const requestId = typeof resolvedSearchParams.requestId === 'string' ? resolvedSearchParams.requestId : undefined
  const returnTo = typeof resolvedSearchParams.returnTo === 'string' ? resolvedSearchParams.returnTo : undefined
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || `${action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' ')} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Ring Platform`}</title>
      <meta name="description" content={seoData?.description || `Your ${action.replace('-', ' ')} is ${status.replace('_', ' ')}. Manage your authentication status and next steps.`} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || `${action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' ')} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Ring Platform`} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || `Your ${action.replace('-', ' ')} is ${status.replace('_', ' ')}. Manage your authentication status and next steps.`} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || `${action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' ')} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}`} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || `Your ${action.replace('-', ' ')} is ${status.replace('_', ' ')}. Manage your authentication status and next steps.`} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href={`/en/auth/status/${action}/${status}`} />
      <link rel="alternate" hrefLang="uk" href={`/uk/auth/status/${action}/${status}`} />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />

      <AuthStatusPage 
        action={action as AuthAction}
        status={status as AuthStatus}
        locale={validLocale}
        email={email}
        token={token}
        requestId={requestId}
        returnTo={returnTo}
      />
    </>
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

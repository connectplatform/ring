import React from 'react'
import type { Locale } from '@/i18n-config'
import EntityStatusPage from '@/components/entities/EntityStatusPage'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import { notFound } from 'next/navigation'

// Valid entity action types
const VALID_ACTIONS = [
  'create',
  'verify',
  'approve',
  'publish'
] as const

// Valid status types per action
const VALID_STATUSES = {
  create: ['draft', 'pending_review', 'published', 'failed', 'rejected'],
  verify: ['pending', 'under_review', 'verified', 'rejected', 'expired'],
  approve: ['pending', 'approved', 'rejected', 'needs_revision'],
  publish: ['scheduled', 'published', 'failed', 'unpublished', 'archived']
} as const

type EntityAction = typeof VALID_ACTIONS[number]
type EntityStatus = typeof VALID_STATUSES[EntityAction][number]

// Metadata will be handled inline using React 19 native approach

export default async function EntityStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale, action, status } = await params
  const resolvedSearchParams = await searchParams
  
  // Validate action parameter
  if (!VALID_ACTIONS.includes(action as EntityAction)) {
    notFound()
  }
  
  // Validate status parameter for the given action
  const validStatuses = VALID_STATUSES[action as EntityAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound()
  }
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get SEO metadata for the entity status
  const seoData = await getSEOMetadata(
    validLocale, 
    'entities.status', 
    { 
      action: action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' '),
      status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    }
  )
  
  // Extract relevant query parameters
  const entityId = typeof resolvedSearchParams.entityId === 'string' ? resolvedSearchParams.entityId : undefined
  const entityName = typeof resolvedSearchParams.entityName === 'string' ? resolvedSearchParams.entityName : undefined
  const reviewId = typeof resolvedSearchParams.reviewId === 'string' ? resolvedSearchParams.reviewId : undefined
  const returnTo = typeof resolvedSearchParams.returnTo === 'string' ? resolvedSearchParams.returnTo : undefined
  const reason = typeof resolvedSearchParams.reason === 'string' ? resolvedSearchParams.reason : undefined
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || `Entity ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Ring Platform`}</title>
      <meta name="description" content={seoData?.description || `Your entity ${action} is ${status.replace('_', ' ')}. Manage your entity status and next steps on Ring platform.`} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || `Entity ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Ring Platform`} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || `Your entity ${action} is ${status.replace('_', ' ')}. Manage your entity status and next steps on Ring platform.`} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || `Entity ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}`} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || `Your entity ${action} is ${status.replace('_', ' ')}. Manage your entity status and next steps on Ring platform.`} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href={`/en/entities/status/${action}/${status}`} />
      <link rel="alternate" hrefLang="uk" href={`/uk/entities/status/${action}/${status}`} />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />

      <EntityStatusPage 
        action={action as EntityAction}
        status={status as EntityStatus}
        locale={validLocale}
        entityId={entityId}
        entityName={entityName}
        reviewId={reviewId}
        returnTo={returnTo}
        reason={reason}
      />
    </>
  )
}

// Generate static params for all valid entity action/status combinations
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

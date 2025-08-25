import React from 'react'
import type { Locale } from '@/i18n-config'
import OpportunityStatusPage from '@/components/opportunities/OpportunityStatusPage'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import { notFound } from 'next/navigation'

// Valid opportunity action types
const VALID_ACTIONS = [
  'create',
  'apply',
  'submit',
  'approve',
  'publish'
] as const

// Valid status types per action
const VALID_STATUSES = {
  create: ['draft', 'pending_review', 'published', 'success', 'failed', 'rejected'],
  apply: ['submitted', 'under_review', 'accepted', 'rejected', 'pending_documents'],
  submit: ['received', 'processing', 'approved', 'requires_changes', 'rejected'],
  approve: ['pending', 'approved', 'rejected', 'needs_revision'],
  publish: ['scheduled', 'published', 'failed', 'unpublished']
} as const

type OpportunityAction = typeof VALID_ACTIONS[number]
type OpportunityStatus = typeof VALID_STATUSES[OpportunityAction][number]

// Metadata will be handled inline using React 19 native approach

export default async function OpportunityStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale, action, status } = await params
  const resolvedSearchParams = await searchParams
  
  // Validate action parameter
  if (!VALID_ACTIONS.includes(action as OpportunityAction)) {
    notFound()
  }
  
  // Validate status parameter for the given action
  const validStatuses = VALID_STATUSES[action as OpportunityAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound()
  }
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get SEO metadata for the opportunity status
  const seoData = await getSEOMetadata(
    validLocale, 
    'opportunities.status', 
    { 
      action: action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' '),
      status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    }
  )
  
  // Extract relevant query parameters
  const opportunityId = typeof resolvedSearchParams.opportunityId === 'string' ? resolvedSearchParams.opportunityId : undefined
  const opportunityTitle = typeof resolvedSearchParams.opportunityTitle === 'string' ? resolvedSearchParams.opportunityTitle : undefined
  const applicationId = typeof resolvedSearchParams.applicationId === 'string' ? resolvedSearchParams.applicationId : undefined
  const submissionId = typeof resolvedSearchParams.submissionId === 'string' ? resolvedSearchParams.submissionId : undefined
  const reviewId = typeof resolvedSearchParams.reviewId === 'string' ? resolvedSearchParams.reviewId : undefined
  const returnTo = typeof resolvedSearchParams.returnTo === 'string' ? resolvedSearchParams.returnTo : undefined
  const reason = typeof resolvedSearchParams.reason === 'string' ? resolvedSearchParams.reason : undefined
  const nextStep = typeof resolvedSearchParams.nextStep === 'string' ? resolvedSearchParams.nextStep : undefined
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || `Opportunity ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Ring Platform`}</title>
      <meta name="description" content={seoData?.description || `Your opportunity ${action} is ${status.replace('_', ' ')}. Manage your opportunity status and next steps.`} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || `Opportunity ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Ring Platform`} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || `Your opportunity ${action} is ${status.replace('_', ' ')}. Manage your opportunity status and next steps.`} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || `Opportunity ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}`} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || `Your opportunity ${action} is ${status.replace('_', ' ')}. Manage your opportunity status and next steps.`} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href={`/en/opportunities/status/${action}/${status}`} />
      <link rel="alternate" hrefLang="uk" href={`/uk/opportunities/status/${action}/${status}`} />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />

      <OpportunityStatusPage 
        action={action as OpportunityAction}
        status={status as OpportunityStatus}
        locale={validLocale}
        opportunityId={opportunityId}
        opportunityTitle={opportunityTitle}
        applicationId={applicationId}
        submissionId={submissionId}
        reviewId={reviewId}
        returnTo={returnTo}
        reason={reason}
        nextStep={nextStep}
      />
    </>
  )
}

// Generate static params for all valid opportunity action/status combinations
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

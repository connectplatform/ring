import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import OpportunityStatusPage from '@/components/opportunities/OpportunityStatusPage'
import { generatePageMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import type { Metadata } from 'next'
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
  create: ['draft', 'pending_review', 'published', 'failed', 'rejected'],
  apply: ['submitted', 'under_review', 'accepted', 'rejected', 'pending_documents'],
  submit: ['received', 'processing', 'approved', 'requires_changes', 'rejected'],
  approve: ['pending', 'approved', 'rejected', 'needs_revision'],
  publish: ['scheduled', 'published', 'failed', 'unpublished']
} as const

type OpportunityAction = typeof VALID_ACTIONS[number]
type OpportunityStatus = typeof VALID_STATUSES[OpportunityAction][number]

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }> 
}): Promise<Metadata> {
  const { locale, action, status } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Generate SEO metadata with dynamic action and status values
  return generatePageMetadata(validLocale, 'opportunities.status', { 
    action: action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' '),
    status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  })
}

export default function OpportunityStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale, action, status } = use(params)
  const resolvedSearchParams = use(searchParams)
  
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

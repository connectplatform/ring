import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'
import OpportunityStatusPage from '@/components/opportunities/opportunity-status-page'
import { defaultLocale } from '@/i18n/shared'
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
    path: 'opportunities.status',
    variables: { action, status: status.charAt(0).toUpperCase() + status.slice(1) },
    pathname: '/opportunities/status',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

export default async function OpportunityStatusDynamicPage({ 
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
  if (!VALID_ACTIONS.includes(action as OpportunityAction)) {
    notFound()
  }
  
  // Validate status parameter for the given action
  const validStatuses = VALID_STATUSES[action as OpportunityAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound()
  }
  
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale

  
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

// Note: No generateStaticParams() - opportunity status pages are per-request dynamic
// (they read searchParams for contextual data like opportunityId, returnTo)

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

// List of all valid opportunity actions.
// Used for type safety and runtime validation.
const VALID_ACTIONS = [
  'create',
  'update',
  'delete',
  'apply',
  'submit',
  'approve',
  'publish'
] as const

// Each action maps to a set of valid statuses.
const VALID_STATUSES = {
  create: ['draft', 'pending_review', 'published', 'success', 'failed', 'rejected'],
  update: ['success', 'failed'],
  delete: ['success', 'failed'],
  apply: ['submitted', 'under_review', 'accepted', 'rejected', 'pending_documents'],
  submit: ['received', 'processing', 'approved', 'requires_changes', 'rejected'],
  approve: ['pending', 'approved', 'rejected', 'needs_revision'],
  publish: ['scheduled', 'published', 'failed', 'unpublished']
} as const

type OpportunityAction = typeof VALID_ACTIONS[number]
type OpportunityStatus = typeof VALID_STATUSES[OpportunityAction][number]

/**
 * Generates page-level metadata for SEO based on current locale, action, and status.
 * @param params - The promise resolving to route params (locale, action, status).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; action: string; status: string }>
}): Promise<Metadata> {
  // Destructure params once the promise resolves
  const { locale: localeParam, action, status } = await params

  // Validate/resolve locale or default it to fallback locale
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Inform next-intl of current request locale (internationalization)
  setRequestLocale(locale)

  // Build and return localized metadata, with status nicely formatted for display
  return buildLocalizedMetadata({
    locale,
    path: 'opportunities.status',
    variables: { action, status: status.charAt(0).toUpperCase() + status.slice(1) },
    pathname: '/opportunities/status',
  })
}

/**
 * Main dynamic page component for opportunity status-related screens.
 * Validates params and extracts contextual data from the query string.
 * Returns notFound() for invalid action/status.
 */
export default async function OpportunityStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Ensure per-request searchParams (see Next.js 16 dynamic context)
  await connection() 

  // Destructure route params and resolve query params
  const { locale, action, status } = await params
  const resolvedSearchParams = await searchParams

  // Validate action parameter, 404 if invalid
  if (!VALID_ACTIONS.includes(action as OpportunityAction)) {
    notFound() // Shows Next.js native 404 page
  }

  // Validate status parameter for given action, 404 if invalid per validated action
  const validStatuses = VALID_STATUSES[action as OpportunityAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound() // Shows Next.js native 404 page
  }

  // Validate/resolve locale, fallback to default if invalid (should be rare)
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale

  // Extract all relevant query parameters, fallback to undefined if missing.
  // Some parameters are accepted under two keys for compatibility (e.g., opportunityId or id).
  // TODO: Use URLSearchParams (edge-compatible) or serverActions hooks if stable in React 19/Next 16.
  const opportunityId =
    typeof resolvedSearchParams.opportunityId === 'string'
      ? resolvedSearchParams.opportunityId
      : typeof resolvedSearchParams.id === 'string'
        ? resolvedSearchParams.id
        : undefined
  const opportunityTitle = typeof resolvedSearchParams.opportunityTitle === 'string'
    ? resolvedSearchParams.opportunityTitle
    : undefined
  const applicationId = typeof resolvedSearchParams.applicationId === 'string'
    ? resolvedSearchParams.applicationId
    : undefined
  const submissionId = typeof resolvedSearchParams.submissionId === 'string'
    ? resolvedSearchParams.submissionId
    : undefined
  const reviewId = typeof resolvedSearchParams.reviewId === 'string'
    ? resolvedSearchParams.reviewId
    : undefined
  const returnTo = typeof resolvedSearchParams.returnTo === 'string'
    ? resolvedSearchParams.returnTo
    : undefined
  const reason = typeof resolvedSearchParams.reason === 'string'
    ? resolvedSearchParams.reason
    : undefined
  const nextStep = typeof resolvedSearchParams.nextStep === 'string'
    ? resolvedSearchParams.nextStep
    : undefined

  // Render the status page, passing through all contextual information.
  // Some props may be undefined depending on the workflow.
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
// TODO: If/when React 19/Next.js 16 fully stabilizes async route handlers/hooks, consider using
// Future server actions/hooks for contextual data extraction or parameter coercion.

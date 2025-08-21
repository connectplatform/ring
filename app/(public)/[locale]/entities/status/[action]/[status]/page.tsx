import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import EntityStatusPage from '@/components/entities/EntityStatusPage'
import { generatePageMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import type { Metadata } from 'next'
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

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }> 
}): Promise<Metadata> {
  const { locale, action, status } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Generate SEO metadata with dynamic action and status values
  return generatePageMetadata(validLocale, 'entities.status', { 
    action: action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' '),
    status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  })
}

export default function EntityStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale, action, status } = use(params)
  const resolvedSearchParams = use(searchParams)
  
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
  
  // Extract relevant query parameters
  const entityId = typeof resolvedSearchParams.entityId === 'string' ? resolvedSearchParams.entityId : undefined
  const entityName = typeof resolvedSearchParams.entityName === 'string' ? resolvedSearchParams.entityName : undefined
  const reviewId = typeof resolvedSearchParams.reviewId === 'string' ? resolvedSearchParams.reviewId : undefined
  const returnTo = typeof resolvedSearchParams.returnTo === 'string' ? resolvedSearchParams.returnTo : undefined
  const reason = typeof resolvedSearchParams.reason === 'string' ? resolvedSearchParams.reason : undefined
  
  return (
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

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'
import EntityStatusPage from '@/components/entities/entity-status-page'
import { defaultLocale } from '@/i18n/shared'
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
    path: 'entities.status',
    variables: { action, status: status.charAt(0).toUpperCase() + status.slice(1) },
    pathname: '/entities/status',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

export default async function EntityStatusDynamicPage({ 
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
  if (!VALID_ACTIONS.includes(action as EntityAction)) {
    notFound()
  }
  
  // Validate status parameter for the given action
  const validStatuses = VALID_STATUSES[action as EntityAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound()
  }
  
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale

  
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

// Note: No generateStaticParams() - entity status pages are per-request dynamic
// (they read searchParams for contextual data like entityId, returnTo)

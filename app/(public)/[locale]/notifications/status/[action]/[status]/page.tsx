import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'
import NotificationStatusPage from '@/components/notifications/notification-status-page'
import {isValidLocale, defaultLocale} from '@/i18n/shared'
import { notFound } from 'next/navigation'

// Valid notification action types
const VALID_ACTIONS = [
  'permission',
  'subscribe',
  'send',
  'deliver'
] as const

// Valid status types per action
const VALID_STATUSES = {
  permission: ['granted', 'denied', 'pending', 'unsupported'],
  subscribe: ['subscribed', 'unsubscribed', 'failed', 'pending'],
  send: ['sent', 'delivered', 'failed', 'pending'],
  deliver: ['delivered', 'read', 'failed', 'cancelled']
} as const

type NotificationAction = typeof VALID_ACTIONS[number]
type NotificationStatus = typeof VALID_STATUSES[NotificationAction][number]


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
    path: 'notifications.status',
    variables: { action, status: status.charAt(0).toUpperCase() + status.slice(1) },
    pathname: '/notifications/status',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

export default async function NotificationStatusDynamicPage({ 
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
  if (!VALID_ACTIONS.includes(action as NotificationAction)) {
    notFound()
  }
  
  // Validate status parameter for the given action
  const validStatuses = VALID_STATUSES[action as NotificationAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound()
  }
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  // Extract relevant query parameters
  const notificationId = typeof resolvedSearchParams.notificationId === 'string' ? resolvedSearchParams.notificationId : undefined
  const subscriptionId = typeof resolvedSearchParams.subscriptionId === 'string' ? resolvedSearchParams.subscriptionId : undefined
  const deviceToken = typeof resolvedSearchParams.deviceToken === 'string' ? resolvedSearchParams.deviceToken : undefined
  const returnTo = typeof resolvedSearchParams.returnTo === 'string' ? resolvedSearchParams.returnTo : undefined
  const reason = typeof resolvedSearchParams.reason === 'string' ? resolvedSearchParams.reason : undefined
  const topic = typeof resolvedSearchParams.topic === 'string' ? resolvedSearchParams.topic : undefined
  
  return (
      <NotificationStatusPage 
        action={action as NotificationAction}
        status={status as NotificationStatus}
        locale={validLocale}
        notificationId={notificationId}
        subscriptionId={subscriptionId}
        deviceToken={deviceToken}
        returnTo={returnTo}
        reason={reason}
        topic={topic}
      />
  )
}

// Note: No generateStaticParams() - notification status pages are per-request dynamic
// (they read searchParams for contextual data like notificationId, returnTo)

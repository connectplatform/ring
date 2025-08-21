import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import NotificationStatusPage from '@/components/notifications/NotificationStatusPage'
import { generatePageMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import type { Metadata } from 'next'
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
  params 
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }> 
}): Promise<Metadata> {
  const { locale, action, status } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Generate SEO metadata with dynamic action and status values
  return generatePageMetadata(validLocale, 'notifications.status', { 
    action: action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' '),
    status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  })
}

export default function NotificationStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale, action, status } = use(params)
  const resolvedSearchParams = use(searchParams)
  
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

// Generate static params for all valid notification action/status combinations
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

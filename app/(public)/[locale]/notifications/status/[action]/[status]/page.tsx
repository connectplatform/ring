import React from 'react'
import type { Locale } from '@/i18n-config'
import NotificationStatusPage from '@/components/notifications/NotificationStatusPage'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
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

// Metadata will be handled inline using React 19 native approach

export default async function NotificationStatusDynamicPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
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
  
  // Get SEO metadata for the notification status
  const seoData = await getSEOMetadata(
    validLocale, 
    'notifications.status', 
    { 
      action: action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' '),
      status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    }
  )
  
  // Extract relevant query parameters
  const notificationId = typeof resolvedSearchParams.notificationId === 'string' ? resolvedSearchParams.notificationId : undefined
  const subscriptionId = typeof resolvedSearchParams.subscriptionId === 'string' ? resolvedSearchParams.subscriptionId : undefined
  const deviceToken = typeof resolvedSearchParams.deviceToken === 'string' ? resolvedSearchParams.deviceToken : undefined
  const returnTo = typeof resolvedSearchParams.returnTo === 'string' ? resolvedSearchParams.returnTo : undefined
  const reason = typeof resolvedSearchParams.reason === 'string' ? resolvedSearchParams.reason : undefined
  const topic = typeof resolvedSearchParams.topic === 'string' ? resolvedSearchParams.topic : undefined
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || `Notification ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Ring Platform`}</title>
      <meta name="description" content={seoData?.description || `Your notification ${action} is ${status.replace('_', ' ')}. Manage your notification settings and preferences.`} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || `Notification ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} - Ring Platform`} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || `Your notification ${action} is ${status.replace('_', ' ')}. Manage your notification settings and preferences.`} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || `Notification ${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}`} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || `Your notification ${action} is ${status.replace('_', ' ')}. Manage your notification settings and preferences.`} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href={`/en/notifications/status/${action}/${status}`} />
      <link rel="alternate" hrefLang="uk" href={`/uk/notifications/status/${action}/${status}`} />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />

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
    </>
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

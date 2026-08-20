import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'
import NotificationStatusPage from '@/components/notifications/notification-status-page'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
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

// Generates metadata for the notification status pages using the locale, action, and status parameters.
// This is used for SEO and social media sharing.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; action: string; status: string }>
}): Promise<Metadata> {
  // Await route params from Next.js dynamic route.
  const { locale: localeParam, action, status } = await params

  // Ensure the locale is valid; fallback to defaultLocale otherwise.
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request-wide locale for internationalization context.
  setRequestLocale(locale)

  // Build and return metadata using localized values.
  return buildLocalizedMetadata({
    locale,
    path: 'notifications.status',
    variables: { action, status: status.charAt(0).toUpperCase() + status.slice(1) },
    pathname: '/notifications/status',
  })
}

// The main dynamic page for notification statuses.
export default async function NotificationStatusDynamicPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: Locale; action: string; status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Ensures this function runs on a per-request basis (required for searchParams in Next 16).
  await connection()

  // Await the values from dynamic route params and query parameters.
  const { locale, action, status } = await params
  const resolvedSearchParams = await searchParams

  // Validate the `action` parameter; if not valid, show 404 page.
  if (!VALID_ACTIONS.includes(action as NotificationAction)) {
    notFound()
  }

  // Validate the `status` parameter using action-specific options.
  const validStatuses = VALID_STATUSES[action as NotificationAction] as readonly string[]
  if (!validStatuses.includes(status)) {
    notFound()
  }

  // Ensure a valid locale is used, fallback to default if necessary.
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  // Extract query parameters, ensuring they're single string values if present.
  const notificationId =
    typeof resolvedSearchParams.notificationId === 'string'
      ? resolvedSearchParams.notificationId
      : undefined
  const subscriptionId =
    typeof resolvedSearchParams.subscriptionId === 'string'
      ? resolvedSearchParams.subscriptionId
      : undefined
  const deviceToken =
    typeof resolvedSearchParams.deviceToken === 'string'
      ? resolvedSearchParams.deviceToken
      : undefined
  const returnTo =
    typeof resolvedSearchParams.returnTo === 'string'
      ? resolvedSearchParams.returnTo
      : undefined
  const reason =
    typeof resolvedSearchParams.reason === 'string'
      ? resolvedSearchParams.reason
      : undefined
  const topic =
    typeof resolvedSearchParams.topic === 'string'
      ? resolvedSearchParams.topic
      : undefined

  // TODO: If 'useSearchParams' and 'useParams' React hooks become available in Next.js RSC (React 19), refactor 
  //       for more idiomatic parameter access. This will simplify destructuring and avoid the need for Promise props.

  // Render the NotificationStatusPage component with all necessary props.
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

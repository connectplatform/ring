import type { Metadata } from 'next'
import React, { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import type { Locale } from '@/i18n/shared'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import PaymentProcessingClient from './payment-processing-client'

/**
 * Generates localized metadata for the payment processing page.
 *
 * - Resolves the locale from params (falls back to default if unrecognized or missing).
 * - Calls setRequestLocale for proper intl context.
 * - Constructs SEO and robots metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Resolve the incoming params asynchronously
  const { locale: localeParam } = await params
  // Use locale from routing config if valid, otherwise fall back to defaultLocale
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  setRequestLocale(locale) // Needed by next-intl to set expected language

  // Build and return all page metadata for SEO and robots
  return buildLocalizedMetadata({
    locale,
    path: 'store.checkout.status',
    pathname: '/store/checkout/processing',
    variables: { status: 'processing' },
    robots: { index: false, follow: false }, // Prevent indexing and following in this funnel
  })
}

/**
 * Server Component for the checkout processing status page.
 * Handles:
 *   - Asserting valid locale,
 *   - Redirecting if missing or invalid order id,
 *   - Rendering loading UI and the PaymentProcessingClient.
 */
export default async function CheckoutProcessingPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ orderId?: string; status?: string }>
}) {
  // TODO: With Next.js 16 and React 19, consider using the new useSearchParams hook and async Server Components directly for improved ergonomics.

  await connection() // Ensures per-request context for dynamic searchParams (Next.js 16+)
  const { locale } = await params // Await params for incoming locale from the route
  const { orderId, status } = await searchParams // Await query params for order context

  // Validate locale or fall back to platform default
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  // Redirect user to store root if orderId isn't available in query params
  if (!orderId) {
    redirect(`/${validLocale}/store`)
  }

  // Render a suspense fallback while PaymentProcessingClient loads and processes order/payment status.
  return (
    <>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              {/* Animated spinner while fetching status */}
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading payment status...</p>
            </div>
          </div>
        }
      >
        <PaymentProcessingClient 
          orderId={orderId}
          locale={validLocale}
          initialStatus={status}
        />
      </Suspense>
    </>
  )
}

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'store.checkout.status',
    pathname: '/store/checkout/processing',
    variables: { status: 'processing' },
    robots: { index: false, follow: false },
  })
}

export default async function CheckoutProcessingPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ orderId?: string; status?: string }>
}) {
  await connection() // Next.js 16: searchParams is per-request dynamic data
  const { locale } = await params
  const { orderId, status } = await searchParams
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // If no order ID, redirect to store
  if (!orderId) {
    redirect(`/${validLocale}/store`)
  }
  
  return (
    <>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading payment status...</p>
          </div>
        </div>
      }>
        <PaymentProcessingClient 
          orderId={orderId}
          locale={validLocale}
          initialStatus={status}
        />
      </Suspense>
    </>
  )
}

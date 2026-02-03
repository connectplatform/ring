import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Locale } from '@/i18n-config'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import PaymentProcessingClient from './payment-processing-client'

export default async function CheckoutProcessingPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ orderId?: string; status?: string }>
}) {
  const { locale } = await params
  const { orderId, status } = await searchParams
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // If no order ID, redirect to store
  if (!orderId) {
    redirect(`/${validLocale}/store`)
  }
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>Processing Payment - Ring Store</title>
      <meta name="description" content="Processing your payment. Please wait..." />
      <meta name="robots" content="noindex, nofollow" />
      
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

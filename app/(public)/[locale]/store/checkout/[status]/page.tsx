import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import CheckoutStatusPage from '@/components/store/checkout-status-page'
import { generatePageMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// Valid checkout status types
const VALID_STATUSES = [
  'success',
  'failure', 
  'cancel',
  'error',
  'pending',
  'processing',
  'complete'
] as const

type CheckoutStatus = typeof VALID_STATUSES[number]

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ locale: Locale; status: string }> 
}): Promise<Metadata> {
  const { locale, status } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Generate SEO metadata with dynamic status value
  return generatePageMetadata(validLocale, 'store.checkout.status', { 
    status: status.charAt(0).toUpperCase() + status.slice(1) 
  })
}

export default function CheckoutStatusDynamicPage({ 
  params 
}: { 
  params: Promise<{ locale: Locale; status: string }> 
}) {
  const { locale, status } = use(params)
  
  // Validate status parameter
  if (!VALID_STATUSES.includes(status as CheckoutStatus)) {
    notFound()
  }
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  return (
    <CheckoutStatusPage 
      status={status as CheckoutStatus}
      locale={validLocale}
    />
  )
}

// Generate static params for all valid checkout statuses
export async function generateStaticParams() {
  const params = []
  
  for (const locale of ['en', 'uk'] as const) {
    for (const status of VALID_STATUSES) {
      params.push({ locale, status })
    }
  }
  
  return params
}

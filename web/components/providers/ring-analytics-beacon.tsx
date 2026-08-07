'use client'

/**
 * Ensures Ring Analytics page_view events fire on App Router navigations.
 * public/scripts/analytics.js only auto-tracks the first hard load.
 */

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Script from 'next/script'

declare global {
  interface Window {
    ringAnalytics?: {
      pageView: (page?: string) => void
      track: (event: string, data?: Record<string, unknown>) => void
    }
  }
}

export function RingAnalyticsBeacon() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const page =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    window.ringAnalytics?.pageView(page)
  }, [pathname, searchParams])

  return (
    <Script
      id="ring-analytics"
      src="/scripts/analytics.js"
      strategy="afterInteractive"
    />
  )
}

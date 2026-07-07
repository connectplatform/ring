/**
 * Tunnel Transport Test Page
 * Test page for verifying tunnel transport functionality
 *
 * Serves as a dedicated testing ground for the tunnel transport abstraction layer.
 */

import type { Metadata } from 'next'
import { TunnelDemo } from '@/components/tunnel/tunnel-demo'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

// Generates the SEO metadata for this test page, including locale-sensitive paths and robot directives
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Extract the locale from the received route parameters
  const { locale: localeParam } = await params

  // Determine whether the provided locale is supported; fall back to default if not
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set request locale for server-side i18n purposes
  setRequestLocale(locale)

  // Build and return detailed localized metadata for the tunnel test page
  return buildLocalizedMetadata({
    locale,
    path: 'tunnel',
    pathname: '/tunnel-test',
    robots: { index: false, follow: false },
  })
}

// UI component for the tunnel test page
export default function TunnelTestPage() {
  // TODO: If React 19 "use" hook lands/gets stable, consider using it for locale loading
  // TODO: Explore Next.js 16 metadata route segment static optimization if available

  return (
    // Main container styling for vertical padding and light/dark backgrounds
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Page header */}
        <h1 className="text-3xl font-bold text-center mb-8">
          Tunnel Transport Test
        </h1>

        {/* Informational box about the tunnel abstraction */}
        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">About This Test</h2>
          <p className="text-muted-foreground mb-4">
            This page demonstrates the Tunnel Transport Abstraction Layer, which provides
            automatic transport selection and fallback for real-time communication.
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Automatically detects and uses the best transport for your environment</li>
            <li>Seamlessly falls back to alternative transports on failure</li>
            <li>Works on Vercel Edge Runtime, Firebase, and self-hosted deployments</li>
            <li>Supports WebSocket, SSE, Supabase, Firebase, Pusher, Ably, and HTTP polling</li>
          </ul>
        </div>

        {/* The interactive demo component for tunnel transport */}
        <TunnelDemo />

        {/* Information about the test API endpoint, for direct/manual testing */}
        <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">API Test Endpoint</h2>
          <p className="text-muted-foreground mb-4">
            Use the demo above or call the test API directly to verify transport behavior.
          </p>
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getSystemConfigSnapshot, isRoadmapModuleEnabled } from '@/lib/ring-config-core'
import { getPrimaryFounderContact } from '@/lib/ring-widgets/resolve-config-contacts'
import type { LocalePageProps } from '@/utils/page-props'
import { AboutClient } from './about-client'

type AboutParams = Record<string, never>

// Generates metadata for the About page, setting the request's locale context and returning SEO info.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await parameter resolution and extract locale
  const { locale: localeParam } = await params

  // Validate locale from route, fallback to default if unknown
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set request locale for i18n system (side-effect)
  setRequestLocale(locale)

  // Return constructed and localized SEO metadata for the about page
  return buildLocalizedMetadata({
    locale,
    path: 'about',
    pathname: '/about',
  })
}

// The main About page for a given locale, wrapped in AboutWrapper
export default async function AboutPage(props: LocalePageProps<AboutParams>) {
  // Ensure any server preconditions, e.g., database or RPC connections (side-effect)
  await connection()

  // Extract locale parameter from props and validate
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set server request locale (side-effect)
  setRequestLocale(locale)

  // Fetch current configuration snapshot (could be heavy or cacheable)
  const config = getSystemConfigSnapshot()

  // Check if roadmap module/feature is enabled in this config
  const roadmapEnabled = isRoadmapModuleEnabled(config)

  // Get display name, fallback to default branding if not configured
  const displayName = config.clone?.displayName ?? 'Ring Platform'

  // Get the primary founder contact info for About box
  const primaryFounder = getPrimaryFounderContact()

  // TODO: Consider using new Next.js 16+ Parallel/Intercepting Routes feature if AboutPage needs to compose other routes or widgets.
  // TODO: If AboutClient can be a Client Component, mark it as such using "use client" for native React 19 server/client boundaries.
  // TODO: AboutWrapper could leverage the new React 19 context for locale instead of prop drilling.
  // TODO: Investigate moving locale validation logic to middleware for cleaner page code.

  // Render About page with data and config loaded
  return (
    <AboutWrapper locale={locale}>
      <AboutClient
        key={locale} // forces remount on locale change
        roadmapEnabled={roadmapEnabled}
        displayName={displayName}
        primaryFounder={primaryFounder}
      />
    </AboutWrapper>
  )
}

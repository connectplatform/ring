import React, { Suspense } from 'react'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ConfidentialAuthGuard } from '@/lib/auth/layout-guards/confidential-auth-guard'
import { LocaleLayoutFallback } from '@/components/layout/locale-layout-fallback'

interface RoadmapLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

/** Confidential roadmap docs — guard only; DocsLayoutShell comes from parent docs layout. */
export default async function RoadmapLayout({ children, params }: RoadmapLayoutProps) {
  const { locale: localeParam } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return (
    <Suspense fallback={<LocaleLayoutFallback />}>
      <ConfidentialAuthGuard locale={locale}>{children}</ConfidentialAuthGuard>
    </Suspense>
  )
}

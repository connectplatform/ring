import OpportunitiesPageWrapper from '@/components/wrappers/opportunities-page-wrapper'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'

interface OpportunitiesLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function OpportunitiesLayout({ children, params }: OpportunitiesLayoutProps) {
  const { locale: localeParam } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return (
    <OpportunitiesPageWrapper locale={locale} searchParams={{}}>
      {children}
    </OpportunitiesPageWrapper>
  )
}

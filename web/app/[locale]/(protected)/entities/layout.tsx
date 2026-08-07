import EntitiesPageWrapper from '@/components/wrappers/entities-page-wrapper'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'

interface EntitiesLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function EntitiesLayout({ children, params }: EntitiesLayoutProps) {
  const { locale: localeParam } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return (
    <EntitiesPageWrapper locale={locale}>
      {children}
    </EntitiesPageWrapper>
  )
}

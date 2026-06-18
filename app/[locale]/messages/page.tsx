import type { Metadata } from 'next'
import { Suspense } from 'react'
import MessagesWrapper from '@/components/wrappers/messages-wrapper'
import MessagesContent from '@/features/messages/components/messages-content'
import type { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

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
    path: 'messages',
    pathname: '/messages',
    robots: { index: false, follow: false },
  })
}

export default async function MessagesPage(_props: LocalePageProps<{}>) {
  return (
    <MessagesWrapper>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading messenger…</div>}>
        <MessagesContent />
      </Suspense>
    </MessagesWrapper>
  )
}

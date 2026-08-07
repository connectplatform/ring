import { redirect } from 'next/navigation'
import type { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'

type Params = { locale: string }

/** Legacy confidential route — roadmap docs are public at /docs/roadmap */
export default async function ConfidentialRoadmapRedirect({ params }: LocalePageProps<Params>) {
  const { locale: rawLocale } = await params
  const locale = (routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale) as Locale
  redirect(`/${locale}/docs/roadmap`)
}

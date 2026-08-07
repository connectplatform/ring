import { redirect } from 'next/navigation'
import type { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'

type Params = { locale: string; slug: string[] }

/** Legacy confidential child routes — redirect to public docs/roadmap */
export default async function ConfidentialRoadmapChildRedirect({ params }: LocalePageProps<Params>) {
  const { locale: rawLocale, slug } = await params
  const locale = (routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale) as Locale
  const rest = Array.isArray(slug) && slug.length > 0 ? `/${slug.join('/')}` : ''
  redirect(`/${locale}/docs/roadmap${rest}`)
}

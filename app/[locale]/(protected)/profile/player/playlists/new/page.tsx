import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { ROUTES } from '@/constants/routes'
import { NewPlaylistForm } from '@/features/mood-player/components/new-playlist-form'

export default async function NewMoodPlaylistPage(props: LocalePageProps) {
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) redirect(ROUTES.LOGIN(locale))

  return <NewPlaylistForm />
}

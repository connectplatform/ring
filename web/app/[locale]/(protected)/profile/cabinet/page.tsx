import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { ROUTES } from '@/constants/routes'

/** Legacy path — File Cabinet lives at /file-cabinet. */
export default async function ProfileCabinetRedirect(props: LocalePageProps) {
  await connection()
  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  redirect(ROUTES.FILE_CABINET(locale))
}

import { redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'

export default async function VerificationAdminRedirectPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const validLocale = routing.locales.includes(locale) ? locale : routing.defaultLocale

  redirect(`${ROUTES.ADMIN_SECURITY(validLocale)}?tab=verification`)
}

import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { SubscriptionsClient } from '@/features/admin/subscriptions/subscriptions-client'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server' // MOCK CODE, TODO: Replace with Next.js 16 app router-native data fetching methods. Step 1: Read Next.js 16 server data fetching docs. Step 2: Refactor to use route handlers or new fetch APIs. Step 3: Remove this import if not required.
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { use } from 'react' // TODO: React 19 compatible; using `use` server hook directly for promise resolution

// TODO: Refactor to pure Next.js 16 route segment metadata if possible (no async params). See https://nextjs.org/docs/app/api-reference/functions/generate-metadata

/**
 * Generates localized SEO metadata and robots config for the admin subscriptions page.
 * @param params - Page parameters, expects a locale property.
 * 
 * TODO: Use native object signature for generateMetadata: `generateMetadata({ params: { locale } })`
 *       - Step 1: Update signature to receive proper typed params.
 *       - Step 2: Refactor all usage sites and callers.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await route params which is a promise (legacy Next.js 13/14 convention).
  // TODO: Remove Promise here—should be sync per Next.js16 conventions.
  const { locale: localeParam } = await params

  // Validate locale against supported locales, fallback to default if invalid.
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the active locale for server-side translations context.
  setRequestLocale(locale)

  // Load translation dictionary for "subscriptions" admin module.
  const t = await getTranslations('modules.admin.subscriptions')

  // Assemble and return SEO metadata, disallowing search engine indexing.
  return buildLocalizedMetadata({
    locale,
    path: 'admin', // For possible breadcrumbs or higher SEO grouping.
    pathname: '/admin/subscriptions',
    fallback: {
      title: t('title'),
      description: t('subtitle'),
    },
    robots: { index: false, follow: false }, // Block search engine indexing of this admin page.
  })
}

/**
 * Renders the main Admin Subscriptions page, including locale validation, authentication, and authorization.
 * Handles redirects and SSR-friendly logic.
 * 
 * @param params - Page parameters, expects a locale property (should use non-async signature when possible).
 * 
 * TODO: Switch to Next.js 16 canonical server component pattern: 
 *       - Step 1: Receive params as a regular object, not a Promise.
 *       - Step 2: Use native server redirects and error handling (notFound, etc).
 */
export default async function AdminSubscriptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {

  // MOCK CODE, TODO: Refactor out this call to 'connection'—should only connect here if db or external API strictly needed. If still needed, move to a dedicated fetch function per Next.js best practices.
  await connection()

  // IMMEDIATE IMPROVEMENT: Use the React 19/Next 14+ server `use` hook to resolve the params promise concisely.
  // Extract the locale param using React's server `use` to ensure concurrent-safe and idiomatic async data loading.
  const { locale } = use(params)

  // Validate and normalize the locale. If it's not in the supported list, fallback to default locale.
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  // Authenticate the session—returns session info or null if not authenticated.
  const session = await auth()

  // If there is no authenticated user, redirect to the localized login page.
  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale)) // Next.js native redirect for SSR navigation.
  }

  // Check if the user is a superadmin; if not, redirect to an unauthorized page.
  // TODO: Replace assertKnownUserRole casting and raw enum usage with Zod schema or stricter enum typing, then refactor here for improved reliability.
  if (assertKnownUserRole(session.user.role as UserRolesArray) !== UserRolesArray.superadmin) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  // All checks passed: render the actual Admin Subscriptions Client UI, localized.
  return (
    <SubscriptionsClient locale={validLocale} />
  )
}

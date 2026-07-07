import type { Metadata } from 'next'
// Imports for server-side internationalization
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
// TODO (Next.js 16): Prefer new DB connection context API or route segment-level context if applicable (see https://beta.nextjs.org/docs/routing/loading-ui#context-sharing-between-route-segments).
import { connection } from 'next/server'
import { PlatformSettingsContent } from '@/features/admin/platform-settings/components/platform-settings-content'
import {
  loadPlatformSettingsForAdmin,
  testPlatformAIConnection,
  updatePlatformAISettings,
  updatePlatformBrandingSettings,
} from '@/app/_actions/platform-settings'
import { use } from 'react' // TODO: React 19 compatible; using `use` server hook directly for promise resolution

// Generates metadata for admin/settings page, using localized values
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await the route params and extract the locale param.
  // NOTE: Using params as Promise due to routing conventions. Consider native per-request data in Next16 when available.
  const { locale: localeParam } = await params

  // Validate the extracted locale; fallback to the default locale if the param is invalid
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set up Next-intl's request locale context.
  setRequestLocale(locale)
  // TODO: Remove setRequestLocale and migrate to Next.js 16 native per-request locale context (when available).

  // Build and return localized metadata for the admin/settings page for SEO.
  return buildLocalizedMetadata({
    locale,
    path: 'admin',
    pathname: '/admin/settings',
    robots: { index: false, follow: false }, // Ensure search engines do not index admin pages
  })
}

// Main page component for the Platform Settings admin page
export default async function PlatformSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // Establish DB or external service connection for the page.
  // TODO: Once available, switch to Next 16's recommended route-based database connection/context method.
  await connection()

  // Extract locale param from the route.
  const { locale } = use(params) // TODO: Consider removing if `use` is not required with Next.js 13+ async/await data fetching patterns

  // Validate the parsed locale; fallback to the default if not recognized.
  // This prevents invalid locale param from causing errors in downstream translation logic.
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  // Load all translations for the admin UI namespace.
  // This ensures UI copy is localized per request.
  const tAdmin = await getTranslations('modules.admin')

  // Build all admin labels (for menus, sections, etc) using translations.
  // This makes admin modules easily extensible for i18n.
  const adminLabels = buildModulesAdminLabels(tAdmin)

  // Retrieve the current user session (may return null if not logged in).
  // This controls access for authentication and authorization.
  const session = await auth()

  // Redirect unauthenticated users to login page for this locale.
  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale))
  }

  // Ensure only users with superadmin role access this page; others get redirected to unauthorized.
  if (assertKnownUserRole(session.user.role as UserRolesArray) !== UserRolesArray.superadmin) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  // Fetch current platform settings relevant for admin (AI config and branding).
  // Replace or expand this call if platform settings are expanded in the future.
  const { ai, branding } = await loadPlatformSettingsForAdmin()

  // MOCK CODE, TODO: Validate if settings loading logic needs to handle edge/error cases:
  // 1. Handle scenario if loadPlatformSettingsForAdmin returns null or error
  // 2. Consider handling partial/failure states with error boundaries or fallback UI

  // Render the admin UI wrapper, populating page context for navigation and localization.
  return (
    <AdminWrapper locale={validLocale} pageContext="settings" labels={adminLabels}>
      <PlatformSettingsContent
        ai={ai} // AI-related settings for display and update
        branding={branding} // Branding (visual/theme) settings for display and update
        updateAIAction={updatePlatformAISettings} // Handler: form action for AI settings updates
        updateBrandingAction={updatePlatformBrandingSettings} // Handler: form action for branding updates
        testConnectionAction={testPlatformAIConnection} // Allows validating external AI credentials through UI
      />
    </AdminWrapper>
  )
}

import type { Metadata } from 'next'
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
import { connection } from 'next/server'
import { Web3SettingsContent } from '@/features/admin/web3/components/web3-settings-content'
import { use } from 'react' // TODO: Consider removing if `use` is not required with Next.js 13+ async/await data fetching patterns

// TODO: With Next.js 13+/16, you can use async server components and pass `params` directly (params is no longer a Promise in app directory route handlers).
// Update to use latest conventions if you are on a supported version. See: https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#route-segment-config

// Generates SEO-related metadata for the page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await the `params` Promise to get route parameters (Next.js app directory delivers this as a resolved object in latest versions)
  const { locale: localeParam } = await params
  // Check if the provided localeParam is in the list of supported locales, otherwise fallback to default
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  // Update the request's locale for next-intl translations
  setRequestLocale(locale)
  // Generate and return localized metadata for SEO
  return buildLocalizedMetadata({
    locale,
    path: 'admin',
    pathname: '/admin/web3/settings',
    robots: { index: false, follow: false },
  })
}

// Page component for /admin/web3/settings
export default async function Web3SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // Establish DB or backend connection before proceeding
  await connection()

  // TODO: params should not be a Promise in Next.js 13+/16 App Dir. If so, remove 'use' and destructure directly (see docs). This can be refactored as:
  //   export default async function Web3SettingsPage({ params: { locale } }: { params: { locale: string } }) { ... }
  // This improves type-safety and clarity.
  const { locale } = use(params)

  // Validate locale or fallback to default locale type
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  // Fetch admin translations for label-building
  const tAdmin = await getTranslations('modules.admin')
  // Build i18n admin panel labels
  const adminLabels = buildModulesAdminLabels(tAdmin)
  // Get session/auth from Next.js Auth provider
  const session = await auth()

  // Redirect to login page if user is not authenticated
  if (!session?.user) redirect(ROUTES.LOGIN(validLocale))

  // Only allow superadmins to access this page, else redirect to unauthorized
  if (assertKnownUserRole(session.user.role as UserRolesArray) !== UserRolesArray.superadmin) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  // Render the admin wrapper and web3 settings content. Labels and correct locale are passed for i18n UX.
  return (
    <AdminWrapper locale={validLocale} labels={adminLabels}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Web3 / Ring Desk</h1>
        {/* TODO: Consider converting <Web3SettingsContent /> to Async Server Component if it fetches data, for better SSR/streaming */}
        <Web3SettingsContent />
      </div>
    </AdminWrapper>
  )
}

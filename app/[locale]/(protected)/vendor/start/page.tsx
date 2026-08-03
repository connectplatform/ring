import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorStartWrapper from '@/components/wrappers/vendor-start-wrapper'
import VendorOnboardingForm from './vendor-onboarding-form'
import { connection } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { logger } from '@/lib/logger'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await connection()

  const { locale } = await params
  const t = await getTranslations('vendor.startPage')

  return {
    title: t('title') || 'Vendor Start',
    description: t('subtitle') || 'Set up your store and start selling on Ring Platform',
  }
}

export default async function VendorStartPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  const headersList = await headers()
  logger.info('VendorStartPage: Request details', {
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  })

  try {
    const session = await auth()

    if (!session?.user?.id) {
      redirect(ROUTES.LOGIN(validLocale))
    }

    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration')
      const userExists = await userMigrationService.userDocumentExists(session.user.id)
      if (!userExists) {
        await userMigrationService.ensureUserDocument(session.user as any)
      }
    } catch (migrationError) {
      logger.error('VendorStartPage: Failed to check/create user document:', migrationError)
    }

    const existingVendor = await getVendorEntity(session.user.id)
    if (existingVendor) {
      redirect(ROUTES.VENDOR_DASHBOARD(validLocale))
    }

    // Titles live in right-rail (VendorStartRail) — no center sticky header / Card chrome
    return (
      <VendorStartWrapper locale={validLocale} progressPercent={75}>
        <div className="mx-auto w-full max-w-3xl py-2 sm:py-4">
          <VendorOnboardingForm locale={validLocale} />
        </div>
      </VendorStartWrapper>
    )
  } catch (e) {
    logger.error('VendorStartPage: Error:', e)
    return (
      <>
        <title>Vendor Start Error | Ring Platform</title>
        <meta name="robots" content="noindex, nofollow" />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-destructive">Vendor Start Error</h1>
            <p className="mb-4 text-muted-foreground">
              Failed to load vendor start. Please try again later.
            </p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">
              Return to Home
            </a>
          </div>
        </div>
      </>
    )
  }
}

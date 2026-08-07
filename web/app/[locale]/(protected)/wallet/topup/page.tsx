import type { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import WalletWrapper from '@/components/wrappers/wallet-wrapper'
import WalletTopUpClient from './topup-client'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

type WalletTopUpParams = Record<string, never>

const walletRobots: Metadata['robots'] = { index: false, follow: false }

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
    path: 'wallet.topup',
    pathname: '/wallet/topup',
    robots: walletRobots,
  })
}

/**
 * WalletTopUpPage component
 * Renders the wallet top-up page with tabbed selection between RING tokens and WayForPay (ApplePay/GooglePay)
 * 
 * User steps:
 * 1. User navigates to the wallet top-up page (e.g., /en/wallet/topup or /uk/wallet/topup)
 * 2. The page extracts the locale from URL params
 * 3. The page checks for user authentication
 * 4. If not authenticated, user is redirected to localized login
 * 5. If authenticated, the wallet top-up client component is rendered with tabbed interface
 * 6. User can choose between RING token transfer or WayForPay payment methods
 * 
 * @param props - The LocalePageProps with params and searchParams as Promises
 * @returns The rendered WalletTopUpPage component
 */
export default async function WalletTopUpPage(props: LocalePageProps<WalletTopUpParams>) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('WalletTopUpPage: Starting');

  const params = await props.params;
  const searchParams = await props.searchParams;
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('WalletTopUpPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  });

  const session = await auth();
  logger.info('WalletTopUpPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });
  if (!session) return null // Layout AuthGuard already redirects; this narrowing satisfies TypeScript

  try {
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('WalletTopUpPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('WalletTopUpPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('WalletTopUpPage: Failed to check/create user document:', migrationError);
    }

    logger.info('WalletTopUpPage: Rendering wallet top-up client');

    return (
      <WalletWrapper locale={validLocale}>
        <Suspense
          fallback={
            <div className="animate-pulse space-y-6 p-6">
              <div className="h-8 bg-muted rounded w-1/4" />
              <div className="h-32 bg-muted rounded" />
              <div className="h-64 bg-muted rounded" />
            </div>
          }
        >
          <WalletTopUpClient locale={validLocale} searchParams={searchParams} />
        </Suspense>
      </WalletWrapper>
    )

  } catch (e) {
    logger.error('WalletTopUpPage: Error (non-redirect):', e);
    
    return (
      <div className="container mx-auto px-0 py-0">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Wallet Top Up Error</h1>
          <p className="text-muted-foreground mb-4">
            Failed to load wallet top-up. Please try again later.
          </p>
          <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">
            Return to Home
          </a>
        </div>
      </div>
    )
  }
}


import type { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import WalletWrapper from '@/components/wrappers/wallet-wrapper'
import WalletPageClient from './wallet-client'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'

type WalletParams = Record<string, never>

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
    path: 'wallet',
    pathname: '/wallet',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: walletRobots,
  })
}

/**
 * WalletPage - Next.js 16 Streaming Pattern
 * 
 * Static shell (metadata + skeleton) renders immediately.
 * Dynamic content (auth, headers, data) streams inside Suspense.
 * This enables instant page shell delivery while auth/data loads.
 */
export default async function WalletPage(props: LocalePageProps<WalletParams>) {
  const params = await props.params;
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);

  return (
    <WalletWrapper locale={validLocale}>
        <Suspense fallback={
          <div className="animate-pulse space-y-6 p-6">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        }>
          <WalletContent locale={validLocale} searchParams={props.searchParams} />
        </Suspense>
    </WalletWrapper>
  )
}

/**
 * WalletContent - Dynamic async component (streams inside Suspense)
 * 
 * All dynamic data access (connection, auth, headers) happens here,
 * inside the Suspense boundary, so the page shell is never blocked.
 */
async function WalletContent({ 
  locale, 
  searchParams: searchParamsPromise 
}: { 
  locale: Locale
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const searchParams = await searchParamsPromise;
  const headersList = await headers();
  logger.info('WalletPage: Request details', { locale, userAgent: headersList.get('user-agent') });

  const session = await auth();
  logger.info('WalletPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });
  if (!session) return null // Layout AuthGuard already redirects; this narrowing satisfies TypeScript

  try {
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('WalletPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('WalletPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('WalletPage: Failed to check/create user document:', migrationError);
    }

    return (
      <WalletPageClient
        locale={locale}
        searchParams={searchParams}
      />
    );
  } catch (e) {
    logger.error('WalletPage: Error:', e);
    return (
      <div className="container mx-auto px-0 py-0">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Wallet Error</h1>
          <p className="text-muted-foreground mb-4">Failed to load wallet. Please try again later.</p>
          <a href={ROUTES.HOME(locale)} className="text-primary hover:underline">Return to Home</a>
        </div>
      </div>
    );
  }
}


import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { loadTranslations, isValidLocale, type Locale, defaultLocale } from '@/i18n-config'
import WalletWrapper from '@/components/wrappers/wallet-wrapper'
import WalletPageClient from './wallet-client'
import { connection } from 'next/server'


// Define the type for the wallet route params
type WalletParams = {};

/**
 * WalletPage - Next.js 16 Streaming Pattern
 * 
 * Static shell (metadata + skeleton) renders immediately.
 * Dynamic content (auth, headers, data) streams inside Suspense.
 * This enables instant page shell delivery while auth/data loads.
 */
export default async function WalletPage(props: LocalePageProps<WalletParams>) {
  const params = await props.params;
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;

  return (
    <>
      {/* Static metadata - renders immediately */}
      <title>Wallet | Ring Platform</title>
      <meta name="description" content="Manage your RING tokens, view transaction history, and top up your balance." />
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />

      <WalletWrapper locale={locale}>
        <Suspense fallback={
          <div className="animate-pulse space-y-6 p-6">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        }>
          <WalletContent locale={locale} searchParams={props.searchParams} />
        </Suspense>
      </WalletWrapper>
    </>
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

  const headersList = await headers()
  console.log('WalletPage: Request details', { locale, userAgent: headersList.get('user-agent') });

  const session = await auth()

  if (!session) {
    redirect(ROUTES.LOGIN(locale))
  }

  // Ensure user document exists
  try {
    const { userMigrationService } = await import('@/features/auth/services/user-migration');
    const userExists = await userMigrationService.userDocumentExists(session.user.id);
    if (!userExists) {
      await userMigrationService.ensureUserDocument(session.user as any);
    }
  } catch (migrationError) {
    console.error('WalletPage: Failed to check/create user document:', migrationError);
  }

  return (
    <WalletPageClient
      locale={locale}
      searchParams={searchParams}
    />
  )
}

/* 
 * Next.js 16 + React 19 Streaming Pattern:
 * - Page shell (metadata + skeleton) delivered instantly via static render
 * - Dynamic content (auth + data) streams in via Suspense boundary
 * - connection() inside Suspense ensures dynamic data only accessed in streaming context
 * - Security meta tags for authenticated wallet pages (noindex, nofollow)
 */

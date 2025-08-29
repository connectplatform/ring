import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { loadTranslations, isValidLocale, type Locale, defaultLocale } from '@/i18n-config'
import WalletPageClient from './wallet-client'

export const dynamic = 'force-dynamic'

// Define the type for the wallet route params
type WalletParams = {};

/**
 * WalletPage component
 * Renders the wallet management page with RING token balance, transactions, and top-up functionality
 * 
 * User steps:
 * 1. User navigates to the wallet page (e.g., /en/wallet or /uk/wallet)
 * 2. The page extracts the locale from URL params
 * 3. The page checks for user authentication
 * 4. If not authenticated, user is redirected to localized login
 * 5. If authenticated, the wallet client component is rendered with user data
 * 6. User can view balance, transaction history, and manage RING tokens
 * 
 * @param props - The LocalePageProps with params and searchParams as Promises
 * @returns The rendered WalletPage component
 */
export default async function WalletPage(props: LocalePageProps<WalletParams>) {
  console.log('WalletPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('WalletPage: Using locale', locale);

  // Basic metadata for authenticated page
  const translations = await loadTranslations(locale);
  const title = `${(translations as any).modules?.wallet?.title || 'Wallet'} | Ring Platform`;
  const description = (translations as any).modules?.wallet?.description || 'Manage your RING tokens, view transaction history, and top up your balance.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.platform"}/${locale}/wallet`;

  const headersList = await headers()

  console.log('WalletPage: Request details', {
    params,
    searchParams,
    locale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    console.log('WalletPage: Authenticating session');
    const session = await auth()
    console.log('WalletPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session) {
      console.log('WalletPage: No session, redirecting to localized login');
      redirect(ROUTES.LOGIN(locale))
    }

    console.log('WalletPage: Rendering wallet client');

    return (
      <>
        {/* React 19 Native Document Metadata - Authenticated Page */}
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Authenticated page security meta tags */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <Suspense fallback={
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-muted rounded w-1/4"></div>
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        }>
          <WalletPageClient 
            locale={locale}
            searchParams={searchParams}
          />
        </Suspense>
      </>
    )

  } catch (e) {
    console.error("WalletPage: Error:", e)
    
    return (
      <>
        <title>Wallet Error | Ring Platform</title>
        <meta name="robots" content="noindex, nofollow" />
        
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Wallet Error</h1>
            <p className="text-muted-foreground mb-4">
              Failed to load wallet. Please try again later.
            </p>
            <a 
              href={ROUTES.HOME(locale)} 
              className="text-primary hover:underline"
            >
              Return to Home
            </a>
          </div>
        </div>
      </>
    )
  }
}

/* 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Automatic meta tag deduplication and precedence handling
 * - Security meta tags for authenticated wallet pages (noindex, nofollow)
 * - Suspense for progressive loading of wallet data
 * - Preserved all authentication and locale logic
 */

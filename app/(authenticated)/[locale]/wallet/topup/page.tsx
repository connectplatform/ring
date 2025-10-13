import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { loadTranslations, isValidLocale, type Locale, defaultLocale } from '@/i18n-config'
import DesktopSidebar from '@/features/layout/components/desktop-sidebar'
import RightSidebar from '@/features/layout/components/right-sidebar'
import WalletNavigation from '../wallet-navigation'
import WalletTopUpClient from './topup-client'

export const dynamic = 'force-dynamic'

// Define the type for the wallet topup route params
type WalletTopUpParams = {};

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
  console.log('WalletTopUpPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('WalletTopUpPage: Using locale', locale);

  // Basic metadata for authenticated page
  const translations = await loadTranslations(locale);
  const title = `${(translations as any).modules?.wallet?.topup?.title || 'Top Up'} | Ring Platform`;
  const description = (translations as any).modules?.wallet?.topup?.description || 'Add funds to your wallet using RING tokens or WayForPay payment methods.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.platform"}/${locale}/wallet/topup`;

  const headersList = await headers()

  console.log('WalletTopUpPage: Request details', {
    params,
    searchParams,
    locale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    console.log('WalletTopUpPage: Authenticating session');
    const session = await auth()
    console.log('WalletTopUpPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session) {
      console.log('WalletTopUpPage: No session, redirecting to localized login');
      redirect(ROUTES.LOGIN(locale))
    }

    console.log('WalletTopUpPage: Rendering wallet top-up client');

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

        <div className="min-h-screen bg-background">
          {/* Three-column layout for desktop */}
          <div className="grid grid-cols-[280px_1fr_320px] gap-6 min-h-screen">
            {/* Left Sidebar - Navigation */}
            <div className="hidden lg:block">
              <DesktopSidebar />
            </div>

            {/* Main Content - Top Up Form */}
            <div className="lg:ml-0 lg:mr-0 mr-4 ml-4">
              <Suspense fallback={
                <div className="animate-pulse space-y-6 p-6">
                  <div className="h-8 bg-muted rounded w-1/4"></div>
                  <div className="h-32 bg-muted rounded"></div>
                  <div className="h-64 bg-muted rounded"></div>
                </div>
              }>
                <WalletTopUpClient
                  locale={locale}
                  searchParams={searchParams}
                />
              </Suspense>
            </div>

            {/* Right Sidebar - Wallet Navigation */}
            <div className="hidden lg:block">
              <RightSidebar title="Wallet">
                <WalletNavigation locale={locale} />
              </RightSidebar>
            </div>
          </div>

          {/* Mobile Layout - Stack vertically */}
          <div className="lg:hidden">
            <Suspense fallback={
              <div className="animate-pulse space-y-6 p-6">
                <div className="h-8 bg-muted rounded w-1/4"></div>
                <div className="h-32 bg-muted rounded"></div>
                <div className="h-64 bg-muted rounded"></div>
              </div>
            }>
              <WalletTopUpClient
                locale={locale}
                searchParams={searchParams}
              />
            </Suspense>
          </div>
        </div>
      </>
    )

  } catch (e) {
    console.error("WalletTopUpPage: Error:", e)
    
    return (
      <>
        <title>Wallet Top Up Error | Ring Platform</title>
        <meta name="robots" content="noindex, nofollow" />
        
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Wallet Top Up Error</h1>
            <p className="text-muted-foreground mb-4">
              Failed to load wallet top-up. Please try again later.
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


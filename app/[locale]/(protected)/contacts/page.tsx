import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import WalletWrapper from '@/components/wrappers/wallet-wrapper'
import ContactList from '@/features/wallet/components/contact-list'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'


// Define the type for the contacts route params
type ContactsParams = {};

/**
 * ContactsPage component
 * Renders the wallet contacts management page with address book functionality
 *
 * User steps:
 * 1. User navigates to the contacts page (e.g., /en/contacts or /uk/contacts)
 * 2. The page extracts the locale from URL params
 * 3. The page checks for user authentication
 * 4. If not authenticated, user is redirected to localized login
 * 5. If authenticated, the contacts list component is rendered
 * 6. User can view, add, edit, and manage wallet contacts
 *
 * @param props - The LocalePageProps with params and searchParams as Promises
 * @returns The rendered ContactsPage component
 */
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
    path: 'contacts',
    pathname: '/contacts',
    robots: { index: false, follow: false },
  })
}
export default async function ContactsPage(props: LocalePageProps<ContactsParams>) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('ContactsPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);
  logger.info('ContactsPage: Using locale', { locale: validLocale });

  // Basic metadata for authenticated page
  const translations = await getTranslations('modules.wallet');
  const title = `Contacts | ${(translations as any).modules?.wallet?.title || 'Zemna AI'}`;
  const description = 'Manage your wallet contacts and address book for easy token transfers.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://zemna.ai"}${ROUTES.CONTACTS(validLocale)}`;

  const headersList = await headers()

  logger.info('ContactsPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  });

  const session = await auth()
  logger.info('ContactsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });
  if (!session) return null // Layout AuthGuard already redirects; this narrowing satisfies TypeScript

  try {
    // Check if user document exists (with caching - migration now handled at auth level)
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('ContactsPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('ContactsPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('ContactsPage: Failed to check/create user document:', migrationError);
      // Continue anyway - contacts will handle missing document gracefully
    }

    logger.info('ContactsPage: Rendering contacts list');

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

        <WalletWrapper locale={validLocale}>
          <Suspense fallback={
            <div className="animate-pulse space-y-6 p-6">
              <div className="h-8 bg-muted rounded w-1/4"></div>
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          }>
            <ContactList locale={validLocale} />
          </Suspense>
        </WalletWrapper>
      </>
    )

  } catch (e) {
    logger.error("ContactsPage: Error (non-redirect):", e)

    return (
      <>
        <title>Contacts Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />

        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Contacts Error</h1>
            <p className="text-muted-foreground mb-4">
              Failed to load contacts. Please try again later.
            </p>
            <a
              href={ROUTES.HOME(validLocale)}
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
 * - Security meta tags for authenticated contacts pages (noindex, nofollow)
 * - Suspense for progressive loading of contacts data
 * - Preserved all authentication and locale logic
 */

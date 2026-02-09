import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { loadTranslations, isValidLocale, type Locale, defaultLocale } from '@/i18n-config'
import WalletWrapper from '@/components/wrappers/wallet-wrapper'
import ContactList from '@/features/wallet/components/contact-list'
import { connection } from 'next/server'


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
export default async function ContactsPage(props: LocalePageProps<ContactsParams>) {
  await connection() // Next.js 16: opt out of prerendering

  console.log('ContactsPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('ContactsPage: Using locale', locale);

  // Basic metadata for authenticated page
  const translations = await loadTranslations(locale);
  const title = `Contacts | ${(translations as any).modules?.wallet?.title || 'Ring Platform'}`;
  const description = 'Manage your wallet contacts and address book for easy token transfers.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.platform"}/${locale}/contacts`;

  const headersList = await headers()

  console.log('ContactsPage: Request details', {
    params,
    searchParams,
    locale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    console.log('ContactsPage: Authenticating session');
    const session = await auth()
    console.log('ContactsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session) {
      console.log('ContactsPage: No session, redirecting to localized login');
      redirect(ROUTES.LOGIN(locale))
    }

    // Check if user document exists (with caching - migration now handled at auth level)
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        console.warn('ContactsPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        console.log('ContactsPage: User document created successfully');
      }
    } catch (migrationError) {
      console.error('ContactsPage: Failed to check/create user document:', migrationError);
      // Continue anyway - contacts will handle missing document gracefully
    }

    console.log('ContactsPage: Rendering contacts list');

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

        <WalletWrapper locale={locale}>
          <Suspense fallback={
            <div className="animate-pulse space-y-6 p-6">
              <div className="h-8 bg-muted rounded w-1/4"></div>
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          }>
            <ContactList locale={locale} />
          </Suspense>
        </WalletWrapper>
      </>
    )

  } catch (e) {
    console.error("ContactsPage: Error:", e)

    return (
      <>
        <title>Contacts Error | Ring Platform</title>
        <meta name="robots" content="noindex, nofollow" />

        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Contacts Error</h1>
            <p className="text-muted-foreground mb-4">
              Failed to load contacts. Please try again later.
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
 * - Security meta tags for authenticated contacts pages (noindex, nofollow)
 * - Suspense for progressive loading of contacts data
 * - Preserved all authentication and locale logic
 */

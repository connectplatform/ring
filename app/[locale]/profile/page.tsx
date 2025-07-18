import { cookies, headers } from 'next/headers'
import ProfileWrapper from '@/components/profile-wrapper'
import { getServerAuthSession } from '@/auth'
import { AuthUser } from '@/features/auth/types'
import { getWalletBalance, ensureUserWallet } from '@/features/wallet/utils'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { updateProfile } from '@/app/actions/profile'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, Locale } from '@/utils/i18n-server'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = 'force-dynamic'

// Define the type for profile route params
type ProfileParams = {};

/**
 * ProfilePage component
 * Renders the User Profile page, handling authentication and initial data fetching
 * 
 * User steps:
 * 1. User navigates to the profile page
 * 2. The server authenticates the user's session using the auth() function
 * 3. If authenticated, the server fetches the user's wallet balance
 * 4. The server renders the profile-wrapper component with the user's data
 * 5. If not authenticated, the user is redirected to the login page
 * 
 * @param props - The LocalePageProps with Promise-based params and searchParams
 * @returns The rendered profile page
 */
export default async function ProfilePage(props: LocalePageProps<ProfileParams>) {
  console.log('ProfilePage: Starting');

  let initialUser: AuthUser | null = null
  let error: string | null = null

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('ProfilePage: Using locale', locale);

  // React 19 metadata preparation
  const translations = loadTranslations(locale);
  const title = (translations as any).metadata?.profile || 'User Profile | Ring';
  const description = (translations as any).metaDescription?.profile || 'View and manage your Ring user profile, wallet, and account settings.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/profile`;
  const alternates = generateHreflangAlternates('/profile');

  const cookieStore = await cookies()
  const headersList = await headers()

  console.log('ProfilePage: Request details', {
    locale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    console.log('ProfilePage: Authenticating session');
    const session = await getServerAuthSession()
    console.log('ProfilePage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id, role: session?.user?.role });

    if (!session) {
      console.log('ProfilePage: No session, redirecting to login');
      redirect(ROUTES.LOGIN(locale))
    }

    if (session.user) {
      console.log('ProfilePage: Ensuring user wallet');
      const walletAddress = await ensureUserWallet();
      
      console.log('ProfilePage: Fetching wallet balance');
      let userWalletBalance = '0';
      try {
        userWalletBalance = await getWalletBalance();
      } catch (balanceError) {
        console.error('Error fetching wallet balance:', balanceError);
        userWalletBalance = 'Error fetching balance';
      }

      initialUser = {
        ...session.user,
        wallets: [
          ...(session.user.wallets || []),
          {
            address: walletAddress,
            balance: userWalletBalance,
            isDefault: true,
            createdAt: new Date().toISOString(),
            encryptedPrivateKey: '',
            label: 'Default Wallet'
          }
        ]
      } as AuthUser
      console.log('ProfilePage: User data prepared', { userId: initialUser.id, hasWallet: initialUser.wallets.length > 0 });
    }

  } catch (e) {
    console.error('ProfilePage: Error fetching user profile:', e)
    error = 'Failed to load user profile. Please try again later.'
  }

  console.log('Params:', params);
  console.log('Search Params:', searchParams);

  return (
    <>
      {/* React 19 Native Document Metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="profile" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Security meta tags for user profile */}
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}

      <ProfileWrapper 
        initialUser={initialUser} 
        initialError={error}
        params={{ id: undefined, ...params }}
        searchParams={searchParams}
      />
    </>
  )
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Automatic meta tag deduplication and precedence handling
 * - Native hreflang support for i18n
 * - Security meta tags for user profile pages (noindex, nofollow)
 * - Preserved all authentication, wallet integration, and profile logic
 */
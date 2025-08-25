import { cookies, headers } from 'next/headers'
import ProfileWrapper from '@/components/wrappers/profile-wrapper'
import { auth } from '@/auth'
import { AuthUser } from '@/features/auth/types'
// Use server-side services for wallet operations
import { ensureWallet } from '@/features/wallet/services/ensure-wallet'
import { getWalletBalance as getUserWalletBalance } from '@/features/wallet/services/get-wallet-balance'
import { getUserById } from '@/features/auth/services/get-user-by-id'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { updateProfile } from '@/app/_actions/profile'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import { getSEOMetadata } from '@/lib/seo-metadata'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = 'force-dynamic'

// Define the type for profile route params
type ProfileParams = {};

// Metadata will be rendered inline using React 19 native approach

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
  const validLocale = locale;
  console.log('ProfilePage: Using locale', locale);

  // Get SEO metadata for the profile page (authenticated - no keywords)
  const seoData = await getSEOMetadata(validLocale, 'profile');
  const alternates = generateHreflangAlternates('/profile');

  const cookieStore = await cookies()
  const headersList = await headers()

  console.log('ProfilePage: Request details', {
    locale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    console.log('ProfilePage: Authenticating session');
    const session = await auth()
    console.log('ProfilePage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id, role: session?.user?.role });

    if (!session) {
      console.log('ProfilePage: No session, redirecting to login');
      redirect(ROUTES.LOGIN(locale))
    }

    if (session.user) {
      // Fetch complete user data from Firebase including username
      console.log('ProfilePage: Fetching complete user profile from Firebase');
      const fullUserData = await getUserById(session.user.id);
      
      if (!fullUserData) {
        console.error('ProfilePage: Failed to fetch user data from Firebase');
        error = 'Failed to load complete user profile'
      } else {
        console.log('ProfilePage: Ensuring user wallet');
        let walletAddress = ''
        try {
          const wallet = await ensureWallet();
          walletAddress = wallet.address;
        } catch (walletError) {
          console.error('ProfilePage: ensureUserWallet failed:', walletError)
          walletAddress = ''
        }
        
        console.log('ProfilePage: Fetching wallet balance');
        let userWalletBalance = '0';
        try {
          userWalletBalance = await getUserWalletBalance();
        } catch (balanceError) {
          console.error('Error fetching wallet balance:', balanceError);
          userWalletBalance = '0';
        }

        // Merge session data with complete Firebase data
        // Ensure all date fields are proper Date objects
        initialUser = {
          ...session.user,
          ...fullUserData,
          id: fullUserData.id || session.user.id, // Ensure ID is always set
          wallets: walletAddress ? [
            ...(fullUserData.wallets || session.user.wallets || []),
            {
              address: walletAddress,
              balance: userWalletBalance,
              isDefault: true,
              createdAt: new Date().toISOString(),
              encryptedPrivateKey: '',
              label: 'Default Wallet'
            }
          ] : (fullUserData.wallets || session.user.wallets || []),
          // Ensure dates are proper Date objects for AuthUser type
          createdAt: fullUserData.createdAt instanceof Date 
            ? fullUserData.createdAt 
            : typeof fullUserData.createdAt === 'string'
              ? new Date(fullUserData.createdAt)
              : new Date(),
          lastLogin: fullUserData.lastLogin instanceof Date
            ? fullUserData.lastLogin
            : typeof fullUserData.lastLogin === 'string'
              ? new Date(fullUserData.lastLogin)
              : new Date(),
        } as AuthUser
        console.log('ProfilePage: User data prepared', { 
          userId: initialUser.id, 
          username: initialUser.username,
          hasWallet: (initialUser.wallets?.length || 0) > 0 
        });
      }
    }

  } catch (e) {
    console.error('ProfilePage: Error fetching user profile:', e)
    error = 'Failed to load user profile. Please try again later.'
  }

  console.log('Params:', params);
  console.log('Search Params:', searchParams);

  return (
    <>
      {/* React 19 Native Document Metadata - Authenticated Page (No Keywords) */}
      <title>{seoData?.title || 'My Profile - Ring Platform'}</title>
      <meta name="description" content={seoData?.description || 'Manage your Ring Platform profile, preferences, and account settings. Update your professional information and privacy settings.'} />
      <link rel="canonical" href={`/${locale}/profile`} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'My Profile - Ring Platform'} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'Manage your Ring Platform profile, preferences, and account settings. Update your professional information and privacy settings.'} />
      <meta property="og:type" content="profile" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'My Profile - Ring Platform'} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'Manage your Ring Platform profile, preferences, and account settings. Update your professional information and privacy settings.'} />
      
      {/* Security meta tags for user profile - NO SEO FOR AUTHENTICATED PAGES */}
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
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
import React from 'react'
import { redirect } from 'next/navigation'
import { getServerAuthSession } from "@/auth"
import { ROUTES } from '@/constants/routes'
import UnifiedLoginComponent from '@/components/auth/unified-login-component'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, Locale } from '@/utils/i18n-server'

export const dynamic = 'force-dynamic'

/**
 * Define the specific type for login page params
 */
type LoginParams = {};

/**
 * LoginPage component for handling user authentication.
 * 
 * User steps:
 * 1. User navigates to the login page
 * 2. If the user is already authenticated, they are redirected to their profile or a specified page
 * 3. If not authenticated, the unified-login-component is rendered with options for Google, Apple, and Crypto Wallet login
 * 
 * @param props - The page properties including params and searchParams as Promises
 * @returns The rendered login page or a redirect
 */
export default async function LoginPage(props: LocalePageProps<LoginParams>) {
  let from: string | undefined

  try {
    // Resolve params and searchParams
    const params = await props.params;
    const searchParams = await props.searchParams;

    // Extract and validate locale
    const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
    console.log('LoginPage: Using locale', locale);

    // React 19 metadata preparation
    const translations = loadTranslations(locale);
    const title = (translations as any).metadata?.login || 'Login | Ring App';
    const description = (translations as any).metaDescription?.login || 'Log in to access tech opportunities in Cherkasy region';
    const canonicalUrl = `https://ring.ck.ua/${locale}/login`;
    const alternates = generateHreflangAlternates('/login');

    from = typeof searchParams.from === 'string' ? searchParams.from : undefined

    console.log('LoginPage: Starting')
    console.log('Params:', params)
    console.log('Search Params:', searchParams)

    // Step 2: Check if the user is already authenticated
    const session = await getServerAuthSession()
    console.log('Session:', session ? 'Exists' : 'Does not exist')

    // Step 3: Redirect authenticated users
    if (session) {
      console.log('LoginPage: User already logged in, redirecting to', from || ROUTES.PROFILE(locale))
      redirect(from || ROUTES.PROFILE(locale))
    }

    console.log('LoginPage: Rendering unified login component')

    // Step 4: Render the unified-login-component for non-authenticated users
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
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
        <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
        
        {/* Twitter Card metadata */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        
        {/* Hreflang alternates */}
        {Object.entries(alternates).map(([lang, url]) => (
          <link key={lang} rel="alternate" hrefLang={lang} href={url} />
        ))}

        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <UnifiedLoginComponent open={true} from={from} />
          </div>
        </div>
      </>
    );
  } catch (e) {
    console.error("LoginPage: Error checking authentication or resolving request data:", e)
    
    // Fallback return with minimal metadata
    return (
      <>
        <title>Login | Ring App</title>
        <meta name="description" content="Log in to access tech opportunities in Cherkasy region" />
        
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <UnifiedLoginComponent open={true} from={from} />
          </div>
        </div>
      </>
    );
  }
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Automatic meta tag deduplication and precedence handling
 * - Native hreflang support for i18n
 */
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'

type UnauthorizedParams = {}

export default async function Unauthorized(props: LocalePageProps<UnauthorizedParams>) {
  // Resolve params
  const params = await props.params;
  
  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  
  // Load translations for the current locale
  const translations = loadTranslations(locale);

  // React 19 metadata preparation
  const title = (translations as any).metadata?.unauthorized || 'Unauthorized | Ring App';
  const description = (translations as any).metaDescription?.unauthorized || 'Access denied - You do not have permission to view this page.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/unauthorized`;
  const alternates = generateHreflangAlternates('/unauthorized');

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
      
      {/* Error page specific meta tags */}
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            {(translations as any).unauthorized?.title || 'Unauthorized Access'}
          </h1>
          <p className="text-xl mb-8">
            {(translations as any).unauthorized?.message || 'You do not have permission to view this page.'}
          </p>
          <Link href={ROUTES.HOME(locale)} className="text-primary hover:underline">
            {(translations as any).unauthorized?.returnHome || 'Return to home'}
          </Link>
        </div>
      </div>
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
 * - Error page SEO protection (noindex, nofollow for error states)
 * - Preserved all i18n functionality and error handling
 */
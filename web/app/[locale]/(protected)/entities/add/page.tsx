import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import AddEntityForm from '@/features/entities/components/add-entity'
import EntityFormWrapper from '@/components/wrappers/entity-form-wrapper'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { resolvePageProps, LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering for this page to ensure fresh data on every request

// Define the type for the route params (if any)
type AddEntityParams = { id?: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : (routing.defaultLocale as Locale)
  setRequestLocale(locale)
  const t = await getTranslations('modules.entities')
  const base = (process.env.NEXT_PUBLIC_API_URL || 'https://ring.platform').replace(/\/$/, '')
  return {
    title: t('addEntity.title'),
    description: t('addEntity.description'),
    robots: { index: false, follow: false },
    alternates: { canonical: `${base}${ROUTES.ADD_ENTITY(locale)}` },
  }
}

/**
 * Renders the Add Entity page.
 * 
 * User steps:
 * 1. User navigates to the Add Entity page.
 * 2. The page checks user authentication.
 * 3. If authenticated, the page renders the Add Entity form.
 * 4. If not authenticated, the user is redirected to the login page.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns JSX.Element - The rendered page content.
 */
export default async function AddEntityPage(props: LocalePageProps<AddEntityParams>) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('AddEntityPage: Starting');

  const { params, searchParams } = await resolvePageProps<AddEntityParams>(props);
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('AddEntityPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    logger.info('AddEntityPage: Authenticating session');
    const session = await auth();
    logger.info('AddEntityPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session) {
      logger.info('AddEntityPage: Unauthorized access, redirecting to login');
      redirect(ROUTES.LOGIN(validLocale) + `?callbackUrl=${encodeURIComponent(ROUTES.ADD_ENTITY(validLocale))}`);
    }

    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('AddEntityPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('AddEntityPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('AddEntityPage: Failed to check/create user document:', migrationError);
    }

    const t = await getTranslations('modules.entities')
    const title = t('addEntity.title')
    const description = t('addEntity.description')
    const siteBase = (process.env.NEXT_PUBLIC_API_URL || 'https://ring.platform').replace(/\/$/, '')
    const canonicalUrl = `${siteBase}${ROUTES.ADD_ENTITY(validLocale)}`

    logger.info('AddEntityPage: Rendering Add Entity form')

    return (
    <>
      {/* Form-specific structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title,
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": t('addEntity.formTitle'),
              "description": t('addEntity.formDescription')
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": t('breadcrumb.home'),
                  "item": `${siteBase}${ROUTES.HOME(validLocale)}`
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": t('breadcrumb.entities'),
                  "item": `${siteBase}${ROUTES.ENTITIES(validLocale)}`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": t('breadcrumb.addEntity'),
                  "item": canonicalUrl
                }
              ]
            }
          })
        }}
      />

      <EntityFormWrapper locale={validLocale}>
        <Suspense fallback={
          <div className="flex justify-center items-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        }>
          <AddEntityForm locale={validLocale} />
        </Suspense>
      </EntityFormWrapper>
    </>
  );
  } catch (e) {
    logger.error('AddEntityPage: Error:', e);
    return (
      <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Add Entity Error</h1>
            <p className="text-muted-foreground mb-4">Failed to load add entity page. Please try again later.</p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">Return to Home</a>
          </div>
        </div>
    )
  }
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Form page SEO: Proper noindex/nofollow for protected form pages
 * - Breadcrumb structured data: Navigation context for form pages
 * - WebPage schema: Structured data for form functionality
 * - Authentication protection: Redirects maintained for unauthorized access
 * - Preserved all form functionality and user authentication flow
 */
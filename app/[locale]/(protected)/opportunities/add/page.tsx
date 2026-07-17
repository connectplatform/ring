import type { Metadata } from 'next'
import { getSiteBaseUrl } from '@/lib/ring-config-core'
import React from 'react'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import AddOpportunityForm from '@/features/opportunities/components/add-opportunity'
import OpportunityFormWrapper from '@/components/wrappers/opportunity-form-wrapper'
import { OpportunityTypePickerPane } from '@/components/opportunities/opportunity-type-picker-pane'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import {
  canAccessOpportunityCreation,
  hasMemberPrivileges,
  opportunitySelectorUserRole,
  // TODO: With React19, refactor permission checks into middleware if possible for clarity and SSR benefit
} from '@/features/auth/user-role'
import { assertKnownUserRole } from '@/features/auth/user-role'
import { PageProps } from '@/types/next-page'
import { resolvePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { logger } from '@/lib/logger'

/**
 * Returns fallback SEO metadata for the "add opportunity" page,
 * depending on opportunity type.
 */
function addOpportunitySeoFallback(type?: string) {
  // If a specific type is present, return that type's SEO config.
  if (type === 'request') {
    return {
      title: 'Create Request | Ring Platform',
      description:
        'Create a request to find services, advice, or collaboration from the Ring Platform community.',
    }
  }
  if (type === 'offer') {
    return {
      title: 'Create Offer | Ring Platform',
      description: 'Post an official opportunity from your organization on Ring Platform.',
    }
  }
  if (type === 'cv') {
    return {
      title: 'Share Developer CV | Ring Platform',
      description: 'Share your developer profile and skills to connect with marketplace opportunities.',
    }
  }
  // Default fallback if no specific type.
  return {
    title: 'Add Opportunity | Ring Platform',
    description:
      'Add a new opportunity on Ring Platform — job postings, collaboration requests, and partnerships.',
  }
}

// TODO: With React19 and Next 16, migrate document metadata
// generation to native <title> and <meta> JSX where possible
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ type?: string }>
}): Promise<Metadata> {
  // STUB: Metadata export exists for legacy reasons.
  // TODO: Remove in favor of React 19 automatic <title>, <meta> detection.
  // 1. Move collateral metadata (title, meta, structured data) into head tags inside page component.
  // 2. Use React 19's automatic head aggregation in Layout/Page.
  const { locale: localeParam } = await params
  // Choose correct locale (falls back to defaultLocale).
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  const { type } = await searchParams
  const opportunityType = typeof type === 'string' ? type : undefined
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'opportunities.add',
    pathname: '/opportunities/add',
    fallback: addOpportunitySeoFallback(opportunityType),
    robots: { index: false, follow: false },
  })
}

/**
 * The main page component for adding new opportunities.
 * Handles:
 *  - Locale and URL param parsing
 *  - Access/role validation for opportunity creation
 *  - Renders type picker or typed opportunity form
 *  - Handles errors and SEO/structured data
 * 
 * @param props - Arises from Next.js page router with URL search, params
 */
export default async function AddOpportunityPage(props: PageProps) {
  // Prevent static pre-render to allow dynamic logic (user auth, etc)
  await connection() // Next.js 16: opt out of prerendering

  logger.info('AddOpportunityPage: Starting');

  // Step 1: Normalize/resolve params and searchParams
  const { params, searchParams } = await resolvePageProps(props);

  // Determine a valid Locale from route params, otherwise fallback to default locale
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);

  // Extract opportunity type from search param (?type=)
  const typeParam = searchParams.type
  // Only allow known types; if not passed, treat as undefined
  const type =
    typeof typeParam === 'string' &&
    ['request', 'offer', 'cv', 'ring_customization'].includes(typeParam)
      ? (typeParam as 'request' | 'offer' | 'cv' | 'ring_customization')
      : undefined

  // Retrieve HTTP headers and cookies (for auth and logging/diagnostics)
  const headersList = await headers();
  logger.info('AddOpportunityPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    type,
    userAgent: headersList.get('user-agent'),
  });

  // Obtain JWT or session token, if present
  const cookieStore = await cookies();
  const token = cookieStore.get("token");
  const userAgent = headersList.get('user-agent');

  // Utility values for SEO
  const baseUrl = getSiteBaseUrl()
  const description = addOpportunitySeoFallback(typeof type === 'string' ? type : undefined).description

  // Canonical url construction is locale- and type-aware
  const canonicalUrl =
    validLocale === routing.defaultLocale
      ? `${baseUrl}/opportunities/add${type ? `?type=${type}` : ''}`
      : `${baseUrl}/${validLocale}/opportunities/add${type ? `?type=${type}` : ''}`

  // ===== USER AUTH & ROLE VALIDATION =====

  // Check session (auth); ensure user is logged in
  // TODO: With new Next.js middlewares/react-server-components, consider moving redirect logic to middleware layer.
  const session = await auth();
  if (!session) {
    // Not logged in; redirect to login with returnTo.
    logger.info('AddOpportunityPage: No session, redirecting to login');
    const returnTo = ROUTES.ADD_OPPORTUNITY(validLocale) + (type ? `?type=${type}` : '');
    redirect(ROUTES.LOGIN(validLocale) + `?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  // Parse and validate user "role"
  // Throws if role is not recognized (fail fast).
  const userRole = assertKnownUserRole(session.user?.role);

  // Check: Can the role create opportunities at all?
  if (!canAccessOpportunityCreation(userRole)) {
    logger.info('AddOpportunityPage: Authenticated user lacks subscriber role', { userRole });
    const returnTo = ROUTES.ADD_OPPORTUNITY(validLocale) + (type ? `?type=${type}` : '');
    redirect(ROUTES.MEMBERSHIP(validLocale) + `?returnTo=${encodeURIComponent(returnTo)}`);
  }

  // Validate if the type requires member role and user lacks it
  // Prefer in-pane upgrade from picker; fail-closed redirect for direct URL abuse.
  const memberOnlyTypes = new Set(['offer', 'ring_customization', 'program']);
  if (typeof type === 'string' && memberOnlyTypes.has(type) && !hasMemberPrivileges(userRole)) {
    logger.info('AddOpportunityPage: User lacks permission for member-only type', { userRole, type });
    redirect(ROUTES.MEMBERSHIP(validLocale) + `?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(validLocale) + `?type=${type}`)}`);
  }

  logger.info('AddOpportunityPage: User authenticated', { userRole, type, hasToken: !!token });

  // Used in type picker pane for UX
  const selectorRole = opportunitySelectorUserRole(userRole)

  // Load translations for opportunities module
  // TODO: Consider using `useTranslations` hook when possible for client-components
  const t = await getTranslations('modules.opportunities')

  try {
    // ===== USER MIGRATION (non-blocking) =====
    // TODO: Move ensureUserDocument to a one-shot after() / onboarding action so
    // soft navigations to ?type=* do not await migration on every RSC render.
    try {
      const { after } = await import('next/server')
      const userId = session.user.id
      const userSnapshot = session.user
      after(async () => {
        try {
          const { userMigrationService } = await import('@/features/auth/services/user-migration')
          const userExists = await userMigrationService.userDocumentExists(userId)
          if (!userExists) {
            await userMigrationService.ensureUserDocument(userSnapshot as never)
          }
        } catch (migrationError) {
          logger.error('AddOpportunityPage: background user migration failed:', migrationError)
        }
      })
    } catch (migrationScheduleError) {
      logger.error('AddOpportunityPage: could not schedule user migration:', migrationScheduleError)
    }

    // ===== BRANCH: IF NO TYPE, SHOW OPPORTUNITY TYPE PICKER =====
    if (!type) {
      logger.info('AddOpportunityPage: Rendering opportunity type picker')
      return (
        <OpportunityFormWrapper locale={validLocale}>
          <OpportunityTypePickerPane userRole={selectorRole} locale={validLocale} />
        </OpportunityFormWrapper>
      )
    }

    // ===== RENDER: OPPORTUNITY FORM (TYPED) WITH STRUCTURED DATA =====
    return (
    // TODO: Move <script type="application/ld+json"> and <title>, <meta> tags into dedicated React head blocks for React19/Next16
    <>
      {/* Structured data for SEO/Crawlers - Breadcrumb, Page context, etc. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Add Opportunity - Ring Platform",
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": "Opportunity Submission Form",
              "description": "Form for posting opportunities on the Ring platform"
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": baseUrl
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Opportunities",
                  "item": `${baseUrl}/opportunities`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "Add Opportunity",
                  "item": canonicalUrl
                }
              ]
            },
            "potentialAction": {
              "@type": "CreateAction",
              "name": "Submit Opportunity",
              "description": "Create a new opportunity posting on the Ring platform"
            }
          })
        }}
      />

      {/* TODO: Move <title> tag to <Head /> level for React19-native metadata aggregation. */}
      <OpportunityFormWrapper locale={validLocale} opportunityType={type}>
        {/* Client form — no Suspense wrapper (avoids full-pane spinner flash on soft nav). */}
        <AddOpportunityForm opportunityType={type} />
      </OpportunityFormWrapper>
    </>
  );
  } catch (e) {
    // If any unexpected error, log and show error UI.
    logger.error('AddOpportunityPage: Unexpected error:', e);

    // TODO: Use React19 error boundaries for better error handling in future.
    // Render fallback UI (noindex SEO, message).
    return (
      <>
        {/* Error page metadata for SEO */}
        <title>Add Opportunity Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />
        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Add Opportunity Error</h1>
            <p className="text-muted-foreground mb-4">An unexpected error occurred. Please try again later.</p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">Return to Home</a>
          </div>
        </div>
      </>
    );
  }
}

/* 
 * OBSOLETE/LEGACY FUNCTIONS:
 * - generateMetadata() function (should move to React 19 <Head />/JSX)
 *
 * TODO: Modernize React 19 usage:
 * - Move <title>, <meta>, <script type="application/ld+json"> to document head using Head export (see https://nextjs.org/docs/app/api-reference/functions/head)
 * - Consider using error.js/error-boundary.js for error fallback instead of inline error logic
 * - Use middleware for user/role/permission redirect chains
 * - Leverage React suspense and async server components more deeply for opportunity form branching
 * - Cleanup legacy user migration bootstrapping; migrate to idempotent server actions
 * - Use localeProvider/IntlProvider if extending localization
 * - Remove all data fetching/connecting from layout if present (should be here)
 */
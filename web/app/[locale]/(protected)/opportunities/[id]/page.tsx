// TODO: When adding mutating logic like create/edit/delete, refactor to use Next.js 16 server actions instead of classic API routes.
// TODO: Make more pervasive use of React 19 Suspense boundaries: page-level and section-level, so the page can stream prioritized UI faster.
// TODO: migrate script-based schema.org to unified Next.js Metadata API
// TODO: use ErrorBoundary for React 19 (when stable) for better UX than try/catch fallback
// TODO: plumb searchParams fully into wrapper and metadata for deeper SSR/streaming
 

import React, { Suspense } from 'react' // React 19 Suspense for streaming/async boundaries
import { getSiteBaseUrl } from '@/lib/ring-config-core'
import { redirect, notFound } from 'next/navigation' // Next.js 16 navigation functions
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { auth } from '@/auth'
import type { SerializedOpportunity } from '@/features/opportunities/types'
import type { SerializedEntity } from '@/features/entities/types'
import type { Attachment } from '@/features/opportunities/types'
import OpportunitiesWrapper from '@/components/wrappers/opportunities-wrapper'
import { ROUTES } from '@/constants/routes'
import BackBar from '@/components/common/back-bar'

import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { logger } from '@/lib/logger'
import { AuthUser } from '@/features/auth/types'


/**
 * Type for opportunity page route parameters.
 * @typedef {Object} OpportunityParams
 * @property {string} id - unique opportunity ID from URL
 */
type OpportunityParams = { id: string };

// Set of reserved strings that should NOT be treated as opportunity IDs (prevent leaking internal routes)
const RESERVED_OPPORTUNITY_SLUGS = new Set([
  'my',
  'add',
  'status',
])

/**
 * Helper for distinguishing Next.js navigation errors (redirect, notFound) from standard errors.
 * This is critical so we don't accidentally swallow or mishandle framework-level navigation instructions.
 * @param error
 * @returns {boolean}
 */
function isNextNavigationError(error: unknown): boolean {
  // Checks for expected 'digest' property used internally by Next.js navigation errors
  if (!error || typeof error !== 'object' || !('digest' in error)) {
    return false
  }
  const digest = String((error as { digest?: string }).digest ?? '')
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')
}

/**
 * Fetch opportunity and (optionally) entity/org data with error handling.
 * Returns both opportunity and related entity (if available), or throws on error.
 * Stubs out proper error types for granular catch/redirect.
 */
async function getOpportunityData(
  id: string
): Promise<{ opportunity: SerializedOpportunity | null; entity: SerializedEntity | null }> {
  try {
    // Service layer import for fetching opportunity and entity. Handles access control and not-found states.
    const { getSerializedOpportunityById, OpportunityNotFoundError, OpportunityAccessDeniedError } = await import('@/features/opportunities/services/get-opportunity-by-id')
    const { getSerializedEntityById } = await import('@/features/entities/services/get-entity-by-id')
    
    const opportunity = await getSerializedOpportunityById(id)
    
    if (!opportunity) {
      // If the fetch returns null, throw typed error for upstream logic
      throw new OpportunityNotFoundError(id)
    }

    // Attempt to fetch associated entity/org info if orgId is present. On error, continue (not fatal).
    let entity: SerializedEntity | null = null
    if (opportunity.organizationId) {
      try {
        entity = await getSerializedEntityById(opportunity.organizationId)
      } catch (entityError) {
        // Log error and continue, since missing/hidden entities are possible (e.g., deleted org)
        logger.error('getOpportunityData: Error fetching entity data:', entityError)
      }
    }
    
    return { opportunity, entity }
  } catch (error) {
    logger.error('getOpportunityData: Error fetching opportunity data:', error)
    // For known/structured errors, re-throw and let upstream logic react
    if (error instanceof Error && (error.name === 'OpportunityNotFoundError' || error.name === 'OpportunityAccessDeniedError')) {
      throw error
    }
    // For all other unexpected failures, escalate as generic error (would be caught later)
    logger.error('getOpportunityData: Error fetching opportunity data:', error)
    throw new Error('Opportunity retrieval failed')
  }
}

/**
 * Legacy generateMetadata assumes classic Next.js document head functions.
 * 
 * // TODO: Switch to React 19/Next16 unified metadata API when stable:
 * - Use the new "Metadata" export or dynamic metadata as supported by Next.js 16+ for better streaming SEO and OpenGraph
 * - See: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  // Await dynamic params from loader (locale, id)
  const { locale: localeParam, id } = await params
  // Validate or fallback locale
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const t = await getTranslations('modules.opportunities')

  try {
    // Fetch the opportunity for localized SEO details
    const { opportunity } = await getOpportunityData(id)
    if (!opportunity) {
      return {}
    }
    const description =
      opportunity.briefDescription || opportunity.fullDescription || t('opportunityDetails.description')
    return buildLocalizedMetadata({
      locale,
      path: 'opportunities.detail',
      pathname: `/opportunities/${id}`,
      variables: { title: opportunity.title, description },
      fallback: {
        title: `${opportunity.title} | Ring Platform`,
        description,
      },
    })
  } catch {
    // If fetch fails, fall back to generic strings for metadata
    return buildLocalizedMetadata({
      locale,
      path: 'opportunities.detail',
      pathname: `/opportunities/${id}`,
      fallback: {
        title: t('opportunityDetails.title'),
        description: t('opportunityDetails.description'),
      },
    })
  }
}

/**
 * Main server component for the Opportunity Details Page.
 * Responds to direct navigation, validates auth, handles various failure and loading states.
 * - Uses Suspense for async child tree loading (React 19).
 * 
 * User steps:
 * 1. User navigates to the opportunity details page with a specific ID.
 * 2. Page checks authentication/session. If missing, redirects to login.
 * 3. Checks/creates user doc (migration).
 * 4. Fetches the opportunity. If not found or no access, shows not found or unauthorized.
 * 5. Populates wrapper and supplies SSR data for Suspense streaming.
 * 
 * @param props - The page parameters and searchParams, both (potentially) promises (Next.js convention)
 * @returns Promise<React.ReactNode>
 */
export default async function OpportunityPage(props: LocalePageProps<OpportunityParams>): Promise<React.ReactNode> {
  // Opt out of Next.js default prerendering – this ensures fully dynamic SSR for protected content
  await connection() // Next.js 16: makes this page dynamic

  logger.info('OpportunityPage: Starting')

  // Await route param and searchParam resolutions as per Next.js 16 conventions (may be async)
  const params = await props.params
  const searchParams = await props.searchParams

  // Ensure valid locale, falling back to default for bad/unknown/legacy locale slugs
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale)
  logger.info('OpportunityPage: Using locale', { locale: validLocale })

  const { id } = params
  logger.info('OpportunityPage: Opportunity ID', { id })

  // Reserved slugs should not be treated as opportunity IDs; triggers notFound()
  if (RESERVED_OPPORTUNITY_SLUGS.has(id)) {
    return notFound()
  }

  // Capture inbound request headers for UX analytics, logging, device targeting, etc
  const headersList = await headers()
  logger.info('OpportunityPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    id,
    userAgent: headersList.get('user-agent'),
  })

  try {
    // Auth gate: Get user session or redirect to login for protected opportunity page
    logger.info('OpportunityPage: Authenticating session')
    const session = await auth()
    logger.info('OpportunityPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id })

    if (!session) {
      logger.info('OpportunityPage: No session, redirecting to localized login')
      redirect(ROUTES.LOGIN(validLocale))
    }

    // USER MIGRATION LOGIC: Checks if user doc exists, creates if missing (handles first-login migration and backward compatibility)
    // TODO: Optimize by leveraging Next.js 16 native caching and mutation actions once stable.
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration')
      const userExists = await userMigrationService.userDocumentExists(session.user.id)
      if (!userExists) {
        logger.warn('OpportunityPage: User document missing, initializing')
        await userMigrationService.ensureUserDocument(session.user as AuthUser)
        logger.info('OpportunityPage: User document created successfully')
      }
    } catch (migrationError) {
      logger.error('OpportunityPage: Failed to check/create user document:', migrationError)
      // Migration failure is tolerated; missing doc is not critical for read-only opportunity details
    }

    let opportunity: SerializedOpportunity | null = null
    let entity: SerializedEntity | null = null
    let error: string | null = null

    // Primary opportunity fetch: Handles all not-found/unauthorized flows
    try {
      const data = await getOpportunityData(id)
      opportunity = data.opportunity
      entity = data.entity

      logger.info('OpportunityPage: Opportunity data fetched', { hasOpportunity: !!opportunity, hasEntity: !!entity })
    } catch (e) {
      logger.error('OpportunityPage: Error fetching opportunity data:', e)
      if (e instanceof Error) {
        // Next.js uses custom error classes for handling access/no-permission state
        if (e.name === 'OpportunityAccessDeniedError') {
          if (e.message.includes('Authentication required')) {
            redirect(ROUTES.LOGIN(validLocale)) // Not signed in, show login
          } else {
            redirect(ROUTES.UNAUTHORIZED(validLocale)) // Signed in, not permitted
          }
        } else if (e.name === 'OpportunityNotFoundError') {
          return notFound()
        } else {
          // For any other error, show fallback error in UI
          error = "An unexpected error occurred. Please try again later."
        }
      } else {
        error = "An unexpected error occurred. Please try again later."
      }
    }

    logger.info('OpportunityPage: Rendering page')
    const baseUrl = getSiteBaseUrl()

    // -- PAGE BODY --
    // TODO: Migrate <script> usage for structured data to new Next.js 16 Metadata (when supported)
    //       See: https://nextjs.org/docs/app/api-reference/metadata
    // For now, use script with dangerouslySetInnerHTML for SEO (Google Jobs, etc.)
    return (
      <>
        {/* Structured JSON-LD for SEO (JobPosting schema). Only rendered for "full" opportunity + entity */}
        {opportunity && entity && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "JobPosting",
                "title": opportunity.title,
                "description": opportunity.briefDescription || opportunity.fullDescription,
                "hiringOrganization": {
                  "@type": "Organization",
                  "name": entity.name,
                  ...(entity.logo && { "logo": entity.logo }),
                  ...(entity.website && { "url": entity.website })
                },
                "jobLocation": {
                  "@type": "Place",
                  "address": entity.location
                },
                "url": `${process.env.NEXT_PUBLIC_API_URL}${ROUTES.OPPORTUNITY(opportunity.id, validLocale)}`,
                ...(opportunity.type && { "employmentType": opportunity.type }),
                "inLanguage": validLocale,
                "datePosted": opportunity.dateCreated
              })
            }}
          />
        )}

        {/* Navigation: Always provide back bar with sensible fallback label */}
        <BackBar
          href={ROUTES.OPPORTUNITIES(validLocale)}
          title={opportunity?.title || 'Opportunity Details'}
          locale={validLocale}
        />

        {/* Main opportunity content. OpportunitiesWrapper fetches more, allows interaction. Suspended for streaming UX. */}
        <Suspense fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        }>
          <OpportunitiesWrapper
            locale={validLocale}
            searchParams={{}} // TODO: Implement full searchParams plumbthrough if filters/sorting should persist
            initialOpportunity={opportunity ? {
              ...opportunity,
              attachments: opportunity.attachments as Attachment[],
              visibility: opportunity.visibility,
              expirationDate: opportunity.expirationDate // Already string
            } : null}
            initialEntity={entity}
            initialError={error}
            lastVisible={null}
            initialLimit={20}
          />
        </Suspense>
      </>
    )

  } catch (e) {
    // -- ERROR BOUNDARY --
    // Distinguish framework-level navigation errors (redirects, notFound) vs true failures
    if (isNextNavigationError(e)) {
      throw e // Rethrow so Next.js handles natively
    }
    logger.error('OpportunityPage: Error:', e)

    // User-friendly generic error for any other unexpected failure
    // TODO: Custom error overlays via React 19 ErrorBoundary component when available
    return (
      <>
        <title>Opportunity Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />

        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Opportunity Error</h1>
            <p className="text-muted-foreground mb-4">
              Failed to load opportunity. Please try again later.
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
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Opportunity-specific metadata: Dynamic title and description based on opportunity data
 * - JobPosting structured data: Native <script> tag with JSON-LD for job search optimization
 * - Advanced OpenGraph: Entity logos, opportunity types, and tags
 * - Twitter Cards: Enhanced with entity branding
 * - SEO optimization: Index/follow for public opportunity pages
 * - Preserved all authentication, data fetching, and authorization logic
 */
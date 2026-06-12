import React, { Suspense } from 'react'
import { getSiteBaseUrl } from '@/lib/ring-config'
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { Entity, SerializedEntity } from '@/features/entities/types'
import { Attachment } from '@/features/opportunities/types'
import { UserRole } from '@/features/auth/types'
import OpportunitiesWrapper from '@/components/wrappers/opportunities-wrapper'
import { ROUTES } from '@/constants/routes'
import BackBar from '@/components/common/back-bar'

import type { Metadata } from 'next'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { logger } from '@/lib/logger'

// Allow caching for opportunity details with moderate revalidation for content updates

// Define the type for the route params
type OpportunityParams = { id: string };

const RESERVED_OPPORTUNITY_SLUGS = new Set([
  'my',
  'my',
  'add',
  'status',
])

function isNextNavigationError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('digest' in error)) {
    return false
  }
  const digest = String((error as { digest?: string }).digest ?? '')
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')
}

/**
 * Fetches opportunity data using unified services with proper error handling.
 * 
 * @param id - The unique identifier of the opportunity to fetch
 * @returns Promise with opportunity and associated entity data
 * @throws OpportunityNotFoundError if opportunity doesn't exist
 * @throws OpportunityAccessDeniedError if user lacks permissions
 */
async function getOpportunityData(
  id: string
): Promise<{ opportunity: SerializedOpportunity | null; entity: SerializedEntity | null }> {
  try {
    // Use unified services with proper authentication and error handling
    const { getSerializedOpportunityById, OpportunityNotFoundError, OpportunityAccessDeniedError } = await import('@/features/opportunities/services/get-opportunity-by-id')
    const { getSerializedEntityById } = await import('@/features/entities/services/get-entity-by-id')
    
    const opportunity = await getSerializedOpportunityById(id)
    
    if (!opportunity) {
      throw new OpportunityNotFoundError(id)
    }

    // Try to get the associated entity if organizationId is available
    let entity: SerializedEntity | null = null
    if (opportunity.organizationId) {
      try {
        entity = await getSerializedEntityById(opportunity.organizationId)
      } catch (entityError) {
        logger.error('getOpportunityData: Error fetching entity data:', entityError)
        // Continue without entity - this is not a critical error
        // The entity might be confidential or deleted
      }
    }
    
    return { opportunity, entity }
  } catch (error) {
    logger.error('getOpportunityData: Error fetching opportunity data:', error)
    // Re-throw structured errors as-is
    if (error instanceof Error && (error.name === 'OpportunityNotFoundError' || error.name === 'OpportunityAccessDeniedError')) {
      throw error
    }
    // Wrap unknown errors
    logger.error('getOpportunityData: Error fetching opportunity data:', error)
    throw new Error('Opportunity retrieval failed')
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  const t = await getTranslations('modules.opportunities')

  try {
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
 * Renders the opportunity details page.
 * 
 * User steps:
 * 1. User navigates to the opportunity details page with a specific ID.
 * 2. The page checks user authentication and authorization.
 * 3. If authorized, the page fetches and displays the opportunity details.
 * 4. If the opportunity is confidential, it checks for appropriate user role.
 * 5. The page displays the opportunity details or an error message.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns Promise<React.ReactNode> - A promise that resolves to the rendered page content.
 */
export default async function OpportunityPage(props: LocalePageProps<OpportunityParams>): Promise<React.ReactNode> {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('OpportunityPage: Starting')

  // Resolve params and searchParams
  const params = await props.params
  const searchParams = await props.searchParams

  // Extract and validate locale
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale)
  logger.info('OpportunityPage: Using locale', { locale: validLocale })

  const { id } = params
  logger.info('OpportunityPage: Opportunity ID', { id })

  if (RESERVED_OPPORTUNITY_SLUGS.has(id)) {
    return notFound()
  }

  const headersList = await headers()
  logger.info('OpportunityPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    id,
    userAgent: headersList.get('user-agent'),
  })

  try {
    logger.info('OpportunityPage: Authenticating session')
    const session = await auth()
    logger.info('OpportunityPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id })

    if (!session) {
      logger.info('OpportunityPage: No session, redirecting to localized login')
      redirect(ROUTES.LOGIN(validLocale))
    }

    // Check if user document exists (with caching - migration now handled at auth level)
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration')
      const userExists = await userMigrationService.userDocumentExists(session.user.id)
      if (!userExists) {
        logger.warn('OpportunityPage: User document missing, initializing')
        await userMigrationService.ensureUserDocument(session.user as any)
        logger.info('OpportunityPage: User document created successfully')
      }
    } catch (migrationError) {
      logger.error('OpportunityPage: Failed to check/create user document:', migrationError)
      // Continue anyway - opportunity page will handle missing document gracefully
    }

    let opportunity: SerializedOpportunity | null = null
    let entity: SerializedEntity | null = null
    let error: string | null = null

    try {
      const data = await getOpportunityData(id)
      opportunity = data.opportunity
      entity = data.entity

      logger.info('OpportunityPage: Opportunity data fetched', { hasOpportunity: !!opportunity, hasEntity: !!entity })
    } catch (e) {
      logger.error('OpportunityPage: Error fetching opportunity data:', e)
      if (e instanceof Error) {
        if (e.name === 'OpportunityAccessDeniedError') {
          if (e.message.includes('Authentication required')) {
            redirect(ROUTES.LOGIN(validLocale))
          } else {
            redirect(ROUTES.UNAUTHORIZED(validLocale))
          }
        } else if (e.name === 'OpportunityNotFoundError') {
          return notFound()
        } else {
          error = "An unexpected error occurred. Please try again later."
        }
      } else {
        error = "An unexpected error occurred. Please try again later."
      }
    }

    logger.info('OpportunityPage: Rendering page')
    const baseUrl = getSiteBaseUrl()

    return (
    <>
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

      {/* Back Navigation Bar */}
      <BackBar
        href={ROUTES.OPPORTUNITIES(validLocale)}
        title={opportunity?.title || 'Opportunity Details'}
        locale={validLocale}
      />

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <OpportunitiesWrapper
          locale={validLocale}
          searchParams={{}}
          initialOpportunity={opportunity ? {
            ...opportunity,
            attachments: opportunity.attachments as Attachment[],
            visibility: opportunity.visibility,
            expirationDate: opportunity.expirationDate // Already a string from serialization
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
    if (isNextNavigationError(e)) {
      throw e
    }
    logger.error('OpportunityPage: Error:', e)

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
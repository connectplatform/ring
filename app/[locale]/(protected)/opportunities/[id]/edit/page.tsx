import type { Metadata } from 'next'
import React, { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { logger } from '@/lib/logger'
import {
  assertKnownUserRole,
} from '@/features/auth/user-role'
import {
  canEditOpportunity,
} from '@/features/opportunities/lib/opportunity-permissions'
import AddOpportunityForm from '@/features/opportunities/components/add-opportunity'
import OpportunityFormWrapper from '@/components/wrappers/opportunity-form-wrapper'
import type { OpportunityFormRailType } from '@/components/opportunities/opportunity-form-guidance-rail'

type PageProps = {
  params: Promise<{ locale: string; id: string }>
}

function resolveFormRailType(type: string): OpportunityFormRailType | undefined {
  if (type === 'request' || type === 'offer' || type === 'cv' || type === 'ring_customization') {
    return type
  }
  if (['partnership', 'volunteer', 'mentorship', 'resource', 'event'].includes(type)) {
    return 'offer'
  }
  return 'request'
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return buildLocalizedMetadata({
    locale,
    path: 'opportunities.edit',
    pathname: `/opportunities/${id}/edit`,
    robots: { index: false, follow: false },
  })
}

export default async function EditOpportunityPage({ params }: PageProps) {
  await connection()

  const { locale: localeParam, id } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const session = await auth()
  if (!session?.user?.id) {
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.OPPORTUNITY_EDIT(id, locale))}`,
    )
  }

  try {
    const {
      getSerializedOpportunityById,
      OpportunityNotFoundError,
      OpportunityAccessDeniedError,
    } = await import('@/features/opportunities/services/get-opportunity-by-id')

    let opportunity
    try {
      opportunity = await getSerializedOpportunityById(id)
    } catch (error) {
      if (error instanceof OpportunityNotFoundError) {
        notFound()
      }
      if (error instanceof OpportunityAccessDeniedError) {
        redirect(ROUTES.UNAUTHORIZED(locale))
      }
      throw error
    }

    if (!opportunity) {
      notFound()
    }

    const userRole = assertKnownUserRole(session.user.role)
    if (!canEditOpportunity(userRole, opportunity.createdBy, session.user.id)) {
      redirect(ROUTES.UNAUTHORIZED(locale))
    }

    const railType = resolveFormRailType(opportunity.type)

    return (
      <OpportunityFormWrapper locale={locale} opportunityType={railType}>
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--davinci-beam)] border-t-transparent" />
            </div>
          }
        >
          <AddOpportunityForm
            opportunityType={opportunity.type as 'request' | 'offer' | 'partnership' | 'volunteer' | 'cv' | 'resource' | 'event' | 'ring_customization'}
            initialOpportunity={opportunity}
          />
        </Suspense>
      </OpportunityFormWrapper>
    )
  } catch (error) {
    logger.error('EditOpportunityPage: failed', error)
    throw error
  }
}

'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { useSession } from 'next-auth/react'
import { ROUTES } from '@/constants/routes'
import { Plus, Search, User } from 'lucide-react'
import ModuleSectionNav from '@/components/navigation/module-section-nav'
import { OpportunityTypeSelectorClient } from '@/components/opportunities/opportunity-type-selector-client'
import {
  canAccessOpportunityCreation,
  opportunitySelectorUserRole,
  parseUserRole,
  UserRole,
} from '@/features/auth/user-role'
import { useRouter } from '@/i18n/routing'

interface OpportunitiesPageWrapperProps {
  children: React.ReactNode
  locale: string
  searchParams?: { [key: string]: string | string[] | undefined }
}

/**
 * Opportunities layout shell — top section nav only (store SSOT: filter rail lives in list wrapper).
 */
export default function OpportunitiesPageWrapper({ children, locale }: OpportunitiesPageWrapperProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations('modules.opportunities')
  const loc = locale as Locale
  const [showTypeSelector, setShowTypeSelector] = useState(false)

  const userRole = parseUserRole(session?.user?.role) ?? UserRole.visitor

  const handleCreateClick = () => {
    if (!canAccessOpportunityCreation(userRole)) {
      router.push(
        `${ROUTES.MEMBERSHIP(loc)}?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(loc))}` as '/membership',
      )
      return
    }
    setShowTypeSelector(true)
  }

  const navItems = session?.user
    ? [
        {
          id: 'browse',
          label: t('browseOpportunities'),
          href: ROUTES.OPPORTUNITIES(loc),
          icon: Search,
          match: 'exact' as const,
        },
        {
          id: 'my',
          label: t('myOpportunities'),
          href: ROUTES.MY_OPPORTUNITIES(loc),
          icon: User,
          match: 'exact' as const,
        },
        {
          id: 'create',
          label: t('createOpportunity'),
          onClick: handleCreateClick,
          icon: Plus,
          variant: 'outline' as const,
        },
      ]
    : []

  return (
    <div className="min-h-full">
      {session?.user && (
        <ModuleSectionNav
          title={t('opportunities')}
          items={navItems}
          className="mb-4"
        />
      )}
      {children}
      {showTypeSelector && (
        <OpportunityTypeSelectorClient
          layout="overlay"
          userRole={opportunitySelectorUserRole(userRole)}
          locale={loc}
          onClose={() => setShowTypeSelector(false)}
        />
      )}
    </div>
  )
}

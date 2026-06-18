'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  canAccessOpportunityCreation,
  opportunitySelectorUserRole,
} from '@/features/auth/user-role'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { useTranslations, useLocale } from 'next-intl'
import { OpportunityTypeSelectorClient } from '@/components/opportunities/opportunity-type-selector-client'

interface AddOpportunityButtonProps {
  locale?: Locale
  className?: string
}

export function AddOpportunityButton({ locale: localeProp, className }: AddOpportunityButtonProps) {
  const resolvedLocale = (useLocale() as Locale) ?? localeProp
  const locale = resolvedLocale ?? ('en' as Locale)
  const { role, isAuthenticated } = useAuth()
  const t = useTranslations('modules.opportunities')
  const [showTypeSelector, setShowTypeSelector] = useState(false)

  if (!isAuthenticated) {
    return (
      <Button asChild className={className}>
        <Link
          href={`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.OPPORTUNITIES(locale))}`}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('addOpportunity')}
        </Link>
      </Button>
    )
  }

  if (!canAccessOpportunityCreation(role)) {
    return (
      <Button asChild className={className}>
        <Link
          href={`${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(locale))}`}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('addOpportunity')}
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        className={className}
        onClick={() => setShowTypeSelector(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        {t('addOpportunity')}
      </Button>
      {showTypeSelector && (
        <OpportunityTypeSelectorClient
          layout="overlay"
          userRole={opportunitySelectorUserRole(role)}
          locale={locale}
          onClose={() => setShowTypeSelector(false)}
        />
      )}
    </>
  )
}

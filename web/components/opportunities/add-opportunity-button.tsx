'use client'

import { useAuth } from '@/hooks/use-auth'
import { canAccessOpportunityCreation } from '@/features/auth/user-role'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { useTranslations, useLocale } from 'next-intl'
import { requestOpportunityTypeSelector } from '@/lib/opportunities/request-opportunity-type-selector'
import { cn } from '@/lib/utils'

interface AddOpportunityButtonProps {
  locale?: Locale
  className?: string
  /**
   * overlay — emit to the shared AddOpportunityFsModal host (all viewports)
   * navigate — classic Link to /opportunities/add
   */
  mode?: 'overlay' | 'navigate'
}

export function AddOpportunityButton({
  locale: localeProp,
  className,
  mode = 'overlay',
}: AddOpportunityButtonProps) {
  const resolvedLocale = (useLocale() as Locale) ?? localeProp
  const locale = resolvedLocale ?? ('en' as Locale)
  const { role, isAuthenticated } = useAuth()
  const t = useTranslations('modules.opportunities')

  if (!isAuthenticated) {
    return (
      <Button asChild className={className}>
        <Link
          href={
            `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.OPPORTUNITIES(locale))}` as '/login'
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('addOpportunity')}
        </Link>
      </Button>
    )
  }

  if (!canAccessOpportunityCreation(role)) {
    return (
      <Button asChild className={className}>
        <Link
          href={
            `${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(locale))}` as '/membership'
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('addOpportunity')}
        </Link>
      </Button>
    )
  }

  if (mode === 'navigate') {
    return (
      <Button asChild className={className}>
        <Link href={ROUTES.ADD_OPPORTUNITY(locale) as '/opportunities/add'}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addOpportunity')}
        </Link>
      </Button>
    )
  }

  const openSelector = () => {
    requestOpportunityTypeSelector()
  }

  return (
    <Button type="button" className={cn(className)} onClick={openSelector}>
      <Plus className="mr-2 h-4 w-4" />
      {t('addOpportunity')}
    </Button>
  )
}

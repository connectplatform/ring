'use client'

import { useAuth } from '@/hooks/use-auth'
import { canAccessOpportunityCreation } from '@/features/auth/user-role'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { useTranslations, useLocale } from 'next-intl'

interface AddOpportunityButtonProps {
  locale?: Locale
  className?: string
}

export function AddOpportunityButton({ locale: localeProp, className }: AddOpportunityButtonProps) {
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

  const href = canAccessOpportunityCreation(role)
    ? ROUTES.ADD_OPPORTUNITY(locale)
    : `${ROUTES.MEMBERSHIP(locale)}?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(locale))}`

  return (
    <Button asChild className={className}>
      <Link href={href as '/opportunities/add'}>
        <Plus className="mr-2 h-4 w-4" />
        {t('addOpportunity')}
      </Link>
    </Button>
  )
}

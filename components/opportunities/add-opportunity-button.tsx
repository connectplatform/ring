'use client'

import { useAuth } from '@/hooks/use-auth'
import { UserRole } from '@/features/auth/types'
import { Button } from '@/components/ui/button'
import { Plus, Crown, MessageSquare, Briefcase } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { OpportunityTypeSelector } from '@/components/opportunities/opportunity-type-selector'
import Link from 'next/link'
import type { Locale } from '@/i18n-config'
import { useTranslations } from 'next-intl'

interface AddOpportunityButtonProps {
  locale: Locale
  className?: string
}

export function AddOpportunityButton({ locale, className }: AddOpportunityButtonProps) {
  const { hasRole, isAuthenticated, user } = useAuth()
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('modules.opportunities')
  
  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return (
      <Button asChild className={className}>
        <Link href={`/${locale}/auth/login?returnTo=${encodeURIComponent(pathname)}`}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addOpportunity', { defaultValue: 'Add Opportunity' })}
        </Link>
      </Button>
    )
  }
  
  // MEMBER+ users can create both types - show selector
  if (hasRole(UserRole.MEMBER)) {
    return (
      <>
        <Button 
          onClick={() => setShowTypeSelector(true)}
          className={className}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('addOpportunity', { defaultValue: 'Add Opportunity' })}
        </Button>
        
        {showTypeSelector && (
          <OpportunityTypeSelector
            onClose={() => setShowTypeSelector(false)}
            userRole="member"
            locale={locale}
          />
        )}
      </>
    )
  }
  
  // SUBSCRIBER users get type selector with upgrade flow for offers
  if (hasRole(UserRole.SUBSCRIBER)) {
    return (
      <>
        <Button 
          onClick={() => setShowTypeSelector(true)}
          className={className}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('addOpportunity', { defaultValue: 'Add Opportunity' })}
        </Button>
        
        {showTypeSelector && (
          <OpportunityTypeSelector
            onClose={() => setShowTypeSelector(false)}
            userRole="subscriber"
            locale={locale}
          />
        )}
      </>
    )
  }
  
  // VISITOR - redirect to registration
  return (
    <Button asChild className={className}>
      <Link href={`/${locale}/auth/register?returnTo=${encodeURIComponent(pathname)}`}>
        <Plus className="h-4 w-4 mr-2" />
        {t('addOpportunity', { defaultValue: 'Add Opportunity' })}
      </Link>
    </Button>
  )
}

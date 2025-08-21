'use client'

import { useAuth } from '@/hooks/use-auth'
import { UserRole } from '@/features/auth/types'
import { Button } from '@/components/ui/button'
import { Plus, Crown } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { MembershipUpgradeModal } from '@/components/membership/upgrade-modal'
import Link from 'next/link'
import type { Locale } from '@/i18n-config'
import { useTranslations } from 'next-intl'

interface AddEntityButtonProps {
  locale: Locale
  className?: string
}

export function AddEntityButton({ locale, className }: AddEntityButtonProps) {
  const { hasRole, isAuthenticated, user } = useAuth()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('modules.entities')
  
  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return (
      <Button asChild className={className}>
        <Link href={`/${locale}/auth/login?returnTo=${encodeURIComponent(pathname)}`}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addEntity')}
        </Link>
      </Button>
    )
  }
  
  // MEMBER+ users can directly add entities
  if (hasRole(UserRole.MEMBER)) {
    return (
      <Button asChild className={className}>
        <Link href={`/${locale}/entities/add`}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addEntity')}
        </Link>
      </Button>
    )
  }
  
  // SUBSCRIBER users see upgrade prompt
  if (hasRole(UserRole.SUBSCRIBER)) {
    return (
      <>
        <Button 
          onClick={() => setShowUpgradeModal(true)}
          className={className}
          variant="outline"
        >
          <Crown className="h-4 w-4 mr-2" />
          {t('addEntity')}
        </Button>
        
        {showUpgradeModal && (
          <MembershipUpgradeModal
            onClose={() => setShowUpgradeModal(false)}
            returnTo={`/${locale}/entities/add`}
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
        {t('addEntity')}
      </Link>
    </Button>
  )
}

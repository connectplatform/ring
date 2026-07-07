'use client'

// Import dependencies, hooks, and UI components
import { useAuth } from '@/hooks/use-auth' // MOCK CODE, TODO: Remove if useOptimizedSession supersedes this hook
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { Button } from '@/components/ui/button'
import { Plus, Crown } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { MembershipUpgradeModal } from '@/components/membership/upgrade-modal'
import Link from 'next/link'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { useTranslations } from 'next-intl'
import { useOptimizedSession } from '@/lib/hooks/use-optimized-session'

// TODO: If using React 19 and Next.js 16, prefer useOptimizedSession as Server Action/Async Server Component hooks when possible

interface AddEntityButtonProps {
  locale: Locale
  className?: string
}

export function AddEntityButton({ locale, className }: AddEntityButtonProps) {
  // Get authentication and user session states
  const { isAuthenticated, user: sessionUser } = useOptimizedSession()
  // TODO: Consider using React.useTransition for modal? Low-prio since MembershipUpgradeModal is client only.

  // Tracks if the upgrade modal should be visible for subscriber users
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Get current path for redirect purposes (e.g. after login or registering)
  const pathname = usePathname()

  // Hook to get localized translation function
  const t = useTranslations('modules.entities')
  
  // Defensive role assertion (returns safe enum value or fallback)
  const userRole = assertKnownUserRole(sessionUser?.role as UserRolesArray)
  
  /**
   * Not authenticated state:
   * - Button links to login page with returnTo so user navigates back after auth.
   */
  if (!isAuthenticated) {
    return (
      <Button asChild className={className}>
        <Link href={`${ROUTES.LOGIN(locale)}?returnTo=${encodeURIComponent(pathname)}`}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addMyEntity')}
        </Link>
      </Button>
    )
  }
  
  /**
   * MEMBER+ user (likely default paid/free tier):
   * - Directly links to add entity screen.
   */
  if (userRole === UserRolesArray.member) {
    return (
      <Button asChild className={className}>
        <Link href={`/${locale}/entities/add`}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addMyEntity')}
        </Link>
      </Button>
    )
  }
  
  /**
   * SUBSCRIBER user (e.g., allowed basic features, not entity adds).
   * - Show upgrade prompt modal on click, not navigation.
   */
  if (userRole === UserRolesArray.subscriber) {
    return (
      <>
        <Button 
          onClick={() => setShowUpgradeModal(true)}
          className={className}
          variant="outline"
        >
          <Crown className="h-4 w-4 mr-2" />
          {t('addMyEntity')}
        </Button>
        {/* Modal visible only when user clicked upgrade */}
        {showUpgradeModal && (
          <MembershipUpgradeModal
            onClose={() => setShowUpgradeModal(false)}
            returnTo={`/${locale}/entities/add`} // Keeps location context after successful upgrade
          />
        )}
      </>
    )
  }
  
  /**
   * VISITOR fallback (user does not match known roles or is "guest"):
   * - Button links to registration with return path.
   */
  return (
    <Button asChild className={className}>
      <Link href={`/${locale}/auth/register?returnTo=${encodeURIComponent(pathname)}`}>
        <Plus className="h-4 w-4 mr-2" />
        {t('addMyEntity')}
      </Link>
    </Button>
  )
  // TODO: When React 19 actions + Next.js 16 become project-wide, refactor navigation and modal state to use server actions and patterns like useOptimistic if actions are async.
}

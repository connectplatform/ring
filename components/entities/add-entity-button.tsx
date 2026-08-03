'use client'

import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { Button } from '@/components/ui/button'
import { Plus, Crown } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Link, toAppHref } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { useTranslations } from 'next-intl'
import { useOptimizedSession } from '@/lib/hooks/use-optimized-session'

interface AddEntityButtonProps {
  locale: Locale
  className?: string
}

/**
 * Add-entity CTA — all authenticated create intents go to `/entities/add`
 * (subscriber sees MemberUpgradeGate; member+ sees the form).
 */
export function AddEntityButton({ locale, className }: AddEntityButtonProps) {
  const { isAuthenticated, user: sessionUser } = useOptimizedSession()
  const pathname = usePathname()
  const t = useTranslations('modules.entities')
  const userRole = assertKnownUserRole(sessionUser?.role as UserRolesArray)

  if (!isAuthenticated) {
    return (
      <Button asChild className={className}>
        <Link
          href={toAppHref(
            `${ROUTES.LOGIN(locale)}?returnTo=${encodeURIComponent(pathname)}`,
          )}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('addMyEntity')}
        </Link>
      </Button>
    )
  }

  const isSubscriber = userRole === UserRolesArray.subscriber

  return (
    <Button asChild className={className} variant={isSubscriber ? 'outline' : 'default'}>
      <Link href="/entities/add">
        {isSubscriber ? (
          <Crown className="h-4 w-4 mr-2" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        {t('addMyEntity')}
      </Link>
    </Button>
  )
}

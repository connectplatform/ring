'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  hasRoleAtLeast,
  resolveSessionUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'

interface MessageUserButtonProps {
  targetUserId: string
  targetUserName?: string | null
  locale: Locale
  /** When false, hide (recipient opted out or blocked). Default true. */
  acceptProfileDms?: boolean
}

export function MessageUserButton({
  targetUserId,
  targetUserName,
  locale,
  acceptProfileDms = true,
}: MessageUserButtonProps) {
  const t = useTranslations('modules.messenger')
  const { data: session, status } = useSession()
  const router = useRouter()

  if (!acceptProfileDms) {
    return null
  }

  if (status !== 'authenticated' || !session?.user?.id) {
    return null
  }

  if (session.user.id === targetUserId) {
    return null
  }

  // Parity with ContactForm / submitDirectMessageContact — subscriber+
  if (
    !hasRoleAtLeast(
      resolveSessionUserRole(session.user.role as string),
      UserRolesArray.subscriber,
    )
  ) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="gap-2"
      onClick={() => {
        const base = ROUTES.MESSAGES(locale)
        router.push(`${base}?user=${encodeURIComponent(targetUserId)}`)
      }}
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      {t('messageUser', { name: targetUserName || t('messageUserFallback') })}
    </Button>
  )
}

'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

interface MessageUserButtonProps {
  targetUserId: string
  targetUserName?: string | null
  locale: Locale
}

export function MessageUserButton({
  targetUserId,
  targetUserName,
  locale,
}: MessageUserButtonProps) {
  const t = useTranslations('modules.messenger')
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status !== 'authenticated' || !session?.user?.id) {
    return null
  }

  if (session.user.id === targetUserId) {
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

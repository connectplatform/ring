'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Ban, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  blockUserById,
  unblockUserById,
} from '@/features/auth/services/user-blocklist'

type BlockUserButtonProps = {
  targetUserId: string
  initiallyBlocked: boolean
  className?: string
}

/** Toggle block for target user — hides contact CTAs after revalidate. */
export function BlockUserButton({
  targetUserId,
  initiallyBlocked,
  className,
}: BlockUserButtonProps) {
  const t = useTranslations('modules.profile')
  const router = useRouter()
  const [blocked, setBlocked] = useState(initiallyBlocked)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    if (pending) return
    startTransition(async () => {
      const result = blocked
        ? await unblockUserById(targetUserId)
        : await blockUserById(targetUserId)
      if (result.success) {
        setBlocked(!blocked)
        router.refresh()
      }
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      disabled={pending}
      onClick={toggle}
    >
      {blocked ? (
        <>
          <ShieldOff className="mr-1.5 size-3.5" aria-hidden />
          {t('unblockUser') || 'Unblock'}
        </>
      ) : (
        <>
          <Ban className="mr-1.5 size-3.5" aria-hidden />
          {t('blockUser') || 'Block'}
        </>
      )}
    </Button>
  )
}

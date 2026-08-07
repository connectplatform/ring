'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { challengeUserToGameAction } from '@/app/_actions/peer-games'
import { toast } from '@/hooks/use-toast'
import { usePeerGameBusy } from '../lib/peer-game-mutex'

/**
 * Play with me — openOrCreateDirect (via ConversationService dedupe) + createInvite.
 */
export function PublicPlayWithMe({
  targetUserId,
  slug,
  displayName,
}: {
  targetUserId: string
  slug: string
  displayName?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const gameBusy = usePeerGameBusy()

  return (
    <Button
      size="sm"
      disabled={pending || gameBusy}
      onClick={() => {
        startTransition(async () => {
          const result = await challengeUserToGameAction({ targetUserId, slug })
          if (!result.success || !result.sessionId) {
            toast({
              title: result.error ?? 'Challenge failed',
              variant: 'destructive',
            })
            return
          }
          toast({ title: `Challenge sent${displayName ? ` to ${displayName}` : ''}` })
          router.push({
            pathname: '/games/[slug]',
            params: { slug },
            query: { session: result.sessionId },
          })
        })
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Play with me'}
    </Button>
  )
}

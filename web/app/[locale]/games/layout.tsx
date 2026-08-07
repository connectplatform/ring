'use client'

import { IncomingGameBanner } from '@/features/peer-games/components/incoming-game-banner'
import { usePeerGameBusy } from '@/features/peer-games/lib/peer-game-mutex'

/**
 * Games layout — mounts IncomingGameBanner so challenges are heard outside /messages.
 */
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  const gameBusy = usePeerGameBusy()
  return (
    <>
      <IncomingGameBanner gameBusy={gameBusy} />
      {children}
    </>
  )
}

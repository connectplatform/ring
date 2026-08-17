'use client'

import { IncomingGameBanner } from '@/features/peer-games/components/incoming-game-banner'
import { usePeerGameBusy } from '@/features/peer-games/lib/peer-game-mutex'

/** App-wide game invite banner — Tunnel + FCM/RFC push emit. */
export function GlobalIncomingGameBanner() {
  const gameBusy = usePeerGameBusy()
  return <IncomingGameBanner gameBusy={gameBusy} />
}

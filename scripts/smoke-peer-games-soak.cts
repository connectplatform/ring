#!/usr/bin/env npx tsx
/**
 * Structural soak gate for Ring Peer Games P0 (peer_games_manual_e2e_qa).
 * Does not hit live DB — verifies wiring for Member enable → banner → moves → resign matrix.
 * Run: npx tsx scripts/smoke-peer-games-soak.cts
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('FAIL:', message)
    process.exit(1)
  }
}

const root = resolve(process.cwd())

function mustContain(rel: string, needle: string | RegExp) {
  const path = resolve(root, rel)
  assert(existsSync(path), `missing file ${rel}`)
  const text = readFileSync(path, 'utf8')
  const ok = typeof needle === 'string' ? text.includes(needle) : needle.test(text)
  assert(ok, `${rel} must include ${needle}`)
}

function mustNotContain(rel: string, needle: string) {
  const path = resolve(root, rel)
  assert(existsSync(path), `missing file ${rel}`)
  const text = readFileSync(path, 'utf8')
  assert(!text.includes(needle), `${rel} must NOT include ${needle}`)
}

// Titles
mustContain('features/peer-games/catalog.ts', 'tic-tac-toe')
mustContain('features/peer-games/catalog.ts', 'chess')
mustContain('features/peer-games/catalog.ts', 'checkers')

// Locale paths
assert(existsSync(resolve(root, 'app/[locale]/games/page.tsx')), 'missing /games page')
assert(existsSync(resolve(root, 'app/[locale]/games/[slug]/page.tsx')), 'missing /games/[slug]')
assert(existsSync(resolve(root, 'app/[locale]/(protected)/profile/games/page.tsx')), 'missing /profile/games')
assert(existsSync(resolve(root, 'app/[locale]/[username]/games/page.tsx')), 'missing /{username}/games')

// Enable → public list
mustContain('features/peer-games/service.ts', 'setUserEnabledGames')
mustContain('features/peer-games/service.ts', 'listPublicEnabledGamesForOwner')
mustContain('features/peer-games/service.ts', 'hasMemberPrivileges')

// Invite SSOT + atomicity (session before message)
mustContain('features/peer-games/service.ts', 'createInvite')
mustContain('features/peer-games/service.ts', 'createDoc')
mustContain('app/_actions/peer-games.ts', 'createInvite')
mustContain('app/api/conversations/[id]/game-invite/route.ts', 'createInvite')
mustContain('features/peer-games/service.ts', 'setNxPx')
mustContain('features/peer-games/service.ts', 'releaseNx')
mustContain('features/peer-games/service.ts', 'peer-game:invite:')
mustContain('lib/redis/set-nx.ts', 'setNxPx')

// Banner both surfaces
mustContain('features/messages/components/messages-shell.tsx', 'IncomingGameBanner')
mustContain('app/[locale]/games/layout.tsx', 'IncomingGameBanner')
mustContain('features/peer-games/components/incoming-game-banner.tsx', 'games:incoming')

// Moves + resign + locked metadata
mustContain('features/peer-games/service.ts', 'submitMove')
mustContain('features/peer-games/service.ts', 'resignSession')
mustContain('features/peer-games/service.ts', 'updateMessageLocked')
mustContain('features/peer-games/service.ts', 'game:move')

// Mutex (shared call + game)
mustContain('features/peer-games/lib/peer-game-mutex.ts', 'setPeerCallBusy')
mustContain('features/peer-games/lib/peer-game-mutex.ts', 'setPeerGameBusy')
mustContain('features/peer-games/lib/peer-game-mutex.ts', 'BroadcastChannel')
mustContain('features/peer-games/components/incoming-game-banner.tsx', 'usePeerCallBusy')
mustContain('features/chat/interactive/game-request-message-widget.tsx', 'usePeerCallBusy')
mustContain('features/messages/components/messages-shell.tsx', 'setPeerCallBusy')

// Interactive kit
mustContain('features/chat/lib/interactive-kind.ts', 'game_request')
mustContain('features/chat/components/interactive-registry.tsx', 'game_request')
mustContain('features/notifications/types.ts', 'GAME_REQUEST')

// Play-with-me gated on enabledSlugs
mustContain('app/_actions/peer-games.ts', 'listPublicEnabledGamesForOwner')

// Chess non-optimistic board remount
mustContain('features/peer-games/components/chess-board.tsx', 'key={fen}')
mustContain('features/peer-games/components/chess-board.tsx', 'return false')

// P1 ops
mustContain('lib/processes/registry.ts', 'peer-game-session-expiry')
mustContain('app/api/cron/peer-game-session-expiry/route.ts', 'peer-game-session-expiry')
mustContain('vercel.json', 'peer-game-session-expiry')
mustContain('features/peer-games/session-expiry.ts', 'reclaimOrphanPendingSessions')
mustContain('app/api/tunnel/subscribe/route.ts', 'getSessionForParticipant')
mustContain('features/peer-games/service.ts', 'NotificationType.GAME_REQUEST')
mustContain('features/peer-games/service.ts', 'isUserConnected')
mustContain('features/peer-games/hooks/use-peer-game-session.ts', 'game:expire')
mustContain('features/peer-games/components/incoming-game-banner.tsx', 'game:expire')
mustContain('features/peer-games/components/incoming-game-banner.tsx', 'game:accept')
mustContain('features/peer-games/components/incoming-game-banner.tsx', 'terminal')
mustContain('lib/tunnel/native-ws/attach.ts', 'getSessionForParticipant')
mustContain('locales/en/modules/games.json', 'tic-tac-toe')
mustContain('locales/uk/modules/games.json', 'catalog')
mustContain('lib/i18n/message-scopes.ts', 'modGames')
mustContain(
  '../infrastructure/k3s-or/ring-platform-org/cronjob-peer-game-session-expiry.yaml',
  'peer-game-session-expiry',
)
mustContain(
  '../infrastructure/k3s-or/ring-platform-org/cronjob-close-expired-polls.yaml',
  'close-expired-polls',
)

// P1 product
mustContain('features/peer-games/hooks/use-peer-game-datachannel.ts', 'ring-peer-game-moves')
mustContain('features/peer-games/hooks/use-peer-game-datachannel.ts', 'fetchIceServers')
mustContain('features/peer-games/plugins/checkers-logic.ts', 'validateCheckersMove')
mustContain('features/peer-games/hooks/use-telegram-games-back-button.ts', 'BackButton')
mustContain('components/navigation/sidebar-synced-layout.tsx', 'ROUTES.GAMES')

// No GameConductor invention
mustNotContain('features/peer-games/service.ts', 'class GameConductor')

console.log('PASS smoke-peer-games-soak (structural P0+P1 soak gate)')

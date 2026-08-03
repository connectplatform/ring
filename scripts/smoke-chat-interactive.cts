#!/usr/bin/env npx tsx
/**
 * Smoke: chat interactive Type Debt surfaces (no live DB — structural SSOT checks).
 * Run: npx tsx scripts/smoke-chat-interactive.cts
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('FAIL:', message)
    process.exit(1)
  }
}

// tsx may compile .cts as CJS — prefer process.cwd() (run from package root via run-all-smokes)
const root = resolve(process.cwd())

function mustContain(rel: string, needle: string | RegExp) {
  const path = resolve(root, rel)
  assert(existsSync(path), `missing file ${rel}`)
  const text = readFileSync(path, 'utf8')
  const ok = typeof needle === 'string' ? text.includes(needle) : needle.test(text)
  assert(ok, `${rel} must include ${needle}`)
}

mustContain('features/chat/lib/interactive-kind.ts', 'MESSAGE_TYPE_ALLOWLIST')
mustContain('features/chat/lib/interactive-kind.ts', 'dao_jar')
mustContain('features/chat/lib/interactive-kind.ts', 'game_request')
mustContain('features/chat/lib/interactive-kind.ts', 'product_card')
mustContain('features/chat/components/interactive-registry.tsx', 'game_request')
mustContain('features/chat/components/interactive-registry.tsx', 'product_card')
mustContain('features/chat/interactive/game-request-message-widget.tsx', 'GameRequestMessageWidget')
mustContain('features/chat/interactive/product-card-message-widget.tsx', 'ProductCardMessageWidget')
mustContain('features/chat/lib/product-card-marker.ts', 'parseProductCardMarkers')
mustContain('features/chat/lib/product-card-send.ts', 'sendProductCardsFromText')
mustContain('app/_actions/product-card.ts', 'createProductCardMessage')
mustContain('features/peer-games/service.ts', 'createInvite')
mustContain('features/notifications/types.ts', 'GAME_REQUEST')
mustContain('app/api/conversations/[id]/game-invite/route.ts', 'createInvite')
mustContain('features/chat/lib/refresh-open-dao-jar-messages.ts', 'refreshOpenDaoJarMessages')
mustContain('features/chat/lib/close-expired-polls.ts', 'closeExpiredPolls')
mustContain(
  'features/public-pools/services/public-pool-service.ts',
  'refreshOpenDaoJarMessages',
)
mustContain('components/docs/future-feature-widget.tsx', 'PostDaoJarToChatButton')
mustContain('app/[locale]/dao/dao-list-client.tsx', 'ShareToChatButton')
mustContain('app/[locale]/dao/dao-list-client.tsx', 'PostDaoJarToChatButton')
mustContain('features/chat/interactive/poll-compose-dialog.tsx', 'pollCloseAt')
mustContain('app/api/cron/close-expired-polls/route.ts', 'close-expired-polls')
mustContain('lib/processes/registry.ts', "'close-expired-polls'")
mustContain('vercel.json', 'close-expired-polls')
mustContain('features/chat/services/message-service.ts', 'updateMessageLocked')
mustContain('app/_actions/chat-poll.ts', 'updateMessageLocked')
mustContain('features/meetups/components/invite-meetup-rsvp-button.tsx', "targetType: 'meetup'")
mustContain('app/_actions/chat-rsvp.ts', 'createRsvpToContacts')
mustContain('app/api/meetups/route.ts', 'meetups')


// Money Tier B (TD-MONEY-01/02/03)
mustContain('lib/payments/conductor/types.ts', "'public_pool_contribution'")
mustContain('lib/payments/conductor/settle-public-pool-contribution.ts', 'settlePublicPoolCardContribution')
mustContain('app/api/public-pools/[slug]/card-checkout/route.ts', 'public_pool_contribution')
mustContain('features/public-pools/services/public-pool-service.ts', 'maybePayoutBuilderOnComplete')
mustContain('features/public-pools/lib/public-pool-escrow-gate.ts', 'isPublicPoolEscrowDeployed')
mustContain('programs/public-pool/README.md', 'Do we need a separate Solana contract')

mustContain('features/public-pools/lib/public-pool-desk-fx.ts', 'fiatMajorToNativeUi')
mustContain('features/public-pools/lib/public-pool-platform-fee.ts', 'resolveBuilderPlatformFeePercent')
mustContain('features/public-pools/components/pool-contribute-panel.tsx', 'PoolContributePanel')
mustContain('solana/programs/public-pool/src/lib.rs', 'finalize_success')
mustContain('features/public-pools/services/public-pool-service.ts', 'maybeAutoCompleteOnFunding')
mustContain('ring-config.json', 'platformFeePercentByRole')

console.log('PASS smoke-chat-interactive (structural Type Debt remediations)')

import 'server-only'

/**
 * Tunnel fan-out for custodial wallet list / native balances.
 *
 * Contract: publishToUserTunnel(userId, 'wallet:list', …)
 * Client: WalletListProvider subscribes via useTunnelChannel({ channel: 'wallet:list' }).
 * Payload is an invalidate signal — client re-fetches /api/wallet/list (DB cache TTL).
 */

import { publishToUserTunnel } from '@/lib/tunnel/publisher'
import { logger } from '@/lib/logger'

export type WalletListTunnelAction = 'updated' | 'refreshed' | 'provisioned'

export async function publishWalletListUpdate(
  userId: string,
  action: WalletListTunnelAction = 'updated',
): Promise<void> {
  try {
    await publishToUserTunnel(userId, 'wallet:list', {
      action,
      timestamp: Date.now(),
    })
  } catch (error) {
    logger.warn('publishWalletListUpdate failed', { userId, action, error })
  }
}

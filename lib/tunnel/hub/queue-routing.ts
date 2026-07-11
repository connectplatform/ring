/**
 * Offline user-queue routing — separates telemetry fan-out from UI side-effect channels.
 * @see lib/tunnel/SUBSCRIPTION-SSOT.md § Side-effect vs telemetry queues
 */

import { ACCOUNT_STATUS_TUNNEL_CHANNEL } from '@/lib/tunnel/account-status-channels'

/** Channels whose replay can trigger session/navigation side effects on the client. */
export const SIDE_EFFECT_USER_CHANNELS = new Set<string>([ACCOUNT_STATUS_TUNNEL_CHANNEL])

export type UserQueueKind = 'telemetry' | 'sideEffect' | 'general'

export function classifyUserQueueChannel(channel: string | undefined): UserQueueKind {
  if (!channel) return 'general'
  if (SIDE_EFFECT_USER_CHANNELS.has(channel)) return 'sideEffect'
  if (channel.startsWith('telemetry:')) return 'telemetry'
  return 'general'
}

/** Drop stale account-status replays that would cause refresh storms after offline backlog drain. */
export const SIDE_EFFECT_MAX_AGE_MS = 60_000

export function isSideEffectMessageFresh(messageAt: string | undefined): boolean {
  if (!messageAt) return true
  const ts = Date.parse(messageAt)
  if (Number.isNaN(ts)) return true
  return Date.now() - ts <= SIDE_EFFECT_MAX_AGE_MS
}

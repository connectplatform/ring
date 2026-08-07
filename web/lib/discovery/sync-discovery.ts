import 'server-only'

import { publishToChannel } from '@/lib/tunnel/publisher'
import { logger } from '@/lib/logger'

export type DiscoveryChannel = 'opportunities' | 'entities'

export type DiscoveryMutationEvent = 'created' | 'updated' | 'deleted' | 'status_changed'

const CHANNEL_EVENT_PREFIX: Record<DiscoveryChannel, string> = {
  opportunities: 'opportunity',
  entities: 'entity',
}

export function resolveDiscoveryTunnelEvent(
  channel: DiscoveryChannel,
  event: DiscoveryMutationEvent,
): string {
  const prefix = CHANNEL_EVENT_PREFIX[channel]
  if (event === 'deleted') return `${prefix}:deleted`
  if (event === 'created') return `${prefix}:created`
  return `${prefix}:updated`
}

/**
 * Shared Tunnel publish for post-mutation discovery sync.
 * Domain helpers (`syncOpportunityDiscovery`, `syncEntityDiscovery`) also handle
 * `revalidateTag` and `revalidatePath`; this module owns the realtime fan-out only.
 *
 * Optional `snippet` enables optimistic list/detail patches without a full reload.
 */
export async function syncDiscovery(params: {
  channel: DiscoveryChannel
  resourceId: string
  event: DiscoveryMutationEvent
  snippet?: Record<string, unknown> | null
}): Promise<void> {
  const { channel, resourceId, event, snippet } = params
  try {
    const tunnelEvent = resolveDiscoveryTunnelEvent(channel, event)
    const payload: Record<string, unknown> = { id: resourceId, event }
    if (snippet && typeof snippet === 'object') {
      payload.snippet = snippet
    }
    await publishToChannel(channel, tunnelEvent, payload)
  } catch (error) {
    logger.warn('syncDiscovery: tunnel publish failed', { channel, resourceId, event, error })
  }
}

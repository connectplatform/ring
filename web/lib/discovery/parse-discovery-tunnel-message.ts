/**
 * Map syncDiscovery tunnel messages to client update shapes.
 *
 * Server publishes:
 *   publishToChannel(channel, `${prefix}:created|updated|deleted`, { id, event, snippet? })
 */

import type { TunnelMessage } from '@/lib/tunnel/types'

/** Mirrors lib/discovery/sync-discovery — kept client-safe (no server-only import). */
export type DiscoveryMutationEvent = 'created' | 'updated' | 'deleted' | 'status_changed'

export type DiscoveryClientUpdateType = 'new' | 'updated' | 'deleted'

export interface DiscoveryClientUpdate {
  type: DiscoveryClientUpdateType
  resourceId: string
  event: DiscoveryMutationEvent
  /** Optional row patch from syncDiscovery — enables true optimistic UI. */
  snippet?: Record<string, unknown>
}

function normalizeEvent(
  message: TunnelMessage,
  payload: { id?: string; event?: string } | null | undefined,
): DiscoveryMutationEvent | null {
  const fromPayload = payload?.event
  if (
    fromPayload === 'created' ||
    fromPayload === 'updated' ||
    fromPayload === 'deleted' ||
    fromPayload === 'status_changed'
  ) {
    return fromPayload
  }

  const tunnelEvent = message.event ?? ''
  if (tunnelEvent.endsWith(':created')) return 'created'
  if (tunnelEvent.endsWith(':deleted')) return 'deleted'
  if (tunnelEvent.endsWith(':updated')) return 'updated'
  return null
}

export function parseDiscoveryTunnelMessage(
  message: TunnelMessage,
): DiscoveryClientUpdate | null {
  const payload = (message.payload ?? null) as {
    id?: string
    event?: string
    snippet?: Record<string, unknown>
  } | null
  const resourceId = typeof payload?.id === 'string' ? payload.id : null
  if (!resourceId) return null

  const event = normalizeEvent(message, payload)
  if (!event) return null

  const type: DiscoveryClientUpdateType =
    event === 'created' ? 'new' : event === 'deleted' ? 'deleted' : 'updated'

  const snippet =
    payload?.snippet && typeof payload.snippet === 'object' ? payload.snippet : undefined

  return { type, resourceId, event, ...(snippet ? { snippet } : {}) }
}

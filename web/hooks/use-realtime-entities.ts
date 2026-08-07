/**
 * Real-time Entities Hook
 * Subscribes to Tunnel `entities` discovery channel (mirrors opportunities).
 *
 * React 19.2: useEffectEvent for stable window listeners (no callback-deps churn).
 * useTunnelChannel already refs onTunnelMessage — no useCallback needed there.
 */

'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { useTunnel } from './use-tunnel'
import { useTunnelChannel } from './use-tunnel-channel'
import type { SerializedEntity } from '@/features/entities/types'
import type { TunnelMessage } from '@/lib/tunnel/types'
import { parseDiscoveryTunnelMessage } from '@/lib/discovery/parse-discovery-tunnel-message'

interface UseRealtimeEntitiesOptions {
  autoConnect?: boolean
  debug?: boolean
}

export interface EntityUpdate {
  type: 'new' | 'updated' | 'deleted'
  entityId: string
  data?: Partial<SerializedEntity>
}

export type EntityListApplyResult<T extends { id: string }> =
  | { kind: 'next'; entities: T[] }
  | { kind: 'needs_reload' }

/**
 * Pure list reducer for discovery tunnel events (shared by feed / confidential / my-entities).
 * Callers run `needs_reload` side effects outside setState.
 */
export function applyEntityListUpdate<T extends { id: string }>(
  prev: T[],
  update: EntityUpdate,
): EntityListApplyResult<T> {
  if (update.type === 'deleted') {
    return { kind: 'next', entities: prev.filter((e) => e.id !== update.entityId) }
  }

  if (update.data) {
    if (update.type === 'new') {
      if (prev.some((e) => e.id === update.entityId)) {
        return { kind: 'next', entities: prev }
      }
      return {
        kind: 'next',
        entities: [{ ...(update.data as unknown as T), id: update.entityId }, ...prev],
      }
    }
    return {
      kind: 'next',
      entities: prev.map((e) =>
        e.id === update.entityId ? ({ ...e, ...update.data } as T) : e,
      ),
    }
  }

  return { kind: 'needs_reload' }
}

export function useRealtimeEntities(options: UseRealtimeEntitiesOptions = {}) {
  const { autoConnect = true, debug = false } = options

  const tunnel = useTunnel({
    autoConnect,
    debug,
  })

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateHistory, setUpdateHistory] = useState<EntityUpdate[]>([])

  const onEntityMessage = useEffectEvent((message: TunnelMessage) => {
    const parsed = parseDiscoveryTunnelMessage(message)
    if (!parsed) return

    const update: EntityUpdate = {
      type: parsed.type,
      entityId: parsed.resourceId,
      ...(parsed.snippet
        ? { data: parsed.snippet as Partial<SerializedEntity> }
        : {}),
    }

    if (debug) {
      console.log('Received entity update:', update, message.event)
    }

    setLastUpdate(new Date())
    setUpdateHistory((prev) => [update, ...prev].slice(0, 10))

    window.dispatchEvent(
      new CustomEvent('entity-update', {
        detail: update,
      }),
    )
  })

  useTunnelChannel({
    channel: 'entities',
    enabled: autoConnect,
    onTunnelMessage: onEntityMessage,
  })

  return {
    isConnected: tunnel.isConnected,
    connectionState: tunnel.connectionState,
    provider: tunnel.provider,
    lastUpdate,
    updateHistory,
    latency: tunnel.latency,
    health: tunnel.health,
  }
}

export function useEntityUpdates(callback?: (update: EntityUpdate) => void) {
  const [lastUpdate, setLastUpdate] = useState<EntityUpdate | null>(null)

  const onUpdate = useEffectEvent((update: EntityUpdate) => {
    setLastUpdate(update)
    callback?.(update)
  })

  useEffect(() => {
    const handleUpdate = (event: CustomEvent<EntityUpdate>) => {
      onUpdate(event.detail)
    }

    window.addEventListener('entity-update', handleUpdate as EventListener)
    return () => {
      window.removeEventListener('entity-update', handleUpdate as EventListener)
    }
  }, [])

  return { lastUpdate }
}

/**
 * Optimistic splice for entity lists driven by discovery tunnel events.
 * `new` / `updated` without full `data` trigger `onNeedsReload` (list refetch).
 * Side effects (reload) run outside setState updaters — React 19 purity rule.
 */
export function useOptimisticEntities(
  initialEntities: SerializedEntity[],
  onRealtimeUpdate?: (update: EntityUpdate) => void,
  onNeedsReload?: () => void,
) {
  const [entities, setEntities] = useState(initialEntities)

  useEntityUpdates((update) => {
    if (update.type === 'deleted' || update.data) {
      setEntities((prev) => {
        const next = applyEntityListUpdate(prev, update)
        return next.kind === 'next' ? next.entities : prev
      })
    } else {
      onNeedsReload?.()
    }

    onRealtimeUpdate?.(update)
  })

  return {
    entities,
    setEntities,
  }
}

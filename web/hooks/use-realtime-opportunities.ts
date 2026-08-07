/**
 * Real-time Opportunities Hook
 * Integrates with tunnel transport for live updates on opportunities
 */

'use client'

import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { useTunnel } from './use-tunnel'
import { useTunnelChannel } from './use-tunnel-channel'
import { SerializedOpportunity } from '@/features/opportunities/types'
import type { TunnelMessage } from '@/lib/tunnel/types'
import { parseDiscoveryTunnelMessage } from '@/lib/discovery/parse-discovery-tunnel-message'

interface UseRealtimeOpportunitiesOptions {
  autoConnect?: boolean
  debug?: boolean
}

export interface OpportunityUpdate {
  type: 'new' | 'updated' | 'deleted' | 'application_count_changed'
  opportunityId: string
  data?: Partial<SerializedOpportunity>
}

/**
 * Pure list reducer for opportunity discovery tunnel events.
 * Skips merge when `data` is missing (avoids spreading undefined into rows).
 */
export function applyOpportunityListUpdate(
  prev: SerializedOpportunity[],
  update: OpportunityUpdate,
): SerializedOpportunity[] {
  switch (update.type) {
    case 'new':
      if (!update.data || prev.some((opp) => opp.id === update.opportunityId)) return prev
      return [update.data as SerializedOpportunity, ...prev]
    case 'updated':
    case 'application_count_changed':
      if (!update.data) return prev
      return prev.map((opp) =>
        opp.id === update.opportunityId ? { ...opp, ...update.data } : opp,
      )
    case 'deleted':
      return prev.filter((opp) => opp.id !== update.opportunityId)
    default:
      return prev
  }
}

export function useRealtimeOpportunities(options: UseRealtimeOpportunitiesOptions = {}) {
  const { autoConnect = true, debug = false } = options

  const tunnel = useTunnel({
    autoConnect,
    debug,
  })

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateHistory, setUpdateHistory] = useState<OpportunityUpdate[]>([])

  const onOpportunityMessage = useEffectEvent((message: TunnelMessage) => {
    // Prefer syncDiscovery shape ({ id, event } + message.event), fall back to legacy payload
    const parsed = parseDiscoveryTunnelMessage(message)
    let update: OpportunityUpdate | null = null

    if (parsed) {
      update = {
        type: parsed.type,
        opportunityId: parsed.resourceId,
        ...(parsed.snippet
          ? { data: parsed.snippet as Partial<SerializedOpportunity> }
          : {}),
      }
    } else {
      const legacy = message.payload as OpportunityUpdate | undefined
      if (legacy?.opportunityId && legacy?.type) {
        update = legacy
      }
    }

    if (!update) return

    if (debug) {
      console.log('Received opportunity update:', update)
    }

    setLastUpdate(new Date())
    setUpdateHistory((prev) => [update!, ...prev].slice(0, 10))

    window.dispatchEvent(
      new CustomEvent('opportunity-update', {
        detail: update,
      }),
    )
  })

  useTunnelChannel({
    channel: 'opportunities',
    enabled: autoConnect,
    onTunnelMessage: onOpportunityMessage,
  })

  const publishOpportunityUpdate = useCallback(async (update: OpportunityUpdate) => {
    if (!tunnel.isConnected) {
      console.warn('Cannot publish opportunity update: tunnel not connected')
      return
    }

    try {
      await tunnel.publish('opportunities', 'update', update)

      if (debug) {
        console.log('Published opportunity update:', update)
      }
    } catch (error) {
      console.error('Failed to publish opportunity update:', error)
    }
  }, [tunnel, debug])

  const notifyNewOpportunity = useCallback((opportunity: SerializedOpportunity) => {
    return publishOpportunityUpdate({
      type: 'new',
      opportunityId: opportunity.id,
      data: opportunity,
    })
  }, [publishOpportunityUpdate])

  const notifyOpportunityUpdate = useCallback((opportunityId: string, updates: Partial<SerializedOpportunity>) => {
    return publishOpportunityUpdate({
      type: 'updated',
      opportunityId,
      data: updates,
    })
  }, [publishOpportunityUpdate])

  const notifyOpportunityDeleted = useCallback((opportunityId: string) => {
    return publishOpportunityUpdate({
      type: 'deleted',
      opportunityId,
    })
  }, [publishOpportunityUpdate])

  const notifyApplicationCountChange = useCallback((opportunityId: string, newCount: number) => {
    return publishOpportunityUpdate({
      type: 'application_count_changed',
      opportunityId,
      data: { applicantCount: newCount },
    })
  }, [publishOpportunityUpdate])

  return {
    isConnected: tunnel.isConnected,
    connectionState: tunnel.connectionState,
    provider: tunnel.provider,
    lastUpdate,
    updateHistory,
    publishOpportunityUpdate,
    notifyNewOpportunity,
    notifyOpportunityUpdate,
    notifyOpportunityDeleted,
    notifyApplicationCountChange,
    latency: tunnel.latency,
    health: tunnel.health,
  }
}

/**
 * Hook for listening to opportunity updates in components
 * React 19.2: useEffectEvent keeps the listener mounted once (no callback-deps churn).
 */
export function useOpportunityUpdates(callback?: (update: OpportunityUpdate) => void) {
  const [lastUpdate, setLastUpdate] = useState<OpportunityUpdate | null>(null)

  const onUpdate = useEffectEvent((update: OpportunityUpdate) => {
    setLastUpdate(update)
    callback?.(update)
  })

  useEffect(() => {
    const handleUpdate = (event: CustomEvent<OpportunityUpdate>) => {
      onUpdate(event.detail)
    }

    window.addEventListener('opportunity-update', handleUpdate as EventListener)
    return () => {
      window.removeEventListener('opportunity-update', handleUpdate as EventListener)
    }
  }, [])

  return {
    lastUpdate,
  }
}

/**
 * Hook for optimistic updates on opportunity lists
 */
export function useOptimisticOpportunities(
  initialOpportunities: SerializedOpportunity[],
  onRealtimeUpdate?: (update: OpportunityUpdate) => void,
) {
  const [opportunities, setOpportunities] = useState(initialOpportunities)

  useOpportunityUpdates((update) => {
    setOpportunities((prev) => applyOpportunityListUpdate(prev, update))
    onRealtimeUpdate?.(update)
  })

  return {
    opportunities,
    setOpportunities,
  }
}

/**
 * Real-time Opportunities Hook
 * Integrates with tunnel transport for live updates on opportunities
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTunnel } from './use-tunnel'
import { useTunnelChannel } from './use-tunnel-channel'
import { SerializedOpportunity } from '@/features/opportunities/types'
import type { TunnelMessage } from '@/lib/tunnel/types'

interface UseRealtimeOpportunitiesOptions {
  autoConnect?: boolean
  debug?: boolean
}

interface OpportunityUpdate {
  type: 'new' | 'updated' | 'deleted' | 'application_count_changed'
  opportunityId: string
  data?: Partial<SerializedOpportunity>
}

export function useRealtimeOpportunities(options: UseRealtimeOpportunitiesOptions = {}) {
  const { autoConnect = true, debug = false } = options

  const tunnel = useTunnel({
    autoConnect,
    debug,
  })

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateHistory, setUpdateHistory] = useState<OpportunityUpdate[]>([])

  const handleOpportunityUpdate = useCallback((message: TunnelMessage) => {
    const update: OpportunityUpdate = message.payload as OpportunityUpdate

    if (debug) {
      console.log('Received opportunity update:', update)
    }

    setLastUpdate(new Date())

    setUpdateHistory((prev) => {
      const newHistory = [update, ...prev].slice(0, 10)
      return newHistory
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('opportunity-update', {
          detail: update,
        }),
      )
    }
  }, [debug])

  useTunnelChannel({
    channel: 'opportunities',
    enabled: autoConnect,
    onTunnelMessage: handleOpportunityUpdate,
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
 */
export function useOpportunityUpdates(callback?: (update: OpportunityUpdate) => void) {
  const [lastUpdate, setLastUpdate] = useState<OpportunityUpdate | null>(null)

  useEffect(() => {
    const handleUpdate = (event: CustomEvent<OpportunityUpdate>) => {
      setLastUpdate(event.detail)
      if (callback) {
        callback(event.detail)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('opportunity-update', handleUpdate as EventListener)

      return () => {
        window.removeEventListener('opportunity-update', handleUpdate as EventListener)
      }
    }
  }, [callback])

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
    setOpportunities((prev) => {
      switch (update.type) {
        case 'new':
          if (!prev.find((opp) => opp.id === update.opportunityId) && update.data) {
            return [update.data as SerializedOpportunity, ...prev]
          }
          return prev

        case 'updated':
          return prev.map((opp) =>
            opp.id === update.opportunityId ? { ...opp, ...update.data } : opp,
          )

        case 'deleted':
          return prev.filter((opp) => opp.id !== update.opportunityId)

        case 'application_count_changed':
          return prev.map((opp) =>
            opp.id === update.opportunityId ? { ...opp, ...update.data } : opp,
          )

        default:
          return prev
      }
    })

    if (onRealtimeUpdate) {
      onRealtimeUpdate(update)
    }
  })

  return {
    opportunities,
    setOpportunities,
  }
}

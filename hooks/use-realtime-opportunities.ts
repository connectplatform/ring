/**
 * Real-time Opportunities Hook
 * Integrates with tunnel transport for live updates on opportunities
 */

'use client'

import { useEffect, useCallback, useState } from 'react'
import { useTunnel } from './use-tunnel'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { TunnelMessage } from '@/lib/tunnel/types'

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
    debug
  })

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [updateHistory, setUpdateHistory] = useState<OpportunityUpdate[]>([])

  // Handle incoming opportunity updates
  const handleOpportunityUpdate = useCallback((message: TunnelMessage) => {
    const update: OpportunityUpdate = message.payload

    if (debug) {
      console.log('Received opportunity update:', update)
    }

    // Update last activity timestamp
    setLastUpdate(new Date())

    // Add to update history (keep last 10 updates)
    setUpdateHistory(prev => {
      const newHistory = [update, ...prev].slice(0, 10)
      return newHistory
    })

    // Emit custom event for components to listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('opportunity-update', {
        detail: update
      }))
    }
  }, [debug])

  // Subscribe to opportunity updates when connected
  useEffect(() => {
    if (!tunnel.isConnected) return

    const unsubscribe = tunnel.subscribe('opportunities', handleOpportunityUpdate)

    if (debug) {
      console.log('Subscribed to opportunities channel')
    }

    return unsubscribe
  }, [tunnel.isConnected, tunnel.subscribe, handleOpportunityUpdate, debug])

  // Publish opportunity update (for when local user creates/updates opportunities)
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

  // Helper functions for specific update types
  const notifyNewOpportunity = useCallback((opportunity: SerializedOpportunity) => {
    return publishOpportunityUpdate({
      type: 'new',
      opportunityId: opportunity.id,
      data: opportunity
    })
  }, [publishOpportunityUpdate])

  const notifyOpportunityUpdate = useCallback((opportunityId: string, updates: Partial<SerializedOpportunity>) => {
    return publishOpportunityUpdate({
      type: 'updated',
      opportunityId,
      data: updates
    })
  }, [publishOpportunityUpdate])

  const notifyOpportunityDeleted = useCallback((opportunityId: string) => {
    return publishOpportunityUpdate({
      type: 'deleted',
      opportunityId
    })
  }, [publishOpportunityUpdate])

  const notifyApplicationCountChange = useCallback((opportunityId: string, newCount: number) => {
    return publishOpportunityUpdate({
      type: 'application_count_changed',
      opportunityId,
      data: { applicantCount: newCount }
    })
  }, [publishOpportunityUpdate])

  return {
    // Connection status
    isConnected: tunnel.isConnected,
    connectionState: tunnel.connectionState,
    provider: tunnel.provider,

    // Real-time data
    lastUpdate,
    updateHistory,

    // Publishing functions
    publishOpportunityUpdate,
    notifyNewOpportunity,
    notifyOpportunityUpdate,
    notifyOpportunityDeleted,
    notifyApplicationCountChange,

    // Transport health
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
    lastUpdate
  }
}

/**
 * Hook for optimistic updates on opportunity lists
 */
export function useOptimisticOpportunities(
  initialOpportunities: SerializedOpportunity[],
  onRealtimeUpdate?: (update: OpportunityUpdate) => void
) {
  const [opportunities, setOpportunities] = useState(initialOpportunities)

  // Listen for real-time updates
  useOpportunityUpdates((update) => {
    setOpportunities(prev => {
      switch (update.type) {
        case 'new':
          // Add new opportunity at the beginning if it's not already there
          if (!prev.find(opp => opp.id === update.opportunityId) && update.data) {
            return [update.data as SerializedOpportunity, ...prev]
          }
          return prev

        case 'updated':
          // Update existing opportunity
          return prev.map(opp =>
            opp.id === update.opportunityId
              ? { ...opp, ...update.data }
              : opp
          )

        case 'deleted':
          // Remove opportunity
          return prev.filter(opp => opp.id !== update.opportunityId)

        case 'application_count_changed':
          // Update applicant count
          return prev.map(opp =>
            opp.id === update.opportunityId
              ? { ...opp, ...update.data }
              : opp
          )

        default:
          return prev
      }
    })

    // Call optional callback
    if (onRealtimeUpdate) {
      onRealtimeUpdate(update)
    }
  })

  return {
    opportunities,
    setOpportunities
  }
}

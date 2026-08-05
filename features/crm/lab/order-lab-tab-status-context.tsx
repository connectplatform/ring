'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { OrderLabTabId, OrderLabTabStatus } from '@/features/crm/lab/order-lab-tabs'

type TabStatusMap = Partial<Record<OrderLabTabId, OrderLabTabStatus>>

type OrderLabTabStatusContextValue = {
  statuses: TabStatusMap
  setTabStatus: (tabId: OrderLabTabId, status: OrderLabTabStatus) => void
  markTabError: (tabId: OrderLabTabId, error?: string) => void
  /** Bump so OrderLabHeroStats re-fetches consolidated /deployment/status */
  heroEpoch: number
  refreshHero: () => void
}

const OrderLabTabStatusContext = createContext<OrderLabTabStatusContextValue | null>(null)

export function OrderLabTabStatusProvider({
  initial,
  children,
}: {
  initial: TabStatusMap
  children: ReactNode
}) {
  const [statuses, setStatuses] = useState<TabStatusMap>(initial)
  const [heroEpoch, setHeroEpoch] = useState(0)

  const setTabStatus = useCallback((tabId: OrderLabTabId, status: OrderLabTabStatus) => {
    setStatuses((prev) => ({ ...prev, [tabId]: status }))
  }, [])

  const markTabError = useCallback((tabId: OrderLabTabId, error = 'panel_render_failed') => {
    setStatuses((prev) => {
      const cur = prev[tabId]
      return {
        ...prev,
        [tabId]: {
          status: 'error',
          missingRequired: cur?.missingRequired || [],
          missingRecommended: cur?.missingRecommended || [],
          errors: [...new Set([...(cur?.errors || []), error])],
        },
      }
    })
  }, [])

  const refreshHero = useCallback(() => {
    setHeroEpoch((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({ statuses, setTabStatus, markTabError, heroEpoch, refreshHero }),
    [statuses, setTabStatus, markTabError, heroEpoch, refreshHero],
  )

  return (
    <OrderLabTabStatusContext.Provider value={value}>
      {children}
    </OrderLabTabStatusContext.Provider>
  )
}

export function useOrderLabTabStatus() {
  const ctx = useContext(OrderLabTabStatusContext)
  if (!ctx) {
    throw new Error('useOrderLabTabStatus must be used within OrderLabTabStatusProvider')
  }
  return ctx
}

/** Optional hook for panels that may render outside the shell. */
export function useOptionalOrderLabTabStatus() {
  return useContext(OrderLabTabStatusContext)
}

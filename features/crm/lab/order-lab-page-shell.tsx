'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { LabPanelBoundary } from '@/features/crm/lab/lab-panel-boundary'
import { OrderLabHeroStats } from '@/features/crm/lab/order-lab-hero-stats'
import { OrderLabNavRail } from '@/features/crm/lab/order-lab-nav-rail'
import {
  OrderLabTabStatusProvider,
  useOrderLabTabStatus,
} from '@/features/crm/lab/order-lab-tab-status-context'
import {
  isOrderLabTabId,
  pickDefaultTab,
  tabsForRole,
  type OrderLabRole,
  type OrderLabTabId,
  type OrderLabTabStatus,
} from '@/features/crm/lab/order-lab-tabs'

export type OrderLabTabPanels = Partial<Record<OrderLabTabId, ReactNode>>

type OrderLabPageShellProps = {
  orderId: string
  role: OrderLabRole
  /** Server-computed initial chip colors */
  initialStatuses: Partial<Record<OrderLabTabId, OrderLabTabStatus>>
  /** Optional header above the hero (title, badges, back link) */
  header?: ReactNode
  /** Optional floating chat / extras outside the tab pane */
  extras?: ReactNode
  panels: OrderLabTabPanels
  /** Hide hero for buyer surfaces that don't need pod metrics */
  showHero?: boolean
}

function OrderLabPageShellInner({
  orderId,
  role,
  header,
  extras,
  panels,
  showHero = true,
}: Omit<OrderLabPageShellProps, 'initialStatuses'>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { statuses, markTabError } = useOrderLabTabStatus()
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const available = useMemo(() => tabsForRole(role).map((t) => t.id), [role])

  const tabFromUrl = searchParams.get('tab')
  const sourceParam = searchParams.get('source')
  const [hashHint, setHashHint] = useState<string | null>(null)
  const [hashReady, setHashReady] = useState(false)

  useEffect(() => {
    setHashHint(typeof window !== 'undefined' ? window.location.hash || null : null)
    setHashReady(true)
  }, [])

  const [activeTab, setActiveTabState] = useState<OrderLabTabId>(() => {
    if (isOrderLabTabId(tabFromUrl) && available.includes(tabFromUrl)) {
      return tabFromUrl
    }
    return pickDefaultTab(role, statuses, {
      sourceParam,
      hash: typeof window !== 'undefined' ? window.location.hash : null,
    })
  })

  // Honor ?source= / #project-config / #secrets when URL has no explicit ?tab=
  useEffect(() => {
    if (!hashReady || tabFromUrl) return
    const hinted = pickDefaultTab(role, statuses, { sourceParam, hash: hashHint })
    if (hinted !== activeTab && available.includes(hinted)) {
      setActiveTabState(hinted)
    }
  }, [hashReady, hashHint, sourceParam, tabFromUrl, role, statuses, activeTab, available])

  // Sync URL → state when deep-link ?tab= changes
  useEffect(() => {
    if (isOrderLabTabId(tabFromUrl) && available.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl)
    }
  }, [tabFromUrl, available, activeTab])

  const setActiveTab = useCallback(
    (id: OrderLabTabId) => {
      if (!available.includes(id)) return
      setActiveTabState(id)
      const next = new URLSearchParams(searchParams.toString())
      next.set('tab', id)
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [available, pathname, router, searchParams],
  )

  // Write ?tab= after hash is known so #project-config / ?source= win over status default
  useEffect(() => {
    if (!hashReady || tabFromUrl || !activeTab) return
    const next = new URLSearchParams(searchParams.toString())
    if (next.get('tab') === activeTab) return
    next.set('tab', activeTab)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [hashReady, tabFromUrl, activeTab, pathname, router, searchParams])

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rail = useMemo(
    () => (
      <OrderLabNavRail
        role={role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        statuses={statuses}
        onNavigate={closeRail}
      />
    ),
    [role, activeTab, setActiveTab, statuses, closeRail],
  )

  const panel = panels[activeTab]
  const boundaryLabel = `Order Lab · ${activeTab}`

  return (
    <RingRightRailLayout
      flushCenterPane
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      rightRail={rail}
      rightRailPurpose="order-lab"
      railWidth={280}
    >
      <DavinciCenterPane key={activeTab}>
        <div className="space-y-4 p-4 sm:p-6">
          {header}
          {showHero ? <OrderLabHeroStats orderId={orderId} /> : null}
          <LabPanelBoundary
            label={boundaryLabel}
            onError={() => markTabError(activeTab)}
          >
            {panel ?? (
              <p className="text-sm text-muted-foreground">
                No content for this tab.
              </p>
            )}
          </LabPanelBoundary>
        </div>
      </DavinciCenterPane>
      {extras}
    </RingRightRailLayout>
  )
}

/**
 * Shared Order Lab chrome: right-rail tabs + slim hero + Davinci center pane.
 * Role filters which tabs appear; panels map tab id → center content.
 */
export function OrderLabPageShell(props: OrderLabPageShellProps) {
  return (
    <OrderLabTabStatusProvider initial={props.initialStatuses}>
      <Suspense
        fallback={
          <div className="p-6 text-sm text-muted-foreground">Loading Order Lab…</div>
        }
      >
        <OrderLabPageShellInner
          orderId={props.orderId}
          role={props.role}
          header={props.header}
          extras={props.extras}
          panels={props.panels}
          showHero={props.showHero}
        />
      </Suspense>
    </OrderLabTabStatusProvider>
  )
}

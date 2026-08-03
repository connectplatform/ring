'use client'

import React, { useState, useEffect } from 'react'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { RingContentPanel } from '@/components/layout/ring-app-shell'
import {
  RING_FLUSH_CENTER_PANE_MOBILE,
} from '@/components/layout/center-pane-classes'
import { cn } from '@/lib/utils'

interface RingRightRailLayoutProps {
  children: React.ReactNode
  rightRail?: React.ReactNode
  /** When false, center content only (form/detail pages manage their own rail). */
  showRightRail?: boolean
  /** DaVinci immersive: strip default panel padding/bg so center pane fills edge-to-edge. */
  flushCenterPane?: boolean
  /**
   * Mobile/tablet right-rail presentation.
   * - overlay (default): FloatingSidebarToggle drawer (filters, wallet, etc.)
   * - consecutive: stack rail content below center pane (product details)
   */
  mobileRailMode?: 'overlay' | 'consecutive'

  // === SSOT dimension control (Phase 1 core) ===
  /** Right rail width in px. Defaults to 300. Use 320 for settings/notifications, 380 for cart. */
  railWidth?: number
  /** Additional classes for the rail aside (e.g. custom backgrounds, borders). */
  railClassName?: string

  className?: string
  contentClassName?: string
  isOpen?: boolean
  onToggle?: (isOpen: boolean) => void

  // === P1 Dynamic ParamSet for adaptive right rails (messenger, notifications, cart) ===
  /**
   * Semantic purpose of this right rail.
   * Consumers and future RailComposer use this to select/compose widgets and behaviors.
   * Examples:
   * - 'messenger': audience-tabs (Chats|Contacts|Offers) + roster or chat-info overlay
   * - 'notifications': unread list + detail routing
   * - 'cart': item roster (parallel to chats/contacts)
   */
  rightRailPurpose?: 'messenger' | 'notifications' | 'cart' | 'opportunities' | 'settings' | 'admin' | 'generic' | string

  /**
   * Declarative description of rail blocks (i18nized, param-driven).
   * This is the SSOT for what goes into the rail for a given purpose.
   * Actual rendering is provided via `rightRail` (or future <RightRailComposer rightRailContent={...} />).
   * Enables zero-dupe descriptions across clones and easy LegioX propagation.
   */
  rightRailContent?: Array<{
    id?: string
    /** e.g. 'title', 'audience-tabs', 'roster-dashboard', 'chat-info', 'cart-items', 'unread-notifications', 'matched-opportunities' */
    blockType: string
    /** Translation key or literal for headings (e.g. 'modules.messenger.title' or 'Messages') */
    i18nKey?: string
    /** Arbitrary params passed to the block/widget (locale-aware content, filters, selectedId, etc.) */
    params?: Record<string, any>
  }>

  /**
   * View configuration for responsive, overlay, and presentation modes.
   * - miniRail: 10% width avatar icon list on mobile (notifications/messages); narrow rail on desktop.
   * - overlayBottomPercent: e.g. 25 — chat-info overlays the tabs/roster from bottom of rail.
   * - hideOnMobileWhenSelected: auto-hide rail when item selected (center takes focus).
   */
  viewOptions?: {
    miniRail?: boolean
    overlayBottomPercent?: number
    compact?: boolean
    hideOnMobileWhenSelected?: boolean
    /** Optional: force specific mobile/tablet overlay widths when miniRail or special flows */
    mobileRailWidth?: string
    tabletRailWidth?: string
  }

  /**
   * Fine-grained control for the floating toggle (mobile/iPad) and rail visibility.
   * Mirrors and extends FloatingSidebarToggle props for per-purpose tuning.
   */
  toggleOptions?: {
    mobileWidth?: string
    tabletWidth?: string
    showFloatingButton?: boolean
    showControls?: boolean
    closeOnNavigate?: boolean
  }
}

/**
 * Layout component with a center panel and an optional right rail.
 * The right rail can be toggled on/off, and on mobile is accessed by a floating sidebar button.
 * - Avoids rendering the rail/children more than necessary (critical for perf and SSR).
 */
export default function RingRightRailLayout({
  children,
  rightRail,
  showRightRail = true,
  flushCenterPane = false,
  mobileRailMode = 'overlay',
  railWidth = 300,
  railClassName,
  className,
  contentClassName,
  isOpen: controlledIsOpen,
  onToggle,
  // P1 dynamic params (used by consumers / future composer; layout passes through)
  rightRailPurpose,
  rightRailContent,
  viewOptions,
  toggleOptions,
}: RingRightRailLayoutProps) {
  // Track if component has mounted, used to avoid hydration mismatches or SSR/CSR issues with width checks
  const [mounted, setMounted] = useState(false)

  // Internal open/close state (uncontrolled) for the right rail (used on mobile, but can be controlled by parent)
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  /**
   * If isOpen is specified by parent (controlled), use it;
   * otherwise fall back to internal state.
   */
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen

  /**
   * If a handler is provided by parent use it; otherwise set local state (uncontrolled).
   */
  const setIsOpen = onToggle ?? setInternalIsOpen

  useEffect(() => {
    setMounted(true)
    // Only set to true after client mounts to avoid issues with SSR/CSR
  }, [])

  // Only show right rail if explicitly allowed
  const rail = showRightRail ? rightRail : null

  // Effective rail width (number) + optional mini-rail override for special mobile flows
  const effectiveRailWidth = viewOptions?.miniRail ? 64 /* narrow icon rail */ : (railWidth ?? 300)

  // Toggle widths: prefer explicit toggleOptions, then viewOptions mobile/tablet, then sensible defaults per purpose
  const mobileW = toggleOptions?.mobileWidth ?? viewOptions?.mobileRailWidth ?? (viewOptions?.miniRail ? '10%' : '90%')
  const tabletW = toggleOptions?.tabletWidth ?? viewOptions?.tabletRailWidth ?? (viewOptions?.miniRail ? '12%' : '380px')

  // TODO: React 19 has the `use` Hook for Suspense data and improved async patterns.
  // Consider applying for data loading / deferring heavy content in rail if needed.
  // TODO: Next.js 16 introduces new Layouts API and Server Components.
  // This entire layout could become a server component (with SSR) with a client-only rail toggle.

  return (
    <div className={cn('min-h-full text-foreground relative transition-colors duration-300', className)}>
      {/* Main layout wrapper: min height full and flex in desktop */}
      <div className="min-h-full lg:flex lg:gap-3">
        <RingContentPanel
          className={cn(
            'relative min-h-full min-w-0 flex-1 px-1',
            'pb-[calc(var(--mobile-bottom-nav-h,3.5rem)+1.25rem)] md:px-5 md:pb-6 lg:px-6 lg:pb-0',
            // Flush always keeps mobile nav clearance (`!pb` beats flush `!p-0`).
            flushCenterPane && RING_FLUSH_CENTER_PANE_MOBILE,
            contentClassName,
          )}
        >
          {children}
          {/* Consecutive mobile: rail content after center pane (no floating drawer) */}
          {mounted && rail && mobileRailMode === 'consecutive' && (
            <div className="mt-8 space-y-4 border-t border-border/60 pt-6 lg:hidden">
              {rail}
            </div>
          )}
          {/* Overlay mobile/tablet: floating toggle drawer */}
          {mounted && rail && mobileRailMode === 'overlay' && (
            <div className="lg:hidden">
              <FloatingSidebarToggle
                isOpen={isOpen}
                onToggle={setIsOpen}
                mobileWidth={mobileW}
                tabletWidth={tabletW}
                showFloatingButton={toggleOptions?.showFloatingButton ?? true}
                showControls={toggleOptions?.showControls ?? true}
              >
                {rail}
              </FloatingSidebarToggle>
            </div>
          )}
        </RingContentPanel>

        {/* Desktop right rail: sticky, only after mount. Width driven by prop + viewOptions. */}
        {mounted && rail && (
          <aside
            className={cn(
              'ring-right-rail hidden shrink-0 self-stretch min-h-0 lg:block',
              railClassName
            )}
            style={{ width: effectiveRailWidth }}
            data-rail-purpose={rightRailPurpose}
            data-rail-content-count={rightRailContent?.length ?? 0}
          >
            <div className="sticky top-0 overflow-visible px-3 pt-4 pb-6 pr-4">{rail}</div>

            {/* Declarative content hint (for future <RightRailComposer /> or inspection/debug).
                Not rendered here; the concrete widgets are supplied via the rightRail prop by the wrapper.
                This makes the intent machine-readable for LegioX and propagation. */}
            {rightRailContent && rightRailContent.length > 0 && (
              <div className="sr-only" aria-hidden="true" data-right-rail-content={JSON.stringify(rightRailContent)} />
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

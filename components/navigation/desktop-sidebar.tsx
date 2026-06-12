'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useSidebarResize } from '@/hooks/use-sidebar-resize'
import { SidebarRail } from './sidebar-rail'
import { SidebarAside } from './sidebar-aside'
import { SidebarIdentityPanel } from './sidebar-identity-panel'
import { SidebarSyncedLayout } from './sidebar-synced-layout'
import { ChevronRight } from 'lucide-react'

interface DesktopSidebarProps {
  className?: string
  isAuthenticating?: boolean
}

export default function DesktopSidebar({ className }: DesktopSidebarProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const overlayMode = !isDesktop

  const {
    gridRef,
    asideContentRef,
    dragTriggerRef,
    collapsed,
    overlayOpen,
    setOverlayOpen,
    expand,
  } = useSidebarResize({ overlayMode })

  return (
    <>
      <div
        className={cn(
          'fixed z-40 hidden md:flex inset-y-0 left-0 h-[100dvh]',
          className,
        )}
      >
        <div
          ref={gridRef}
          data-grid
          className="relative flex h-full min-h-[100dvh] flex-col [--aside-width:var(--sidebar-aside-w)]"
          style={{ width: 'calc(var(--sidebar-rail-w) + clamp(0px, var(--sidebar-aside-w), 320px))' }}
        >
          {overlayMode ? (
            <div className="flex h-full w-16 shrink-0 flex-col rounded-none rounded-r-[12px] bg-[#090909] shadow-[0px_259px_103px_rgba(0,0,0,0.03),0px_146px_87px_rgba(0,0,0,0.09),0px_65px_65px_rgba(0,0,0,0.15),0px_16px_36px_rgba(0,0,0,0.17)]">
              <SidebarIdentityPanel variant="rail" />
              <SidebarRail
                overlayMode
                embedded
                onOpenAside={() => {
                  setOverlayOpen(true)
                  expand()
                }}
              />
            </div>
          ) : (
            <SidebarSyncedLayout asideContentRef={asideContentRef} className="min-h-0 flex-1" />
          )}

          {!overlayMode && (
            <div
              ref={dragTriggerRef}
              data-drag-trigger
              role="separator"
              aria-orientation="vertical"
              aria-valuemin={0}
              aria-valuemax={320}
              tabIndex={0}
              className="group absolute right-0 top-0 z-10 flex h-full w-2.5 cursor-ew-resize touch-none select-none items-center justify-center"
            >
              <div
                data-drag-indicator
                className="absolute left-1/2 top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/10 transition-colors group-hover:bg-foreground/20"
              />
            </div>
          )}

          {collapsed && !overlayMode && (
            <button
              type="button"
              onClick={() => expand()}
              className="absolute -right-3 top-1/2 z-50 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-[hsl(var(--app-panel))] shadow-md"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {overlayMode && overlayOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/20 md:block lg:hidden"
            aria-label="Close navigation panel"
            onClick={() => setOverlayOpen(false)}
          />
          <div className="fixed left-[var(--sidebar-rail-w)] inset-y-0 z-40 hidden h-[100dvh] w-[min(320px,calc(100vw-var(--sidebar-rail-w)))] md:block lg:hidden">
            <SidebarAside
              ref={asideContentRef}
              overlayMode
              showIdentityAside
              className="h-full border-r border-border/30 bg-[hsl(var(--app-canvas))] shadow-xl"
            />
          </div>
        </>
      )}
    </>
  )
}

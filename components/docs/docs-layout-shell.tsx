import type { ReactNode } from 'react'
import RightSidebar from '@/features/layout/components/right-sidebar'
import DocsNavigationTree from '@/components/docs/docs-navigation-tree'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { RingContentPanel } from '@/components/layout/ring-app-shell'

/** Left nav is the global `DesktopSidebar` from `Navigation` (fixed, 280px). This shell only reserves space + right TOC. */

interface DocsLayoutShellProps {
  children: ReactNode
  locale: string
}

export default async function DocsLayoutShell({ children, locale }: DocsLayoutShellProps) {
  return (
    <div className="min-h-full text-foreground">
      <div className="hidden min-h-full gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_270px] lg:pr-1">
        <RingContentPanel className="min-w-0 overflow-hidden">
          <main className="w-full">{children}</main>
        </RingContentPanel>

        <div className="min-w-0 py-5 pr-2">
          <RightSidebar title="Documentation">
            <DocsNavigationTree locale={locale} />
          </RightSidebar>
        </div>
      </div>

      <div className="hidden min-h-full md:block lg:hidden">
        <RingContentPanel className="min-h-full">
          <main className="w-full">{children}</main>

        <FloatingSidebarToggle>
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Documentation</h3>
            <DocsNavigationTree locale={locale} />
          </div>
        </FloatingSidebarToggle>
        </RingContentPanel>
      </div>

      <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:hidden">
        <RingContentPanel className="min-h-full">
          <main className="w-full">{children}</main>

        <FloatingSidebarToggle>
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Documentation</h3>
            <DocsNavigationTree locale={locale} />
          </div>
        </FloatingSidebarToggle>
        </RingContentPanel>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
import RightSidebar from '@/features/layout/components/right-sidebar'
import DocsSidebarControls from '@/components/docs/docs-sidebar-controls'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { RingContentPanel } from '@/components/layout/ring-app-shell'
import { DocsAudienceProvider } from '@/components/docs/docs-audience-context'
import { DocsPoolProvider } from '@/components/docs/docs-pool-context'

/** Left nav is the global `DesktopSidebar` from `Navigation` (fixed, 280px). This shell only reserves space + right TOC. */

interface DocsLayoutShellProps {
  children: ReactNode
  locale: string
}

/**
 * Docs chrome shell. Nav tree (FS) is dynamic-imported so the static module
 * graph for this file does not eagerly pull `docs-path` / `fs` into shared chunks.
 */
export default async function DocsLayoutShell({ children, locale }: DocsLayoutShellProps) {
  const { default: DocsNavigationTree } = await import(
    '@/components/docs/docs-navigation-tree'
  )

  return (
    <DocsAudienceProvider>
    <DocsPoolProvider>
    <div className="min-h-full text-foreground">
      <div className="hidden min-h-full gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_270px] lg:pr-1">
        <RingContentPanel className="min-w-0 overflow-hidden">
          <main className="w-full">{children}</main>
        </RingContentPanel>

        <div className="min-w-0 py-5 pr-2">
          <RightSidebar
            title="Documentation"
            actions={<DocsSidebarControls />}
            showControls={false}
          >
            <DocsNavigationTree locale={locale} />
          </RightSidebar>
        </div>
      </div>

      <div className="hidden min-h-full md:block lg:hidden">
        <RingContentPanel className="min-h-full">
          <main className="w-full">{children}</main>

        <FloatingSidebarToggle>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-lg">Documentation</h3>
              <DocsSidebarControls />
            </div>
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
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-lg">Documentation</h3>
              <DocsSidebarControls />
            </div>
            <DocsNavigationTree locale={locale} />
          </div>
        </FloatingSidebarToggle>
        </RingContentPanel>
      </div>
    </div>
    </DocsPoolProvider>
    </DocsAudienceProvider>
  )
}

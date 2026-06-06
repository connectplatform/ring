import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import RightSidebar from '@/features/layout/components/right-sidebar'
import DocsNavigationTree from '@/components/docs/docs-navigation-tree'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import BackBar from '@/components/common/back-bar'
import type { Locale } from '@/i18n/shared'

/** Left nav is the global `DesktopSidebar` from `Navigation` (fixed, 280px). This shell only reserves space + right TOC. */

interface DocsLayoutShellProps {
  children: ReactNode
  locale: string
}

export default async function DocsLayoutShell({ children, locale }: DocsLayoutShellProps) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const isDocsHub =
    pathname === `/${locale}/docs` ||
    pathname === `/${locale}/docs/` ||
    pathname === `/${locale}/docs/library` ||
    pathname === `/${locale}/docs/library/`
  const showBackBar = !isDocsHub

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop (lg+): reserve 280px for fixed app sidebar + main + right docs nav */}
      <div className="hidden lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_270px] lg:gap-6 lg:pl-[280px] lg:pr-4">
        <div className="w-full min-w-0 overflow-hidden">
          {showBackBar && (
            <BackBar
              href={`/${locale}/docs`}
              locale={locale as Locale}
              showOnDesktop={true}
            />
          )}
          <main className="min-h-screen w-full">{children}</main>
        </div>

        <div className="min-w-0">
          <RightSidebar title="Documentation">
            <DocsNavigationTree locale={locale} />
          </RightSidebar>
        </div>
      </div>

      {/* Tablet / iPad (md–lg): same 280px offset; docs TOC in floating panel */}
      <div className="hidden md:block lg:hidden min-h-screen pl-[280px] pr-4">
        {showBackBar && (
          <BackBar
            href={`/${locale}/docs`}
            locale={locale as Locale}
            showOnDesktop={true}
          />
        )}
        <main className="min-h-screen w-full">{children}</main>

        <FloatingSidebarToggle>
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Documentation</h3>
            <DocsNavigationTree locale={locale} />
          </div>
        </FloatingSidebarToggle>
      </div>

      {/* Mobile: one column; bottom nav + floating profile come from `Navigation` */}
      <div className="md:hidden pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        {showBackBar && (
          <BackBar
            href={`/${locale}/docs`}
            locale={locale as Locale}
            showOnDesktop={false}
          />
        )}
        <main className="min-h-screen w-full px-4">{children}</main>

        <FloatingSidebarToggle>
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Documentation</h3>
            <DocsNavigationTree locale={locale} />
          </div>
        </FloatingSidebarToggle>
      </div>
    </div>
  )
}

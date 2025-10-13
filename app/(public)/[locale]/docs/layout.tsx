import type { ReactNode } from 'react'
import DesktopSidebar from '@/features/layout/components/desktop-sidebar'
import RightSidebar from '@/features/layout/components/right-sidebar'
import DocsNavigationTree from './docs-navigation-tree'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import BackBar from '@/components/common/back-bar'
import type { Locale } from '@/i18n-config'

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <div className="min-h-screen bg-background">
      {/* Back Navigation Bar */}
      <BackBar
        href={`/${locale}/docs`}
        locale={locale as Locale}
        showOnDesktop={true}
      />

      {/* Desktop Layout - Hidden on mobile */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[280px_1fr_320px] gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Active Article */}
          <div>
            <main className="min-h-screen">
              {children}
            </main>
          </div>

          {/* Right Sidebar - Documentation Menu Tree */}
          <div>
            <RightSidebar title="Documentation">
              <DocsNavigationTree locale={locale} />
            </RightSidebar>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Full width content with floating sidebar toggle */}
      <div className="lg:hidden">
        <main className="min-h-screen w-full px-4">
          {children}
        </main>

        {/* Floating Sidebar Toggle for Documentation */}
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

import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
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
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  // Hide back bar on the library index page (it's the main docs hub)
  // Only show on article pages, not on the main docs library index
  const isLibraryIndex = pathname === '/docs/library' || pathname.endsWith('/docs/library')
  const showBackBar = !isLibraryIndex

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Layout (lg+) - Three columns: sidebar + content + right sidebar */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[280px_1fr_270px] gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Active Article */}
          <div className="w-full min-w-0 overflow-hidden">
            {/* Back Navigation Bar - Only show on article pages, not on library index */}
            {showBackBar && (
              <BackBar
                href={`/${locale}/docs/library`}
                locale={locale as Locale}
                showOnDesktop={true}
              />
            )}
            <main className="min-h-screen w-full">
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

      {/* Tablet/iPad Layout (md to lg) - Two columns: sidebar + content with floating toggle */}
      <div className="hidden md:block lg:hidden">
        <div className="flex flex-row gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div className="w-[280px] flex-shrink-0">
            <DesktopSidebar />
          </div>

          {/* Main Content - Active Article */}
          <div className="flex-1 w-full min-w-0 overflow-hidden">
            {/* Back Navigation Bar - Only show on article pages, not on library index */}
            {showBackBar && (
              <BackBar
                href={`/${locale}/docs/library`}
                locale={locale as Locale}
                showOnDesktop={true}
              />
            )}
            <main className="min-h-screen w-full">
              {children}
            </main>
          </div>
        </div>

        {/* Floating Sidebar Toggle for Documentation */}
        <FloatingSidebarToggle>
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Documentation</h3>
            <DocsNavigationTree locale={locale} />
          </div>
        </FloatingSidebarToggle>
      </div>

      {/* Mobile Layout (below md) - Full width content with floating sidebar toggle */}
      <div className="md:hidden">
        {/* Back Navigation Bar - Only show on article pages, not on library index */}
        {showBackBar && (
          <BackBar
            href={`/${locale}/docs/library`}
            locale={locale as Locale}
            showOnDesktop={false}
          />
        )}
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

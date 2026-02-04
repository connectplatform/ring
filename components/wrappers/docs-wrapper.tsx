'use client'

import React from 'react'
import { useLocale } from 'next-intl'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import RightSidebar from '@/features/layout/components/right-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import type { Locale } from '@/i18n-config'

interface DocsWrapperProps {
  children: React.ReactNode
  locale: Locale
}

export default function DocsWrapper({ children, locale }: DocsWrapperProps) {
  const currentLocale = useLocale()

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Layout - Account for fixed 280px sidebar, then content + right sidebar */}
      <div className="hidden lg:block" key={`desktop-${currentLocale}`}>
        {/* Fixed Left Sidebar - Navigation (280px, overlays on left) */}
        <DesktopSidebar key={`sidebar-${currentLocale}`} />

        {/* Main grid: Content + Right Sidebar (offset by 280px for fixed sidebar) */}
        <div className="grid grid-cols-[1fr_320px] gap-0 min-h-screen">
          {/* Main Content - Documentation */}
          <div className="pl-6 pr-6">
            {children}
          </div>

          {/* Right Sidebar - Documentation Navigation */}
          <RightSidebar key={`right-sidebar-${currentLocale}`}>
            <div>
              {/* Right sidebar content will be rendered by individual docs pages */}
            </div>
          </RightSidebar>
        </div>
      </div>

      {/* iPad Layout - Fixed sidebar + full-width content, hidden on mobile and desktop */}
      <div className="hidden md:block lg:hidden min-h-screen" key={`ipad-${currentLocale}`}>
        {/* Left Sidebar - Navigation (Fixed, overlays) */}
        <DesktopSidebar key={`sidebar-ipad-${currentLocale}`} />

        {/* Main Content - Documentation */}
        <div className="pl-6">
          {children}

          {/* Floating Sidebar Toggle for Navigation (iPad only) */}
          <FloatingSidebarToggle key={`toggle-ipad-${currentLocale}`}>
            <div>
              {/* Floating sidebar content will be rendered by individual docs pages */}
            </div>
          </FloatingSidebarToggle>
        </div>
      </div>

      {/* Mobile Layout - Single column, hidden on iPad and desktop */}
      <div className="md:hidden px-4" key={`mobile-${currentLocale}`}>
        {children}

        {/* Floating Sidebar Toggle for Navigation (Mobile only) */}
        <FloatingSidebarToggle key={`toggle-mobile-${currentLocale}`}>
          <div>
            {/* Floating sidebar content will be rendered by individual docs pages */}
          </div>
        </FloatingSidebarToggle>
      </div>
    </div>
  )
}

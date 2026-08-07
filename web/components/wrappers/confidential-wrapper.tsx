'use client'

/**
 * CONFIDENTIAL PAGE WRAPPER - Ring Platform v2.0
 * ==============================================
 * Universal 3-column responsive layout for confidential content pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Access Info
 * - Security
 * - Filters
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - Security Expert (confidential content handling)
 * - Privacy Specialist (access control UX)
 * - Content Strategy Expert (confidential content management)
 * - UI/UX Optimization Agent (mobile excellence)
 */

import React, { useState, useCallback, useMemo } from 'react'
import type { Locale } from '@/i18n/shared'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { ConfidentialSidebarContent } from '@/components/layout/rails/confidential-rail'

interface ConfidentialWrapperProps {
  children: React.ReactNode
  locale: Locale
  contentType?: 'entities' | 'opportunities'
}

export default function ConfidentialWrapper({
  children,
  locale,
  contentType = 'entities'
}: ConfidentialWrapperProps) {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rightRail = useMemo(
    () => (
      <ConfidentialSidebarContent
        locale={locale}
        contentType={contentType}
        onNavigate={closeRail}
      />
    ),
    [locale, contentType, closeRail],
  )

  return (
    <RingRightRailLayout
      rightRail={rightRail}
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      contentClassName="pb-24 lg:pb-8"
    >
      {children}
    </RingRightRailLayout>
  )
}

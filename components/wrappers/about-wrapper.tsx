'use client'

/**
 * ABOUT PAGE WRAPPER - Ring Platform v2.0
 * Right rail driven by ring-config.json sidebar section.
 * Migrated to RingRightRailLayout (railWidth=300).
 */

import React, { useState, useCallback, useMemo } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import AboutSidebarContent from '@/components/layout/rails/about-rail'
import type { Locale } from '@/i18n/shared'

interface AboutWrapperProps {
  children: React.ReactNode
  locale: Locale
  /**
   * @deprecated Always flush (`!p-0`) for DaVinci narrative bands — kept for call-site compat.
   */
  flush?: boolean
}

export default function AboutWrapper({ children, locale }: AboutWrapperProps) {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rightRail = useMemo(
    () => <AboutSidebarContent locale={locale} onNavigate={closeRail} />,
    [locale, closeRail],
  )

  return (
    <RingRightRailLayout
      rightRailPurpose="generic"
      rightRailContent={[
        { blockType: 'about-platform-info' },
        { blockType: 'about-quick-links' },
        { blockType: 'about-community' },
        { blockType: 'about-help' },
      ]}
      rightRail={rightRail}
      flushCenterPane
      contentClassName="pb-24 lg:pb-8"
      railWidth={300}
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
    >
      <DavinciCenterPane contentClassName="!p-0">
        {children}
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}

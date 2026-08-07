'use client'

import React, { useState, useCallback, useMemo } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { SettingsSidebarContent } from '@/components/layout/rails/settings-rail'
import type { Locale } from '@/i18n/shared'

interface SettingsWrapperProps {
  children: React.ReactNode
  locale: Locale
  userStats?: {
    accountAge: string
    lastLogin: string
    createdAt: string
    profileCompleteness: number
  }
}

export default function SettingsWrapper({
  children,
  locale,
  userStats
}: SettingsWrapperProps) {
  const [activeTab, setActiveTab] = useState('profile-settings')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rail = useMemo(
    () => (
      <SettingsSidebarContent
        locale={locale}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userStats={userStats}
        onNavigate={closeRail}
      />
    ),
    [locale, activeTab, userStats, closeRail],
  )

  return (
    <RingRightRailLayout
      flushCenterPane
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      rightRail={rail}
    >
      <DavinciCenterPane key={activeTab}>
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ activeTab: string; setActiveTab: (tab: string) => void; userStats?: { accountAge: string; lastLogin: string; createdAt: string; profileCompleteness: number } }>, { activeTab, setActiveTab, userStats })
          : children}
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}

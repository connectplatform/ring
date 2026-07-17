'use client'

/**
 * NOTIFICATIONS WRAPPER - Ring Platform v2.0
 * ==========================================
 * Standardized 3-column responsive layout for notification pages.
 *
 * Right Sidebar (via RingRightRailLayout railWidth=320):
 * - Title row (site-wide pattern)
 * - Settings link
 * - Focus / Quiet Hours toggles
 */

import React, { useState, useCallback, useMemo } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { NotificationsSidebarContent } from '@/components/layout/rails/notifications-rail'
import type { Locale } from '@/i18n/shared'

interface NotificationsWrapperProps {
  children: React.ReactNode
  locale: Locale
  /** Optional count of unread notifications to show in sidebar badge */
  unreadCount?: number
  /** Whether to show the full title row in the sidebar (default: true) */
  showTitleRow?: boolean
}

export default function NotificationsWrapper({
  children,
  locale,
  unreadCount = 0,
  showTitleRow = true,
}: NotificationsWrapperProps) {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [quietHours, setQuietHours] = useState(false)

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  const rightRail = useMemo(
    () => (
      <NotificationsSidebarContent
        locale={locale}
        unreadCount={unreadCount}
        showTitleRow={showTitleRow}
        focusMode={focusMode}
        quietHours={quietHours}
        onFocusModeChange={setFocusMode}
        onQuietHoursChange={setQuietHours}
        onNavigate={closeRail}
      />
    ),
    [locale, unreadCount, showTitleRow, focusMode, quietHours, closeRail],
  )

  return (
    <RingRightRailLayout
      rightRailPurpose="notifications"
      rightRailContent={[
        { blockType: 'notifications-title', i18nKey: 'notifications.pageTitle' },
        { blockType: 'notifications-settings' },
        { blockType: 'notifications-focus' },
      ]}
      viewOptions={{ overlayBottomPercent: 0 }}
      rightRail={rightRail}
      flushCenterPane
      contentClassName="pb-24 lg:pb-8"
      railWidth={320}
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
    >
      <DavinciCenterPane>
        {children}
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}

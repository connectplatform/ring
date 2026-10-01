'use client'

/**
 * NOTIFICATIONS WRAPPER - Ring Platform v2.0
 * ==========================================
 * Standardized 3-column responsive layout for notification pages.
 *
 * Right Sidebar (via RingRightRailLayout railWidth=320):
 * - Title row (site-wide pattern)
 * - Settings link
 * - Quiet Hours toggle (persisted via /api/notifications/preferences)
 */

import React, { useState, useCallback, useMemo } from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { NotificationsSidebarContent } from '@/components/layout/rails/notifications-rail'
import { useNotifications } from '@/hooks/use-notifications'
import type { Locale } from '@/i18n/shared'

interface NotificationsWrapperProps {
  children: React.ReactNode
  locale: Locale
  /** Whether to show the full title row in the sidebar (default: true) */
  showTitleRow?: boolean
}

export default function NotificationsWrapper({
  children,
  locale,
  showTitleRow = true,
}: NotificationsWrapperProps) {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  // Rail data — unread badge + persisted quiet-hours preference (no list fetch)
  const {
    unreadCount,
    preferences,
    updatePreferences,
    updatingPreferences,
  } = useNotifications({ autoRefresh: false, listEnabled: false })

  const quietHoursEnabled = preferences?.quietHours?.enabled ?? false

  const handleQuietHoursChange = useCallback(
    (value: boolean) => {
      void updatePreferences({
        quietHours: {
          enabled: value,
          startTime: preferences?.quietHours?.startTime || '22:00',
          endTime: preferences?.quietHours?.endTime || '08:00',
          timezone: preferences?.quietHours?.timezone || 'UTC',
        },
      })
    },
    [updatePreferences, preferences],
  )

  const rightRail = useMemo(
    () => (
      <NotificationsSidebarContent
        locale={locale}
        unreadCount={unreadCount}
        showTitleRow={showTitleRow}
        quietHours={quietHoursEnabled}
        onQuietHoursChange={handleQuietHoursChange}
        quietHoursUpdating={updatingPreferences}
        onNavigate={closeRail}
      />
    ),
    [locale, unreadCount, showTitleRow, quietHoursEnabled, handleQuietHoursChange, updatingPreferences, closeRail],
  )

  return (
    <RingRightRailLayout
      rightRailPurpose="notifications"
      rightRailContent={[
        { blockType: 'notifications-title', i18nKey: 'notifications.title' },
        { blockType: 'notifications-settings' },
        { blockType: 'notifications-quiet-hours' },
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

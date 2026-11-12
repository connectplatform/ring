'use client'

/**
 * NOTIFICATIONS WRAPPER - Ring Platform v2.0
 * ==========================================
 * Full-page layout for notification pages (2026-11-12 Emperor directive):
 * no right rail — the center pane spans the whole page on desktop.
 *
 * The page-level chrome lives in NotificationList itself (title row, stats,
 * refresh/settings controls); quiet-hours + preferences stay in
 * /settings/notifications (single source of truth).
 */

import React from 'react'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import type { Locale } from '@/i18n/shared'

interface NotificationsWrapperProps {
  children: React.ReactNode
  locale: Locale
  /** Kept for call-site compatibility (settings page passes it). */
  showTitleRow?: boolean
}

export default function NotificationsWrapper({
  children,
  showTitleRow: _showTitleRow = true,
}: NotificationsWrapperProps) {
  return (
    <DavinciCenterPane>
      {children}
    </DavinciCenterPane>
  )
}

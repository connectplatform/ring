'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Settings,
  Moon,
  Sun,
  BellOff,
  BellRing,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export interface NotificationsSidebarContentProps {
  locale: Locale
  unreadCount?: number
  showTitleRow?: boolean
  /** Quiet-hours preference (persisted server-side) */
  quietHours?: boolean
  onQuietHoursChange?: (value: boolean) => void
  quietHoursUpdating?: boolean
  onNavigate?: () => void
}

/**
 * Extracted Notifications right-rail content.
 * Title row lives here (site-wide pattern).
 * Used by notifications-wrapper via RingRightRailLayout (railWidth={320}).
 */
export function NotificationsSidebarContent({
  locale,
  unreadCount = 0,
  showTitleRow = true,
  quietHours = false,
  onQuietHoursChange,
  quietHoursUpdating = false,
  onNavigate,
}: NotificationsSidebarContentProps) {
  const router = useRouter()
  const t = useTranslations('modules.notifications')
  const tRail = useTranslations('modules.notifications.rail')

  const navigate = (path: string) => {
    router.push(path)
    onNavigate?.()
  }

  return (
    <div className="space-y-6">
      {/* Page Title Row — moved here from center pane (site-wide pattern) */}
      {showTitleRow && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5" aria-hidden />
              {t('title')}
            </h1>
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-2 tabular-nums">
                {unreadCount}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {tRail('subtitle')}
          </p>
        </div>
      )}

      <Separator />

      {/* Settings Button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" aria-hidden />
            {tRail('settingsTitle')}
          </CardTitle>
          <CardDescription className="text-xs">
            {tRail('settingsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate(ROUTES.NOTIFICATIONS_SETTINGS(locale))}
          >
            <Settings className="h-4 w-4 mr-2" aria-hidden />
            {tRail('openSettings')}
          </Button>
        </CardContent>
      </Card>

      {/* Quiet Hours Toggle (persisted via notification preferences) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Moon className="h-4 w-4" aria-hidden />
            {tRail('quietHours')}
          </CardTitle>
          <CardDescription className="text-xs">
            {tRail('quietHoursDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {quietHours ? (
                <BellRing className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
              <span className="text-sm">{tRail('quietHours')}</span>
            </div>
            <Switch
              checked={quietHours}
              onCheckedChange={onQuietHoursChange}
              disabled={quietHoursUpdating}
              aria-label={tRail('quietHours')}
            />
          </div>

          {quietHours && (
            <p className="text-xs text-muted-foreground italic">
              {tRail('quietHoursActiveHint')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

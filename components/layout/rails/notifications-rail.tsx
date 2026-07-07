'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Settings,
  Target,
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
import type { Locale } from '@/i18n/shared'

export interface NotificationsSidebarContentProps {
  locale: Locale
  unreadCount?: number
  showTitleRow?: boolean
  focusMode?: boolean
  quietHours?: boolean
  onFocusModeChange?: (value: boolean) => void
  onQuietHoursChange?: (value: boolean) => void
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
  focusMode = false,
  quietHours = false,
  onFocusModeChange,
  onQuietHoursChange,
  onNavigate,
}: NotificationsSidebarContentProps) {
  const router = useRouter()

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
              <Bell className="h-5 w-5" />
              Notifications
            </h1>
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Stay up to date with your activities
          </p>
        </div>
      )}

      <Separator />

      {/* Settings Button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Notification Settings
          </CardTitle>
          <CardDescription className="text-xs">
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate(`/${locale}/settings/notifications`)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Open Settings
          </Button>
        </CardContent>
      </Card>

      {/* Focus Mode Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Focus Mode
          </CardTitle>
          <CardDescription className="text-xs">
            Only show priority and important notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {focusMode ? (
                <BellRing className="h-4 w-4 text-primary" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Focus Mode</span>
            </div>
            <Switch
              checked={focusMode}
              onCheckedChange={onFocusModeChange}
              aria-label="Toggle focus mode"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {quietHours ? (
                <Moon className="h-4 w-4 text-primary" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Quiet Hours</span>
            </div>
            <Switch
              checked={quietHours}
              onCheckedChange={onQuietHoursChange}
              aria-label="Toggle quiet hours"
            />
          </div>

          {focusMode && (
            <p className="text-xs text-muted-foreground italic">
              Only priority notifications will be shown
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

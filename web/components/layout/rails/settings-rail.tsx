'use client'

import React from 'react'
import { useRouter } from '@/i18n/routing'
import { Settings, Lock, Bell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'

export interface SettingsSidebarContentProps {
  locale: Locale
  activeTab: string
  setActiveTab: (tab: string) => void
  userStats?: {
    accountAge: string
    lastLogin: string
    createdAt?: string
    profileCompleteness: number
  }
  onNavigate?: () => void
}

export interface SettingsMenuItem {
  id: string
  label: string
  icon: React.ElementType
}

/**
 * Settings sidebar nav rail — styled like profile-nav-rail.
 * Provides tab navigation for all settings sections.
 */
export function SettingsSidebarContent({
  locale,
  activeTab,
  setActiveTab,
  userStats,
  onNavigate,
}: SettingsSidebarContentProps) {
  const router = useRouter()
  const t = useTranslations('modules.settings.rail')
  const settingsMenuItems: SettingsMenuItem[] = [
    { id: 'profile-settings', label: t('overview'), icon: Settings },
    { id: 'privacy', label: t('privacy'), icon: Lock },
    { id: 'preferences', label: t('notifications'), icon: Bell },
  ]

  const handleSelect = (tabId: string) => {
    setActiveTab(tabId)
    onNavigate?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-2">
      {/* Settings Navigation */}
      <div className="mb-4">
        <div className="px-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => router.push(`/${locale}/profile` as any)}
          >
            <User className="mr-2 h-4 w-4" />
            {t('profile')}
          </Button>
        </div>
      </div>

      {/* Settings Navigation */}
      <div className="mb-4">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('sections')}
        </div>
        <div className="flex flex-col gap-2 px-3">
          {settingsMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                activeTab === item.id
                  ? 'bg-primary text-primary-foreground'
                  : cn(davinciGlassSurface, 'text-muted-foreground hover:text-foreground'),
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

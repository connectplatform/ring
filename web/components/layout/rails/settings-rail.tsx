'use client'

import React from 'react'
import { useRouter } from '@/i18n/routing'
import {
  Settings,
  Lock,
  Bell,
  Award,
  Sparkles,
  TrendingUp,
  User,
  ArrowLeft,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
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
  const settingsMenuItems: SettingsMenuItem[] = [
    { id: 'profile-settings', label: 'Overview', icon: Settings },
    { id: 'privacy', label: 'Privacy & Consent', icon: Lock },
    { id: 'preferences', label: 'Notifications & AI', icon: Bell },
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
            Profile
          </Button>
        </div>
      </div>

      {/* Settings Navigation */}
      <div className="mb-4">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings Sections
        </div>
        <div className="flex flex-col gap-2 px-3">
          {settingsMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex w-full items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-accent hover:text-foreground'
              }`}
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

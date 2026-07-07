'use client'

import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Award,
  MessageSquare,
  Phone,
  Send,
  Shield,
  Edit2,
  Settings,
  LogOut,
  Wallet,
  ExternalLink,
} from 'lucide-react'

export interface ProfileMenuItem {
  id: string
  label: string
  icon: LucideIcon
}

interface ProfileNavRailProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  profileMenuItems: ProfileMenuItem[]
  profileCompletion: number
  communicationsForm: {
    telegramUsername?: string
    whatsappNumber?: string
  }
  kycStatus: string
  user: Record<string, unknown>
  onNavigate?: () => void
  /** Edit Profile: trigger inline edit mode */
  onEditProfile?: () => void
  /** Navigate to /settings page */
  onNavigateSettings?: () => void
  /** Sign out */
  onSignOut?: () => void
}

export default function ProfileNavRail({
  activeTab,
  setActiveTab,
  profileMenuItems,
  profileCompletion,
  communicationsForm,
  kycStatus,
  user,
  onNavigate,
  onEditProfile,
  onNavigateSettings,
  onSignOut,
}: ProfileNavRailProps) {
  const t = useTranslations('modules.profile')

  const phoneNumber = (user as { phoneNumber?: string | null }).phoneNumber

  const potentialRing =
    700 -
    (communicationsForm.telegramUsername ? 50 : 0) -
    (communicationsForm.whatsappNumber ? 50 : 0) -
    (phoneNumber ? 100 : 0) -
    (kycStatus === 'approved' ? 500 : 0)

  const handleSelect = (tabId: string) => {
    setActiveTab(tabId)
    onNavigate?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-2">
      {/* Profile Navigation Sections */}
      <div className="mb-4">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('profileSections')}
        </div>
        <div className="flex flex-col gap-2 px-3">
          {profileMenuItems.map((item) => (
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

      {/* Quick Actions */}
      <div className="mb-4">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </div>
        <div className="flex flex-col gap-2 px-3">
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              onEditProfile?.()
              onNavigate?.()
            }}
          >
            <Edit2 className="mr-2 h-4 w-4" />
            {t('editProfile')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              onNavigateSettings?.()
              onNavigate?.()
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              setActiveTab('wallet')
              onNavigate?.()
            }}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Wallet
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              onSignOut?.()
              onNavigate?.()
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('signOut')}
          </Button>
        </div>
      </div>
    </div>
  )
}

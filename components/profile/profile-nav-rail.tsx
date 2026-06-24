'use client'

import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Award,
  MessageSquare,
  Phone,
  Send,
  Shield,
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
      <div className="mb-6 rounded-lg border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-primary/10 to-purple-500/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            <span className="text-sm font-bold">{t('earnRing')}</span>
          </div>
          <Badge
            variant="default"
            className="border-yellow-500/30 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
          >
            💰
          </Badge>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-2xl font-bold text-transparent">
            {profileCompletion}%
          </span>
          <Badge variant="secondary" className="text-xs">
            {profileCompletion === 100 ? `✨ ${t('maxRewards')}` : `⭐ ${t('keepGoing')}`}
          </Badge>
        </div>
        <Progress value={profileCompletion} className="mb-4 h-2" />

        <div className="space-y-2 text-xs">
          <div className="mb-2 font-medium text-muted-foreground">{t('completeToEarn')}:</div>

          {!communicationsForm.telegramUsername && (
            <div className="flex items-center justify-between rounded border border-border/50 bg-background/50 p-2 transition-colors hover:border-yellow-500/30">
              <div className="flex items-center gap-2">
                <Send className="h-3 w-3 text-blue-500" />
                <span>{t('addTelegram')}</span>
              </div>
              <Badge variant="outline" className="border-yellow-500/30 text-xs text-yellow-600">
                +5
              </Badge>
            </div>
          )}

          {!communicationsForm.whatsappNumber && (
            <div className="flex items-center justify-between rounded border border-border/50 bg-background/50 p-2 transition-colors hover:border-yellow-500/30">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-green-500" />
                <span>{t('addWhatsApp')}</span>
              </div>
              <Badge variant="outline" className="border-yellow-500/30 text-xs text-yellow-600">
                +5
              </Badge>
            </div>
          )}

          {!phoneNumber && (
            <div className="flex items-center justify-between rounded border border-border/50 bg-background/50 p-2 transition-colors hover:border-yellow-500/30">
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-purple-500" />
                <span>{t('addPhone')}</span>
              </div>
              <Badge variant="outline" className="border-yellow-500/30 text-xs text-yellow-600">
                +10
              </Badge>
            </div>
          )}

          {kycStatus !== 'approved' && (
            <div className="flex items-center justify-between rounded border border-border/50 bg-background/50 p-2 transition-colors hover:border-yellow-500/30">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-red-500" />
                <span>{t('completeKyc')}</span>
              </div>
              <Badge variant="outline" className="border-yellow-500/30 text-xs text-yellow-600">
                +50
              </Badge>
            </div>
          )}
        </div>

        {profileCompletion < 100 && (
          <div className="mt-3 border-t border-yellow-500/20 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t('potentialEarnings')}:</span>
              <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-sm font-bold text-transparent">
                {potentialRing} RING
              </span>
            </div>
          </div>
        )}
      </div>

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
    </div>
  )
}

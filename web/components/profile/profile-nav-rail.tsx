'use client'

import type { LucideIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, toAppHref } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import {
  Edit2,
  Settings,
  LogOut,
  Wallet,
  Share2,
  Music2,
  Images,
  HardDrive,
  Gamepad2,
  FolderOpen,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export interface ProfileMenuItem {
  id: string
  label: string
  icon: LucideIcon
}

/**
 * DEAD_PROPS_LEDGER (trimmed 2026-07-16 from ProfileNavRailProps):
 * - profileCompletion: number — never rendered in this rail (was passed from
 *   profile-content.calculateProfileCompletion). Reapply if rail gets a progress
 *   meter; currently SSOT for quest progress is UserProgressWidget.
 * - communicationsForm: { telegramUsername?, whatsappNumber? } — never read;
 *   was likely intended for quick-status badges. Communications tab owns the form.
 * - kycStatus: string — never read; verification tab + UserProgressWidget own KYC.
 * - user: Record<string, unknown> — never read; identity lives in profile hero.
 */
interface ProfileNavRailProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  profileMenuItems: ProfileMenuItem[]
  onNavigate?: () => void
  onEditProfile?: () => void
  onNavigateSettings?: () => void
  onSignOut?: () => void
  /** Public username for Player / Gallery quick links */
  username?: string | null
}

export default function ProfileNavRail({
  activeTab,
  setActiveTab,
  profileMenuItems,
  onNavigate,
  onEditProfile,
  onNavigateSettings,
  onSignOut,
  username,
}: ProfileNavRailProps) {
  const t = useTranslations('modules.profile')
  const tNav = useTranslations('navigation')
  const locale = useLocale() as Locale

  const handleSelect = (tabId: string) => {
    setActiveTab(tabId)
    onNavigate?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-2">
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

      <div className="mb-4">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('quickActions')}
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
            {t('settings')}
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" asChild>
            <Link
              href={toAppHref(ROUTES.WALLET(locale))}
              onClick={() => onNavigate?.()}
            >
              <Wallet className="mr-2 h-4 w-4" />
              {t('wallet')}
            </Link>
          </Button>
          {username ? (
            <>
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link
                  href={toAppHref(ROUTES.PUBLIC_PROFILE_PLAYER(username, locale))}
                  onClick={() => onNavigate?.()}
                >
                  <Music2 className="mr-2 h-4 w-4" />
                  Player
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link
                  href={toAppHref(ROUTES.PUBLIC_PROFILE_GAMES(username, locale))}
                  onClick={() => onNavigate?.()}
                >
                  <Gamepad2 className="mr-2 h-4 w-4" />
                  Games
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link
                  href={toAppHref(ROUTES.PUBLIC_PROFILE_IMG(username, locale))}
                  onClick={() => onNavigate?.()}
                >
                  <Images className="mr-2 h-4 w-4" />
                  Gallery
                </Link>
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" className="w-full justify-start" asChild>
            <Link
              href={toAppHref(ROUTES.FILE_CABINET(locale))}
              onClick={() => onNavigate?.()}
            >
              <HardDrive className="mr-2 h-4 w-4" />
              File Cabinet
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" asChild>
            <Link
              href={toAppHref(ROUTES.PROFILE_SHARED(locale))}
              onClick={() => onNavigate?.()}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Shared
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" asChild>
            <Link
              href={toAppHref(ROUTES.REFCODES(locale))}
              onClick={() => onNavigate?.()}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {tNav('refcodes')}
            </Link>
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

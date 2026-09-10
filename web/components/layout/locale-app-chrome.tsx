import React from 'react'
import { NotificationProvider } from '@/features/notifications/components/notification-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import Navigation from '@/components/navigation/navigation'
import { HreflangLinks } from '@/components/seo/hreflang-links'
import { AppContentShell } from '@/components/layout/ring-app-shell'
import { ReferralAttributionEffect } from '@/components/refcodes/referral-attribution-effect'
import { CreditRewardReceivedListener } from '@/features/wallet/components/credit-reward-received-listener'
import { GlobalTunnelListeners } from '@/components/providers/global-tunnel-listeners'
import { DocumentHtmlLang } from '@/components/layout/document-html-lang'
import { getBrandName } from '@/lib/site-branding'
import { isCreditRewardsEnabled } from '@/lib/ring-config-core'
import { getUserOnboardingPendingSegments } from '@/features/onboarding/server'
import { UserOnboardingGate } from '@/features/onboarding/components/user-onboarding-gate'
import type { Locale } from '@/i18n/shared'

export interface LocaleAppChromeProps {
  locale: Locale
  messages: Record<string, unknown>
  hreflangPath?: string
  showReferralAttribution?: boolean
  /** Minimal shell for suspended-account flows (no main navigation). */
  variant?: 'full' | 'minimal'
  children: React.ReactNode
}

/**
 * Single locale shell — I18n, notifications, navigation, content frame.
 * Mounted once per [locale] segment; auth guards live in nested layouts only.
 */
export async function LocaleAppChrome({
  locale,
  messages,
  hreflangPath,
  showReferralAttribution = true,
  variant = 'full',
  children,
}: LocaleAppChromeProps) {
  // Pending user-segment onboarding for clones that set
  // user.requiredProfileFields (empty = no gate). Guests / satisfied users get [].
  const pendingOnboardingSegments =
    variant === 'full' ? await getUserOnboardingPendingSegments() : []

  return (
    <I18nProvider locale={locale} messages={messages}>
      <DocumentHtmlLang />
      {hreflangPath != null ? <HreflangLinks pathname={hreflangPath} /> : null}
      <NotificationProvider>
        {/* Must sit under NextIntlClientProvider — banners use useTranslations + next-intl router. */}
        <GlobalTunnelListeners />
        {isCreditRewardsEnabled() ? <CreditRewardReceivedListener /> : null}
        <UserOnboardingGate
          pendingSegments={pendingOnboardingSegments}
          locale={locale}
        />
        {showReferralAttribution && variant === 'full' ? <ReferralAttributionEffect /> : null}
        {variant === 'minimal' ? (
          <div className="flex min-h-screen flex-col bg-background">
            <header className="border-b px-6 py-4">
              <span className="text-sm font-semibold tracking-tight">{getBrandName()}</span>
            </header>
            <main className="flex flex-1 items-center justify-center p-6">{children}</main>
          </div>
        ) : (
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <main className="flex-grow md:pl-(--sidebar-total-w)">
              <AppContentShell>{children}</AppContentShell>
            </main>
          </div>
        )}
      </NotificationProvider>
    </I18nProvider>
  )
}

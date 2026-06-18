import React from 'react'
import { NotificationProvider } from '@/features/notifications/components/notification-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import Navigation from '@/components/navigation/navigation'
import { HreflangLinks } from '@/components/seo/hreflang-links'
import { AppContentShell } from '@/components/layout/ring-app-shell'
import { ReferralAttributionEffect } from '@/components/refcodes/referral-attribution-effect'
import type { Locale } from '@/i18n/shared'

export interface LocaleAppChromeProps {
  locale: Locale
  messages: Record<string, unknown>
  hreflangPath?: string
  showReferralAttribution?: boolean
  children: React.ReactNode
}

/**
 * Single locale shell — I18n, notifications, navigation, content frame.
 * Mounted once per [locale] segment; auth guards live in nested layouts only.
 */
export function LocaleAppChrome({
  locale,
  messages,
  hreflangPath,
  showReferralAttribution = true,
  children,
}: LocaleAppChromeProps) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      {hreflangPath != null ? <HreflangLinks pathname={hreflangPath} /> : null}
      <NotificationProvider>
        {showReferralAttribution ? <ReferralAttributionEffect /> : null}
        <div className="flex flex-col min-h-screen">
          <Navigation />
          <main className="flex-grow md:pl-(--sidebar-total-w)">
            <AppContentShell>{children}</AppContentShell>
          </main>
        </div>
      </NotificationProvider>
    </I18nProvider>
  )
}

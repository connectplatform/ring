'use client'

import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import type { Locale } from '@/i18n/shared'

export type LoginWidgetProps = {
  from?: string
  locale?: Locale
  /** Fired when the user picks a provider (parent should close the FsModal). */
  onAuthAction?: () => void
}

/**
 * Login widget — Google / Telegram / Apple / wallet / email-or-phone.
 * Used inside FsModal from unauthenticated mobile overflow (Login tab).
 */
export function LoginWidget({ from, locale, onAuthAction }: LoginWidgetProps) {
  return (
    <UnifiedLoginInline
      from={from}
      locale={locale}
      variant="default"
      onAuthAction={onAuthAction}
    />
  )
}

export default LoginWidget

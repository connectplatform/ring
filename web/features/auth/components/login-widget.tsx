'use client'

import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import type { Locale } from '@/i18n/shared'

export type LoginWidgetProps = {
  from?: string
  locale?: Locale
  /** Fired when the user picks a provider (parent should close the FsModal). */
  onAuthAction?: () => void
  /** Mobile login sheet: controls size to their labels instead of the pane. */
  variant?: 'default' | 'sheet'
}

/**
 * Login widget — Google / Telegram / Apple / wallet / email-or-phone.
 * Used inside FsModal from unauthenticated mobile overflow (Login tab).
 */
export function LoginWidget({ from, locale, onAuthAction, variant = 'default' }: LoginWidgetProps) {
  return (
    <UnifiedLoginInline
      from={from}
      locale={locale}
      variant={variant === 'sheet' ? 'sheet' : 'default'}
      onAuthAction={onAuthAction}
    />
  )
}

export default LoginWidget

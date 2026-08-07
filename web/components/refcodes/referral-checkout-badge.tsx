'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { REF_VISIBLE_COOKIE_NAME } from '@/features/refcodes/constants'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function ReferralCheckoutBadge() {
  const t = useTranslations('modules.store.checkout')
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    setCode(readCookie(REF_VISIBLE_COOKIE_NAME))
  }, [])

  if (!code) return null

  return (
    <div
      className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
      role="status"
    >
      <span className="font-medium text-primary">{t('referralApplied')}</span>
      <span className="ml-2 text-muted-foreground font-mono">{code}</span>
    </div>
  )
}

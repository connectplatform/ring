'use client'

import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'

export function LoginBackButton() {
  const t = useTranslations('common.actions')
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          window.history.back()
          return
        }
        router.push('/')
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-foreground hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t('back')}
    </button>
  )
}

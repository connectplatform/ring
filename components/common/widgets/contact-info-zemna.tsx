'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const EMAIL = 'ceo@zemna.ai'

export function ContactInfoZemna() {
  const t = useTranslations('common')
  const [copied, setCopied] = useState(false)

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.location.href = `mailto:${EMAIL}`
    }
  }

  return (
    <div className="space-y-3">
      <p className="font-semibold text-foreground">Alex Zvansky</p>
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={`mailto:${EMAIL}`}
          className="text-primary hover:underline break-all"
        >
          {EMAIL}
        </a>
        <button
          type="button"
          onClick={copyEmail}
          title={t('contact.copyToClipboard')}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'h-8 gap-1.5 flex-shrink-0 border-border bg-background hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="text-xs text-foreground">
            {copied ? t('contact.copied') : t('contact.copyToClipboard')}
          </span>
        </button>
      </div>
      <p className="text-muted-foreground">
        <a href="tel:+380631220264" className="text-primary hover:underline">
          +380 63 12 20 264
        </a>
        <span className="mx-2">{t('contact.whatsapp')}</span>
      </p>
      <p className="text-muted-foreground">
        <a href="tel:+351939086100" className="text-primary hover:underline">
          +351 93 90 86 100
        </a>
        <span className="mx-2">{t('contact.lisbonPortugal')}</span>
      </p>
    </div>
  )
}

'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'

interface BackBarProps {
  href?: string
  title?: string
  locale: Locale
  className?: string
  showOnDesktop?: boolean
}

export default function BackBar({
  href,
  title,
  locale,
  className = '',
  showOnDesktop = false
}: BackBarProps) {
  const router = useRouter()
  const t = useTranslations('common')

  const handleBack = () => {
    if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  return (
    <div className={`sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border ${showOnDesktop ? '' : 'lg:hidden'} ${className}`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2 hover:bg-muted/50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">{t('actions.back', { defaultValue: 'Back' })}</span>
          </Button>

          {/* Optional Title */}
          {title && (
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
            </div>
          )}

          {/* Spacer for centering */}
          {!title && <div className="w-16" />}
        </div>
      </div>
    </div>
  )
}

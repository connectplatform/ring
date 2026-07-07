'use client'

/**
 * VENDOR START RAIL - Extracted right-rail content
 * Setup progress, platform benefits, next steps, and vendor guide.
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { Sparkles, TrendingUp, BarChart3, BookOpen, CheckCircle, Bot, Coins, Gift } from 'lucide-react'

export interface VendorStartRailProps {
  locale: string
  progressPercent?: number
  onNavigate?: () => void
}

const BENEFIT_ICONS = {
  aiEnrichment: Bot,
  automatedSettlements: Coins,
  ringRewards: Gift,
  trustTier: BarChart3,
} as const

type BenefitKey = keyof typeof BENEFIT_ICONS
const BENEFIT_KEYS: BenefitKey[] = ['aiEnrichment', 'automatedSettlements', 'ringRewards', 'trustTier']

export function VendorStartRail({ locale, progressPercent = 75, onNavigate }: VendorStartRailProps) {
  const router = useRouter()
  const t = useTranslations('vendor')
  const resolvedLocale = locale as Locale

  const navigate = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  return (
    <div className="flex flex-col min-h-0 text-foreground space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 shrink-0" />
          {t('startWrapper.setupProgress')}
        </h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('startWrapper.storeDetails')}</span>
          <span className="font-medium text-foreground">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <p className="text-xs text-muted-foreground">{t('startWrapper.completeStoreInfo')}</p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0" />
          {t('startWrapper.whyChoosePlatform')}
        </h2>
        <ul className="space-y-4">
          {BENEFIT_KEYS.map((key) => {
            const Icon = BENEFIT_ICONS[key]
            return (
              <li key={key} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium mb-0.5">{t(`startWrapper.benefits.${key}.title`)}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t(`startWrapper.benefits.${key}.description`)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t('startWrapper.nextSteps.title')}
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 shrink-0 text-green-500" /><span>{t('startWrapper.nextSteps.completeStore')}</span></li>
          <li className="flex items-center gap-2"><div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted" /><span>{t('startWrapper.nextSteps.uploadLogo')}</span></li>
          <li className="flex items-center gap-2"><div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted" /><span>{t('startWrapper.nextSteps.addFirstProduct')}</span></li>
        </ul>
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0" />
          {t('startWrapper.vendorGuide.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('startWrapper.vendorGuide.description')}</p>
        <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate(`${ROUTES.DOCS(resolvedLocale)}/vendor-guide`)}>
          {t('startWrapper.vendorGuide.viewGuide')}
        </Button>
      </section>
    </div>
  )
}

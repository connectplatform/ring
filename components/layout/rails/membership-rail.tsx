'use client'

/**
 * MEMBERSHIP RAIL - Extracted right-rail content
 * Member benefits, pricing, payment options, and help.
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, Building2, Briefcase, Coins, CreditCard, HelpCircle, BookOpen, CheckCircle } from 'lucide-react'
import { formatMembershipFiatAmount, getMemberFiatTier, getMembershipRingUpgradeAmount } from '@/lib/membership/pricing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export interface MembershipRailProps {
  locale: string
  onNavigate?: () => void
}

export function MembershipRail({ locale, onNavigate }: MembershipRailProps) {
  const router = useRouter()
  const t = useTranslations('modules.membership')
  const fiatTier = getMemberFiatTier()
  const ringAmount = getMembershipRingUpgradeAmount()
  const localeKey = locale as Locale

  const navigate = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  const benefitItems = [
    { icon: Building2, title: t('benefits.entity_management.title'), description: t('benefits.entity_management.description') },
    { icon: Briefcase, title: t('benefits.premium_features.title'), description: t('benefits.premium_features.description') },
    { icon: Crown, title: t('benefits.verified_profile.title'), description: t('benefits.verified_profile.description') },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4" />
            {t('sidebar.member_benefits')}
          </CardTitle>
          <CardDescription>{t('sidebar.member_benefits_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {benefitItems.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="p-1 bg-primary/10 rounded">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4" />
            {t('sidebar.pricing_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2"><Coins className="h-3.5 w-3.5" /> RING</span>
            <span className="font-medium">{ringAmount.toFixed(2)} RING</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> {fiatTier.currency}</span>
            <span className="font-medium">{formatMembershipFiatAmount(fiatTier)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{fiatTier.description}</p>
          <Badge variant="secondary" className="text-xs">{t('sidebar.pay_either')}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('sidebar.payment_options')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('sidebar.payment_options_desc')}</p>
          <Button variant="outline" className="w-full justify-start" onClick={() => navigate(ROUTES.WALLET_TOPUP(localeKey))}>
            <Coins className="h-4 w-4 mr-2" />
            {t('payment.ring.top_up')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('sidebar.help_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('sidebar.help_desc')}</p>
          <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate(ROUTES.DOCS_PAYMENTS(localeKey))}>
            <BookOpen className="h-4 w-4 mr-1 inline" />
            {t('sidebar.view_payment_guide')} →
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

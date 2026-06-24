'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, Building2, Users, Zap } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PaymentModal } from '@/components/membership/payment-modal'
import {
  formatMembershipFiatAmount,
  getMemberFiatTier,
  getMembershipRingUpgradeAmount,
} from '@/lib/membership/pricing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

interface MembershipUpgradeModalProps {
  onClose: () => void
  returnTo?: string
}

const QUICK_BENEFITS = [
  { key: 'entity_creation', icon: Building2 },
  { key: 'entity_management', icon: Users },
  { key: 'premium_access', icon: Zap },
]

export function MembershipUpgradeModal({ onClose, returnTo }: MembershipUpgradeModalProps) {
  const t = useTranslations('modules.membership')
  const locale = useLocale() as Locale
  const router = useRouter()
  const [showPayment, setShowPayment] = useState(false)

  const fiatTier = getMemberFiatTier()
  const ringAmount = getMembershipRingUpgradeAmount()

  if (showPayment) {
    return <PaymentModal onClose={onClose} returnTo={returnTo} />
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <span>{t('modal.title')}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{t('modal.description')}</p>
            <Badge variant="secondary" className="mb-4">
              {t('modal.upgrade_required')}
            </Badge>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-center">{t('modal.benefits_title')}</h3>
            {QUICK_BENEFITS.map((benefit) => {
              const Icon = benefit.icon
              return (
                <div key={benefit.key} className="flex items-center space-x-3">
                  <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm">{t(`modal.benefits.${benefit.key}`)}</span>
                </div>
              )
            })}
          </div>

          <div className="bg-muted p-4 rounded-lg text-center space-y-1">
            <div className="flex justify-center items-center space-x-2 mb-1">
              <span className="text-2xl font-bold">{formatMembershipFiatAmount(fiatTier)}</span>
              <span className="text-sm text-muted-foreground">{fiatTier.currency}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('sidebar.or_ring', { amount: ringAmount.toFixed(2) })}
            </p>
            <p className="text-xs text-muted-foreground">{t('pricing.features_included')}</p>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={() => setShowPayment(true)}
              className="flex-1"
              data-testid="button-membership-upgrade-now"
            >
              {t('modal.upgrade_now')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              data-testid="button-membership-learn-more"
              onClick={() => {
                onClose()
                router.push(ROUTES.DOCS_PAYMENTS(locale))
              }}
            >
              {t('modal.learn_more')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

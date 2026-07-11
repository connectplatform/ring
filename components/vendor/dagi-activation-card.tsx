'use client'

/**
 * DAGI Activation Card
 *
 * Unlock requires GateEscrow stake of vendor-dagi-key (hasFeature vendor.dagi).
 * Agent provisioning API remains coming-soon — no fake activation.
 */

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GateStakeCard } from '@/components/vendor/gate-stake-card'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NftOwnershipRecord, NftStakeRecord } from '@/features/nft-gates/types'

interface DAGIActivationCardProps {
  userId: string
  locale?: Locale
  /** GateResolver: hasFeature(userId, 'vendor.dagi') */
  dagiUnlocked: boolean
  owned: NftOwnershipRecord[]
  stakes: NftStakeRecord[]
}

export function DAGIActivationCard({
  userId,
  locale = 'en',
  dagiUnlocked,
  owned,
  stakes,
}: DAGIActivationCardProps) {
  const t = useTranslations('vendor.dashboard.dagi')
  void userId

  return (
    <Card className={dagiUnlocked ? undefined : 'border-dashed'}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Bot className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
          </div>
          {dagiUnlocked ? (
            <Badge>Gate unlocked</Badge>
          ) : (
            <Badge variant="secondary">{t('comingSoon')}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!dagiUnlocked && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Buy and stake a <span className="font-medium">vendor-dagi-key</span> NFT to unlock
              DAGI. Stake uses GateEscrow — not the APR yield pool.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`${ROUTES.NFT_GATES(locale)}?slug=vendor-dagi-key`}>
                Get DAGI key
              </Link>
            </Button>
            <GateStakeCard owned={owned} stakes={stakes} focusSlug="vendor-dagi-key" />
          </div>
        )}
        {dagiUnlocked && (
          <p className="text-sm text-muted-foreground">
            DAGI gate is active via GateEscrow. Agent provisioning API is not live yet —{' '}
            {t('todoNote')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

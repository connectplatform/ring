'use client'

/**
 * DAGI Activation Card
 *
 * Unlock requires GateEscrow stake of vendor-dagi-key (hasFeatureForVendor).
 * When unlocked, mounts ERP chat bound to vendorEntityId (Anthropic tool loop).
 */

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GateStakeCard } from '@/components/vendor/gate-stake-card'
import { DagiErpChatPanel } from '@/components/vendor/dagi-erp-chat-panel'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NftOwnershipRecord, NftStakeRecord } from '@/features/nft-gates/types'

interface DAGIActivationCardProps {
  userId: string
  locale?: Locale
  /** GateResolver: hasFeatureForVendor(userId, vendorEntityId, 'vendor.dagi') */
  dagiUnlocked: boolean
  /** Bound store for ERP tools — must match stake.vendorEntityId */
  vendorEntityId: string
  vendorName?: string
  owned: NftOwnershipRecord[]
  stakes: NftStakeRecord[]
  /** Owned vendor entities for stake-time bind (multi-store picker) */
  vendorEntities?: Array<{ id: string; name: string }>
}

export function DAGIActivationCard({
  userId,
  locale = 'en',
  dagiUnlocked,
  vendorEntityId,
  vendorName,
  owned,
  stakes,
  vendorEntities = [],
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
            <Badge>{t('unlocked')}</Badge>
          ) : (
            <Badge variant="secondary">{t('comingSoon')}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!dagiUnlocked && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('unlockHint')}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`${ROUTES.NFT_GATES(locale)}?slug=vendor-dagi-key`}>
                {t('getKey')}
              </Link>
            </Button>
            <GateStakeCard
              owned={owned}
              stakes={stakes}
              focusSlug="vendor-dagi-key"
              vendorEntities={vendorEntities}
            />
          </div>
        )}
        {dagiUnlocked && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('chatIntro')}</p>
            <DagiErpChatPanel
              vendorEntityId={vendorEntityId}
              vendorName={vendorName}
              locale={locale}
            />
            <GateStakeCard
              owned={owned}
              stakes={stakes}
              focusSlug="vendor-dagi-key"
              vendorEntities={vendorEntities}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

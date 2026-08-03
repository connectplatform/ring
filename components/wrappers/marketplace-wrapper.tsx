'use client'

/**
 * MARKETPLACE WRAPPER — flush DaVinci center pane for MV services marketplace.
 * StoreWrapper (product filters rail) is wrong for this surface.
 */

import React from 'react'
import { useTranslations } from 'next-intl'
import { Briefcase, Rocket, Store, Users } from 'lucide-react'
import { Link } from '@/i18n/routing'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  davinciCtaPrimary,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

interface MarketplaceWrapperProps {
  children: React.ReactNode
}

function MarketplaceRail() {
  const t = useTranslations('pages.marketplace')
  const tVendor = useTranslations('vendor')

  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-labelledby="marketplace-rail-heading">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
          <h2
            id="marketplace-rail-heading"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            {t('title')}
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('subtitle')}</p>
        <div className="flex flex-wrap gap-2">
          <DavinciGlassChip icon={<Users className="h-3 w-3" />}>{t('tabs.vendors')}</DavinciGlassChip>
          <DavinciGlassChip icon={<Briefcase className="h-3 w-3" />}>{t('tabs.services')}</DavinciGlassChip>
        </div>
      </section>

      <section className={cn(davinciGlassSurface, 'space-y-2 p-3.5')}>
        <Link
          href={{ pathname: '/membership' }}
          className={cn(
            davinciCtaPrimary,
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold',
          )}
        >
          <Rocket className="size-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
          {tVendor('becomeVendor')}
        </Link>
      </section>
    </div>
  )
}

export default function MarketplaceWrapper({ children }: MarketplaceWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="generic"
      rightRailContent={[
        { blockType: 'marketplace-intro' },
        { blockType: 'marketplace-vendor-cta' },
      ]}
      rightRail={<MarketplaceRail />}
      railWidth={300}
      contentClassName="pb-24 lg:pb-8"
      flushCenterPane
    >
      <DavinciCenterPane contentClassName="!p-0">{children}</DavinciCenterPane>
    </RingRightRailLayout>
  )
}

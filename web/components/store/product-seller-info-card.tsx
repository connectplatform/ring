'use client'

/**
 * Seller information card — rendered in the product details Reviews tab
 * (center pane, above reviews). Moved from the product right rail when the
 * rail became fully dedicated to the product agent chat.
 */

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Award, Store } from 'lucide-react'
import { DavinciGlassPanel, davinciCtaPrimary } from '@/lib/ui/davinci'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProductDetailsVendorRail } from '@/features/store/services/product-details-rail'

export default function ProductSellerInfoCard({
  vendor,
  className,
}: {
  vendor: ProductDetailsVendorRail
  className?: string
}) {
  const t = useTranslations('modules.store')

  return (
    <DavinciGlassPanel
      title={t('vendorInfo', { defaultValue: 'Vendor Info' })}
      icon={<Store className="h-4 w-4" />}
      className={className}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Store className="h-5 w-5 text-[var(--davinci-beam)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight">
            {vendor.name || t('vendorInfo', { defaultValue: 'Vendor' })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('memberSince', { defaultValue: 'Member since' })}{' '}
            <span className="font-medium text-foreground">{vendor.memberSince || '—'}</span>
          </p>
          {vendor.verified ? (
            <Badge variant="secondary" className="mt-2 text-[10px]">
              <Award className="mr-1 h-3 w-3" />
              {t('verified', { defaultValue: 'Verified' })}
            </Badge>
          ) : null}
        </div>
      </div>
      {vendor.href && vendor.id !== 'unknown' ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn('mt-3 w-full', davinciCtaPrimary)}
        >
          <Link href={vendor.href}>{t('visitVendor', { defaultValue: 'Visit Vendor' })}</Link>
        </Button>
      ) : null}
    </DavinciGlassPanel>
  )
}

'use client'

/**
 * Store product details right rail — vendor trust + reviews + category/seller products.
 */

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Award, ChevronDown, Star, Store } from 'lucide-react'
import { DavinciGlassPanel, davinciCtaPrimary } from '@/lib/ui/davinci'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProductDetailsRailData } from '@/features/store/services/product-details-rail'

type StoreProductRightSidebarProps = {
  locale: string
  railData: ProductDetailsRailData
  productName?: string
  onScrollToReviews?: () => void
}

function MiniProductList({
  products,
  emptyLabel,
}: {
  products: ProductDetailsRailData['categoryProducts']
  emptyLabel: string
}) {
  if (!products.length) {
    return <p className="py-2 text-xs text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-3">
      {products.map((p) => (
        <li key={p.id}>
          <Link
            href={p.url}
            className="flex gap-3 rounded-lg border border-transparent p-1.5 transition-colors hover:border-border hover:bg-muted/40"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image src={p.image} alt={p.name} fill className="object-cover" sizes="48px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-snug">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.price.toFixed(2)} {p.currency}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function StoreProductRightSidebar({
  railData,
  onScrollToReviews,
}: StoreProductRightSidebarProps) {
  const t = useTranslations('modules.store')
  const { vendor, reviews, categoryProducts, featuredSellerProducts } = railData

  return (
    <div className="space-y-4">
      <DavinciGlassPanel>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-5 w-5 text-[var(--davinci-beam)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight">
              {vendor?.name || t('vendorInfo', { defaultValue: 'Vendor' })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('memberSince', { defaultValue: 'Member since' })}{' '}
              <span className="font-medium text-foreground">{vendor?.memberSince || '—'}</span>
            </p>
            {vendor?.verified ? (
              <Badge variant="secondary" className="mt-2 text-[10px]">
                <Award className="mr-1 h-3 w-3" />
                {t('verified', { defaultValue: 'Verified' })}
              </Badge>
            ) : null}
          </div>
        </div>
        {vendor?.href && vendor.id !== 'unknown' ? (
          <Button asChild variant="outline" size="sm" className={cn('mt-3 w-full', davinciCtaPrimary)}>
            <Link href={vendor.href}>{t('visitVendor', { defaultValue: 'Visit Vendor' })}</Link>
          </Button>
        ) : null}
      </DavinciGlassPanel>

      <DavinciGlassPanel innerClassName="p-0">
        <Collapsible defaultOpen={false} className="group">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/30">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {t('product.reviews', { defaultValue: 'Reviews' })} ({reviews.totalReviews})
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <span className="text-lg font-bold">{reviews.averageRating || '—'}</span>
              <span className="text-xs text-muted-foreground">({reviews.totalReviews})</span>
            </div>
            <div className="space-y-1">
              {([5, 4, 3, 2, 1] as const).map((stars) => {
                const count = reviews.distribution[stars] || 0
                const pct = reviews.totalReviews ? (count / reviews.totalReviews) * 100 : 0
                return (
                  <div key={stars} className="flex items-center gap-2 text-xs">
                    <span className="w-3">{stars}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-5 text-right text-muted-foreground">{count}</span>
                  </div>
                )
              })}
            </div>
            <Button
              variant="link"
              className="h-auto w-full p-0 text-sm"
              onClick={() => onScrollToReviews?.()}
            >
              {t('readAllReviews', { defaultValue: 'Read All Reviews' })} →
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </DavinciGlassPanel>

      <DavinciGlassPanel
        title={t('relatedProducts', { defaultValue: 'Other in category' })}
      >
        <MiniProductList
          products={categoryProducts}
          emptyLabel={t('noRelatedProducts', {
            defaultValue: 'No other products in this category yet.',
          })}
        />
      </DavinciGlassPanel>

      <DavinciGlassPanel
        title={t('featuredSellerProducts', { defaultValue: 'From this seller' })}
      >
        <MiniProductList
          products={featuredSellerProducts}
          emptyLabel={t('noSellerProducts', {
            defaultValue: 'No other products from this seller yet.',
          })}
        />
      </DavinciGlassPanel>
    </div>
  )
}

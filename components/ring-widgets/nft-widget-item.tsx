/**
 * nft-widget-item — MDX/docs widget for a single gate template CTA.
 */

'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NftGateSlug } from '@/features/nft-gates/types'

export interface NftWidgetItemProps {
  slug: NftGateSlug | string
  name: string
  priceRing: number
  soulbound?: boolean
  tokenSymbol?: string
  locale?: Locale
  imageUrl?: string
  description?: string
}

export function NftWidgetItem({
  slug,
  name,
  priceRing,
  soulbound = false,
  tokenSymbol = 'RING',
  locale = 'en',
  imageUrl,
  description,
}: NftWidgetItemProps) {
  const href = `${ROUTES.NFT_GATES(locale)}?slug=${encodeURIComponent(slug)}`

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3 items-start">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="h-16 w-16 rounded-md object-cover bg-muted"
          />
        ) : (
          <div className="h-16 w-16 rounded-md bg-muted" aria-hidden />
        )}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{name}</span>
            {soulbound && <Badge variant="secondary">Soulbound</Badge>}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          )}
          <p className="text-sm">
            {priceRing} {tokenSymbol}
          </p>
        </div>
      </div>
      <Button asChild>
        <Link href={href}>View gate</Link>
      </Button>
    </div>
  )
}

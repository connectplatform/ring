'use client'

/**
 * Interactive product_card — CRM snapshot: image, price, View, Add to cart.
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, Package, ShoppingCart, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Message, ProductCardMetadata } from '@/features/chat/types'
import type { StoreProduct, StorePaymentMethods } from '@/features/store/types'
import { useStore } from '@/features/store/context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

function parseProductCard(message: Message): ProductCardMetadata | null {
  const meta = message.metadata
  if (!meta || meta.kind !== 'product_card') return null
  if (typeof meta.productId !== 'string' || typeof meta.title !== 'string') return null
  if (typeof meta.url !== 'string' || typeof meta.price !== 'string') return null
  return meta as unknown as ProductCardMetadata
}

function snapshotToStoreProduct(card: ProductCardMetadata): StoreProduct {
  return {
    id: card.productId,
    name: card.title,
    description: card.description,
    price: card.price,
    currency: (card.currency || 'USD') as StorePaymentMethods,
    inStock: card.inStock !== false,
    images: card.previewImage ? [card.previewImage] : [],
    vendorName: card.vendorName,
  }
}

export interface ProductCardMessageWidgetProps {
  message: Message
  isOwn?: boolean
  className?: string
}

export function ProductCardMessageWidget({
  message,
  isOwn,
  className,
}: ProductCardMessageWidgetProps) {
  const card = parseProductCard(message)
  const { addToCart } = useStore()
  const { success } = useToast()
  const t = useTranslations('modules.store.product')
  const [adding, setAdding] = useState(false)

  if (!card) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  const handleAdd = async () => {
    if (adding) return
    setAdding(true)
    try {
      addToCart(snapshotToStoreProduct(card))
      success({
        title: t('addedToCart', {
          name: card.title,
          defaultValue: `${card.title} added to cart`,
        }),
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className={cn(
        'min-w-[240px] max-w-[300px] overflow-hidden rounded-lg border border-border/60 bg-background/50',
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-muted">
        {card.previewImage ? (
          <Image
            src={card.previewImage}
            alt={card.title}
            fill
            className="object-cover"
            sizes="300px"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Package className="h-10 w-10 opacity-40" aria-hidden />
          </div>
        )}
        {card.inStock === false ? (
          <span className="absolute left-2 top-2 rounded bg-destructive/90 px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
            {t('inStockNo', { defaultValue: 'Out of stock' })}
          </span>
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-snug line-clamp-2">{card.title}</p>
          {card.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{card.description}</p>
          ) : null}
          {card.vendorName ? (
            <p className="text-[11px] text-muted-foreground">{card.vendorName}</p>
          ) : null}
        </div>

        <p className="text-sm font-medium">
          {card.price} {card.currency}
        </p>

        <div className="flex gap-2">
          <Button
            asChild
            size="sm"
            variant={isOwn ? 'secondary' : 'outline'}
            className="h-8 flex-1 gap-1 text-xs"
          >
            <Link href={card.url}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {t('viewProduct', { defaultValue: 'View' })}
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 flex-1 gap-1 text-xs"
            disabled={adding || card.inStock === false}
            onClick={() => void handleAdd()}
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
            )}
            {t('addToCart', { defaultValue: 'Add' })}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ProductCardMessageWidget

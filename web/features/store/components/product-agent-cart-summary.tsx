'use client'

/**
 * Floating Cart Summary for product agent chat — Cart + Pay & Buy.
 * Desktop: stays on chat; Cart switches center to /cart (chat rail kept on cart page).
 * Mobile: Cart hides chat panel; Pay & Buy goes to checkout (panel hides).
 */

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShoppingCart, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOptionalStore } from '@/features/store/context'
import {
  useOptionalStorePaymentMethods,
  MAIN_CURRENCY,
  resolveStorePriceCurrency,
  type StorePaymentMethods,
} from '@/features/store/currency-context'
import type { CartItem } from '@/features/store/types'
import { applyProductPromotionToLine } from '@/features/store/types/promotions'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'
import { useOptionalProductAgentChatContext } from '@/features/store/context/product-agent-chat-context'

const LAST_PRODUCT_KEY = 'ring:lastProductAgent'

/** Stable identity so the `total` memo does not rerun when the store is absent. */
const EMPTY_CART: CartItem[] = []

export function rememberProductAgentContext(productId: string, productName: string) {
  try {
    sessionStorage.setItem(
      LAST_PRODUCT_KEY,
      JSON.stringify({ productId, productName, at: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}

export function readLastProductAgentContext(): {
  productId: string
  productName: string
} | null {
  try {
    const raw = sessionStorage.getItem(LAST_PRODUCT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { productId?: string; productName?: string }
    if (!parsed.productId) return null
    return {
      productId: parsed.productId,
      productName: parsed.productName || 'Product',
    }
  } catch {
    return null
  }
}

/**
 * `bar` — docked above the chat composer, owns its own border/background.
 * `chat` — rendered as a message bubble; the surrounding bubble owns the chrome,
 * so the bar drops its border to avoid nested card edges.
 */
export type CartSummaryVariant = 'bar' | 'chat'

export function ProductAgentCartSummaryBar({
  locale,
  productId,
  className,
  variant = 'bar',
}: {
  locale: Locale
  productId: string
  className?: string
  variant?: CartSummaryVariant
}) {
  const t = useTranslations('modules.store')
  const router = useRouter()
  const store = useOptionalStore()
  const storeCurrency = useOptionalStorePaymentMethods()
  const chatCtx = useOptionalProductAgentChatContext()

  const cartItems = store?.cartItems ?? EMPTY_CART
  const totalItems = store?.totalItems ?? 0
  const currency = storeCurrency?.currency ?? MAIN_CURRENCY
  const convertPrice = storeCurrency?.convertPrice ?? ((price: number) => price)
  const formatPrice =
    storeCurrency?.formatPrice ??
    ((price: number, code: StorePaymentMethods) => `${price.toFixed(2)} ${code}`)

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const raw = item.finalPrice != null ? item.finalPrice : parseFloat(item.product.price)
      const from = resolveStorePriceCurrency(item.product.currency || MAIN_CURRENCY)
      const unit = convertPrice(raw, from, currency)
      const { lineTotal } = applyProductPromotionToLine(
        unit,
        item.quantity,
        item.product.promotions,
      )
      return sum + lineTotal
    }, 0)
  }, [cartItems, convertPrice, currency])

  const openCart = useCallback(() => {
    rememberProductAgentContext(productId, chatCtx?.productName || '')
    chatCtx?.setOpen(false)
    router.push(ROUTES.CART(locale))
  }, [chatCtx, locale, productId, router])

  const payAndBuy = useCallback(() => {
    rememberProductAgentContext(productId, chatCtx?.productName || '')
    chatCtx?.setOpen(false)
    router.push(ROUTES.CHECKOUT(locale))
  }, [chatCtx, locale, productId, router])

  // In `chat` the message bubble already draws the card edge — do not nest another.
  const surface =
    variant === 'chat'
      ? 'rounded-lg bg-background/70 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/50'
      : 'z-10 shrink-0 border-b bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80'

  if (totalItems === 0) {
    return (
      <div
        className={cn(
          'px-3 py-2 text-xs text-muted-foreground',
          variant === 'chat' ? 'rounded-lg bg-muted/30' : 'shrink-0 border-b bg-muted/40',
          className,
        )}
      >
        {t('product.cartSummaryEmpty')}
      </div>
    )
  }

  return (
    <div className={cn(surface, className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{t('product.cartSummaryTitle')}</p>
        <p className="text-xs text-muted-foreground">
          {totalItems} · {formatPrice(total, currency)}
        </p>
      </div>
      <ul className="mb-2 max-h-16 space-y-0.5 overflow-y-auto text-[11px] text-muted-foreground">
        {cartItems.slice(0, 4).map((item) => (
          <li key={item.product.id} className="truncate">
            {item.quantity}× {item.product.name}
          </li>
        ))}
        {cartItems.length > 4 ? <li>…</li> : null}
      </ul>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1 gap-1" onClick={openCart}>
          <ShoppingCart className="h-3.5 w-3.5" />
          {t('product.cartSummaryOpenCart')}
        </Button>
        <Button type="button" size="sm" className="flex-1 gap-1" onClick={payAndBuy}>
          <CreditCard className="h-3.5 w-3.5" />
          {t('product.cartSummaryPay')}
        </Button>
      </div>
    </div>
  )
}

export default ProductAgentCartSummaryBar

'use client'

/**
 * Interactive `cart_summary` message widget — mirrors the floating product-agent
 * cart bar, rendered as a chat bubble.
 *
 * The bubble owns the card chrome (border + glass), so the bar renders in its
 * `chat` variant to avoid a second nested edge. Prices format through the store
 * currency context, i.e. the project main currency, never a hardcoded code.
 */

import type { Message } from '@/features/chat/types'
import { ProductAgentCartSummaryBar } from '@/features/store/components/product-agent-cart-summary'
import { useLocale } from 'next-intl'
import { isValidLocale, type Locale } from '@/i18n/shared'

export function CartSummaryMessageWidget({
  message,
}: {
  message: Message
  isOwn?: boolean
}) {
  const uiLocale = useLocale() as Locale
  // Prefer the locale the conversation was written in over the viewer's UI locale.
  const metaLocale = message.metadata?.locale
  const locale =
    typeof metaLocale === 'string' && isValidLocale(metaLocale) ? metaLocale : uiLocale

  const productId =
    (typeof message.metadata?.productId === 'string' && message.metadata.productId) || 'cart'

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border/60 bg-card/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/50 sm:max-w-md">
      <ProductAgentCartSummaryBar locale={locale} productId={productId} variant="chat" />
    </div>
  )
}

export default CartSummaryMessageWidget

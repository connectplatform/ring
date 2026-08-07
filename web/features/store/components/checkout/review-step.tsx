'use client'
import React from 'react'
import { useStore } from '@/features/store/context'
import {
  MAIN_CURRENCY,
  useOptionalStorePaymentMethods,
  type StorePaymentMethods,
} from '@/features/store/currency-context'
import { ReferralCheckoutBadge } from '@/components/refcodes/referral-checkout-badge'

export function ReviewStep({
  onPlaceOrder,
  submitting,
  asFormSubmit = false,
}: {
  onPlaceOrder?: () => void
  submitting: boolean
  /** When true, renders a submit button for progressive form actions. */
  asFormSubmit?: boolean
}) {
  const { cartItems } = useStore()
  const storeCurrency = useOptionalStorePaymentMethods()
  const formatPrice =
    storeCurrency?.formatPrice ??
    ((price: number, currency: StorePaymentMethods) => `${price.toFixed(2)} ${currency}`)
  const displayPrice =
    storeCurrency?.displayPrice ??
    ((amount: number) => formatPrice(amount, MAIN_CURRENCY))
  const convertPrice =
    storeCurrency?.convertPrice ??
    ((amount: number) => amount)
  const activeCurrency = storeCurrency?.currency ?? MAIN_CURRENCY
  const mainCurrency = storeCurrency?.mainCurrency ?? MAIN_CURRENCY

  let grandTotalMain = 0
  for (const i of cartItems) {
    const unit = i.finalPrice || parseFloat(String(i.product.price)) || 0
    const from = (i.product.currency || mainCurrency) as StorePaymentMethods
    const lineMain = convertPrice(unit * i.quantity, from, mainCurrency)
    grandTotalMain += lineMain
  }

  return (
    <div className="space-y-6">
      <ReferralCheckoutBadge />
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
        <div className="space-y-4">
          {cartItems.map((i) => {
            const unit = i.finalPrice || parseFloat(String(i.product.price)) || 0
            const from = (i.product.currency || mainCurrency) as StorePaymentMethods
            const lineMain = convertPrice(unit * i.quantity, from, mainCurrency)
            const lineDisplay = convertPrice(lineMain, mainCurrency, activeCurrency)
            const unitDisplay = convertPrice(unit, from, activeCurrency)

            return (
              <div
                key={i.product.id}
                className="flex items-start justify-between pb-4 border-b last:border-b-0 last:pb-0"
              >
                <div className="flex-1">
                  <div className="font-medium">{i.product.name}</div>

                  {i.selectedVariants && Object.keys(i.selectedVariants).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(i.selectedVariants).map(([name, value]) => (
                        <span
                          key={name}
                          className="inline-flex items-center px-2 py-0.5 bg-muted rounded text-xs font-medium"
                        >
                          {name}: <span className="ml-1 text-primary">{value}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground mt-2">
                    Quantity: {i.quantity} × {formatPrice(unitDisplay, activeCurrency)}
                  </div>
                </div>
                <div className="font-semibold ml-4">
                  {formatPrice(lineDisplay, activeCurrency)}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-4 border-t flex items-center justify-between">
          <span className="font-semibold text-lg">Total:</span>
          <span className="font-bold text-xl text-primary">
            {displayPrice(grandTotalMain, mainCurrency)}
          </span>
        </div>
      </div>

      {/* Place Order Button */}
      <button
        type={asFormSubmit ? 'submit' : 'button'}
        disabled={submitting}
        className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={asFormSubmit ? undefined : onPlaceOrder}
      >
        {submitting ? 'Placing order...' : 'Place Order'}
      </button>
    </div>
  )
}

'use client'
import React from 'react'
import { useStore } from '@/features/store/context'

export function ReviewStep({ onPlaceOrder, submitting }: { onPlaceOrder: () => void, submitting: boolean }) {
  const { cartItems, totalPriceByCurrency } = useStore()
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {cartItems.map(i => (
          <div key={i.product.id} className="flex items-center justify-between text-sm">
            <div>{i.product.name} × {i.quantity}</div>
            <div>{i.product.price} {i.product.currency}</div>
          </div>
        ))}
      </div>
      <div className="text-sm">Total: {totalPriceByCurrency.DAAR || 0} DAAR{(totalPriceByCurrency.DAAR && totalPriceByCurrency.DAARION) ? ' + ' : ''}{totalPriceByCurrency.DAARION || 0} DAARION</div>
      <button disabled={submitting} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={onPlaceOrder}>
        {submitting ? 'Placing order...' : 'Place order'}
      </button>
    </div>
  )
}



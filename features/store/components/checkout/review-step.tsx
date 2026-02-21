'use client'
import React from 'react'
import { useStore } from '@/features/store/context'

export function ReviewStep({ onPlaceOrder, submitting }: { onPlaceOrder: () => void, submitting: boolean }) {
  const { cartItems, totalPriceByCurrency } = useStore()
  
  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
        <div className="space-y-4">
          {cartItems.map(i => {
            // Phase 2: Calculate display price with variants
            const displayPrice = i.finalPrice || parseFloat(i.product.price)
            const itemTotal = displayPrice * i.quantity
            
            return (
              <div key={i.product.id} className="flex items-start justify-between pb-4 border-b last:border-b-0 last:pb-0">
                <div className="flex-1">
                  <div className="font-medium">{i.product.name}</div>
                  
                  {/* Phase 2: Display selected variants */}
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
                    Quantity: {i.quantity} × {displayPrice} {i.product.currency}
                  </div>
                </div>
                <div className="font-semibold ml-4">
                  {itemTotal} {i.product.currency}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Total */}
        <div className="mt-6 pt-4 border-t flex items-center justify-between">
          <span className="font-semibold text-lg">Total:</span>
          <span className="font-bold text-xl text-primary">
            {totalPriceByCurrency.DAAR || 0} DAAR
            {(totalPriceByCurrency.DAAR && totalPriceByCurrency.DAARION) ? ' + ' : ''}
            {totalPriceByCurrency.DAARION || 0} DAARION
          </span>
        </div>
      </div>
      
      {/* Place Order Button */}
      <button 
        disabled={submitting} 
        className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
        onClick={onPlaceOrder}
      >
        {submitting ? 'Placing order...' : 'Place Order'}
      </button>
    </div>
  )
}



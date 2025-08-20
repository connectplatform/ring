'use client'
import React from 'react'

export function PaymentStep({ method, setMethod }: { method: 'stripe' | 'crypto', setMethod: (m: 'stripe' | 'crypto') => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input type="radio" checked={method === 'stripe'} onChange={() => setMethod('stripe')} />
          <span>Credit Card (Stripe - test)</span>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input type="radio" checked={method === 'crypto'} onChange={() => setMethod('crypto')} />
          <span>Crypto (DAAR/DAARION)</span>
        </label>
      </div>
      <div className="text-xs text-muted-foreground">Payment will be simulated on submit until gateway is enabled.</div>
    </div>
  )
}



'use client'

import type { PricingResult, SubscriptionResult } from '@/app/_actions/membership'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'

interface Props {
  pricing: PricingResult
  status: SubscriptionResult & {
    hasActiveMembership?: boolean
    currentBalance?: string
    daysUntilPayment?: number | null
  }
}

/**
 * Client leaf for streamed membership pricing (paired with MembershipPricingSuspense).
 */
export function MembershipPricingClient({ pricing, status }: Props) {
  const symbol = getClientNativeTokenSymbol()

  if (!pricing.success) {
    return (
      <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
        {pricing.error || 'Failed to load pricing'}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-6">
      <div>
        <h3 className="text-lg font-semibold">Membership</h3>
        <p className="text-sm text-muted-foreground">
          {pricing.membershipFee} {pricing.currency || symbol}
          {pricing.usdEquivalent ? ` ≈ $${pricing.usdEquivalent}` : ''}
        </p>
      </div>

      {status.success && (
        <p className="text-sm text-muted-foreground">
          Status: {status.subscription?.status || 'none'}
          {status.hasActiveMembership ? ' (active)' : ''}
          {typeof status.daysUntilPayment === 'number'
            ? ` · next payment in ${status.daysUntilPayment}d`
            : ''}
        </p>
      )}

      <ul className="space-y-2">
        {(pricing.paymentOptions || []).map((opt) => (
          <li
            key={opt.type}
            className={`rounded-md border p-3 text-sm ${
              opt.available ? 'border-border' : 'border-border/50 opacity-60'
            }`}
          >
            <div className="font-medium">{opt.title}</div>
            <div className="text-muted-foreground">{opt.description}</div>
            <div className="mt-1">
              {opt.cost.token_amount} · ${opt.cost.main_currency_equivalent}
              {!opt.available ? ' · unavailable' : ''}
            </div>
          </li>
        ))}
      </ul>

      {pricing.currentBalance != null && (
        <p className="text-xs text-muted-foreground">
          Credit balance: {pricing.currentBalance}
          {pricing.balanceSufficient ? ' (sufficient)' : ' (top up needed)'}
        </p>
      )}
    </div>
  )
}

import { Suspense } from 'react'
import {
  getMembershipPricing,
  getSubscriptionStatus,
} from '@/app/_actions/membership'
import { MembershipPricingClient } from '@/components/membership/membership-pricing-client'

/**
 * RSC + Suspense: stream membership pricing / subscription status.
 * Chain balance fetch happens on the server inside the actions; client only renders.
 */
async function MembershipPricingInner() {
  const [pricing, status] = await Promise.all([
    getMembershipPricing(),
    getSubscriptionStatus(),
  ])
  return <MembershipPricingClient pricing={pricing} status={status} />
}

export function MembershipPricingSuspense() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground animate-pulse">
          Loading membership pricing…
        </div>
      }
    >
      <MembershipPricingInner />
    </Suspense>
  )
}

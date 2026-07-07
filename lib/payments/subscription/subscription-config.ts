/**
 * Subscription Configuration — SSOT accessor for payment & membership billing.
 *
 * All subscription-related config is driven by ring-config.json's `payment`
 * section. This module provides typed accessors that fall back to environment
 * variables where appropriate (secrets still live in .env.local / k8s secrets).
 *
 * SSOT hierarchy:
 *   1. ring-config.json → payment.cardPaymentProcessor  (card gateway choice)
 *   2. env.PAYMENT_MEMBERSHIP_PROCESSOR                   (per-deployment override)
 *   3. ring-config.json → payment.gateways                (fee rates, currency)
 *   4. ring-config.json → membership.tiers                (pricing amounts)
 */

import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type {
  CardPaymentProcessor,
  MembershipPaymentProvider,
  PaymentGatewayConfig,
  PaymentConfig,
} from '@/lib/ring-config-types'

// ---------------------------------------------------------------------------
// Card payment processor — SSOT resolution
// ---------------------------------------------------------------------------

/**
 * Returns which card processor handles membership checkout.
 * Resolution order: env PAYMENT_MEMBERSHIP_PROCESSOR → ring-config.json → default.
 */
export function getCardPaymentProcessor(): CardPaymentProcessor {
  const envOverride = process.env.PAYMENT_MEMBERSHIP_PROCESSOR?.toLowerCase().trim()
  if (envOverride === 'stripe' || envOverride === 'wayforpay') {
    return envOverride
  }
  const config = getSystemConfigSnapshot().payment
  return config?.cardPaymentProcessor ?? 'wayforpay'
}

// ---------------------------------------------------------------------------
// Supported / future methods
// ---------------------------------------------------------------------------

/** Which membership payment methods are currently available to users. */
export function getSupportedPaymentMethods(): MembershipPaymentProvider[] {
  return getSystemConfigSnapshot().payment?.supportedMethods ?? ['wayforpay', 'credit_balance', 'native_token']
}

/** Which methods are listed as upcoming features (docs, UI badges). */
export function getFuturePaymentMethods(): MembershipPaymentProvider[] {
  return getSystemConfigSnapshot().payment?.futureMethods ?? ['stripe', 'paypal', 'nft_gate']
}

/** Check if a specific payment method is enabled for users. */
export function isPaymentMethodEnabled(provider: MembershipPaymentProvider): boolean {
  const supported = getSupportedPaymentMethods()
  return supported.includes(provider)
}

// ---------------------------------------------------------------------------
// Gateway fee configuration
// ---------------------------------------------------------------------------

/** Get the full payment config snapshot (for admin dashboards). */
export function getPaymentConfig(): PaymentConfig | undefined {
  return getSystemConfigSnapshot().payment
}

/** Get per-gateway fee/currency config — for net-revenue calculation. */
export function getGatewayConfig(
  provider: MembershipPaymentProvider,
): PaymentGatewayConfig | undefined {
  return getSystemConfigSnapshot().payment?.gateways?.[provider]
}

/**
 * Calculate net revenue for a given gateway.
 * net = amount - (amount * feePercent / 100) - feeFixed
 */
export function calculateNetRevenue(
  amount: number,
  provider: MembershipPaymentProvider,
): { gross: number; fee: number; net: number; currency: string } {
  const gw = getGatewayConfig(provider)
  const feePercent = gw?.feePercent ?? 0
  const feeFixed = gw?.feeFixedCents ?? 0
  const currency = gw?.currency ?? 'USD'

  const percentageFee = Math.round(amount * feePercent) / 100
  const totalFee = percentageFee + feeFixed
  const net = Math.round((amount - totalFee) * 100) / 100

  return { gross: amount, fee: totalFee, net, currency }
}

// ---------------------------------------------------------------------------
// Supported payment methods for user-facing UI
// ---------------------------------------------------------------------------

export interface PaymentMethodOption {
  id: MembershipPaymentProvider
  label: string
  description: string
  enabled: boolean
  isFutureFeature: boolean
  gatewayLabel?: string
}

/**
 * Build the full list of payment method options for membership upgrade UI.
 * Includes both enabled methods and future-feature TBD items.
 */
export function getMembershipPaymentOptions(): PaymentMethodOption[] {
  const supported = getSupportedPaymentMethods()
  const future = getFuturePaymentMethods()
  const config = getPaymentConfig()

  const allMethods: Array<{
    id: MembershipPaymentProvider
    label: string
    description: string
  }> = [
    {
      id: 'wayforpay',
      label: 'Card (WayForPay)',
      description: 'Pay with Visa/Mastercard via WayForPay (UAH)',
    },
    {
      id: 'stripe',
      label: 'Card (Stripe)',
      description: 'Pay with card via Stripe (USD/international)',
    },
    {
      id: 'credit_balance',
      label: 'RING Credits',
      description: 'Auto-pay monthly from your RING credit balance',
    },
    {
      id: 'native_token',
      label: 'RING Token (On-Chain)',
      description: 'Pay with RING token via sponsored Solana gas',
    },
    {
      id: 'nft_gate',
      label: 'NFT Certificate',
      description: '12-month membership via soulbound NFT certificate',
    },
    {
      id: 'paypal',
      label: 'PayPal',
      description: 'Pay with PayPal (international)',
    },
  ]

  return allMethods.map((m) => {
    const gw = config?.gateways?.[m.id]
    return {
      ...m,
      enabled: supported.includes(m.id),
      isFutureFeature: future.includes(m.id),
      gatewayLabel: gw?.label,
    }
  })
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------

export type { CardPaymentProcessor, MembershipPaymentProvider, PaymentGatewayConfig, PaymentConfig }

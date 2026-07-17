import type { PaymentPurpose, PaymentProcessorId, PaymentRail } from '@/lib/payments/conductor/types'
import { getSiteBaseUrl, getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { RING_TOKEN_ADDRESS } from '@/constants/web3'
import { StoreCurrency } from '@/features/store/types'

// Helper to fetch a processor from env, normalized to string union
function envProcessor(key: string): PaymentProcessorId | null {
  // Fetch and normalize processor value from ENV
  const v = process.env[key]?.toLowerCase().trim()
  // Only allow processors that are explicitly supported
  if (v === 'wayforpay' || v === 'stripe' || v === 'paypal') return v
  return null
}

// Default processor comes from ENV, else hard-coded fallback
const DEFAULT_PROCESSOR: PaymentProcessorId =
  envProcessor('PAYMENT_DEFAULT_PROCESSOR') ?? 'wayforpay'

// Maps PaymentPurpose (typed) to their related processor ENV key
const PURPOSE_ENV: Record<PaymentPurpose, string> = {
  store_order: 'PAYMENT_STORE_PROCESSOR',
  news_promotion: 'PAYMENT_NEWS_PROCESSOR',
  membership_upgrade: 'PAYMENT_MEMBERSHIP_PROCESSOR',
  wallet_topup: 'PAYMENT_WALLET_TOPUP_PROCESSOR',
  native_token_onramp: 'PAYMENT_NATIVE_TOKEN_ONRAMP_PROCESSOR',
  project_order: 'PAYMENT_PROJECT_ORDER_PROCESSOR',
}

/** 
 * Get processor for a specific payment purpose. 
 * This will use an override from ENV if present, else falls back to default. 
 */ 
export function getPaymentProvider(purpose: PaymentPurpose): PaymentProcessorId {
  // Try to get env override by mapped key
  const override = envProcessor(PURPOSE_ENV[purpose] ?? '')
  return override ?? DEFAULT_PROCESSOR
}

// Alias for business/domain compatibility, clarity or historical code.
export function getProcessorForPurpose(purpose: PaymentPurpose): PaymentProcessorId {
  return getPaymentProvider(purpose)
}

// TODO: If using React Server Actions in Next16, consider using caching
// and Next.js' config fetching methods for runtime configs to reduce cold lookup times.

/**
 * Gets the fiat currency used for display AND order settlement from system config (SSOT).
 * Fallbacks: process.env, then USD.
 */
export function getDefaultStoreCurrencySymbol(): StoreCurrency {
  const config = getSystemConfigSnapshot()
  // NOTE: .store?.defaultCurrency is expected to be defined in SSOT
  const raw =
    config.store?.defaultCurrency
    ?? process.env.PAYMENT_FIAT_CURRENCY?.toUpperCase()
    ?? 'USD'
  return raw as StoreCurrency
}

/**
 * Gets the array of accepted currencies for credit-based payments.
 * Priority: ring-config.json > ENV > fallback to fiat currency.
 *
 * NOTE: Each accepted value is uppercased and trimmed for comparison/robustness.
 */
export function getCreditAcceptOrderCurrencies(): string[] {
  const config = getSystemConfigSnapshot()
  const configCurrencies = config.store?.creditAcceptOrderCurrencies

  // If config explicitly lists currencies, normalize and return
  if (configCurrencies && configCurrencies.length > 0) {
    return configCurrencies.map((c) => c.trim().toUpperCase()).filter(Boolean)
  }

  // Fallback: try ENV var
  const raw = process.env.PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY?.trim()
  if (raw) {
    // Supports comma-separated values, cleans up spacing & case
    return raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
  }

  // Ultimate fallback: just use SSOT fiat currency.
  return [getDefaultStoreCurrencySymbol()]
}

/**
 * Utility to check if a given order currency is permitted for credit spending.
 * Used in guards, frontend, and API-level checks.
 */
export function canSpendCreditForOrderCurrency(orderCurrency: string): boolean {
  const allowed = getCreditAcceptOrderCurrencies()
  // Normalize input for case-insensitive compare
  return allowed.includes(orderCurrency.toUpperCase())
}

/**
 * Determines if a payment rail is enabled for a purpose.
 * Reads config and env overrides.
 * 
 * @param purpose - business context for payment
 * @param rail - which payment system/approach
 */
export function isRailEnabled(purpose: PaymentPurpose, rail: PaymentRail): boolean {
  // rail 'internal_credit' has nuanced checks for store orders
  if (rail === 'internal_credit') {
    if (purpose === 'store_order') {
      // Use config if present, else ENV flag (default true if unset)
      const config = getSystemConfigSnapshot()
      // If explicit config present, always allow credit payments for store orders
      if (config.store?.creditAcceptOrderCurrencies !== undefined) {
        return true // Explicit config always enables
      }
      // Else, use ENV; disabled ONLY if env var is explicitly 'false'
      return process.env.PAYMENT_STORE_ALLOW_CREDIT !== 'false'
    }
    // For non-store purposes, credit payments always enabled
    return true
  }

  // rail 'native_token' is only enabled if store specifically allows it in ENV
  if (rail === 'native_token') {
    return process.env.PAYMENT_STORE_ALLOW_TOKEN === 'true'
  }

  // rail 'merchant_redirect' always enabled (at code-level)
  if (rail === 'merchant_redirect') {
    return true
  }

  // Any other rails not recognized for this config are not enabled
  return false
}

/**
 * Site base URL is fetched from SSOT / ENV through shared core util.
 * Used for webhooks, payment links, etc.
 */
export function getSiteUrl(): string {
  return getSiteBaseUrl()
}

/**
 * Constructs webhook URL for payment providers in canonical format.
 * Safety strict: provider type union as parameter.
 * 
 * @param provider - currently 'wayforpay' or 'stripe'
 */
export function getWebhookUrl(provider: 'wayforpay' | 'stripe' | 'paypal'): string {
  // NOTE: Path is hard coded, consider registering route with Next.js app router for static safety
  return `${getSiteUrl()}/api/payments/${provider}/webhook`
}

/**
 * Gets config for contract-based native token payments.
 * Pulls address: several possible envs or fallback hard constant.
 * Symbol & decimals come from config or env as supported.
 */
// TODO: Consider switching to server-actions/getServerSideProps if client & server config diverges in future Next.js releases.
export function getNativeTokenConfig() {
  return {
    contractAddress:
      process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS || // Most explicit/public
      process.env.RING_CONTRACT_ADDRESS || // Deprecated, legacy
      RING_TOKEN_ADDRESS, // Hard fallback

    symbol: getNativeTokenSymbol(), // From shared chain config util
    decimals: Number(process.env.PAYMENT_TOKEN_DECIMALS || 18), // Default to 18 decimals (ERC20 standard)
  }
}

// MOCK CODE, TODO: Mocks for payment system configuration are currently not present, but if future modules need full test doubles:
// 1. Implement mock ring-config-core with entirely stubbed getSystemConfigSnapshot
// 2. Provide deterministic mock ENV getter hooks for deterministic snapshot+env tests
// 3. Optionally refactor config calls to use Next.js server/direct runtime config modules for type and hot reload safety

// TODO: When migrating to React 19/Next.js 16, investigate unification of config fetching (and server-side only exposure) using:
// - 'server-only' package for config hooks
// - Rust-based next config compiler for .env => runtime
// - next.config.js modules with static typing for non-secret config

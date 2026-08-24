import type { PaymentPurpose, PaymentProcessorId, PaymentRail, ExternalPaymentProcessorId } from '@/lib/payments/conductor/types'
import { getSiteBaseUrl, getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { getEvmTokenAddress, getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { isPaymentMethodEnabled } from '@/lib/payments/subscription/subscription-config'

/**
 * Main currency SSOT lives in `@/lib/ring-config-core`. Re-exported here so payment
 * code has one import surface and can never drift into a second implementation.
 */
export { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'

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
  task_escrow: 'PAYMENT_TASK_ESCROW_PROCESSOR',
  collective_order_slot: 'PAYMENT_COLLECTIVE_ORDER_SLOT_PROCESSOR',
  scheduled_service_slot: 'PAYMENT_SCHEDULED_SERVICE_SLOT_PROCESSOR',
  public_pool_contribution: 'PAYMENT_PUBLIC_POOL_CONTRIBUTION_PROCESSOR',
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
 * Order currencies the `credit_balance` rail is allowed to settle.
 * Priority: ring-config `store.creditBalanceAcceptedOrderCurrencies` > ENV > main currency.
 *
 * NOTE: Each accepted value is uppercased and trimmed for comparison/robustness.
 */
export function getCreditBalanceAcceptedOrderCurrencies(): string[] {
  const config = getSystemConfigSnapshot()
  const configCurrencies = config.store?.creditBalanceAcceptedOrderCurrencies

  if (configCurrencies && configCurrencies.length > 0) {
    return configCurrencies.map((c) => c.trim().toUpperCase()).filter(Boolean)
  }

  const raw = process.env.PAYMENT_CREDIT_BALANCE_ACCEPTED_ORDER_CURRENCIES?.trim()
  if (raw) {
    // Supports comma-separated values, cleans up spacing & case
    return raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
  }

  return [getMainCurrencySymbol()]
}

/**
 * Utility to check if a given order currency is permitted for credit spending.
 * Used in guards, frontend, and API-level checks.
 */
export function canSpendCreditForOrderCurrency(orderCurrency: string): boolean {
  const allowed = getCreditBalanceAcceptedOrderCurrencies()
  // Normalize input for case-insensitive compare
  return allowed.includes(orderCurrency.toUpperCase())
}

/**
 * Determines if a user-facing payment rail is enabled for a purpose.
 * Reads ring-config and env overrides.
 *
 * @param purpose - business context for payment
 * @param rail - user-facing rail the buyer picked
 */
export function isRailEnabled(purpose: PaymentPurpose, rail: PaymentRail): boolean {
  if (rail === 'credit_balance') {
    if (purpose === 'store_order') {
      const config = getSystemConfigSnapshot()
      // An explicit accepted-currency list is itself the enable signal.
      if (config.store?.creditBalanceAcceptedOrderCurrencies !== undefined) {
        return true
      }
      return process.env.PAYMENT_STORE_ALLOW_CREDIT !== 'false'
    }
    return true
  }

  if (rail === 'native_token') {
    if (purpose === 'task_escrow') {
      return process.env.PAYMENT_STORE_ALLOW_TOKEN === 'true' || process.env.PAYMENT_TASK_ESCROW_ALLOW_TOKEN === 'true'
    }
    // Membership native pay gates on membership config (payment.supportedMethods +
    // gateway registry) — NOT the store flag. This lets PaymentConductor fold
    // membership_upgrade through the native processor for ledger parity without
    // requiring PAYMENT_STORE_ALLOW_TOKEN (store-only rail gate).
    if (purpose === 'membership_upgrade') {
      return isPaymentMethodEnabled('native_token')
    }
    return process.env.PAYMENT_STORE_ALLOW_TOKEN === 'true'
  }

  if (rail === 'paypal') {
    const gateways = getSystemConfigSnapshot().payment?.gateways as
      | Record<string, { enabled?: boolean }>
      | undefined
    return gateways?.paypal?.enabled === true
  }

  // Card rail is always available at code level; PSP availability is a gateway concern.
  return rail === 'card'
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
export function getWebhookUrl(provider: ExternalPaymentProcessorId): string {
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
  // EVM contract payments only — never fall back to Solana SPL mint from getNativeTokenAddress().
  return {
    contractAddress: getEvmTokenAddress() || '0x0000000000000000000000000000000000000000',
    symbol: getNativeTokenSymbol(),
    decimals: Number(process.env.PAYMENT_TOKEN_DECIMALS || 18),
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

import type { PaymentPurpose, PaymentProcessorId, PaymentRail } from '@/lib/payments/conductor/types'
import { PORTAL_CONFIG } from '@/lib/portal-config'
import { RING_TOKEN_ADDRESS } from '@/constants/web3'

function envProcessor(key: string): PaymentProcessorId | null {
  const v = process.env[key]?.toLowerCase().trim()
  if (v === 'wayforpay' || v === 'stripe') return v
  return null
}

const DEFAULT_PROCESSOR: PaymentProcessorId =
  envProcessor('PAYMENT_DEFAULT_PROCESSOR') ?? 'wayforpay'

const PURPOSE_ENV: Record<PaymentPurpose, string> = {
  store_order: 'PAYMENT_STORE_PROCESSOR',
  news_promotion: 'PAYMENT_NEWS_PROCESSOR',
  membership_upgrade: 'PAYMENT_MEMBERSHIP_PROCESSOR',
  wallet_topup: 'PAYMENT_WALLET_TOPUP_PROCESSOR',
}

/** Kingdom-wide: which PSP handles card/redirect checkout for this purpose */
export function getPaymentProvider(purpose: PaymentPurpose): PaymentProcessorId {
  const override = envProcessor(PURPOSE_ENV[purpose] ?? '')
  return override ?? DEFAULT_PROCESSOR
}

export function getProcessorForPurpose(purpose: PaymentPurpose): PaymentProcessorId {
  return getPaymentProvider(purpose)
}

export function getFiatCurrency(): string {
  return process.env.PAYMENT_FIAT_CURRENCY?.toUpperCase() || 'USD'
}

export function getCreditAcceptOrderCurrencies(): string[] {
  const raw = process.env.PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY?.trim()
  if (!raw) return [getFiatCurrency()]
  return raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
}

export function canSpendCreditForOrderCurrency(orderCurrency: string): boolean {
  const allowed = getCreditAcceptOrderCurrencies()
  return allowed.includes(orderCurrency.toUpperCase())
}

export function isRailEnabled(purpose: PaymentPurpose, rail: PaymentRail): boolean {
  if (rail === 'internal_credit') {
    if (purpose === 'store_order') {
      return process.env.PAYMENT_STORE_ALLOW_CREDIT !== 'false'
    }
    return true
  }
  if (rail === 'native_token') {
    return process.env.PAYMENT_STORE_ALLOW_TOKEN === 'true'
  }
  if (rail === 'merchant_redirect') {
    return true
  }
  return false
}

export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    PORTAL_CONFIG.platform.baseUrl
  ).replace(/\/$/, '')
}

export function getWebhookUrl(provider: 'wayforpay' | 'stripe'): string {
  return `${getSiteUrl()}/api/payments/${provider}/webhook`
}

export function getNativeTokenConfig() {
  return {
    contractAddress:
      process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS ||
      process.env.RING_CONTRACT_ADDRESS ||
      RING_TOKEN_ADDRESS,
    symbol: process.env.PAYMENT_TOKEN_SYMBOL || PORTAL_CONFIG.tokens.ring.symbol || 'RING',
    decimals: Number(process.env.PAYMENT_TOKEN_DECIMALS || 18),
  }
}

import { z } from 'zod'
import { formDataToObject, parseFormData } from '@/lib/zod/form-data'

/** Wallet desk / topup / oracle admin FormData schemas (unique to wallet domain). */

export const walletOracleRateSchema = z.object({
  rate: z
    .string()
    .min(1, 'Rate required')
    .regex(/^\d+(\.\d+)?$/, 'Rate must be a positive number'),
})

export const walletDeskQuoteFormSchema = z.object({
  side: z.enum(['buy', 'sell']),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number'),
  amountUnit: z.enum(['points', 'native']).optional().default('points'),
})

export const walletTopupFormSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number'),
  currency: z.string().min(1).optional(),
  provider: z.enum(['wayforpay', 'stripe', 'paypal']).optional(),
  processor: z.enum(['wayforpay', 'stripe', 'paypal']).optional(),
  returnUrl: z.string().optional(),
  locale: z.string().optional(),
  source: z.string().optional(),
})

/** On-chain proof top-up (txHash → credit points) — distinct from card top-up. */
export const walletChainTopupFormSchema = z.object({
  txHash: z.string().min(1, 'Transaction hash required'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number'),
  description: z.string().optional(),
})

/** Admin/sign desk quote FormData (UI → server action). */
export const walletSignDeskQuoteFormSchema = z.object({
  side: z.enum(['buy', 'sell']),
  ringAmount: z.string().regex(/^\d+(\.\d+)?$/, 'RING amount required'),
  creditBalanceAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Credit balance amount required'),
  rate: z.string().regex(/^\d+(\.\d+)?$/, 'Rate required'),
  discountBps: z.string().regex(/^\d+$/).optional().default('0'),
})

export const walletVerifyDeskQuoteFormSchema = z.object({
  quoteToken: z.string().min(1, 'Quote token is required'),
})

export const storeCheckoutPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID required'),
  paymentMethod: z.enum(['card', 'credit_balance', 'native_token', 'paypal', 'wayforpay']),
  /** Fiat presentment code for card/paypal — server recomputes amount. */
  paymentCurrency: z.string().trim().toUpperCase().optional(),
  returnUrl: z.string().optional(),
  locale: z.string().optional(),
})

/** Place order + pay — progressive checkout FormData (`payload` = JSON orderCreate). */
export const storePlaceAndPayFormSchema = z.object({
  payload: z.string().min(2, 'Order payload required'),
  paymentMethod: z.enum(['card', 'credit_balance', 'native_token', 'paypal', 'wayforpay', 'stripe']),
  paymentCurrency: z.string().trim().toUpperCase().optional(),
  returnUrl: z.string().optional(),
  locale: z.string().optional(),
})

export { formDataToObject, parseFormData }

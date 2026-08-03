import { z } from 'zod'
import { formDataToObject } from '@/lib/zod/form-data'

/**
 * Membership FormData validation (server actions).
 * Prefer these over raw casts; React 19 forms pair with useActionState + Zod.
 */

export const membershipBillingPeriodSchema = z.enum(['monthly', 'yearly'])

export const membershipPaymentTypeSchema = z.enum([
  'membership_upgrade',
  'subscription_renewal',
  'membership_fee',
])

export const membershipProviderSchema = z.enum([
  'credit_balance',
  'native_token',
  'ring_token', // legacy alias → normalized to native_token
  'stripe',
  'wayforpay',
  'paypal',
  'nft_gate',
  'telegram_stars',
])

export const payWithCreditBalanceSchema = z.object({
  type: membershipPaymentTypeSchema,
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number')
    .optional(),
  auto_subscribe: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true' || v === undefined),
  billingPeriod: membershipBillingPeriodSchema.optional().default('monthly'),
  period: membershipBillingPeriodSchema.optional(),
})

export const payWithNativeTokenSchema = z.object({
  type: membershipPaymentTypeSchema,
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number')
    .optional(),
  auto_subscribe: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  billingPeriod: membershipBillingPeriodSchema.optional().default('monthly'),
  period: membershipBillingPeriodSchema.optional(),
})

export const payWithCardSchema = z.object({
  provider: z.enum(['stripe', 'wayforpay']).optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number')
    .optional(),
  returnUrl: z.string().optional(),
  auto_subscribe: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  billingPeriod: membershipBillingPeriodSchema.optional().default('monthly'),
  period: membershipBillingPeriodSchema.optional(),
})

export const createSubscriptionSchema = z.object({
  provider: membershipProviderSchema.optional().default('credit_balance'),
  auto_renew: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v !== false && v !== 'false'),
  billingPeriod: membershipBillingPeriodSchema.optional().default('monthly'),
  period: membershipBillingPeriodSchema.optional(),
})

export const cancelSubscriptionSchema = z.object({
  immediate: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v !== false && v !== 'false'),
  reason: z.string().max(500).optional(),
})

/** Initiate membership upgrade (card/credit/PayPal) from PaymentModal / member-upgrade-gate. */
export const initiateMembershipPaymentSchema = z.object({
  targetRole: z.string().min(1, 'Target membership role is required'),
  returnUrl: z.string().optional(),
  paymentMethod: z
    .enum(['credit_balance', 'card', 'stripe', 'wayforpay', 'paypal', 'native_token'])
    .optional()
    .default('credit_balance'),
  billingPeriod: membershipBillingPeriodSchema.optional().default('monthly'),
})

/** Shared JSON body schema for membership payment API routes (card / paypal / token). */
export const membershipApiPaymentBodySchema = z.object({
  type: membershipPaymentTypeSchema,
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a valid positive number')
    .optional(),
  auto_subscribe: z.boolean().default(true),
  billingPeriod: membershipBillingPeriodSchema.optional().default('monthly'),
  provider: z.enum(['stripe', 'wayforpay']).optional(),
  rail: z.enum(['account_credit', 'on_chain_ring']).optional(),
  toAddress: z.string().optional(),
})

export function parseMembershipForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const parsed = schema.safeParse(formDataToObject(formData))
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    return { success: false as const, error: msg || 'Invalid form data' }
  }
  return { success: true as const, data: parsed.data }
}

export { formDataToObject }

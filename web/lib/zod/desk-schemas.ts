import { z } from 'zod'

export const DeskOrderSideSchema = z.enum(['buy', 'sell'])
export const DeskOrderStatusSchema = z.enum([
  'pending',
  'credit_held',
  'chain_submitted',
  'settled',
  'failed',
  'refunded',
])

export const DeskOrderSchema = z.object({
  idempotency_key: z.string().min(8).max(128),
  user_id: z.string().uuid(),
  side: DeskOrderSideSchema,
  status: DeskOrderStatusSchema,
  quote_token: z.string().min(1),
  ring_amount_raw: z.string(),
  credit_amount_usd: z.string(),
  sell_tax_ring_raw: z.string().optional(),
  first_settler_discount_applied: z.boolean().optional(),
  chain_signature: z.string().optional(),
  wallet_transaction_id: z.string().optional(),
  failure_reason: z.string().optional(),
})

export type DeskOrder = z.infer<typeof DeskOrderSchema> & { id?: string }
export type DeskOrderSide = z.infer<typeof DeskOrderSideSchema>
export type DeskOrderStatus = z.infer<typeof DeskOrderStatusSchema>

export const DeskQuoteRequestSchema = z.object({
  side: DeskOrderSideSchema,
  /** Buy: credit points (whole number). Sell: native token UI amount. */
  amount: z.string().min(1),
})

export const DeskExecuteRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  quoteToken: z.string().min(1),
})

export type DeskQuoteRequest = z.infer<typeof DeskQuoteRequestSchema>
export type DeskExecuteRequest = z.infer<typeof DeskExecuteRequestSchema>

/**
 * WayForPay webhook Zod schema — route-level validation wrapper.
 *
 * ⚠️ CRITICAL: The preprocess function MUST NOT transform values.
 * WayForPay HMAC verification uses `Object.values(payload).join(';')` on the
 * raw payload — any value transformation (e.g. string→number) would invalidate
 * the signature.  This schema validates shape only, then passes through so the
 * dispatcher and verify functions receive the exact payload WayForPay sent.
 */

import { z } from 'zod'

/** Fields that every WayForPay webhook carries. */
const wayforpayBaseShape = {
  orderReference: z.string().min(1, 'orderReference is required'),
  merchantSignature: z.string().min(1, 'merchantSignature is required'),
  merchantAccount: z.string().optional(),
  transactionStatus: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  reasonCode: z.union([z.number(), z.string()]).optional(),
  reason: z.string().optional(),
  cardPan: z.string().optional(),
  authCode: z.string().optional(),
  cardType: z.string().optional(),
  settlementAmount: z.union([z.number(), z.string()]).optional(),
  settlementCurrency: z.string().optional(),
  fee: z.union([z.number(), z.string()]).optional(),
  createdDate: z.union([z.number(), z.string()]).optional(),
  processingDate: z.union([z.number(), z.string()]).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  d3AcsUrl: z.string().optional(),
  authorization_ticket: z.string().optional(),
  recToken: z.string().optional(),
} as const

/**
 * Preprocess: validate the raw body is a JSON object, then pass through
 * WITHOUT transforming any values — HMAC integrity depends on raw values.
 */
function normalizeWayforPayBody(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('WayForPay webhook payload must be a JSON object')
  }
  return raw
}

/**
 * Canonical WayForPay webhook schema.
 * - `.passthrough()` allows extra fields WayForPay may send
 * - `.strip()` on unknown fields would NOT affect HMAC (Object.values skips
 *   prototype)
 */
export const wayforpayWebhookSchema = z.preprocess(
  normalizeWayforPayBody,
  z.object(wayforpayBaseShape).passthrough(),
)

export type WayforpayWebhookInput = z.infer<typeof wayforpayWebhookSchema>

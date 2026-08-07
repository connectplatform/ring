/**
 * Stripe webhook Zod schema — route-level validation wrapper.
 *
 * ⚠️ CRITICAL: The Stripe webhook route receives raw text (not JSON)
 * for signature verification via `stripe.webhooks.constructEvent`.
 * This schema validates the bytes-like input before passing to the
 * Stripe SDK for signature verification.
 *
 * Pattern mirrors `wayforpay-webhook-schema.ts` — validates shape
 * without transforming values (Stripe SDK needs raw Buffer/bytes).
 */

import { z } from 'zod'

/**
 * Preprocess: validate the raw body is a non-empty string or Buffer.
 * Stripe webhooks send `application/json` with a raw body that must be
 * passed unmodified to `constructEvent()`. We ensure it's truthy.
 */
function normalizeStripeBody(raw: unknown): unknown {
  if (!raw) throw new Error('Stripe webhook body must not be empty')
  if (typeof raw === 'string') return raw
  if (Buffer.isBuffer(raw)) return raw
  if (typeof raw === 'object') {
    // Some runtimes expose the body as a parsed object — reject early
    throw new Error('Stripe webhook requires raw body (text), not parsed JSON')
  }
  return raw
}

/**
 * Stripe webhook input schema.
 * Validates that the raw body is a non-empty string-like value.
 * Signature validation is deferred to `stripe.webhooks.constructEvent()`.
 */
export const stripeWebhookInputSchema = z.preprocess(
  normalizeStripeBody,
  z.union([z.string().min(1), z.instanceof(Buffer)]),
)

export type StripeWebhookInput = z.infer<typeof stripeWebhookInputSchema>

/**
 * SubscriptionConductor — multi-provider membership subscription facade.
 *
 * Mirrors the PaymentConductor pattern: routes subscription lifecycle
 * operations (create, cancel, renew, query) by provider. Each provider
 * implements the `SubscriptionProviderModule` contract.
 *
 * The subscription_ledger collection is SSOT for all subscription state.
 * Gateway-specific references (stripe_subscription_id, wayforpay_rec_token,
 * paypal_subscription_id, solana_tx_signature, nft_mint_address) are stored per-row.
 *
 * SSOT hierarchy:
 *   1. ring-config.json → payment.cardPaymentProcessor   (default card gateway)
 *   2. ring-config.json → payment.gateways               (fee rates)
 *   3. subscription_ledger DB collection                 (subscriber state)
 *
 * // TODO: If SubscriptionConductor is reused by API routes, refactor as a
 * class to leverage React Server components or Next.js 16 server actions, if beneficial.
 */

import 'server-only'

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import {
  subscriptionLedgerSchema,
} from '@/lib/payments/subscription/subscription-ledger-schema'
import type {
  SubscriptionLedgerRow,
  SubscriptionLedgerFilter,
  SubscriptionStats,
  SubscriptionProvider,
  SubscriptionLedgerStatus,
} from '@/lib/payments/subscription/subscription-ledger-schema'
import {
  getCardPaymentProcessor,
  getGatewayConfig,
  calculateNetRevenue,
  getSupportedPaymentMethods,
} from '@/lib/payments/subscription/subscription-config'
import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
  SubscriptionProviderModule,
} from '@/lib/payments/subscription/subscription-types'
import { ringCreditSubscriptionProvider } from '@/lib/payments/subscription/providers/ring-credit-subscription'
import { nativeTokenSubscriptionProvider } from '@/lib/payments/subscription/providers/native-token-subscription'
import { stripeSubscriptionProvider } from '@/lib/payments/subscription/providers/stripe-subscription'
import { wayforpaySubscriptionProvider } from '@/lib/payments/subscription/providers/wayforpay-subscription'
import { nftGateSubscriptionProvider } from '@/lib/payments/subscription/providers/nft-gate-subscription'
import { paypalSubscriptionProvider } from '@/lib/payments/subscription/providers/paypal-subscription'
import { telegramStarsSubscriptionProvider } from '@/lib/payments/subscription/providers/telegram-stars-subscription'
// paypalSubscriptionProvider — Subscriptions v1 (recurring) + Orders v2 one-shot
// telegramStarsSubscriptionProvider — Telegram Stars (XTR) Mini App invoices

/**
 * Provider registry: map provider identifier (string) to
 * the actual implementation module used for that provider.
 * This supports extensible providers.
 */
const providerRegistry = new Map<SubscriptionProvider, SubscriptionProviderModule>([
  ['credit_balance', ringCreditSubscriptionProvider],
  ['native_token', nativeTokenSubscriptionProvider],
  ['stripe', stripeSubscriptionProvider],
  ['wayforpay', wayforpaySubscriptionProvider],
  ['nft_gate', nftGateSubscriptionProvider], // Metaplex Core + GateEscrow (MVP-A)
  ['paypal', paypalSubscriptionProvider],    // PaymentConductor Orders v2 + webhook capture
  ['telegram_stars', telegramStarsSubscriptionProvider],
])

/**
 * Resolve a provider module from its id.
 * Throws if provider is unknown. Ensures the conductor cannot operate on an unsupported provider.
 */
function resolveProvider(provider: SubscriptionProvider): SubscriptionProviderModule {
  const mod = providerRegistry.get(provider)
  if (!mod) throw new Error(`Unknown subscription provider: ${provider}`)
  return mod
}

const COLLECTION = 'subscription_ledger'

/**
 * Insert a new row into the subscription_ledger. Handles all the
 * row field defaults, including setting the next payment due date.
 * Throws on db failure. Used in happy path for successful payment/creation workflow.
 */
async function insertLedgerRow(
  input: CreateSubscriptionInput,
  gatewayReference?: string,
  options?: {
    status?: SubscriptionLedgerStatus
    /** Prefer provider-issued id (e.g. Stars invoice payload `stars_<uuid>`). */
    preferredId?: string
    extraFields?: Partial<Record<string, string>>
  },
): Promise<SubscriptionLedgerRow> {
  const now = Date.now()
  const period = 30 * 24 * 60 * 60 * 1000 // 30 days — mirrors Membership.sol
  const nextPaymentDue = now + period
  const status = options?.status ?? 'active'
  const isPending = status === 'pending'

  const row: Omit<SubscriptionLedgerRow, 'id'> = {
    user_id: input.userId,
    provider: input.provider,
    gateway: input.gateway,
    method: input.method,
    status,
    amount: input.amount,
    currency: input.currency,
    gateway_fee_percent: input.gatewayFeePercent,
    gateway_fee_fixed: input.gatewayFeeFixed ?? 0,
    start_time: now,
    next_payment_due: nextPaymentDue,
    failed_attempts: 0,
    max_failed_attempts: 3,
    auto_renew: true,
    total_paid: isPending ? '0' : String(input.amount),
    payments_count: isPending ? 0 : 1,
    created_at: now,
    updated_at: now,
  }

  // Build a unique id for this subscription.
  // Stars: use invoice payload as ledger id so successful_payment can find the row.
  const preferred = options?.preferredId?.trim()
  const id =
    preferred && preferred.length > 0
      ? preferred
      : `sub_${now}_${input.userId.slice(-8)}`
  // Compose row with possible gateway reference (for Stripe, WayForPay, PayPal etc.).
  const gatewayFields = gatewayReference
    ? gatewayRefToField(input.provider, gatewayReference)
    : {}
  const extra = options?.extraFields ?? {}
  const result = await db().createDoc(
    COLLECTION,
    {
      ...row,
      id,
      ...gatewayFields,
      ...extra,
    },
    { id },
  )

  if (!result.success) {
    throw result.error ?? new Error('Failed to create subscription_ledger row')
  }

  return {
    id,
    ...row,
    ...gatewayFields,
    ...extra,
  } as SubscriptionLedgerRow
}

/**
 * Map a gateway reference to its database field, depending on the provider.
 * Expands the ledger row's shape on creation with gateway-related keys.
 */
function gatewayRefToField(
  provider: SubscriptionProvider,
  ref: string,
): Partial<Record<string, string>> {
  // Map each provider type to its expected reference column
  switch (provider) {
    case 'stripe':
      return { stripe_subscription_id: ref }
    case 'wayforpay':
      return { wayforpay_rec_token: ref }
    case 'native_token':
      return { solana_tx_signature: ref }
    case 'nft_gate':
      return { nft_mint_address: ref }
    case 'paypal':
      return { paypal_subscription_id: ref }
    case 'telegram_stars':
      // Prefer storing invoice payload when ref looks like stars_*; otherwise invoice URL.
      if (ref.startsWith('stars_')) {
        return { telegram_stars_payload: ref }
      }
      return { telegram_stars_invoice_link: ref }
    // STUB: Add more mappings as providers are implemented.
    default:
      return {}
  }
}

// ---------------------------------------------------------------------------
// User role integration — hooks for subscription lifecycle events
// ---------------------------------------------------------------------------

/**
 * Upgrade user role to MEMBER on subscription activation.
 * Relies on the centralized upgradeUserRole to ensure SSOT for roles.
 */
async function upgradeUserRoleOnSubscription(
  userId: string,
  paymentReference: string,
  paymentAmount: number,
  paymentCurrency: string,
): Promise<void> {
  try {
    // Lazy import to minimize cold-start for unrelated requests
    const { upgradeUserRole } = await import(
      '@/features/auth/services/upgrade-user-role'
    )
    const { UserRolesArray } = await import('@/features/auth/user-role')

    // Upgrade to 'member' using the payment information as audit trail.
    const result = await upgradeUserRole(userId, UserRolesArray.member, {
      paymentReference,
      paymentAmount,
      paymentCurrency,
      authCode: '', // Not applicable for subscription payments
    })

    if (result.success) {
      logger.info('SubscriptionConductor: user role upgraded to member', {
        userId,
        paymentReference,
      })
    } else {
      logger.warn('SubscriptionConductor: failed to upgrade user role', {
        userId,
        error: result.error,
      })
    }
  } catch (error) {
    // Log but tolerate, as this shouldn't block subscription creation
    logger.error('SubscriptionConductor: user role upgrade error', {
      userId,
      error,
    })
  }
}

/**
 * Downgrade user role to SUBSCRIBER when a membership subscription is cancelled or expired.
 * Only downgrades if the user's only path to MEMBER was via subscription.
 * No-op if user is admin or confidential.
 */
async function downgradeUserRoleOnCancellation(userId: string): Promise<void> {
  try {
    const { db } = await import('@/lib/database')
    const { UserRolesArray } = await import('@/features/auth/user-role')

    const userResult = await db().findDocById<Record<string, unknown>>('users', userId)
    if (!userResult.success || !userResult.data) return

    const user = userResult.data
    const currentRole = user.role as string

    // Only downgrade if currently MEMBER (not admin/etc).
    if (currentRole !== UserRolesArray.member) return

    // Transition from MEMBER → SUBSCRIBER (logs for audit).
    await db().updateDoc('users', userId, {
      role: UserRolesArray.subscriber,
      updatedAt: new Date(),
    })

    logger.info('SubscriptionConductor: user role downgraded to subscriber', {
      userId,
      previousRole: currentRole,
    })
  } catch (error) {
    logger.error('SubscriptionConductor: user role downgrade error', {
      userId,
      error,
    })
  }
}

export const SubscriptionConductor = {
  // ---- Subscription Lifecycle ----

  /**
   * Create a membership subscription for the given input.
   * Delegates to the correct provider module, then inserts a row
   * in the ledger. Also upgrades user role on success.
   */
  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    // Resolve the payment/subscription provider module
    const providerMod = resolveProvider(input.provider)
    // Attempt to create a subscription with the payment provider
    const result = await providerMod.createSubscription(input)

    if (!result.success) {
      // Provider creation failed, return error (do not persist ledger row)
      return result
    }

    // For WayForPay, recToken is set by webhook, but may be returned as metadata in input.
    // Choose metadata.recToken (if available) or use provider's returned gatewayReference.
    const gatewayReference =
      result.gatewayReference ??
      (input.metadata?.recToken ? String(input.metadata.recToken) : undefined)
    const ledgerStatus = result.ledgerStatus ?? 'active'

    // Stars: invoice payload (`stars_<uuid>`) is the ledger id + lookup key for successful_payment.
    const starsPayload =
      input.provider === 'telegram_stars' &&
      typeof result.subscriptionId === 'string' &&
      result.subscriptionId.startsWith('stars_')
        ? result.subscriptionId
        : undefined
    const starsInvoiceUrl =
      starsPayload
        ? result.redirect?.url || result.redirectUrl || undefined
        : undefined

    try {
      // Persist the subscription in the ledger (SSOT)
      const row = await insertLedgerRow(input, gatewayReference, {
        status: ledgerStatus,
        preferredId: starsPayload,
        extraFields: starsPayload
          ? {
              telegram_stars_payload: starsPayload,
              ...(starsInvoiceUrl
                ? { telegram_stars_invoice_link: starsInvoiceUrl }
                : {}),
            }
          : undefined,
      })
      logger.info('SubscriptionConductor: subscription created', {
        userId: input.userId,
        provider: input.provider,
        ledgerId: row.id,
        ledgerStatus,
        gatewayReference: result.gatewayReference,
      })

      // Promote user to member only when ledger is active (not pending redirect flows)
      if (ledgerStatus === 'active') {
        await upgradeUserRoleOnSubscription(
          input.userId,
          row.id,
          input.amount,
          input.currency,
        )
      }

      // Append ledger id as subscriptionId on result for downstream use
      return {
        ...result,
        subscriptionId: row.id,
      }
    } catch (error) {
      // Ledger insert failed, but payment may have succeeded. Log and return best effort.
      logger.error('SubscriptionConductor: ledger insert failed', {
        userId: input.userId,
        provider: input.provider,
        error,
      })
      // Don't abort: subscription could be reconciled later by a cron job
      return result
    }
  },

  /**
   * Cancel a user's active subscription for a given provider.
   * Cancels with the external/payment gateway, then marks all active ledger rows as cancelled.
   * If this was their only route to MEMBER, downgrades user role.
   */
  async cancelSubscription(
    userId: string,
    provider: SubscriptionProvider,
    gatewayReference?: string,
  ): Promise<CancelSubscriptionResult> {
    // 1. Cancel with provider/gateway
    const providerMod = resolveProvider(provider)
    const result = await providerMod.cancelSubscription(userId, gatewayReference)

    if (!result.success) {
      return result
    }

    try {
      // 2. Mark all ledger entries as cancelled for user+provider+active (defensive in case of duplicate or old subs).
      const now = Date.now()
      for (const status of ['active', 'pending'] as const) {
        const rows = await db().queryDocs<Record<string, unknown>>({
          collection: COLLECTION,
          filters: [
            { field: 'user_id', operator: '==', value: userId },
            { field: 'provider', operator: '==', value: provider },
            { field: 'status', operator: '==', value: status },
          ],
        })

        if (rows.success && rows.data) {
          for (const row of rows.data) {
            await db().updateDoc(COLLECTION, String(row.id), {
              status: 'cancelled',
              cancelled_at: now,
              auto_renew: false,
              updated_at: now,
            }).catch(() => { /* best-effort, tolerate partial failures */ })
          }
        }
      }

      // Attempt user role downgrade, if appropriate.
      await downgradeUserRoleOnCancellation(userId)

      logger.info('SubscriptionConductor: subscription cancelled', { userId, provider })
    } catch (error) {
      logger.error('SubscriptionConductor: ledger cancel failed', { userId, provider, error })
    }

    return result
  },

  /**
   * Renew a subscription for a user with the given provider.
   * Delegates to the payment module, and updates ledger with new due date, payments count, etc.
   */
  async renewSubscription(
    userId: string,
    provider: SubscriptionProvider,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult> {
    // 1. Trigger provider renewal (external payment, token burn, etc.)
    const providerMod = resolveProvider(provider)
    const result = await providerMod.renewSubscription(userId, gatewayReference)

    if (!result.success) {
      return result
    }

    try {
      const now = Date.now()
      // Next payment due date from provider, or default to now + period
      const nextDue = result.nextPaymentDue ?? (now + 30 * 24 * 60 * 60 * 1000)

      // Find latest subscription ledger entry for this user/provider (most recent by created_at)
      const rows = await db().queryDocs<Record<string, unknown>>({
        collection: COLLECTION,
        filters: [
          { field: 'user_id', operator: '==', value: userId },
          { field: 'provider', operator: '==', value: provider },
        ],
        orderBy: [{ field: 'created_at', direction: 'desc' }],
        pagination: { limit: 1 },
      })

      if (rows.success && rows.data?.[0]) {
        const row = rows.data[0]
        // Update ledger: mark as active, update next due, increment payments, reset failures
        await db().updateDoc(COLLECTION, String(row.id), {
          status: 'active',
          next_payment_due: nextDue,
          failed_attempts: 0,
          total_paid: String(Number(row.total_paid ?? 0) + Number(row.amount ?? 0)),
          payments_count: (Number(row.payments_count) || 0) + 1,
          updated_at: now,
        })
      }

      logger.info('SubscriptionConductor: subscription renewed', { userId, provider, nextDue })
    } catch (error) {
      logger.error('SubscriptionConductor: ledger renew failed', { userId, provider, error })
    }

    return result
  },

  // ---- Manual status update (admin / cron reconciliation) ----

  /**
   * Update subscription status manually. Used by:
   *   - Admin dashboard (force-active, force-cancelled)
   *   - Cron reconciliations (grace_period → active, grace_period → expired)
   *   - Webhook-driven status transitions that bypass the provider module
   * Only updates fields present in `patch`. Returns updated row or null.
   */
  async updateSubscriptionStatus(
    userId: string,
    patch: {
      status?: SubscriptionLedgerStatus
      auto_renew?: boolean
      next_payment_due?: number
      failed_attempts?: number
      cancelled_at?: number
      expired_at?: number
      payments_count?: number
      total_paid?: string
      paypal_subscription_id?: string
      metadata?: Record<string, unknown>
    },
  ): Promise<SubscriptionLedgerRow | null> {
    try {
      // Always operate on latest ledger row for this user
      const existing = await this.getSubscription(userId)
      if (!existing) return null

      const now = Date.now()
      // Merge patch fields into updateFields while preserving missing keys.
      const updateFields: Record<string, unknown> = {
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.auto_renew !== undefined && { auto_renew: patch.auto_renew }),
        ...(patch.next_payment_due !== undefined && { next_payment_due: patch.next_payment_due }),
        ...(patch.failed_attempts !== undefined && { failed_attempts: patch.failed_attempts }),
        ...(patch.cancelled_at !== undefined && { cancelled_at: patch.cancelled_at }),
        ...(patch.expired_at !== undefined && { expired_at: patch.expired_at }),
        ...(patch.payments_count !== undefined && { payments_count: patch.payments_count }),
        ...(patch.total_paid !== undefined && { total_paid: patch.total_paid }),
        ...(patch.paypal_subscription_id !== undefined && {
          paypal_subscription_id: patch.paypal_subscription_id,
        }),
        ...(patch.metadata && { metadata: { ...(existing as { metadata?: Record<string, unknown> }).metadata, ...patch.metadata } }),
        updated_at: now,
      }

      const result = await db().updateDoc(COLLECTION, existing.id, updateFields)
      if (!result.success) {
        // Log and return stale data if update fails.
        logger.warn('SubscriptionConductor: updateSubscriptionStatus failed', {
          userId,
          error: result.error,
        })
        return existing // return stale data on error
      }

      logger.info('SubscriptionConductor: status updated', {
        userId,
        subscriptionId: existing.id,
        oldStatus: existing.status,
        newStatus: patch.status ?? existing.status,
      })

      // Return patched record as SubscriptionLedgerRow
      return { ...existing, ...updateFields, id: existing.id } as SubscriptionLedgerRow
    } catch (error) {
      logger.error('SubscriptionConductor: updateSubscriptionStatus error', {
        userId,
        error: error instanceof Error ? error.message : error,
      })
      return null
    }
  },

  // ---- Querying Subscription State ----

  /**
   * Insert an already-paid ledger row without calling the payment provider.
   * Used by Orders v2 CAPTURE webhooks (one-shot membership) so we never
   * re-enter PayPal create from a webhook.
   */
  async recordPaidSubscription(
    input: CreateSubscriptionInput,
    gatewayReference?: string,
  ): Promise<SubscriptionLedgerRow> {
    const row = await insertLedgerRow(input, gatewayReference, { status: 'active' })
    await upgradeUserRoleOnSubscription(
      input.userId,
      row.id,
      input.amount,
      input.currency,
    )
    logger.info('SubscriptionConductor: paid subscription recorded', {
      userId: input.userId,
      provider: input.provider,
      ledgerId: row.id,
      gatewayReference,
    })
    return row
  },

  /**
   * Look up a ledger row by PayPal Subscriptions v1 id (I-…).
   */
  async findByPaypalSubscriptionId(
    paypalSubscriptionId: string,
  ): Promise<SubscriptionLedgerRow | null> {
    if (!paypalSubscriptionId) return null
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters: [
        { field: 'paypal_subscription_id', operator: '==', value: paypalSubscriptionId },
      ],
      pagination: { limit: 1 },
    })
    if (!result.success || !result.data?.length) return null
    const parsed = subscriptionLedgerSchema.safeParse(result.data[0])
    return parsed.success ? parsed.data : null
  },

  /**
   * Look up Telegram Stars pending/active row by invoice payload (`stars_<uuid>`).
   * Primary key is the payload (ledger id); falls back to telegram_stars_payload field.
   */
  async findByTelegramStarsPayload(
    invoicePayload: string,
  ): Promise<SubscriptionLedgerRow | null> {
    const payload = String(invoicePayload || '').trim()
    if (!payload.startsWith('stars_')) return null

    const byId = await db().readDoc<Record<string, unknown>>(COLLECTION, payload)
    if (byId.success && byId.data) {
      const parsed = subscriptionLedgerSchema.safeParse(byId.data)
      if (parsed.success) return parsed.data
    }

    const result = await db().queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters: [
        { field: 'telegram_stars_payload', operator: '==', value: payload },
      ],
      pagination: { limit: 1 },
    })
    if (!result.success || !result.data?.length) return null
    const parsed = subscriptionLedgerSchema.safeParse(result.data[0])
    return parsed.success ? parsed.data : null
  },

  /**
   * Activate a pending telegram_stars ledger after SuccessfulPayment.
   * Idempotent on telegram_payment_charge_id. Upgrades user to MEMBER.
   */
  async activateTelegramStarsPayment(params: {
    invoicePayload: string
    telegramPaymentChargeId: string
    totalAmount?: number
    currency?: string
  }): Promise<{ ok: boolean; alreadyActive?: boolean; reason?: string }> {
    const payload = String(params.invoicePayload || '').trim()
    const chargeId = String(params.telegramPaymentChargeId || '').trim()
    if (!payload.startsWith('stars_') || !chargeId) {
      return { ok: false, reason: 'invalid_payload_or_charge_id' }
    }

    const row = await this.findByTelegramStarsPayload(payload)
    if (!row) {
      logger.warn('SubscriptionConductor: Stars activate — no ledger row', { payload })
      return { ok: false, reason: 'ledger_not_found' }
    }

    if (row.provider !== 'telegram_stars') {
      return { ok: false, reason: 'wrong_provider' }
    }

    if (
      row.status === 'active' &&
      row.telegram_payment_charge_id &&
      row.telegram_payment_charge_id === chargeId
    ) {
      return { ok: true, alreadyActive: true }
    }

    if (row.status === 'active' && row.telegram_payment_charge_id) {
      // Different charge against already-active row — treat as renewal-ish idempotent ack
      logger.info('SubscriptionConductor: Stars charge on already-active row', {
        ledgerId: row.id,
        chargeId,
        existingCharge: row.telegram_payment_charge_id,
      })
      return { ok: true, alreadyActive: true }
    }

    const now = Date.now()
    const period = 30 * 24 * 60 * 60 * 1000
    const amount =
      typeof params.totalAmount === 'number' && params.totalAmount > 0
        ? params.totalAmount
        : Number(row.amount) || 0
    const currency = String(params.currency || row.currency || 'XTR').toUpperCase()

    const updateResult = await db().updateDoc(COLLECTION, row.id, {
      status: 'active',
      telegram_payment_charge_id: chargeId,
      telegram_stars_payload: payload,
      next_payment_due: now + period,
      payments_count: Math.max(1, Number(row.payments_count) || 0),
      total_paid: String(amount),
      failed_attempts: 0,
      currency,
      updated_at: now,
    })

    if (!updateResult.success) {
      logger.error('SubscriptionConductor: Stars activate update failed', {
        ledgerId: row.id,
        error: updateResult.error,
      })
      return { ok: false, reason: 'update_failed' }
    }

    await upgradeUserRoleOnSubscription(row.user_id, row.id, amount, currency)

    logger.info('SubscriptionConductor: Stars payment activated', {
      userId: row.user_id,
      ledgerId: row.id,
      chargeId,
      amount,
      currency,
    })

    return { ok: true }
  },

  /**
   * Get the latest subscription ledger row for a user.
   * Used for showing active subscription or for mutation lookups.
   */
  async getSubscription(userId: string): Promise<SubscriptionLedgerRow | null> {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters: [{ field: 'user_id', operator: '==', value: userId }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 1 },
    })

    if (!result.success || !result.data?.length) return null

    // Validate/parse with zod schema before returning from DB.
    const parsed = subscriptionLedgerSchema.safeParse(result.data[0])
    return parsed.success ? parsed.data : null
  },

  /**
   * Query multiple subscription rows, filtering on status, provider, due dates, etc.
   * Returns validated parsed rows, up to 200 by created desc.
   */
  async getSubscriptions(
    filter: SubscriptionLedgerFilter = {},
  ): Promise<SubscriptionLedgerRow[]> {
    const dbFilters: Array<{ field: string; operator: string; value: unknown }> = []

    if (filter.user_id) dbFilters.push({ field: 'user_id', operator: '==', value: filter.user_id })
    if (filter.provider) dbFilters.push({ field: 'provider', operator: '==', value: filter.provider })
    if (filter.status) dbFilters.push({ field: 'status', operator: '==', value: filter.status })
    if (filter.method) dbFilters.push({ field: 'method', operator: '==', value: filter.method })
    if (filter.due_before) dbFilters.push({ field: 'next_payment_due', operator: '<', value: filter.due_before })
    if (filter.due_after) dbFilters.push({ field: 'next_payment_due', operator: '>', value: filter.due_after })

    const result = await db().queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters: dbFilters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 200 },
    })

    if (!result.success || !result.data) return []

    // Only return rows passing zod schema validation.
    return result.data
      .map((row) => subscriptionLedgerSchema.safeParse(row))
      .filter((p) => p.success)
      .map((p) => p.data)
  },

  /**
   * Calculate aggregate stats on subscriptions — counts by status,
   * by provider, due for payment, etc. Used for dashboards/analytics.
   */
  async getStats(): Promise<SubscriptionStats> {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      pagination: { limit: 1000 },
    })

    // Initialize default stats structure for all supported status/provider
    const stats: SubscriptionStats = {
      total_active: 0,
      total_grace_period: 0,
      total_expired: 0,
      total_cancelled: 0,
      total_suspended: 0,
      due_for_payment: 0,
      by_provider: {
        stripe: 0,
        wayforpay: 0,
        credit_balance: 0,
        native_token: 0,
        nft_gate: 0,
        paypal: 0,
        telegram_stars: 0,
      },
      by_method: {},
    }

    if (!result.success || !result.data) return stats

    const now = Date.now()

    for (const raw of result.data) {
      const parsed = subscriptionLedgerSchema.safeParse(raw)
      if (!parsed.success) continue
      const row = parsed.data

      // Increment status/aggregate counters
      switch (row.status) {
        case 'active': stats.total_active++; break
        case 'grace_period': stats.total_grace_period++; break
        case 'expired': stats.total_expired++; break
        case 'cancelled': stats.total_cancelled++; break
        case 'suspended': stats.total_suspended++; break
      }

      // Count due for payment if current time is after next_payment_due
      if (row.status === 'active' && row.next_payment_due <= now) {
        stats.due_for_payment++
      }

      // Group count by provider if recognized
      if (row.provider in stats.by_provider) {
        stats.by_provider[row.provider]++
      }

      // Group count by payment method (initialize if needed)
      const method = row.method
      stats.by_method[method] = (stats.by_method[method] ?? 0) + 1
    }

    return stats
  },

  // ---- Revenue & Payment Information ----

  /**
   * Quick calculation for net revenue (amount - fee) for a given ledger row.
   */
  calculateNetRevenue(row: SubscriptionLedgerRow) {
    return calculateNetRevenue(row.amount, row.provider)
  },

  /**
   * Get which card processor should be used for memberships for paywall/checkout UI.
   * Pure proxy to the config SSOT.
   */
  getCardPaymentProcessor,

  // TODO: If these API methods are called directly from Next.js server actions,
  // consider annotating as 'use server' and leveraging route handlers instead of exported JS API object for greater type-strictness and streaming options in React 19/Next 16.
}

// ---------------------------------------------------------------------------
// Re-export utility API for cron-pipelines and external importers
// ---------------------------------------------------------------------------

export { getSupportedPaymentMethods, getGatewayConfig, calculateNetRevenue }
export type {
  SubscriptionLedgerRow,
  SubscriptionLedgerFilter,
  SubscriptionStats,
  SubscriptionProvider,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
}

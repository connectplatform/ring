import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import {
  convertToMainCurrency,
  getExchangeRates,
  getMainCurrencySymbol,
} from '@/lib/ring-oracle'
import type { SupportedCurrencies } from '@/lib/ring-config-types'
import type {
  PaymentProcessorId,
  PaymentPurpose,
  PaymentRail,
  PaymentTransactionStatus,
} from '@/lib/payments/conductor/types'

export interface PaymentTransactionRecord {
  id: string
  purpose: PaymentPurpose
  processor: PaymentProcessorId
  rail: PaymentRail
  order_reference: string
  entity_type: string
  entity_id: string
  user_id?: string
  /** Charged amount in minor units of `currency` (e.g. cents). */
  amount_minor?: number
  /** Charged / presentment currency code (fiat or token symbol). */
  currency?: string
  /** Project main currency at transaction time (SSOT: store.mainCurrency). */
  main_currency?: SupportedCurrencies
  /** Charged amount converted to main currency minor units at transaction FX. */
  main_currency_amount_minor?: number
  /**
   * Charged units per 1 main-currency unit at transaction time
   * (same semantics as exchangeRates[currency] / exchangeRates[main]).
   */
  fx_rate?: number
  status: PaymentTransactionStatus
  status_history: Array<{ status: PaymentTransactionStatus; at: string; meta?: Record<string, unknown> }>
  processor_payload?: Record<string, unknown>
  /** Checkout metadata (poolSlug, amountNativeToken, …) */
  metadata?: Record<string, unknown>
  paid_at?: string
  created_at: string
  updated_at: string
}

function nowIso() {
  return new Date().toISOString()
}

/** Stamp main-currency equivalent + FX rate for ledger audit. */
function stampMainCurrencyFx(input: {
  amountMinor?: number
  currency?: string
}): {
  main_currency: SupportedCurrencies
  main_currency_amount_minor?: number
  fx_rate?: number
} {
  const main = getMainCurrencySymbol()
  const code = (input.currency || main).trim().toUpperCase() || main
  const rates = getExchangeRates()
  const mainRate = rates[main]
  const chargedRate = rates[code]

  let fx_rate: number | undefined
  if (
    typeof chargedRate === 'number' &&
    chargedRate > 0 &&
    typeof mainRate === 'number' &&
    mainRate > 0
  ) {
    fx_rate = chargedRate / mainRate
  } else if (code === main) {
    fx_rate = 1
  }

  let main_currency_amount_minor: number | undefined
  if (typeof input.amountMinor === 'number' && Number.isFinite(input.amountMinor)) {
    if (code === main) {
      main_currency_amount_minor = Math.round(input.amountMinor)
    } else {
      const major = input.amountMinor / 100
      const mainMajor = convertToMainCurrency(major, code)
      main_currency_amount_minor = Math.round(mainMajor * 100)
    }
  }

  return { main_currency: main, main_currency_amount_minor, fx_rate }
}

export const paymentTransactionService = {
  async findByOrderReference(orderReference: string): Promise<PaymentTransactionRecord | null> {
    const result = await db().queryDocs<PaymentTransactionRecord>({
      collection: 'payment_transactions',
      filters: [{ field: 'order_reference', operator: '==', value: orderReference }],
      pagination: { limit: 1 },
    })
    if (!result.success || !result.data?.length) return null
    const row = result.data[0]
    return { ...row, id: row.id }
  },

  async createPending(input: {
    purpose: PaymentPurpose
    processor: PaymentProcessorId
    rail: PaymentRail
    orderReference: string
    entityType: string
    entityId: string
    userId?: string
    amountMinor?: number
    currency?: string
    metadata?: Record<string, unknown>
  }): Promise<PaymentTransactionRecord> {
    const existing = await this.findByOrderReference(input.orderReference)
    if (existing) return existing

    const id = `pay-${input.orderReference}`.slice(0, 255)
    const ts = nowIso()
    const fx = stampMainCurrencyFx({
      amountMinor: input.amountMinor,
      currency: input.currency,
    })
    const record: PaymentTransactionRecord = {
      id,
      purpose: input.purpose,
      processor: input.processor,
      rail: input.rail,
      order_reference: input.orderReference,
      entity_type: input.entityType,
      entity_id: input.entityId,
      user_id: input.userId,
      amount_minor: input.amountMinor,
      currency: input.currency,
      ...fx,
      status: 'created',
      status_history: [{ status: 'created', at: ts }],
      metadata: input.metadata,
      created_at: ts,
      updated_at: ts,
    }

    const created = await db().createDoc('payment_transactions', record, { id })
    if (!created.success) {
      logger.error('payment_transactions create failed', { error: created.error, id })
      throw created.error || new Error('Failed to create payment transaction')
    }
    return record
  },

  async appendStatus(
    orderReference: string,
    status: PaymentTransactionStatus,
    meta?: Record<string, unknown>
  ): Promise<void> {
    const row = await this.findByOrderReference(orderReference)
    if (!row) return

    const ts = nowIso()
    const history = [...(row.status_history || []), { status, at: ts, meta }]
    const update: Partial<PaymentTransactionRecord> = {
      status,
      status_history: history,
      updated_at: ts,
    }
    if (status === 'paid') update.paid_at = ts
    if (meta?.processor_payload) {
      update.processor_payload = meta.processor_payload as Record<string, unknown>
    }

    await db().updateDoc('payment_transactions', row.id, {
      ...row,
      ...update,
    })
  },

  async markRedirected(orderReference: string): Promise<void> {
    await this.appendStatus(orderReference, 'redirected')
  },

  async markPaid(
    orderReference: string,
    processorPayload?: Record<string, unknown>
  ): Promise<boolean> {
    const row = await this.findByOrderReference(orderReference)
    if (!row?.id) return false
    if (row.status === 'paid') return false

    return db().transaction(async (txn) => {
      const locked = await txn.read('payment_transactions', row.id)
      if (!locked) return false

      const current = {
        id: locked.id,
        ...(locked.data as Omit<PaymentTransactionRecord, 'id'>),
      } as PaymentTransactionRecord

      if (current.status === 'paid') return false

      const ts = nowIso()
      const history = [
        ...(current.status_history || []),
        {
          status: 'paid' as const,
          at: ts,
          meta: processorPayload ? { processor_payload: processorPayload } : undefined,
        },
      ]

      await txn.update('payment_transactions', row.id, {
        ...current,
        status: 'paid',
        status_history: history,
        updated_at: ts,
        paid_at: ts,
        ...(processorPayload
          ? { processor_payload: processorPayload as Record<string, unknown> }
          : {}),
      })
      return true
    })
  },

  /**
   * List payment_transactions for a user (admin Payments tab).
   * Defaults to membership_upgrade + wallet_topup purposes.
   */
  async listByUserId(
    userId: string,
    opts?: { purposes?: PaymentPurpose[]; limit?: number },
  ): Promise<PaymentTransactionRecord[]> {
    const purposes = opts?.purposes ?? (['membership_upgrade', 'wallet_topup'] as PaymentPurpose[])
    const limit = opts?.limit ?? 50

    const result = await db().queryDocs<PaymentTransactionRecord>({
      collection: 'payment_transactions',
      filters: [{ field: 'user_id', operator: '==', value: userId }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: Math.max(limit * 3, 100) },
    })

    if (!result.success || !result.data?.length) {
      return []
    }

    const purposeSet = new Set(purposes)
    return result.data
      .filter((row) => purposeSet.has(row.purpose))
      .slice(0, limit)
      .map((row) => ({ ...row, id: row.id }))
  },
}

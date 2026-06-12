import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
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
  amount_minor?: number
  currency?: string
  status: PaymentTransactionStatus
  status_history: Array<{ status: PaymentTransactionStatus; at: string; meta?: Record<string, unknown> }>
  processor_payload?: Record<string, unknown>
  paid_at?: string
  created_at: string
  updated_at: string
}

function nowIso() {
  return new Date().toISOString()
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
  }): Promise<PaymentTransactionRecord> {
    const existing = await this.findByOrderReference(input.orderReference)
    if (existing) return existing

    const id = `pay-${input.orderReference}`.slice(0, 255)
    const ts = nowIso()
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
      status: 'created',
      status_history: [{ status: 'created', at: ts }],
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
    if (row?.status === 'paid') return false

    await this.appendStatus(orderReference, 'paid', {
      processor_payload: processorPayload,
    })
    return true
  },
}

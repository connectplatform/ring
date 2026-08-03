import 'server-only'

import { db } from '@/lib/database'
import { ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { spendCreditsForEscrow } from '@/lib/escrow/credit-spend'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { syncOpportunityDiscovery } from '@/features/opportunities/lib/opportunity-mutation-sync'
import {
  asCollectiveOrderMetadata,
  type CollectiveOrderMetadata,
} from '@/features/opportunities/types/type-metadata'
import type {
  CollectiveOrderEscrow,
  ReserveCollectiveOrderSlotInput,
} from '@/features/opportunities/types/collective-order-escrow'
import type { CreateCheckoutResult } from '@/lib/payments/conductor/types'

export type ReserveSlotResult = {
  success: boolean
  error?: string
  escrow?: CollectiveOrderEscrow
  checkout?: CreateCheckoutResult
  opportunityClosed?: boolean
  slotsFilled?: number
  slotCount?: number
}

function newEscrowId(): string {
  return `cos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export class CollectiveOrderEscrowService {
  async getById(escrowId: string): Promise<CollectiveOrderEscrow | null> {
    const result = await db().readDoc<CollectiveOrderEscrow>('collective_order_escrows', escrowId)
    if (!result.success || !result.data) return null
    return result.data
  }

  async listByOpportunity(opportunityId: string): Promise<CollectiveOrderEscrow[]> {
    const result = await db().queryDocs({
      collection: 'collective_order_escrows',
      filters: [{ field: 'opportunityId', operator: '=', value: opportunityId }],
      pagination: { limit: 500 },
    })
    if (!result.success || !result.data) return []
    return result.data as unknown as CollectiveOrderEscrow[]
  }

  private async readOpportunityRaw(
    opportunityId: string,
  ): Promise<(Record<string, unknown> & { id: string }) | null> {
    const result = await db().findDocById<Record<string, unknown>>('opportunities', opportunityId)
    if (!result.success || !result.data) return null
    return { ...result.data, id: opportunityId }
  }

  private getMeta(opp: Record<string, unknown>): CollectiveOrderMetadata {
    const meta = asCollectiveOrderMetadata(opp.metadata)
    if (!meta) {
      throw new ValidationError('Opportunity is missing collective_order metadata')
    }
    return meta
  }

  private async persistMetadata(
    opportunityId: string,
    opp: Record<string, unknown>,
    meta: CollectiveOrderMetadata,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const existingMeta =
      opp.metadata && typeof opp.metadata === 'object'
        ? (opp.metadata as Record<string, unknown>)
        : {}
    const updateResult = await db().updateDoc(
      'opportunities',
      opportunityId,
      {
        metadata: { ...existingMeta, ...meta },
        dateUpdated: new Date().toISOString(),
        ...extra,
      },
      { merge: true },
    )
    if (!updateResult.success) {
      throw new ValidationError(updateResult.error?.message || 'Failed to update opportunity')
    }
  }

  /**
   * Reconcile slotsFilled from authoritative held escrow count (idempotent / race-safe).
   */
  private async reconcileSlotsFromHeld(
    opportunityId: string,
    escrow?: CollectiveOrderEscrow,
  ): Promise<{
    success: boolean
    error?: string
    escrow?: CollectiveOrderEscrow
    opportunityClosed?: boolean
    slotsFilled?: number
    slotCount?: number
  }> {
    const opp = await this.readOpportunityRaw(opportunityId)
    if (!opp) return { success: false, error: 'Opportunity not found' }

    let meta: CollectiveOrderMetadata
    try {
      meta = this.getMeta(opp)
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Invalid metadata' }
    }

    const rows = await this.listByOpportunity(opportunityId)
    const heldCount = rows.filter((r) => r.paymentStatus === 'held').length
    const slotsFilled = Math.min(meta.slotCount, heldCount)
    const funded = slotsFilled >= meta.slotCount
    const nextMeta: CollectiveOrderMetadata = {
      ...meta,
      slotsFilled,
      escrowStatus: funded ? 'funded' : meta.escrowStatus === 'funded' ? 'funded' : 'open',
      escrowPoolId: meta.escrowPoolId || opportunityId,
    }

    // Oversell guard: if this escrow pushed held past slotCount, fail it out
    if (escrow && heldCount > meta.slotCount && escrow.paymentStatus === 'held') {
      const now = new Date().toISOString()
      await db().updateDoc('collective_order_escrows', escrow.id, {
        paymentStatus: 'failed',
        updatedAt: now,
        refundReference: 'over_capacity',
      })
      logger.warn('Collective order oversell rejected', {
        escrowId: escrow.id,
        opportunityId,
        heldCount,
        slotCount: meta.slotCount,
      })
      // Recompute without this escrow
      const heldAfter = heldCount - 1
      const filledAfter = Math.min(meta.slotCount, heldAfter)
      const fundedAfter = filledAfter >= meta.slotCount
      await this.persistMetadata(opportunityId, opp, {
        ...meta,
        slotsFilled: filledAfter,
        escrowStatus: fundedAfter ? 'funded' : 'open',
      })
      return {
        success: false,
        error: 'All slots were already filled',
        slotsFilled: filledAfter,
        slotCount: meta.slotCount,
      }
    }

    if (meta.slotsFilled !== slotsFilled || (funded && meta.escrowStatus !== 'funded')) {
      await this.persistMetadata(opportunityId, opp, nextMeta, {
        ...(funded ? { status: 'closed', isActive: false } : {}),
      })

      await syncOpportunityDiscovery({
        opportunityId,
        event: funded ? 'status_changed' : 'updated',
        snippet: {
          type: 'collective_order',
          slotsFilled,
          slotCount: meta.slotCount,
          escrowStatus: nextMeta.escrowStatus,
          message: funded
            ? `Collective order filled (${slotsFilled}/${meta.slotCount})`
            : `Collective order ${slotsFilled}/${meta.slotCount} slots filled`,
        },
      })
    }

    return {
      success: true,
      escrow,
      opportunityClosed: funded,
      slotsFilled,
      slotCount: meta.slotCount,
    }
  }

  /**
   * Reserve a slot: credit spends immediately; card/PayPal creates pending + checkout.
   */
  async reserveSlot(input: ReserveCollectiveOrderSlotInput): Promise<ReserveSlotResult> {
    const opp = await this.readOpportunityRaw(input.opportunityId)
    if (!opp) return { success: false, error: 'Opportunity not found' }
    if (String(opp.type) !== 'collective_order') {
      return { success: false, error: 'Not a collective_order opportunity' }
    }

    let meta: CollectiveOrderMetadata
    try {
      meta = this.getMeta(opp)
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Invalid metadata' }
    }

    if (meta.escrowStatus !== 'open') {
      return { success: false, error: 'Collective order is no longer open' }
    }

    const existing = await this.listByOpportunity(input.opportunityId)
    const heldOrPending = existing.filter(
      (row) => row.paymentStatus === 'held' || row.paymentStatus === 'pending',
    )
    if (heldOrPending.length >= meta.slotCount || meta.slotsFilled >= meta.slotCount) {
      return { success: false, error: 'All slots are filled' }
    }

    const userHeldOrPending = existing.filter(
      (row) =>
        row.userId === input.userId &&
        (row.paymentStatus === 'held' || row.paymentStatus === 'pending'),
    )
    if (!meta.allowMultiSlot && userHeldOrPending.length > 0) {
      return { success: false, error: 'You already reserved a slot for this offer' }
    }

    const now = new Date().toISOString()
    const escrowId = newEscrowId()
    const escrow: CollectiveOrderEscrow = {
      id: escrowId,
      opportunityId: input.opportunityId,
      userId: input.userId,
      amount: meta.slotPrice,
      currency: meta.currency || getMainCurrencySymbol(),
      rail: input.rail,
      paymentStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    }

    const createResult = await db().createDoc('collective_order_escrows', escrow, { id: escrowId })
    if (!createResult.success) {
      return {
        success: false,
        error: createResult.error?.message || 'Failed to create escrow row',
      }
    }

    if (input.rail === 'credit_balance') {
      const spend = await spendCreditsForEscrow({
        userId: input.userId,
        amount: meta.slotPrice,
        description: `Collective order slot for ${input.opportunityId}`,
        referenceId: `cos_fund_${escrowId}`,
        metadata: {
          purpose: 'collective_order_slot',
          opportunityId: input.opportunityId,
          escrowId,
        },
      })
      if (spend.success === false) {
        await db().updateDoc('collective_order_escrows', escrowId, {
          paymentStatus: 'failed',
          updatedAt: new Date().toISOString(),
        })
        return { success: false, error: spend.error }
      }

      const marked = await this.markHeldFromPayment(escrowId, `credit_${escrowId}`, {
        rail: 'credit_balance',
      })
      return {
        success: marked.success,
        error: marked.error,
        escrow: marked.escrow,
        opportunityClosed: marked.opportunityClosed,
        slotsFilled: marked.slotsFilled,
        slotCount: marked.slotCount,
      }
    }

    const checkout = await PaymentConductor.createCheckout({
      purpose: 'collective_order_slot',
      rail: 'card',
      userId: input.userId,
      userEmail: input.userEmail,
      entityId: escrowId,
      orderId: escrowId,
      collectiveOrderEscrowId: escrowId,
      amount: meta.slotPrice,
      currency: meta.currency || getMainCurrencySymbol(),
      returnUrl: input.returnUrl,
      locale: input.locale,
      metadata: {
        purpose: 'collective_order_slot',
        opportunityId: input.opportunityId,
        collectiveOrderEscrowId: escrowId,
        ...(input.processor ? { processor: input.processor } : {}),
      },
    })

    if (!checkout.success) {
      await db().updateDoc('collective_order_escrows', escrowId, {
        paymentStatus: 'failed',
        updatedAt: new Date().toISOString(),
      })
      return { success: false, error: checkout.error || 'Checkout failed', escrow }
    }

    if (checkout.paid && checkout.orderReference) {
      const marked = await this.markHeldFromPayment(escrowId, checkout.orderReference, {
        rail: input.rail,
      })
      return {
        success: marked.success,
        error: marked.error,
        escrow: marked.escrow,
        checkout,
        opportunityClosed: marked.opportunityClosed,
        slotsFilled: marked.slotsFilled,
        slotCount: marked.slotCount,
      }
    }

    await db().updateDoc('collective_order_escrows', escrowId, {
      orderReference: checkout.orderReference,
      updatedAt: new Date().toISOString(),
    })

    return { success: true, escrow, checkout }
  }

  /**
   * Idempotent: pending → held, then reconcile slotsFilled from held escrow count.
   * Held retries re-run reconcile so a failed metadata write cannot permanently undercount.
   */
  async markHeldFromPayment(
    escrowId: string,
    orderReference: string,
    payload?: Record<string, unknown>,
  ): Promise<{
    success: boolean
    error?: string
    escrow?: CollectiveOrderEscrow
    opportunityClosed?: boolean
    slotsFilled?: number
    slotCount?: number
  }> {
    const escrow = await this.getById(escrowId)
    if (!escrow) return { success: false, error: 'Escrow not found' }

    if (escrow.paymentStatus === 'held') {
      return this.reconcileSlotsFromHeld(escrow.opportunityId, escrow)
    }

    if (escrow.paymentStatus !== 'pending') {
      return { success: false, error: `Escrow status is ${escrow.paymentStatus}` }
    }

    const now = new Date().toISOString()
    const claim = await db().updateDoc('collective_order_escrows', escrowId, {
      paymentStatus: 'held',
      orderReference,
      heldAt: now,
      updatedAt: now,
      ...(payload?.txHash ? { paymentTransactionId: String(payload.txHash) } : {}),
    })
    if (!claim.success) {
      return { success: false, error: claim.error?.message || 'Failed to mark held' }
    }

    // Soft CAS: confirm we landed on held (concurrent writers may race)
    const after = await this.getById(escrowId)
    if (!after || after.paymentStatus !== 'held') {
      return { success: false, error: 'Failed to claim escrow as held' }
    }

    const reconciled = await this.reconcileSlotsFromHeld(escrow.opportunityId, after)
    logger.info('Collective order slot held', {
      escrowId,
      opportunityId: escrow.opportunityId,
      slotsFilled: reconciled.slotsFilled,
      funded: reconciled.opportunityClosed,
    })
    return reconciled
  }
}

export const collectiveOrderEscrowService = new CollectiveOrderEscrowService()

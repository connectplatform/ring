import { MessageService } from '@/features/chat/services/message-service'
import type { Message, TaskMetadata } from '@/features/chat/types'
import type { TaskEscrow, TaskEscrowFundInput } from '@/features/tasks/types/escrow'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import {
  getMainCurrencyCreditAccountingRate,
  getNativeTokenPerMainCurrencyRate,
} from '@/lib/ring-oracle'
import { refundStorePayment } from '@/lib/payments/wayforpay-store-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { getNativeChain, getNativeTokenDecimals } from '@/lib/ring-config-chain'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { db } from '@/lib/database'
import { ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { normalizeValueDenomination, type ValueDenomination } from '@/lib/value-denomination'
import { notifyTaskEscrowHeld } from '@/features/tasks/services/notify'

export const NON_CREDIT_ESCROW_MESSAGE =
  'Complete checkout to fund escrow (card or native token)'

export type TaskEscrowFundResult = {
  success: boolean
  error?: string
  message?: Message
  escrowId?: string
  needsCheckout?: boolean
}

export class TaskEscrowService {
  private messages = new MessageService()

  async getById(escrowId: string): Promise<TaskEscrow | null> {
    return this.readEscrow(escrowId)
  }

  async listAdminHeld(limit = 100): Promise<TaskEscrow[]> {
    const result = await db().queryDocs({
      collection: 'task_escrows',
      filters: [{ field: 'paymentStatus', operator: '==', value: 'held' }],
      orderBy: [{ field: 'updatedAt', direction: 'desc' }],
      pagination: { limit },
    })
    if (!result.success || !result.data) return []
    return (result.data as unknown as TaskEscrow[]).filter((row) => Boolean(row?.id))
  }

  private async readEscrow(escrowId: string): Promise<TaskEscrow | null> {
    const result = await db().readDoc<TaskEscrow>('task_escrows', escrowId)
    if (!result.success || !result.data) return null
    return result.data
  }

  private async persistMessageMetadata(messageId: string, meta: TaskMetadata): Promise<Message> {
    return this.messages.updateMessage(messageId, {
      metadata: meta as unknown as Record<string, unknown>,
    })
  }

  private paymentDataType(
    currencyType: NonNullable<TaskMetadata['budget']>['currencyType'],
  ): ValueDenomination {
    return normalizeValueDenomination(currencyType, 'credit_balance')
  }

  /**
   * Claim escrow from `held` → target before moving money (true CAS via FOR UPDATE txn).
   */
  private async claimHeldEscrow(
    escrowId: string,
    to: 'released' | 'refunded',
    extra: Partial<TaskEscrow> = {},
  ): Promise<{ claimed: boolean; escrow: TaskEscrow | null }> {
    return db().transaction(async (txn) => {
      const locked = await txn.read('task_escrows', escrowId)
      if (!locked) return { claimed: false, escrow: null }

      const escrow = {
        id: locked.id,
        ...(locked.data as Omit<TaskEscrow, 'id'>),
      } as TaskEscrow

      if (escrow.paymentStatus === to) {
        return { claimed: false, escrow }
      }
      if (escrow.paymentStatus !== 'held') {
        return { claimed: false, escrow }
      }

      const now = new Date().toISOString()
      const patch: Partial<TaskEscrow> = {
        paymentStatus: to,
        updatedAt: now,
        ...(to === 'released' ? { releasedAt: now } : { refundedAt: now }),
        ...extra,
      }

      await txn.update('task_escrows', escrowId, patch)
      return { claimed: true, escrow: { ...escrow, ...patch } }
    })
  }

  /** Revert a CAS claim back to held when money move fails (status-gated). */
  private async revertEscrowToHeld(escrowId: string): Promise<void> {
    await db().transaction(async (txn) => {
      const locked = await txn.read('task_escrows', escrowId)
      if (!locked) return

      const escrow = locked.data as TaskEscrow
      if (escrow.paymentStatus !== 'released' && escrow.paymentStatus !== 'refunded') {
        return
      }

      const now = new Date().toISOString()
      await txn.update('task_escrows', escrowId, {
        paymentStatus: 'held',
        updatedAt: now,
        releasedAt: null,
        refundedAt: null,
        releaseReference: null,
        refundReference: null,
      })
    })
  }

  /**
   * Create pending escrow doc + message metadata (checkout rails).
   */
  async createPendingEscrowForCheckout(input: TaskEscrowFundInput): Promise<{
    escrow: TaskEscrow
    message: Message
  }> {
    const message = await this.messages.getMessage(input.messageId)
    if (!message) {
      throw new ValidationError('Task message not found')
    }

    let meta = (message.metadata ?? {}) as unknown as TaskMetadata
    const escrow = await this.createEscrowDoc({
      reporterUserId: input.reporterUserId,
      assigneeUserId: input.assigneeUserId,
      messageId: input.messageId,
      conversationId: input.conversationId,
      amount: input.budget.amount,
      currencyType: input.budget.currencyType,
      currencyCode: input.budget.currencyCode,
      paymentStatus: 'pending',
    })

    meta = {
      ...meta,
      escrow: {
        enabled: true,
        escrowId: escrow.id,
        paymentStatus: 'pending',
      },
    }

    const updated = await this.persistMessageMetadata(input.messageId, meta)
    return { escrow, message: updated }
  }

  /**
   * Webhook / inline checkout success → pending → held.
   */
  async markHeldFromPayment(
    escrowId: string,
    orderReference: string,
    paymentData: Record<string, unknown>,
  ): Promise<Message | null> {
    const cas = await db().transaction(async (txn) => {
      const locked = await txn.read('task_escrows', escrowId)
      if (!locked) return { ok: false as const, reason: 'missing' as const, escrow: null }

      const escrow = {
        id: locked.id,
        ...(locked.data as Omit<TaskEscrow, 'id'>),
      } as TaskEscrow

      if (escrow.paymentStatus === 'held') {
        return { ok: true as const, reason: 'already' as const, escrow }
      }
      if (escrow.paymentStatus !== 'pending') {
        return { ok: false as const, reason: 'bad_status' as const, escrow }
      }

      const now = new Date().toISOString()
      const patch: Partial<TaskEscrow> = {
        paymentStatus: 'held',
        updatedAt: now,
        orderReference,
        paymentTransactionId: orderReference,
      }
      await txn.update('task_escrows', escrowId, patch)
      return { ok: true as const, reason: 'claimed' as const, escrow: { ...escrow, ...patch } }
    })

    if (!cas.ok || !cas.escrow) {
      if (cas.reason === 'missing') {
        logger.error('markHeldFromPayment: escrow not found', { escrowId, orderReference })
      } else {
        logger.warn('markHeldFromPayment: escrow not pending', {
          escrowId,
          orderReference,
          status: cas.escrow?.paymentStatus,
        })
      }
      return null
    }

    const escrow = cas.escrow
    const message = await this.messages.getMessage(escrow.messageId)
    if (!message) return null

    if (cas.reason === 'already') {
      return message
    }

    let meta = (message.metadata ?? {}) as unknown as TaskMetadata
    const payType = this.paymentDataType(escrow.currencyType)

    meta = {
      ...meta,
      escrow: {
        enabled: true,
        escrowId,
        paymentStatus: 'held',
        payment_data: {
          type: payType,
          transactionId: orderReference,
          status: 'held',
          ...(paymentData.txHash ? { txHash: String(paymentData.txHash) } : {}),
        },
      },
    }

    const updated = await this.persistMessageMetadata(escrow.messageId, meta)

    void notifyTaskEscrowHeld({
      reporterUserId: escrow.reporterUserId,
      conversationId: escrow.conversationId,
      messageId: escrow.messageId,
      escrowId,
    })

    return updated
  }

  /**
   * Fund escrow after the task message exists.
   */
  async fundOnCreate(input: TaskEscrowFundInput): Promise<TaskEscrowFundResult> {
    if (!input.escrowEnabled || !input.budget) {
      return { success: true }
    }

    if (input.budget.currencyType === 'main_currency' || input.budget.currencyType === 'native_token') {
      const { escrow } = await this.createPendingEscrowForCheckout(input)
      return {
        success: true,
        needsCheckout: true,
        escrowId: escrow.id,
      }
    }

    if (input.budget.currencyType !== 'credit_balance') {
      return { success: false, error: NON_CREDIT_ESCROW_MESSAGE }
    }

    const message = await this.messages.getMessage(input.messageId)
    if (!message) {
      return { success: false, error: 'Task message not found' }
    }

    let meta = (message.metadata ?? {}) as unknown as TaskMetadata
    const amountStr = String(input.budget.amount)

    let escrow: TaskEscrow
    try {
      escrow = await this.createEscrowDoc({
        reporterUserId: input.reporterUserId,
        assigneeUserId: input.assigneeUserId,
        messageId: input.messageId,
        conversationId: input.conversationId,
        amount: input.budget.amount,
        currencyType: input.budget.currencyType,
        currencyCode: input.budget.currencyCode,
        paymentStatus: 'pending',
      })
    } catch (error) {
      logger.error('Task escrow doc create failed', { messageId: input.messageId, error })
      meta = {
        ...meta,
        escrow: { enabled: true, paymentStatus: 'failed' },
      }
      await this.persistMessageMetadata(input.messageId, meta)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create escrow record',
      }
    }

    const fundRef = `task_escrow_fund_${escrow.id}`
    try {
      await creditBalanceService.spendCredits(
        input.reporterUserId,
        {
          amount: amountStr,
          description: `Task escrow hold for message ${input.messageId}`,
          reference_id: fundRef,
          metadata: {
            purpose: 'task_escrow',
            messageId: input.messageId,
            conversationId: input.conversationId,
            escrowId: escrow.id,
          },
        },
        'purchase',
        getMainCurrencyCreditAccountingRate(),
      )
    } catch (error) {
      logger.error('Task escrow credit fund failed', { messageId: input.messageId, error })
      const now = new Date().toISOString()
      await db().updateDoc('task_escrows', escrow.id, {
        paymentStatus: 'failed',
        updatedAt: now,
      })
      meta = {
        ...meta,
        escrow: {
          enabled: true,
          escrowId: escrow.id,
          paymentStatus: 'failed',
        },
      }
      await this.persistMessageMetadata(input.messageId, meta)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fund escrow',
        escrowId: escrow.id,
      }
    }

    try {
      const held = await db().transaction(async (txn) => {
        const locked = await txn.read('task_escrows', escrow.id)
        if (!locked) {
          throw new ValidationError('Escrow record missing after fund')
        }
        const current = {
          id: locked.id,
          ...(locked.data as Omit<TaskEscrow, 'id'>),
        } as TaskEscrow
        if (current.paymentStatus === 'held') {
          return current
        }
        if (current.paymentStatus !== 'pending') {
          throw new ValidationError(
            `Escrow cannot move to held from status ${current.paymentStatus}`,
          )
        }
        const now = new Date().toISOString()
        const patch: Partial<TaskEscrow> = {
          paymentStatus: 'held',
          updatedAt: now,
          paymentTransactionId: fundRef,
        }
        await txn.update('task_escrows', escrow.id, patch)
        return { ...current, ...patch }
      })

      meta = {
        ...meta,
        escrow: {
          enabled: true,
          escrowId: held.id,
          paymentStatus: 'held',
          payment_data: {
            type: 'credit_balance',
            transactionId: fundRef,
            status: 'held',
          },
        },
      }

      const updated = await this.persistMessageMetadata(input.messageId, meta)
      return { success: true, message: updated, escrowId: held.id }
    } catch (error) {
      logger.error('Task escrow hold finalize failed; compensating', {
        messageId: input.messageId,
        escrowId: escrow.id,
        error,
      })
      const compensateRef = `task_escrow_compensate_${escrow.id}`
      try {
        await creditBalanceService.addFiatUsd(
          input.reporterUserId,
          amountStr,
          `Task escrow compensate (failed hold) ${input.messageId}`,
          'desk_refund',
          {
            purpose: 'task_escrow',
            messageId: input.messageId,
            escrowId: escrow.id,
            refundReference: compensateRef,
          },
          compensateRef,
        )
      } catch (refundError) {
        logger.error('Task escrow compensate refund failed', {
          messageId: input.messageId,
          escrowId: escrow.id,
          refundError,
        })
      }

      const now = new Date().toISOString()
      await db().updateDoc('task_escrows', escrow.id, {
        paymentStatus: 'failed',
        updatedAt: now,
        refundReference: compensateRef,
      })
      meta = {
        ...meta,
        escrow: {
          enabled: true,
          escrowId: escrow.id,
          paymentStatus: 'failed',
        },
      }
      await this.persistMessageMetadata(input.messageId, meta)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize escrow hold',
        escrowId: escrow.id,
      }
    }
  }

  async releaseOnAccept(messageId: string, meta: TaskMetadata): Promise<TaskMetadata> {
    if (!meta.escrow?.enabled || meta.escrow.paymentStatus !== 'held') {
      return meta
    }

    const assigneeUserId = meta.assigneeUserId
    if (!assigneeUserId) {
      throw new ValidationError('Assignee is required to release escrow')
    }

    const escrowId = meta.escrow.escrowId
    if (!escrowId) {
      throw new ValidationError('Escrow record is missing')
    }

    const amount = meta.budget?.amount
    const releaseRef = `task_escrow_release_${escrowId}`
    const { claimed, escrow } = await this.claimHeldEscrow(escrowId, 'released', {
      assigneeUserId,
      releaseReference: releaseRef,
    })

    if (!claimed) {
      if (escrow?.paymentStatus === 'released') {
        return {
          ...meta,
          escrow: {
            ...meta.escrow,
            paymentStatus: 'released',
            payment_data: {
              ...(meta.escrow.payment_data ?? { type: 'credit_balance', status: 'released' }),
              status: 'released',
            },
          },
        }
      }
      throw new ValidationError('Escrow is not held for release')
    }

    const releaseAmount = escrow?.amount ?? amount
    if (!releaseAmount || !Number.isFinite(releaseAmount)) {
      await this.revertEscrowToHeld(escrowId)
      throw new ValidationError('Escrow amount is missing')
    }

    const currencyType = escrow?.currencyType ?? meta.budget?.currencyType ?? 'credit_balance'
    const ledgerRef = escrow?.releaseReference ?? releaseRef

    try {
      if (currencyType === 'credit_balance') {
        await creditBalanceService.addFiatUsd(
          assigneeUserId,
          String(releaseAmount),
          `Task escrow release for message ${messageId}`,
          'desk_sell',
          {
            purpose: 'task_escrow',
            messageId,
            escrowId,
            releaseReference: ledgerRef,
          },
          ledgerRef,
        )
      } else if (currencyType === 'main_currency') {
        await creditBalanceService.addFiatUsd(
          assigneeUserId,
          String(releaseAmount),
          `Task escrow fiat release (platform books) ${messageId}`,
          'desk_sell',
          {
            purpose: 'task_escrow',
            messageId,
            escrowId,
            releaseReference: ledgerRef,
            orderReference: escrow?.orderReference,
          },
          ledgerRef,
        )
      } else if (currencyType === 'native_token') {
        const transferred = await this.tryTreasuryTransferToUser(
          assigneeUserId,
          String(releaseAmount),
        )
        if (!transferred) {
          const nativePerMain = Number(await getNativeTokenPerMainCurrencyRate())
          const creditEquivalent =
            Number.isFinite(nativePerMain) && nativePerMain > 0
              ? (releaseAmount * nativePerMain).toFixed(2)
              : String(releaseAmount)
          logger.warn('Task escrow native release: treasury transfer unavailable; crediting assignee', {
            escrowId,
            assigneeUserId,
            creditEquivalent,
          })
          await creditBalanceService.addFiatUsd(
            assigneeUserId,
            creditEquivalent,
            `Task escrow native release (credit equivalent) ${messageId}`,
            'desk_sell',
            {
              purpose: 'task_escrow',
              messageId,
              escrowId,
              releaseReference: ledgerRef,
              fallback: 'credit_equivalent',
            },
            ledgerRef,
          )
        }
      }
    } catch (error) {
      await this.revertEscrowToHeld(escrowId)
      throw error
    }

    return {
      ...meta,
      escrow: {
        ...meta.escrow,
        paymentStatus: 'released',
        payment_data: {
          ...(meta.escrow.payment_data ?? {
            type: this.paymentDataType(currencyType),
            status: 'released',
          }),
          transactionId: ledgerRef,
          status: 'released',
        },
      },
    }
  }

  async refundOnCancel(
    messageId: string,
    meta: TaskMetadata,
    reporterUserId: string,
  ): Promise<TaskMetadata> {
    if (!meta.escrow?.enabled || meta.escrow.paymentStatus !== 'held') {
      return meta
    }

    const escrowId = meta.escrow.escrowId
    if (!escrowId) {
      throw new ValidationError('Escrow record is missing')
    }

    const escrow = await this.readEscrow(escrowId)
    const refundReference = `task_escrow_refund_${escrowId}`
    const { claimed, escrow: claimedEscrow } = await this.claimHeldEscrow(escrowId, 'refunded', {
      refundReference,
    })

    if (!claimed) {
      if (claimedEscrow?.paymentStatus === 'refunded') {
        return {
          ...meta,
          escrow: {
            ...meta.escrow,
            paymentStatus: 'refunded',
            payment_data: {
              ...(meta.escrow.payment_data ?? { type: 'credit_balance', status: 'refunded' }),
              status: 'refunded',
            },
          },
        }
      }
      if (claimedEscrow?.paymentStatus === 'released') {
        return meta
      }
      throw new ValidationError('Escrow is not held for refund')
    }

    const refundAmount = claimedEscrow?.amount ?? escrow?.amount ?? meta.budget?.amount
    if (!refundAmount || !Number.isFinite(refundAmount)) {
      await this.revertEscrowToHeld(escrowId)
      throw new ValidationError('Escrow amount is missing')
    }

    const currencyType =
      claimedEscrow?.currencyType ?? escrow?.currencyType ?? meta.budget?.currencyType ?? 'credit_balance'

    try {
      if (currencyType === 'credit_balance') {
        await creditBalanceService.addFiatUsd(
          reporterUserId,
          String(refundAmount),
          `Task escrow refund for message ${messageId}`,
          'desk_refund',
          {
            purpose: 'task_escrow',
            messageId,
            escrowId,
            refundReference,
          },
          refundReference,
        )
      } else if (currencyType === 'main_currency') {
        const orderReference = escrow?.orderReference ?? claimedEscrow?.orderReference
        if (orderReference) {
          const tx = await paymentTransactionService.findByOrderReference(orderReference)
          if (tx?.processor === 'wayforpay') {
            const currency = escrow?.currencyCode ?? meta.budget?.currencyCode ?? getMainCurrencySymbol()
            const result = await refundStorePayment(
              orderReference,
              refundAmount,
              currency,
              `Task escrow refund ${escrowId}`,
            )
            if (!result.success) {
              await this.revertEscrowToHeld(escrowId)
              throw new ValidationError(result.error ?? 'WayForPay refund failed')
            }
          } else if (tx?.processor === 'stripe') {
            await this.revertEscrowToHeld(escrowId)
            throw new ValidationError(
              'Stripe refund is not automated yet. Refund in Stripe Dashboard before cancel.',
            )
          } else {
            await creditBalanceService.addFiatUsd(
              reporterUserId,
              String(refundAmount),
              `Task escrow fiat refund (platform books) ${messageId}`,
              'desk_refund',
              { purpose: 'task_escrow', messageId, escrowId, refundReference },
              refundReference,
            )
          }
        } else {
          await creditBalanceService.addFiatUsd(
            reporterUserId,
            String(refundAmount),
            `Task escrow fiat refund (no order ref) ${messageId}`,
            'desk_refund',
            { purpose: 'task_escrow', messageId, escrowId, refundReference },
            refundReference,
          )
        }
      } else if (currencyType === 'native_token') {
        const transferred = await this.tryTreasuryTransferToUser(
          reporterUserId,
          String(refundAmount),
        )
        if (!transferred) {
          const nativePerMain = Number(await getNativeTokenPerMainCurrencyRate())
          const creditEquivalent =
            Number.isFinite(nativePerMain) && nativePerMain > 0
              ? (refundAmount * nativePerMain).toFixed(2)
              : String(refundAmount)
          logger.warn('Task escrow native refund: treasury transfer unavailable; crediting reporter', {
            escrowId,
            reporterUserId,
            creditEquivalent,
          })
          await creditBalanceService.addFiatUsd(
            reporterUserId,
            creditEquivalent,
            `Task escrow native refund (credit equivalent) ${messageId}`,
            'desk_refund',
            {
              purpose: 'task_escrow',
              messageId,
              escrowId,
              refundReference,
              fallback: 'credit_equivalent',
            },
            refundReference,
          )
        }
      }
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        await this.revertEscrowToHeld(escrowId)
      }
      throw error
    }

    return {
      ...meta,
      escrow: {
        ...meta.escrow,
        paymentStatus: 'refunded',
        payment_data: {
          ...(meta.escrow.payment_data ?? {
            type: this.paymentDataType(currencyType),
            status: 'refunded',
          }),
          transactionId: refundReference,
          status: 'refunded',
        },
      },
    }
  }

  async adminResolve(
    escrowId: string,
    action: 'release' | 'refund' | 'cancel',
    adminUserId: string,
  ): Promise<Message> {
    const escrow = await this.readEscrow(escrowId)
    if (!escrow) {
      throw new ValidationError('Escrow not found')
    }

    const message = await this.messages.getMessage(escrow.messageId)
    if (!message) {
      throw new ValidationError('Task message not found')
    }

    let meta = (message.metadata ?? {}) as unknown as TaskMetadata
    const auditEntry = {
      at: new Date().toISOString(),
      by: adminUserId,
      action: `admin_${action}`,
    }

    if (action === 'release') {
      meta = await this.releaseOnAccept(escrow.messageId, meta)
    } else if (action === 'refund' || action === 'cancel') {
      meta = await this.refundOnCancel(escrow.messageId, meta, escrow.reporterUserId)
      if (action === 'cancel' && meta.status !== 'canceled') {
        meta = {
          ...meta,
          status: 'canceled',
          canceledAt: new Date().toISOString(),
        }
      }
    } else {
      throw new ValidationError('Invalid admin action')
    }

    meta = {
      ...meta,
      audit: [...(meta.audit ?? []), auditEntry],
    }

    return this.persistMessageMetadata(escrow.messageId, meta)
  }

  private async tryTreasuryTransferToUser(
    userId: string,
    tokenAmount: string,
  ): Promise<{ txHash: string } | null> {
    try {
      const chain = getNativeChain()
      const wallet = await getNativeWallet(userId, chain)
      if (!wallet?.address) return null

      const decimals = getNativeTokenDecimals(chain)
      const [whole, frac = ''] = tokenAmount.split('.')
      const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals)
      const amountRaw = BigInt(whole + fracPadded)

      if (chain === 'solana') {
        const { transferTokenFromTreasury } = await import(
          '@/features/wallet/chains/solana/treasury-transfer-service'
        )
        const result = await transferTokenFromTreasury(wallet.address, amountRaw)
        return { txHash: result.txHash }
      }

      if (chain === 'evm' || chain === 'base') {
        const { transferEvmRingRawFromOpsKey } = await import(
          '@/features/wallet/chains/evm/evm-token-transfer'
        )
        const result = await transferEvmRingRawFromOpsKey({
          toAddress: wallet.address,
          amountRaw,
        })
        return { txHash: result.txHash }
      }

      return null
    } catch (error) {
      logger.warn('Treasury transfer to user failed', { userId, tokenAmount, error })
      return null
    }
  }

  private async createEscrowDoc(input: {
    reporterUserId: string
    assigneeUserId: string | null
    messageId: string
    conversationId: string
    amount: number
    currencyType: NonNullable<TaskMetadata['budget']>['currencyType']
    currencyCode?: string
    paymentStatus: TaskEscrow['paymentStatus']
  }): Promise<TaskEscrow> {
    const now = new Date().toISOString()
    const result = await db().createDoc<Omit<TaskEscrow, 'id'>>('task_escrows', {
      reporterUserId: input.reporterUserId,
      assigneeUserId: input.assigneeUserId,
      messageId: input.messageId,
      conversationId: input.conversationId,
      amount: input.amount,
      currencyType: input.currencyType,
      currencyCode: input.currencyCode,
      paymentStatus: input.paymentStatus,
      createdAt: now,
      updatedAt: now,
    })

    if (!result.success || !result.data) {
      throw new ValidationError(
        result.error?.message || 'Failed to create task escrow record',
      )
    }

    return result.data
  }
}

export const taskEscrowService = new TaskEscrowService()

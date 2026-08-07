import 'server-only'

import { auth } from '@/auth'
import { createHash } from 'crypto'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { getClientMainCurrency } from '@/lib/ring-config-client'
import {
  assertTokenDeskSubscriberAccess,
} from '@/lib/payments/confidential-token-onramp'
import { quoteDesk, executeDesk } from '@/features/wallet/chains/solana/desk-service'
import {
  getNativeTokenBalanceForUser,
  transferNativeTokenForUser,
} from '@/features/wallet/chains/native-token-transfer-service'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { getNativeTokenSymbol, getNativeChain, type NativeChain } from '@/lib/ring-config-chain'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import type { DeskOrderSide } from '@/lib/zod/desk-schemas'
import { nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'

export type WalletConductorResult = {
  success: boolean
  error?: string
  message?: string
  code?: string
}

export type CreditTopupFormState = {
  success?: boolean
  error?: string
  message?: string
  /** Conductor-owned browser handoff */
  redirect?: {
    mode: 'navigate' | 'form_post'
    url: string
    fields?: Record<string, string | string[]>
  }
  /** @deprecated Prefer redirect */
  paymentUrl?: string
  /** @deprecated Prefer redirect.fields */
  paymentFields?: Record<string, string | string[]>
}

/**
 * WalletConductor — SSOT orchestration for native-token web3 + credit money paths.
 *
 * Owns: credit top-up, confidential native onramp, Token Desk, custodial native send/balance,
 * user credit spend. Does NOT own external EVM wallet USDT/POL paths
 * (`/api/wallet/transfer` — SupportedCrypto / chains.enabled evm).
 */
export const WalletConductor = {
  /** Card → credit points (PaymentConductor purpose wallet_topup). */
  async initiateTopUp(
    prevState: CreditTopupFormState | null,
    formData: FormData
  ): Promise<CreditTopupFormState> {
    void prevState
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return { error: 'Authentication required' }
      }

      const { parseFormData, walletTopupFormSchema } = await import(
        '@/lib/zod/wallet-store-schemas'
      )
      const parsed = parseFormData(walletTopupFormSchema, formData)
      if (parsed.success === false) {
        return { error: parsed.error }
      }

      const amount = Math.floor(parseFloat(parsed.data.amount))
      if (!Number.isFinite(amount) || amount < 25 || amount > 2000) {
        return { error: 'Amount must be between 25 and 2000' }
      }

      const locale = parsed.data.locale ?? 'en'
      const returnUrl =
        parsed.data.returnUrl ||
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/${locale}/wallet`
      const source = parsed.data.source ?? 'credit_add_fs_modal'
      const processorRaw = (
        parsed.data.processor ||
        parsed.data.provider ||
        ''
      ).toLowerCase()
      const processor =
        processorRaw === 'paypal' || processorRaw === 'stripe' || processorRaw === 'wayforpay'
          ? processorRaw
          : undefined

      const result = await PaymentConductor.createCheckout({
        purpose: 'wallet_topup',
        userId: session.user.id,
        userEmail: session.user.email || '',
        entityId: session.user.id,
        amount,
        currency: getClientMainCurrency(),
        returnUrl,
        locale,
        metadata: {
          source,
          ...(processor ? { processor } : {}),
        },
      })

      if (!result.success) {
        return { error: result.error || 'Failed to initiate payment' }
      }
      if (result.redirect || result.paymentUrl || result.paymentFields) {
        return {
          success: true,
          message: 'Redirecting to payment…',
          redirect: result.redirect,
          paymentUrl: result.paymentUrl,
          paymentFields: result.paymentFields,
        }
      }
      return { success: true, message: 'Payment processed' }
    } catch (error) {
      logger.error('WalletConductor.initiateTopUp failed', { error })
      return { error: 'An unexpected error occurred. Please try again later.' }
    }
  },

  /** Confidential+ card/PayPal → treasury native token (native_token_onramp). */
  async initiateNativeOnramp(
    prevState: CreditTopupFormState | null,
    formData: FormData
  ): Promise<CreditTopupFormState> {
    void prevState
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return { error: 'Authentication required' }
      }

      const amountRaw = String(formData.get('amount') ?? '')
      const amount = Math.floor(parseFloat(amountRaw))
      if (!Number.isFinite(amount) || amount < 25 || amount > 2000) {
        return { error: 'Amount must be between 25 and 2000' }
      }

      const locale = String(formData.get('locale') ?? 'en')
      const returnUrl =
        String(formData.get('returnUrl') ?? '') ||
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/${locale}/wallet`
      const source = String(formData.get('source') ?? 'native_token_onramp')
      const processorRaw = String(formData.get('processor') ?? '').toLowerCase()
      const processor =
        processorRaw === 'paypal' || processorRaw === 'stripe' || processorRaw === 'wayforpay'
          ? processorRaw
          : undefined

      const result = await PaymentConductor.createCheckout({
        purpose: 'native_token_onramp',
        userId: session.user.id,
        userEmail: session.user.email || '',
        entityId: session.user.id,
        amount,
        currency: getClientMainCurrency(),
        returnUrl,
        locale,
        metadata: {
          source,
          userRole: session.user.role,
          ...(processor ? { processor } : {}),
        },
      })

      if (!result.success) {
        return { error: result.error || result.code || 'Failed to initiate onramp' }
      }
      if (result.redirect || result.paymentUrl || result.paymentFields) {
        return {
          success: true,
          message: 'Redirecting to payment…',
          redirect: result.redirect,
          paymentUrl: result.paymentUrl,
          paymentFields: result.paymentFields,
        }
      }
      return { success: true, message: 'Payment processed' }
    } catch (error) {
      logger.error('WalletConductor.initiateNativeOnramp failed', { error })
      return { error: 'An unexpected error occurred. Please try again later.' }
    }
  },

  /** Token Desk quote — subscriber+ (credit points → native). */
  async quoteDesk(params: {
    userId: string
    role: unknown
    side: DeskOrderSide
    amount: string
  }) {
    assertTokenDeskSubscriberAccess(params.role)
    return quoteDesk({
      userId: params.userId,
      side: params.side,
      amount: params.amount,
    })
  },

  /** Token Desk execute — subscriber+. */
  async executeDesk(params: {
    userId: string
    role: unknown
    idempotencyKey: string
    quoteToken: string
  }) {
    assertTokenDeskSubscriberAccess(params.role)
    return executeDesk({
      userId: params.userId,
      idempotencyKey: params.idempotencyKey,
      quoteToken: params.quoteToken,
    })
  },

  /**
   * Wagmi treasury swap quote — subscriber+.
   * Separate from Solana desk (credit→native); this is ERC-20 → custodial RING.
   */
  async quoteTreasurySwap(params: {
    userId: string
    role: unknown
    fromTokenAddress: string
    amountIn: string
    signInAddress: string
  }) {
    assertTokenDeskSubscriberAccess(params.role)
    const { quoteTreasurySwap } = await import(
      '@/features/wallet/services/treasury-swap-service'
    )
    return quoteTreasurySwap({
      userId: params.userId,
      fromTokenAddress: params.fromTokenAddress,
      amountIn: params.amountIn,
      signInAddress: params.signInAddress,
    })
  },

  /** Wagmi treasury swap execute after on-chain deposit — subscriber+. */
  async executeTreasurySwap(params: {
    userId: string
    role: unknown
    quoteToken: string
    depositTxHash: `0x${string}`
    signInAddress: string
  }) {
    assertTokenDeskSubscriberAccess(params.role)
    const { executeTreasurySwap } = await import(
      '@/features/wallet/services/treasury-swap-service'
    )
    return executeTreasurySwap({
      userId: params.userId,
      quoteToken: params.quoteToken,
      depositTxHash: params.depositTxHash,
      signInAddress: params.signInAddress,
    })
  },

  async getNativeBalance(userId: string) {
    return getNativeTokenBalanceForUser(userId)
  },

  /**
   * Custodial native-token transfer for the platform native chain
   * (Solana when chains.native=solana; EVM/Base when configured via chains.enabled).
   */
  async transferNative(params: {
    userId: string
    toAddress: string
    amount: string
    notes?: string
    contactUserId?: string
    ringContactId?: string
    /** Human display name for the recipient (contact or typed label) — stored for i18n history rows */
    contactDisplayName?: string
    /** Username for profile link on history rows */
    contactUsername?: string
  }): Promise<
    WalletConductorResult & {
      txHash?: string
      fromAddress?: string
      toAddress?: string
      amount?: string
      tokenSymbol?: string
      chain?: NativeChain
    }
  > {
    try {
      const transferAmount = parseFloat(params.amount)
      if (!params.toAddress || !params.amount || Number.isNaN(transferAmount) || transferAmount <= 0) {
        return { success: false, error: 'Valid recipient address and amount are required' }
      }

      // UI sends human amounts ("1.00"); on-chain SPL transfer expects raw integer units.
      const amountRaw = nativeTokenUiToRaw(params.amount)
      if (amountRaw <= 0n) {
        return { success: false, error: 'Valid recipient address and amount are required' }
      }

      const result = await transferNativeTokenForUser({
        userId: params.userId,
        toAddress: params.toAddress,
        amount: amountRaw.toString(),
      })

      const symbol = getNativeTokenSymbol()
      const txId = `native_token_send_${result.txHash.toLowerCase()}`
      const { fetchOnChainTransactionDetails } = await import(
        '@/features/wallet/lib/on-chain-tx-details'
      )
      const { getNativeTokenAddress } = await import('@/lib/ring-config-chain')
      const onChain = await fetchOnChainTransactionDetails({
        txHash: result.txHash,
        chain: result.chain,
        amountRaw: amountRaw.toString(),
        mint: getNativeTokenAddress() || null,
      })

      await db().createDoc(
        'wallet_transactions',
        {
          kind: 'nativetoken_send',
          txHash: result.txHash,
          userId: params.userId,
          fromAddress: result.fromAddress,
          toAddress: params.toAddress,
          amount: params.amount,
          amountRaw: amountRaw.toString(),
          tokenSymbol: symbol,
          chain: result.chain,
          mint: getNativeTokenAddress() || null,
          notes: params.notes ?? null,
          contactUserId: params.contactUserId ?? null,
          contactDisplayName: params.contactDisplayName ?? null,
          contactUsername: params.contactUsername ?? null,
          createdAt: new Date().toISOString(),
          status: onChain.status,
          slot: onChain.slot ?? null,
          blockTime: onChain.blockTime ?? null,
          feeLamports: onChain.feeLamports ?? null,
          explorerUrl: onChain.explorerUrl,
          err: onChain.err ?? null,
          onChainSnapshot: onChain.onChainSnapshot ?? null,
        },
        { id: txId },
      )

      if (params.ringContactId) {
        const { getCurrentRingContactsService } = await import('@/features/contacts/services')
        await getCurrentRingContactsService().touchLastUsed(params.userId, params.ringContactId)
      } else if (params.contactUserId) {
        const { getCurrentRingContactsService } = await import('@/features/contacts/services')
        const contacts = getCurrentRingContactsService()
        const list = await contacts.listContacts(params.userId)
        const match = list.find((c) => c.contactUserId === params.contactUserId)
        if (match) await contacts.touchLastUsed(params.userId, match.id)
      }

      // Invalidate wallet list UIs (other tabs / nav) — balances changed on-chain
      const { publishWalletListUpdate } = await import('@/lib/wallet/publish-wallet-list')
      await publishWalletListUpdate(params.userId, 'updated')

      return {
        success: true,
        message: `Transferred ${params.amount} ${symbol}`,
        txHash: result.txHash,
        fromAddress: result.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        tokenSymbol: symbol,
        chain: result.chain,
      }
    } catch (error) {
      logger.error('WalletConductor.transferNative failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
      }
    }
  },

  async purchaseNftListing(params: {
    buyerUserId: string
    listingId: string
    idempotencyKey: string
  }): Promise<
    WalletConductorResult & {
      listingId?: string
      saleId?: string
      txHash?: string
    }
  > {
    try {
      if (!params.buyerUserId || !params.listingId || !params.idempotencyKey) {
        return { success: false, error: 'buyerUserId, listingId and idempotencyKey are required' }
      }

      const existing = await db().queryDocs<{
        id: string
        status?: string
        txHash?: string
        listingId?: string
      }>({
        collection: 'nft_market_sales',
        filters: [{ field: 'idempotencyKey', operator: '==', value: params.idempotencyKey }],
        pagination: { limit: 1 },
      })
      const existingSale = existing.success ? existing.data?.[0] : undefined
      if (existingSale?.status === 'confirmed') {
        return {
          success: true,
          message: 'NFT listing purchase already confirmed',
          listingId: existingSale.listingId,
          saleId: existingSale.id,
          txHash: existingSale.txHash,
        }
      }
      if (existingSale?.status === 'submitted') {
        return {
          success: false,
          code: 'SALE_NEEDS_RECONCILIATION',
          error: 'NFT listing purchase was submitted and needs reconciliation before retry',
          listingId: existingSale.listingId,
          saleId: existingSale.id,
        }
      }
      if (existingSale?.status === 'pending') {
        return {
          success: false,
          code: 'SALE_IN_PROGRESS',
          error: 'NFT listing purchase is already in progress',
          listingId: existingSale.listingId,
          saleId: existingSale.id,
        }
      }

      const ensured = await WalletConductor.ensureNativeWallet({ id: params.buyerUserId })
      if (!ensured.ok || !ensured.native?.address) {
        return { success: false, error: ensured.error || 'Buyer custodial Solana wallet is required' }
      }

      const { getListingById, markSold } = await import('@/features/nft-market/services/listing-service')
      const listingResult = await getListingById(params.listingId)
      if (!listingResult.success || !listingResult.data) {
        return { success: false, error: listingResult.error || 'Listing not found' }
      }
      const listing = listingResult.data
      if (listing.status !== 'active') {
        return { success: false, error: 'Listing is not active' }
      }
      if (listing.sellerUserId === params.buyerUserId) {
        return { success: false, error: 'Seller cannot buy their own listing' }
      }

      const balance = await getNativeTokenBalanceForUser(params.buyerUserId)
      const balanceRaw = nativeTokenUiToRaw(balance.balance, listing.decimals)
      if (balanceRaw < BigInt(listing.priceRaw)) {
        return { success: false, code: 'INSUFFICIENT_BALANCE', error: 'Insufficient RING balance' }
      }

      const saleId = `nft_sale_${createHash('sha256').update(params.idempotencyKey).digest('hex').slice(0, 32)}`
      const createdAt = new Date().toISOString()
      const sale = {
        id: saleId,
        listingId: listing.id,
        idempotencyKey: params.idempotencyKey,
        buyerUserId: params.buyerUserId,
        sellerUserId: listing.sellerUserId,
        asset: listing.asset,
        status: 'pending' as const,
        priceRaw: listing.priceRaw,
        priceRing: listing.priceRing,
        feeRaw: listing.feeRaw ?? '0',
        sellerProceedsRaw: listing.sellerProceedsRaw ?? listing.priceRaw,
        currency: getNativeTokenSymbol(),
        createdAt,
        updatedAt: createdAt,
      }

      if (existingSale?.status === 'failed') {
        await db().updateDoc('nft_market_sales', saleId, {
          ...sale,
          error: null,
          txHash: null,
        })
      } else {
        const created = await db().createDoc('nft_market_sales', sale, { id: saleId })
        if (!created.success) {
          return { success: false, error: created.error?.message || 'Failed to reserve sale' }
        }
      }

      try {
        const { SolanaMarketClient } = await import('@/features/nft-market/services/solana-market-client')
        const bought = await SolanaMarketClient.buyGate({
          listing,
          buyerUserId: params.buyerUserId,
          buyerWallet: ensured.native.address,
          idempotencyKey: params.idempotencyKey,
        })

        await db().updateDoc('nft_market_sales', saleId, {
          status: 'submitted',
          txHash: bought.signature,
          feeRaw: bought.feeRaw,
          sellerProceedsRaw: bought.sellerProceedsRaw,
          updatedAt: new Date().toISOString(),
        })

        const confirmedSale = {
          ...sale,
          status: 'confirmed' as const,
          txHash: bought.signature,
          feeRaw: bought.feeRaw,
          sellerProceedsRaw: bought.sellerProceedsRaw,
          confirmedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        await markSold({
          listingId: listing.id,
          buyerUserId: params.buyerUserId,
          buyerWallet: ensured.native.address,
          sale: confirmedSale,
          signature: bought.signature,
        })

        await db().updateDoc('nft_market_sales', saleId, confirmedSale)

        try {
          const { revalidatePath } = await import('next/cache')
          revalidatePath('/[locale]/nft/market')
          revalidatePath(`/[locale]/nft/market/${listing.id}`)
          revalidatePath('/[locale]/profile')
        } catch {
          // Cache revalidation is best-effort outside request contexts.
        }

        return {
          success: true,
          message: 'NFT listing purchased',
          listingId: listing.id,
          saleId,
          txHash: bought.signature,
        }
      } catch (innerError) {
        // Release idempotency lock so a retry with a new key (or ops replay) can proceed.
        // Confirmed on-chain payment with failed markSold stays submitted for reconciliation.
        const message = innerError instanceof Error ? innerError.message : 'NFT purchase failed'
        await db().updateDoc('nft_market_sales', saleId, {
          status: 'failed',
          error: message,
          updatedAt: new Date().toISOString(),
        })
        throw innerError
      }
    } catch (error) {
      logger.error('WalletConductor.purchaseNftListing failed', { error })
      return { success: false, error: error instanceof Error ? error.message : 'NFT purchase failed' }
    }
  },

  /** User FormData / credit-spend API path only (not PaymentConductor internal-credit). */
  async spendCredits(params: {
    userId: string
    amount: string
    description?: string
    orderId?: string
    referenceId?: string
    metadata?: Record<string, unknown>
    type?: 'purchase' | 'membership_fee' | 'payment'
    mainCurrencyRate?: string
  }): Promise<
    WalletConductorResult & { newBalance?: string; transactionId?: string; mainCurrencyEquivalent?: string }
  > {
    try {
      if (!params.amount || parseFloat(params.amount) <= 0) {
        return { success: false, error: 'Valid amount is required' }
      }
      const hasBalance = await creditBalanceService.hasSufficientBalance(
        params.userId,
        params.amount,
      )
      if (!hasBalance) {
        return { success: false, error: 'Insufficient credit balance' }
      }
      const { getMainCurrencyCreditAccountingRate } = await import('@/lib/ring-oracle')
      const result = await creditBalanceService.spendCredits(
        params.userId,
        {
          amount: params.amount,
          description: params.description || 'Credit spend',
          order_id: params.orderId,
          reference_id: params.referenceId,
          metadata: params.metadata,
        },
        params.type || 'purchase',
        params.mainCurrencyRate || getMainCurrencyCreditAccountingRate(),
      )
      return {
        success: true,
        message: `Spent ${params.amount} credits successfully`,
        newBalance: result.newBalance,
        transactionId: result.transaction.id,
        mainCurrencyEquivalent: result.transaction.main_currency_equivalent,
      }
    } catch (error) {
      logger.error('WalletConductor.spendCredits failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to spend credits',
      }
    }
  },

  /** Ensure native (+ enabled) wallets for a known user — OAuth/events safe (no session). */
  async ensureNativeWallet(userOverride: {
    id: string
    role?: string
  }): Promise<{
    ok: boolean
    native?: import('@/features/wallet/types/wallet').Wallet
    wallets?: import('@/features/wallet/types/wallet').Wallet[]
    error?: string
  }> {
    try {
      const { ensureWallets } = await import('@/features/wallet/services/ensure-wallet')
      const { resolvePersistedUserRole, UserRolesArray } = await import('@/features/auth/user-role')
      const result = await ensureWallets({
        id: userOverride.id,
        role: resolvePersistedUserRole(userOverride.role || UserRolesArray.subscriber),
      })
      return { ok: true, native: result.native, wallets: result.wallets }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to ensure wallets',
      }
    }
  },

  /** Ensure wallets exist and credit balance meets a minimum (session-gated). */
  async ensureFunded(minCredits = '0'): Promise<{
    ok: boolean
    balance?: string
    topUpSuggested?: boolean
    error?: string
  }> {
    const session = await auth()
    if (!session?.user?.id) {
      return { ok: false, error: 'Authentication required' }
    }
    const ensured = await WalletConductor.ensureNativeWallet({
      id: session.user.id,
      role: session.user.role,
    })
    if (!ensured.ok) {
      return { ok: false, error: ensured.error }
    }
    try {
      const balanceDoc = await creditBalanceService.getUserCreditBalance(session.user.id)
      const balance = String(balanceDoc?.amount ?? '0')
      const min = Number(minCredits)
      const current = Number(balance)
      if (Number.isFinite(min) && Number.isFinite(current) && current < min) {
        return { ok: false, balance, topUpSuggested: true, error: 'Insufficient credit balance' }
      }
      return { ok: true, balance }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to read credit balance',
      }
    }
  },
}

export function getWalletConductorNativeChain(): NativeChain {
  return getNativeChain()
}

'use server'

/**
 * Wallet Server Actions — Ring Platform
 *
 * 15 server actions covering wallet management, credit operations,
 * and oracle/desk functionality. Follows SSOT patterns:
 * - Dynamic imports for server-only services, preventing unwanted client-side exposure.
 * - Structured return objects ideal for React 19 useActionState
 * - Auth checks at start of every action
 * - revalidatePath for cache invalidation after mutations
 * - Try-catch for robust error handling
 *
 * // TODO: For pure mutations, consider adopting the Next.js 16 `revalidateTag` and fine-grained cache tags for more efficient invalidation.
 * // TODO: Leverage React 19's native useFormStatus for even more granular optimistic UI updates in supported components.
 */

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { NativeChain } from '@/lib/ring-config-chain'

// ============================================================================
// TYPES
// ============================================================================

export interface WalletActionResult {
  success: boolean
  error?: string
  message?: string
}

export interface WalletListResult extends WalletActionResult {
  wallets?: Array<{
    address: string
    isPrimary: boolean
    label?: string
    createdAt?: string
    balance?: string
    nativeBalance?: string
    tokenSymbol?: ReturnType<typeof getNativeTokenSymbol> | string
    creditFiatCurrency?: string
    chain?: NativeChain
  }>
}

export interface CreditBalanceResult extends WalletActionResult {
  balance?: {
    amount: string
    usd_equivalent: string
    fiat_currency: string
    last_updated: number
    subscription_active: boolean
  }
}

export interface CreditHistoryResult extends WalletActionResult {
  transactions?: Array<{
    id: string
    user_id: string
    type: string
    amount: string
    usd_equivalent: string
    usd_rate: string
    balance_after: string
    timestamp: number
    description?: string
  }>
  has_more?: boolean
  next_cursor?: string
}

export interface ActivityResult extends WalletActionResult {
  activities?: Array<{
    id: string
    source: 'credit' | 'chain'
    kind: string
    amount: string
    currency: string
    direction: 'in' | 'out'
    createdAt: string
    description?: string
    txHash?: string
    metadata?: Record<string, unknown>
  }>
}

export interface OracleRateResult extends WalletActionResult {
  ringPerUsd?: string
}

// ============================================================================
// 1. ENSURE USER WALLETS
// ============================================================================

/**
 * Ensures the authenticated user has wallets provisioned for all enabled chains.
 * Called on first wallet page visit or when user needs a new wallet.
 */
export async function ensureUserWallets(): Promise<WalletActionResult & {
  nativeWallet?: { address: string; chain: string }
  walletCount?: number
}> {
  try {
    const session = await auth() // Retrieve user session
    if (!session?.user?.id) {
      // Authentication check
      return { success: false, error: 'Authentication required' }
    }

    const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
    const ensured = await WalletConductor.ensureNativeWallet({
      id: session.user.id,
      role: session.user.role,
    })

    if (!ensured.ok || !ensured.native) {
      return { success: false, error: ensured.error || 'Failed to ensure wallets' }
    }

    // Invalidate wallet-related paths for fresh UI data
    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    // Return structured result for use in React 19's useActionState
    return {
      success: true,
      nativeWallet: {
        address: ensured.native.address,
        chain: ensured.native.chain ?? 'evm',
      },
      walletCount: ensured.wallets?.length ?? 1,
    }
  } catch (error) {
    logger.error('ensureUserWallets failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to ensure wallets',
    }
  }
}

// ============================================================================
// 2. LIST USER WALLETS
// ============================================================================

/**
 * Lists all wallets for the authenticated user with balances.
 * Replaces the /api/wallet/list endpoint for server action consumers.
 */
export async function listUserWallets(): Promise<WalletListResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Dynamically import wallet listing service; avoids build-time size bloat
    const { listWallets } = await import('@/features/wallet/services/list-wallets')
    const wallets = await listWallets()

    // Balances are already formatted strings from listWallets / wallet-balance-cache
    return {
      success: true,
      wallets: wallets.map(w => ({
        address: w.address,
        isPrimary: w.isPrimary,
        label: w.label,
        createdAt: w.createdAt,
        balance: w.balance,
        nativeBalance: w.nativeBalance,
        tokenSymbol: w.tokenSymbol,
        creditFiatCurrency: w.creditFiatCurrency,
        chain: w.chain,
      })),
    }
  } catch (error) {
    logger.error('listUserWallets failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list wallets',
    }
  }
}

// ============================================================================
// 3. GET WALLET BALANCE
// ============================================================================

/**
 * Fetches the on-chain balance for the user's default wallet.
 * Pass `existingWallet` when the caller already provisioned wallets (avoids duplicate work).
 */
export async function getWalletBalance(
  existingWallet?: Pick<import('@/features/auth/types').Wallet, 'address' | 'chain'>,
): Promise<WalletActionResult & { balance?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' };
    }

    let primaryWallet = existingWallet
    if (!primaryWallet?.address) {
      const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
      const ensured = await WalletConductor.ensureNativeWallet({
        id: session.user.id,
        role: session.user.role,
      })
      if (!ensured.ok || !ensured.native) {
        return { success: false, error: ensured.error || 'Primary wallet not found' }
      }
      primaryWallet = ensured.native
    }

    if (!primaryWallet?.address) {
      return { success: false, error: 'Primary wallet not found' };
    }

    // Chain-aware balance fetch: route to the correct chain's balance function
    const walletChain = primaryWallet.chain ?? 'evm'
    let balance: string

    if (walletChain === 'solana') {
      const { getNativeTokenBalance } = await import('@/features/wallet/chains/solana/native-token-transfer')
      balance = await getNativeTokenBalance(primaryWallet.address)
    } else {
      // EVM / Base / Polygon — use the EVM token balance fetcher (SSOT via evm-token-transfer)
      const { getEvmTokenBalance } = await import('@/features/wallet/chains/evm/evm-token-transfer')
      balance = await getEvmTokenBalance(primaryWallet.address)
    }

    return { success: true, balance };
  } catch (error) {
    logger.error('getWalletBalanceByAddress failed', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get balance' }
  }
}

/**
 * Native-token custodial balance via WalletConductor (preferred for send UI).
 */
export async function getNativeTokenBalanceAction(): Promise<
  WalletActionResult & { balance?: string; address?: string; chain?: string; tokenSymbol?: string }
> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }
    const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
    const result = await WalletConductor.getNativeBalance(session.user.id)
    return {
      success: true,
      balance: result.balance,
      address: result.address,
      chain: result.chain,
      tokenSymbol: result.tokenSymbol,
    }
  } catch (error) {
    logger.error('getNativeTokenBalanceAction failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get native balance',
    }
  }
}

// ============================================================================
// 4. GET WALLET ACTIVITY
// ============================================================================

export async function getWalletActivity(options?: {
  filter?: 'all' | 'credit' | 'chain'
  limit?: number
  walletAddress?: string
}): Promise<ActivityResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Fetch activity feed for this user
    const { getWalletActivityFeed } = await import('@/features/wallet/services/wallet-activity-feed')
    const activities = await getWalletActivityFeed(session.user.id, options)

    return {
      success: true,
      activities,
    }
  } catch (error) {
    logger.error('getWalletActivity failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get activity',
    }
  }
}

// ============================================================================
// 5. GET CREDIT HISTORY
// ============================================================================

/**
 * Gets credit transaction history with pagination.
 * Replaces the /api/wallet/credit/history endpoint.
 */
export async function getCreditHistory(options?: {
  limit?: number
  afterId?: string
  type?: string
}): Promise<CreditHistoryResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Pull transaction history, paginated, and optionally filtered
    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')
    const result = await creditBalanceService.getCreditHistory(session.user.id, {
      limit: options?.limit ?? 50,
      after_id: options?.afterId,
      type: options?.type as any,
    })

    return {
      success: true,
      transactions: result.transactions,
      has_more: result.has_more,
      next_cursor: result.next_cursor,
    }
  } catch (error) {
    logger.error('getCreditHistory failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get credit history',
    }
  }
}

// ============================================================================
// 6. GET CREDIT BALANCE
// ============================================================================

/**
 * Gets the user's current credit balance.
 * Replaces the /api/wallet/credit/balance endpoint.
 */
export async function getCreditBalance(): Promise<CreditBalanceResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')
    const balance = await creditBalanceService.getUserCreditBalance(session.user.id)

    if (!balance) {
      // Null balance is valid for zeroed-out users
      return { success: true, balance: null }
    }

    return {
      success: true,
      balance: {
        amount: balance.amount,
        usd_equivalent: balance.usd_equivalent,
        fiat_currency: balance.fiat_currency ?? 'USD',
        last_updated: balance.last_updated,
        subscription_active: balance.subscription_active ?? false,
      },
    }
  } catch (error) {
    logger.error('getCreditBalance failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get credit balance',
    }
  }
}

// ============================================================================
// 7. TOP UP CREDITS
// ============================================================================

/**
 * Adds credit-balance points after verifying an on-chain transfer to treasury (chain-proof).
 * Does NOT credit native RING wallet balance — that is Token Desk / native_token_onramp.
 * Card → credit points use initiateCreditTopupPayment → PaymentConductor wallet_topup.
 */
export async function topUpCredits(formData: FormData): Promise<WalletActionResult & {
  newBalance?: string
  txHash?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      // Enforce authentication for credit operations
      return { success: false, error: 'Authentication required' }
    }

    const txHash = formData.get('txHash') as string
    const amount = formData.get('amount') as string
    const description = formData.get('description') as string || 'Credit top-up'

    // Validate minimum required fields
    if (!txHash || !amount) {
      return { success: false, error: 'Transaction hash and amount are required' }
    }

    // Get all user wallet addresses for securing the top-up source(s)
    const { getUserWallets } = await import('@/lib/wallet/user-wallet-db')
    const wallets = await getUserWallets(session.user.id)
    const walletAddresses = wallets.map(w => w.address)

    // Check on-chain evidence of a valid top-up
    const { verifyTopUpTransaction, reserveTopUpTxHash } = await import('@/features/wallet/services/topup-verification')
    const verification = await verifyTopUpTransaction({
      txHash,
      amount,
      userWallets: walletAddresses,
    })

    if (!verification.verified) {
      // Propagate reason for verification failure if any (user-friendly)
      return { success: false, error: verification.reason ?? 'Transaction verification failed' }
    }

    // Reserve the txHash to enforce idempotency and prevent replay
    const reserved = await reserveTopUpTxHash(txHash, session.user.id, amount)
    if (!reserved) {
      // Already-processed replay attempt
      return { success: false, error: 'Transaction already processed' }
    }

    // Grab current token oracle rate for accurate USD conversion
    const { getRingPerUsdRate } = await import('@/features/wallet/services/ring-token-oracle')
    const rate = await getRingPerUsdRate()

    // Actually credit user after validation & USD conversion
    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')
    const result = await creditBalanceService.addCredits(
      session.user.id,
      { amount, description, tx_hash: txHash },
      'top_up',
      rate,
    )

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: `Added ${amount} credits successfully`,
      newBalance: result.newBalance,
      txHash,
    }
  } catch (error) {
    logger.error('topUpCredits failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to top up credits',
    }
  }
}

// ============================================================================
// 8. SPEND CREDITS
// ============================================================================

/**
 * Spends credits from user balance for a purchase or service.
 * Used by checkout flows and membership payments.
 */
export async function spendCredits(formData: FormData): Promise<WalletActionResult & {
  newBalance?: string
  transactionId?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const amount = formData.get('amount') as string
    const description = (formData.get('description') as string) || 'Credit spend'
    const orderId = (formData.get('orderId') as string) || undefined

    const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
    const result = await WalletConductor.spendCredits({
      userId: session.user.id,
      amount,
      description,
      orderId,
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: result.message,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
    }
  } catch (error) {
    logger.error('spendCredits failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to spend credits',
    }
  }
}

// ============================================================================
// 9. TRANSFER CREDITS
// ============================================================================

/**
 * Transfers credits from one user to another.
 * Admin-only action for now (future: peer-to-peer transfers).
 *
 * // TODO: Implement user-initiated peer-to-peer credit transfer flow with notifications and fraud controls.
 */
export async function transferCredits(formData: FormData): Promise<WalletActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Only platform admins may move user credits directly (future: peer transfer)
    if (!isPlatformAdmin(session.user.role)) {
      return { success: false, error: 'Admin access required' }
    }

    const toUserId = formData.get('toUserId') as string
    const amount = formData.get('amount') as string
    const description = formData.get('description') as string || 'Credit transfer'

    // Validate destination/amount
    if (!toUserId || !amount || parseFloat(amount) <= 0) {
      return { success: false, error: 'Valid recipient and amount are required' }
    }

    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')

    // STUB: In production, debit credits from admin/system pool.
    // For now, this only credits recipient for reimbursements.
    // TODO: Add an actual system pool for debits to ensure credits are not infinite.

    const result = await creditBalanceService.addCredits(
      toUserId,
      { amount, description, metadata: { transferred_by: session.user.id } },
      'reimbursement',
      '1',
    )

    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${toUserId}`)

    return {
      success: true,
      message: `Transferred ${amount} credits to user ${toUserId}`,
    }
  } catch (error) {
    logger.error('transferCredits failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to transfer credits',
    }
  }
}

// ============================================================================
// 10. VERIFY TOP-UP TRANSACTION
// ============================================================================

/**
 * Verifies an on-chain ERC20 transfer without crediting.
 * Useful for pre-check before actual top-up.
 */
export async function verifyTopUpTransaction(formData: FormData): Promise<WalletActionResult & {
  verified?: boolean
  fromAddress?: string
  reason?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const txHash = formData.get('txHash') as string
    const amount = formData.get('amount') as string

    // Minimal presence validation
    if (!txHash || !amount) {
      return { success: false, error: 'Transaction hash and amount are required' }
    }

    // Establish possible wallet sources
    const { getUserWallets } = await import('@/lib/wallet/user-wallet-db')
    const wallets = await getUserWallets(session.user.id)
    const walletAddresses = wallets.map(w => w.address)

    // Actually run verification service
    const { verifyTopUpTransaction: verify } = await import('@/features/wallet/services/topup-verification')
    const result = await verify({ txHash, amount, userWallets: walletAddresses })

    // Detailed fields for client disambiguation (source validation, reason etc)
    return {
      success: true,
      verified: result.verified,
      fromAddress: result.fromAddress,
      reason: result.reason,
    }
  } catch (error) {
    logger.error('verifyTopUpTransaction failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify transaction',
    }
  }
}

// ============================================================================
// 11. GET RING PER USD RATE
// ============================================================================

/**
 * Gets the current RING token per USD rate from the oracle.
 */
export async function getRingPerUsdRate(): Promise<OracleRateResult> {
  try {
    // Lightweight dynamic import of token oracle
    const { getRingPerUsdRate: getRate } = await import('@/features/wallet/services/ring-token-oracle')
    const rate = await getRate()

    return {
      success: true,
      ringPerUsd: rate,
    }
  } catch (error) {
    logger.error('getRingPerUsdRate failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get oracle rate',
    }
  }
}

// ============================================================================
// 12. SET RING PER USD RATE (ADMIN)
// ============================================================================

/**
 * Updates the RING per USD oracle rate. Admin-only.
 * Includes audit logging and deviation checks.
 */
export async function setRingPerUsdRate(formData: FormData): Promise<OracleRateResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Only admins may update oracle
    if (!isPlatformAdmin(session.user.role)) {
      return { success: false, error: 'Admin access required' }
    }

    const newRate = formData.get('rate') as string
    if (!newRate || parseFloat(newRate) <= 0) {
      return { success: false, error: 'Valid rate is required' }
    }

    // Mutate oracle value and propagate fresh settings
    const { setRingPerUsdRate: setRate } = await import('@/features/wallet/services/ring-token-oracle')
    const result = await setRate(newRate, session.user.id)

    revalidatePath('/admin/platform-settings')

    return {
      success: true,
      ringPerUsd: result.ringPerUsd,
    }
  } catch (error) {
    logger.error('setRingPerUsdRate failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set oracle rate',
    }
  }
}

// ============================================================================
// 13. SIGN DESK QUOTE
// ============================================================================

/**
 * Signs a desk quote for RING token trading.
 * Returns a signed quote token that can be verified server-side.
 */
export async function signDeskQuote(formData: FormData): Promise<WalletActionResult & {
  quoteToken?: string
  expiresAt?: number
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Extract and strongly type required quote params
    const side = formData.get('side') as 'buy' | 'sell'
    const ringAmount = formData.get('ringAmount') as string
    const creditUsd = formData.get('creditUsd') as string
    const rate = formData.get('rate') as string
    const discountBps = parseInt(formData.get('discountBps') as string || '0', 10)

    // Frontload basic validation to enable clear UX and safe signing
    if (!side || !ringAmount || !creditUsd || !rate) {
      return { success: false, error: 'All quote parameters are required' }
    }

    // Create signed quote for later verification/execution
    const { signQuote } = await import('@/features/wallet/services/ring-token-oracle')
    const quoteToken = signQuote({
      side,
      ringAmountRaw: ringAmount,
      creditUsd,
      rate,
      discountBps,
    })

    // Calculate expiry using current desk config
    const { getTokenDeskConfig } = await import('@/lib/ring-config-chain')
    const desk = getTokenDeskConfig()
    // TODO: Desk quote TTL could be settable per-quote in v2
    const expiresAt = Date.now() + ((desk.quoteTtlSeconds ?? 60) as number) * 1000

    return {
      success: true,
      quoteToken,
      expiresAt,
    }
  } catch (error) {
    logger.error('signDeskQuote failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign quote',
    }
  }
}

// ============================================================================
// 14. VERIFY DESK QUOTE
// ============================================================================

/**
 * Verifies a signed desk quote token.
 * Checks signature and expiry.
 */
export async function verifyDeskQuote(formData: FormData): Promise<WalletActionResult & {
  payload?: {
    side: 'buy' | 'sell'
    ringAmountRaw: string
    creditUsd: string
    rate: string
    discountBps: number
    expiresAt: number
  }
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Must provide quote token for server-side verification (prevents tampering)
    const quoteToken = formData.get('quoteToken') as string
    if (!quoteToken) {
      return { success: false, error: 'Quote token is required' }
    }

    // Validate quote signature, parse payload, etc
    const { verifyQuoteToken } = await import('@/features/wallet/services/ring-token-oracle')
    const payload = verifyQuoteToken(quoteToken)

    return {
      success: true,
      payload,
    }
  } catch (error) {
    logger.error('verifyDeskQuote failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify quote',
    }
  }
}

// ============================================================================
// 15. PROCESS MEMBERSHIP FEE
// ============================================================================

/**
 * Processes monthly membership fee from user's credit balance.
 * Called by subscription system or admin action.
 */
export async function processMembershipFee(formData: FormData): Promise<WalletActionResult & {
  transactionId?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const membershipFee = formData.get('membershipFee') as string
    if (!membershipFee || parseFloat(membershipFee) <= 0) {
      return { success: false, error: 'Valid membership fee amount is required' }
    }

    // Bill for subscription/etc.
    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')
    const { getFiatCreditAccountingRate } = await import('@/lib/payments/credit-currency')
    const result = await creditBalanceService.processMembershipFee(
      session.user.id,
      membershipFee,
      getFiatCreditAccountingRate(),
    )

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: `Membership fee of ${membershipFee} processed successfully`,
      transactionId: result.transaction.id,
    }
  } catch (error) {
    logger.error('processMembershipFee failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process membership fee',
    }
  }
}

// ============================================================================
// 16. TRANSFER NATIVE TOKEN (GASLESS, SPONSORED)
// ============================================================================

/**
 * Transfer project-native-token (RING for ring-platform.org) from sender to recipient.
 *
 * Generalized action name suitable for clones — the actual token symbol
 * is read from the platform's ring-config (e.g., RING for ring-platform.org,
 * DAARION for greenfood-live, etc.).
 *
 * Gas is SPONSORED by the native-token-treasury — users never pay SOL/POL for gas.
 * An optional transfer tax may be configured per clone (for high-freq-send projects
 * to cover chain gas costs).
 *
 * Mirrors `send-native-token(recipient($userID), note($messageID), amount($amountNativeToken))`.
 *
 * @param formData - toAddress, amount, notes, contactUserId, ringContactId
 * @returns txHash, fromAddress, toAddress, amount, tokenSymbol, chain
 */
export async function transferNativeTokens(formData: FormData): Promise<WalletActionResult & {
  txHash?: string
  fromAddress?: string
  toAddress?: string
  amount?: string
  tokenSymbol?: ReturnType<typeof getNativeTokenSymbol>
  chain?: NativeChain
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const toAddress = formData.get('toAddress') as string
    const amount = formData.get('amount') as string
    const notes = (formData.get('notes') as string) || undefined
    const contactUserId = (formData.get('contactUserId') as string) || undefined
    const ringContactId = (formData.get('ringContactId') as string) || undefined

    const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
    const result = await WalletConductor.transferNative({
      userId: session.user.id,
      toAddress,
      amount,
      notes,
      contactUserId,
      ringContactId,
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/wallet/activity')

    return {
      success: true,
      message: result.message,
      txHash: result.txHash,
      fromAddress: result.fromAddress,
      toAddress: result.toAddress,
      amount: result.amount,
      tokenSymbol: result.tokenSymbol as ReturnType<typeof getNativeTokenSymbol>,
      chain: result.chain,
    }
  } catch (error) {
    logger.error('transferNativeTokens failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to transfer tokens',
    }
  }
}

// ============================================================================
// 17. EXECUTE DESK QUOTE (RING/credit conversion)
// ============================================================================
// Thin adapter → WalletConductor.executeDesk (see executeDeskQuote below)

// ============================================================================
// 18. LIST WALLET TRANSACTIONS
// ============================================================================

/**
 * List wallet_transactions for the authenticated user from the ring-db.
 * Replaces direct DB calls in client components.
 */
export async function listWalletTransactions(options?: {
  kinds?: string[]
  limit?: number
}): Promise<WalletActionResult & {
  transactions?: Array<{
    id?: string
    kind: string
    userId: string
    txHash?: string
    fromAddress?: string
    toAddress?: string
    amount?: string
    tokenSymbol?: string
    chain?: string
    notes?: string | null
    createdAt?: string
  }>
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Lightweight logic for listing; audit-optimized
    const { listWalletTransactionsByUser } = await import('@/lib/wallet/wallet-transaction-db')
    const txs = await listWalletTransactionsByUser(session.user.id, options)

    return {
      success: true,
      transactions: txs,
    }
  } catch (error) {
    logger.error('listWalletTransactions failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list transactions',
    }
  }
}

// ============================================================================
// 19. SET PRIMARY WALLET
// ============================================================================

/**
 * Set a specific wallet address as the primary/default wallet.
 *
 * // TODO: Use Next.js 16 server actions callback for direct mutation of persistent state.
 */
export async function setPrimaryWallet(formData: FormData): Promise<WalletActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const walletAddress = formData.get('walletAddress') as string
    if (!walletAddress) {
      return { success: false, error: 'walletAddress is required' }
    }

    // Retrieve and update wallet default field in-place
    const { getUserWallets, setUserWallets } = await import('@/lib/wallet/user-wallet-db')
    const wallets = await getUserWallets(session.user.id)

    // Exactly one wallet must be marked as default
    const updated = wallets.map((w) => ({
      ...w,
      isDefault: w.address === walletAddress,
    }))

    await setUserWallets(session.user.id, updated)

    revalidatePath('/[locale]/wallet')

    return { success: true, message: 'Primary wallet updated' }
  } catch (error) {
    logger.error('setPrimaryWallet failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set primary wallet',
    }
  }
}

// ============================================================================
// 20. GET SPENDING SUMMARY
// ============================================================================

/**
 * Get credit spending summary for the current period.
 * Reuses the same creditBalanceService.getCreditHistory logic as the API route.
 */
export async function getSpendSummary(options?: {
  period?: 'day' | 'week' | 'month' | 'year'
}): Promise<WalletActionResult & {
  period?: string
  totalSpent?: string
  transactionCount?: number
  limits?: {
    daily_limit: string
    weekly_limit: string
    monthly_limit: string
    yearly_limit: string
  }
  remaining?: {
    daily_remaining: string
    weekly_remaining: string
    monthly_remaining: string
    yearly_remaining: string
  }
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Fetch summary for current period
    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')

    const period = options?.period ?? 'month'
    const now = Date.now()
    let startDate: number
    // Calculate period start for each reporting period
    switch (period) {
      case 'day':
        startDate = new Date(new Date().toDateString()).getTime() // Midnight today
        break
      case 'week':
        startDate = now - 7 * 24 * 60 * 60 * 1000 // 7 days ago
        break
      case 'year':
        startDate = new Date(new Date().getFullYear(), 0, 1).getTime() // Jan 1
        break
      case 'month':
      default:
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() // 1st of month
    }

    // Query only purchase transactions in the period
    const history = await creditBalanceService.getCreditHistory(session.user.id, {
      limit: 100,
      type: 'purchase' as any,
      start_date: startDate,
      end_date: now,
    })

    // Compute total spent by summing over all txs
    const totalSpent = history.transactions.reduce(
      (sum, tx) => sum + Math.abs(parseFloat(tx.amount)),
      0,
    )

    // TODO: Fetch spending policy limits from config/db instead of hardcoded values
    const limits = {
      daily_limit: '100',
      weekly_limit: '500',
      monthly_limit: '2000',
      yearly_limit: '20000',
    }

    // Compute "remaining" room per period for front-end use
    return {
      success: true,
      period,
      totalSpent: totalSpent.toString(),
      transactionCount: history.transactions.length,
      limits,
      remaining: {
        daily_remaining: Math.max(0, 100 - (period === 'day' ? totalSpent : 0)).toString(),
        weekly_remaining: Math.max(0, 500 - (period === 'week' ? totalSpent : 0)).toString(),
        monthly_remaining: Math.max(0, 2000 - (period === 'month' ? totalSpent : 0)).toString(),
        yearly_remaining: Math.max(0, 20000 - (period === 'year' ? totalSpent : 0)).toString(),
      },
    }
  } catch (error) {
    logger.error('getSpendSummary failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get spending summary',
    }
  }
}

// ============================================================================
// 21. GET REWARD CREDIT ADD EVENT SUMMARY
// ============================================================================

/**
 * Get a summary of reward-credit-add events for the current user.
 * Shows how many credits were earned from each trigger type.
 */
export async function getRewardCreditAddEventSummary(): Promise<WalletActionResult & {
  totalReceived?: string
  byTrigger?: Record<string, { count: number; total: string }>
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Aggregate per-trigger sources of reward credit events for analytics/reward screens
    const { getUserRewardCreditAddEventSummary } = await import('@/lib/wallet/reward-credit-service')
    const summary = await getUserRewardCreditAddEventSummary(session.user.id)

    return {
      success: true,
      totalReceived: summary.totalReceived,
      byTrigger: summary.byTrigger,
    }
  } catch (error) {
    logger.error('getRewardCreditAddEventSummary failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get reward summary',
    }
  }
}

/**
 * Execute a signed desk quote — converts between project-credit (USD) and
 * project-native-token (RING) at the oracle rate.
 *
 * Desk flow:
 * 1. Client calls signDeskQuote action → gets quoteToken + rate
 * 2. Client confirms → calls executeDeskQuote with idempotencyKey + quoteToken
 * 3. Server validates quote, executes on-chain (buy: treasury→user RING, sell: user→burn RING)
 * 4. Server credits/debits user-credit-balance (always in project-default-fiat)
 *
 * Example (ring-platform.org): 100 user-credit-points (USD) → 10 RING at 10 USD per 1 RING
 */
export async function executeDeskQuote(formData: FormData): Promise<WalletActionResult & {
  orderId?: string
  status?: string
  txHash?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const idempotencyKey = formData.get('idempotencyKey') as string
    const quoteToken = formData.get('quoteToken') as string
    if (!idempotencyKey || !quoteToken) {
      return { success: false, error: 'idempotencyKey and quoteToken are required' }
    }

    const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
    const result = await WalletConductor.executeDesk({
      userId: session.user.id,
      role: session.user.role,
      idempotencyKey,
      quoteToken,
    })

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/wallet/activity')

    return {
      success: true,
      message: 'Desk trade executed successfully',
      orderId: result.orderId,
      status: result.status,
      txHash: result.txHash,
    }
  } catch (error) {
    logger.error('executeDeskQuote failed', { error })
    const message = error instanceof Error ? error.message : 'Desk execution failed'
    if (message.includes('Compliance')) {
      return { success: false, error: 'Compliance check failed' }
    }
    if (message.includes('Quote expired') || message.includes('signature mismatch')) {
      return { success: false, error: 'Quote expired or invalid — request a new quote' }
    }
    return { success: false, error: message }
  }
}

// ============================================================================
// PIN-GATED ACCESS TOKEN (Flawless Victory 2026-07-03)
// ============================================================================
// Replaces the previous MOCK CODE createPinAccessToken in
// features/wallet/services/ensure-wallet.ts. Now uses the persistent
// wallet_access_tokens table (lib/wallet/pin-access-token-db.ts) with
// sha256-hashed tokens, 15-min TTL, single-use, auto-revoke on re-issue.
//
// React 19 useActionState pattern: client uses useActionState() with
// initialState=null; the returned state carries the issued token or
// a sanitized error suitable for UI display.
// ============================================================================

export interface PinAccessTokenState {
  success: boolean
  accessToken?: string
  walletAddress?: string
  expiresAt?: string
  scope?: 'withdrawal' | 'transfer' | 'admin'
  error?: string
  /** Set when the user must migrate their wallet to v2 before tokens can be issued */
  requiresMigration?: boolean
}

export interface CreatePinAccessTokenOptions {
  scope?: 'withdrawal' | 'transfer' | 'admin'
  metadata?: Record<string, unknown>
}

/**
 * Server Action: Issue a single-use PIN-gated access token.
 * Use from client via useActionState — see features/wallet/components/PinAccessForm.tsx (TODO).
 */
export async function createPinAccessTokenAction(
  _prev: PinAccessTokenState | null,
  formData: FormData,
): Promise<PinAccessTokenState> {
  // 1. Auth: Secure entry point, required for all server actions.
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 2. Inputs: Parse FormData kept as a standard between React 19/Next.js 16 actions and forms.
  const pin = String(formData.get('pin') ?? '')
  const scope = (String(formData.get('scope') ?? 'withdrawal')) as PinAccessTokenState['scope']
  const metadataRaw = formData.get('metadata')
  let metadata: Record<string, unknown> = {}

  if (typeof metadataRaw === 'string' && metadataRaw.trim().length > 0) {
    try {
      metadata = JSON.parse(metadataRaw) as Record<string, unknown>
    } catch {
      // Defensive: bad JSON disables issuance but does not crash server; user gets a friendly error.
      return { success: false, error: 'Invalid metadata JSON' }
    }
  }

  try {
    // 3. Dynamic Import: These keep private cryptographic and db logic server-only and avoid cold starts.
    const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
    const { issueAccessToken } = await import('@/lib/wallet/pin-access-token-db')

    // Only v2 wallets support pin-gated flows. Fails with 'Legacy v1 wallet' for migration prompt.
    const ensured = await WalletConductor.ensureNativeWallet({
      id: session.user.id,
      role: session.user.role,
    })
    if (!ensured.ok || !ensured.native) {
      return { success: false, error: ensured.error || 'Wallet provisioning failed' }
    }
    const wallet = ensured.native

    // Core access token issuance, checks PIN and returns details
    const issued = await issueAccessToken(
      session.user.id,
      wallet,
      pin,
      scope,
      metadata,
    )

    // 4. Reactively invalidate wallets and security views, enabling UI auto-update/feedback
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/wallet')
    revalidatePath('/wallet/security')

    // 5. Return token, UI can then display it or store in useActionState
    return {
      success: true,
      accessToken: issued.accessToken,
      walletAddress: issued.walletAddress,
      expiresAt: issued.expiresAt,
      scope: issued.scope,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PIN verification failed'
    // Surface specific errors for most common user faults
    if (message.includes('PIN must be exactly 4 digits')) {
      return { success: false, error: 'PIN must be exactly 4 digits' }
    }
    if (message.includes('Legacy v1 wallet')) {
      return { success: false, error: 'Please migrate your wallet to set a PIN', requiresMigration: true }
    }
    if (message.includes('PIN authentication failed') || message.includes('decryptPrivateKeyWithPin')) {
      return { success: false, error: 'Incorrect PIN' }
    }
    // Unknown error, report generic
    logger.error('createPinAccessTokenAction failed', { error: message })
    return { success: false, error: 'Token issuance failed' }
  }
}

/**
 * Server Action: Revoke all active PIN-gated access tokens for the current user.
 * Useful for "log out all wallet sessions" / account-compromise recovery.
 */
export async function revokePinAccessTokensAction(): Promise<WalletActionResult> {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: 'Unauthorized' }
  }
  try {
    // Use DB revoker to delete all PIN tokens for the user.
    const { revokeActiveTokens } = await import('@/lib/wallet/pin-access-token-db')
    const revoked = await revokeActiveTokens(session.user.id)
    // Invalidate in-memory/server cache and security UI
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/wallet')
    revalidatePath('/wallet/security')
    return { success: true, message: `Revoked ${revoked} active token(s)` }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Revocation failed'
    logger.error('revokePinAccessTokensAction failed', { error: message })
    return { success: false, error: message }
  }
}

export interface CreditTopupFormState {
  success?: boolean
  error?: string
  message?: string
  paymentUrl?: string
}

/**
 * Initiate card redirect for wallet credit top-up (card / Apple Pay / Google Pay).
 * Settled via wallet_topup webhook → credit_balance add (NOT native RING).
 * Thin adapter → WalletConductor.initiateTopUp.
 */
export async function initiateCreditTopupPayment(
  prevState: CreditTopupFormState | null,
  formData: FormData,
): Promise<CreditTopupFormState> {
  const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
  return WalletConductor.initiateTopUp(prevState, formData)
}

/**
 * Confidential+ BuyNativeViaCard — PaymentConductor purpose native_token_onramp.
 * Thin adapter → WalletConductor.initiateNativeOnramp.
 */
export async function initiateNativeTokenOnrampPayment(
  prevState: CreditTopupFormState | null,
  formData: FormData,
): Promise<CreditTopupFormState> {
  const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
  return WalletConductor.initiateNativeOnramp(prevState, formData)
}

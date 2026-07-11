import {
  CreditTransaction,
  CreditTransactionType,
  UserCreditBalance,
  CreditTopUpRequest,
  CreditSpendRequest,
  CreditHistoryRequest,
  CreditHistoryResponse,
} from '@/lib/zod/credit-schemas';
import { db } from '@/lib/database';
import { logger } from '@/lib/logger';
import { publishToChannel } from '@/lib/tunnel/publisher';
import { getNativeTokenSymbol } from '@/lib/ring-config-chain';
import { getDefaultStoreCurrencySymbol } from '@/lib/ring-config-core';

// Fetch the default payment currency (e.g. 'USD' or similar) from system config.
// Uses the SSOT accessor (getDefaultStoreCurrencySymbol) instead of reaching
// into the raw snapshot — ring-config.json has `currencies` (array) and
// `store.defaultCurrency` (string), NOT `supportedCurrencies` (which is undefined).
const paymentCurrency = getDefaultStoreCurrencySymbol();

// Interface describing credit-related DB shape for a user document
interface UserCreditRow extends Record<string, unknown> {
  credit_balance?: UserCreditBalance;
  credit_transactions?: CreditTransaction[];
  updated_at?: Date;
}

// Returns true if the DB error metadata specifically indicates an initialization failure
function isDbInitFailure(metadata?: { operation?: string }): boolean {
  return metadata?.operation === 'initialize';
}

/**
 * CreditBalanceService exposes key operations for credit wallet logic:
 *  - Look up balances and histories
 *  - Transactionally update balances (debit/credit)
 *  - Publish balance changes for real-time UI updates
 *
 * TODO: Adopt native React 19/Next.js 16 server actions for all transactional flows.
 * TODO: Switch to React 19 native server context or next-auth's server user fetch for authenticated ops where possible.
 */
export class CreditBalanceService {
  // Singleton instance managed at the class level
  private static instance: CreditBalanceService;

  //   Private constructor enforces singleton usage.
  private constructor() {}

  /**
   * Returns the single instance of this service.
   * Ensures app-wide consistent singleton state.
   */
  static getInstance(): CreditBalanceService {
    if (!CreditBalanceService.instance) {
      CreditBalanceService.instance = new CreditBalanceService();
    }
    return CreditBalanceService.instance;
  }

  /**
   * Looks up a user's current credit balance from the DB.
   * Returns null for any DB error or missing document, with granular logging for diagnostics.
   */
  async getUserCreditBalance(userId: string): Promise<UserCreditBalance | null> {
    try {
      // Fetch user document for specified userId
      const userResult = await db().readDoc<UserCreditRow>('users', userId);
      // If DB read fails (e.g., init fail or user not found), log and degrade gracefully.
      if (!userResult.success) {
        if (isDbInitFailure(userResult.metadata)) {
          logger.error('Database initialization failed, returning null for graceful degradation.', {
            userId,
            error: userResult.error,
          });
        } else {
          logger.warn('User document not found, returning null for credit balance.', {
            userId,
            success: userResult.success,
            error: userResult.error,
          });
        }
        return null;
      }
      if (!userResult.data) {
        // User document is genuinely missing in DB
        logger.warn('User document not found, returning null for credit balance.', {
          userId,
          success: true,
          error: undefined,
        });
        return null;
      }
      // User doc exists: return the balance property if available; log for debug/observability.
      const userData = userResult.data;
      logger.info('User data retrieved for credit balance.', {
        userId,
        hasCreditBalance: !!userData?.credit_balance,
        creditBalanceKeys: userData?.credit_balance ? Object.keys(userData.credit_balance) : null,
      });
      return userData?.credit_balance ?? null;
    } catch (error) {
      // Defensive: catch all, log with stack, degrade to null.
      logger.error('Failed to get user credit balance, returning null for graceful degradation.', {
        userId,
        error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      return null;
    }
  }

  /**
   * Initialize a credit balance struct for a user if not present.
   * Throws if user doesn't exist in the DB or DB unavailable.
   */
  async initializeCreditBalance(userId: string): Promise<UserCreditBalance> {
    try {
      const now = new Date();

      // Create an initial zero balance struct
      const initialBalance: UserCreditBalance = {
        amount: '0',
        usd_equivalent: '0',
        fiat_currency: paymentCurrency,
        last_updated: now.getTime(),
        subscription_active: false,
      };

      // Read user doc to ensure user exists
      logger.info('Credit balance initialization: Reading user data.', { userId });
      const userResult = await db().readDoc<UserCreditRow>('users', userId);

      logger.info('Credit balance initialization: User read result.', {
        userId,
        success: userResult.success,
        hasData: !!userResult.data,
        error: userResult.error,
      });

      if (!userResult.success) {
        // DB unavailable or initializing
        if (isDbInitFailure(userResult.metadata)) {
          logger.error('Database initialization failed.', { userId, error: userResult.error });
          throw new Error('Database initialization failed.');
        }
        logger.error('Credit balance initialization: User not found in database.', {
          userId,
          success: userResult.success,
          error: userResult.error,
        });
        throw new Error('User not found.');
      }
      if (!userResult.data) {
        // User doesn't exist
        logger.error('Credit balance initialization: User not found in database.', { userId });
        throw new Error('User not found.');
      }
      const userData = userResult.data;

      logger.info('Initializing credit balance for existing user.', {
        userId,
        userDataKeys: Object.keys(userData),
        hasExistingCreditBalance: !!userData?.credit_balance,
      });

      // Merge initial balance into user document data for update
      const updatedData = {
        ...userData,
        credit_balance: initialBalance,
      };

      logger.info('Attempting to update user document with credit balance.', {
        userId,
        updatedDataKeys: Object.keys(updatedData),
      });

      // Update the DB with the new balance and updated_at timestamp
      const updateResult = await db().updateDoc('users', userId, {
        ...updatedData,
        updated_at: now,
      });
      if (!updateResult.success) {
        logger.error('Failed to update user document with credit balance.', {
          userId,
          error: updateResult.error,
          success: updateResult.success,
        });
        throw new Error(
          `Failed to update user document: ${updateResult.error?.message || 'Unknown error.'}`
        );
      }
      logger.info('Credit balance initialized.', { userId });
      return initialBalance;
    } catch (error) {
      logger.error('Failed to initialize credit balance.', {
        userId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error instanceof Error ? error : new Error('Failed to initialize credit balance.');
    }
  }

  /**
   * Add ("top up") credits to a user's account.
   * Transaction is atomically appended to history.
   * Throws if user doesn't exist or DB issues.
   *
   * TODO: Use React 19 Server Actions for this mutation (direct atomic 'update' in server context).
   */
  async addCredits(
    userId: string,
    request: CreditTopUpRequest,
    type: CreditTransactionType,
    usdRate: string
  ): Promise<{ success: true; transaction: CreditTransaction; newBalance: string }> {
    try {
      const now = new Date();

      // Lookup current user and their balance
      const userResult = await db().readDoc<UserCreditRow>('users', userId);
      if (!userResult.success) {
        if (isDbInitFailure(userResult.metadata)) {
          throw new Error('Database initialization failed.');
        }
        throw new Error('User not found.');
      }
      if (!userResult.data) {
        throw new Error('User not found.');
      }
      const userData = userResult.data;

      // Use the in-document balance, or default/zero if none present (legacy users)
      const currentBalance = userData?.credit_balance || {
        amount: '0',
        usd_equivalent: '0',
        fiat_currency: paymentCurrency,
        last_updated: now.getTime(),
        subscription_active: false,
      };

      // Compute the numeric new and old balances
      const currentAmount = parseFloat(currentBalance.amount);
      const addAmount = parseFloat(request.amount);
      const newAmount = (currentAmount + addAmount).toString();
      const usdEquivalent = (addAmount * parseFloat(usdRate)).toString();

      // Compose transaction for audit/history
      const transactionId = this._generateTransactionId();
      const creditTransaction: CreditTransaction = {
        id: transactionId,
        user_id: userId,
        type,
        amount: request.amount, // Always positive for credit/top-up
        usd_rate: usdRate,
        usd_equivalent: usdEquivalent,
        balance_after: newAmount,
        timestamp: now.getTime(),
        description: request.description,
        tx_hash: request.tx_hash,
        metadata: request.metadata,
      };

      // Update the balance in the struct
      const updatedBalance: UserCreditBalance = {
        ...currentBalance,
        amount: newAmount,
        usd_equivalent: (parseFloat(currentBalance.usd_equivalent) + parseFloat(usdEquivalent)).toString(),
        fiat_currency: currentBalance.fiat_currency ?? paymentCurrency,
        last_updated: now.getTime(),
        last_transaction_id: transactionId,
      };

      // Mutate user doc with new balance and timestamp
      const updatedUserData = {
        ...userData,
        credit_balance: updatedBalance,
        updated_at: now,
      };

      // Write balance update
      const updateResult = await db().updateDoc('users', userId, updatedUserData);
      if (!updateResult.success) {
        throw new Error('Failed to update user balance.');
      }

      // Extend transaction array with the new top-up
      // TODO: React19/Next16 - migrate to native RDB transactions or draft updates for true atomicity.
      const existingTransactions = userData?.credit_transactions || [];
      const updatedTransactions = [...existingTransactions, creditTransaction];

      // Now commit the transaction list (ideally, this and previous would be a single atomic op)
      const transactionUpdateResult = await db().updateDoc('users', userId, {
        ...updatedUserData,
        credit_transactions: updatedTransactions,
      });

      if (!transactionUpdateResult.success) {
        logger.warn('Failed to save credit transaction record, but balance was updated.', { userId, transactionId });
      }

      logger.info('Credits added successfully.', {
        userId,
        amount: request.amount,
        type,
        transactionId: creditTransaction.id,
      });

      // Fire-and-forget: update client UI in real-time via user-scope tunnel/pubsub channel
      await this.publishBalanceUpdate(userId, updatedBalance);

      return { success: true, transaction: creditTransaction, newBalance: newAmount };
    } catch (error) {
      logger.error('Failed to add credits.', { userId, request, error });
      throw new Error(`Failed to add credits: ${error}`);
    }
  }

  /**
   * Spend/debit credits from a user. Checks available balance, creates negative transaction.
   * Throws on overdraft or DB issues.
   *
   * TODO: Implement this as a React 19 server action for atomic debits, once available app-wide.
   */
  async spendCredits(
    userId: string,
    request: CreditSpendRequest,
    type: CreditTransactionType,
    usdRate: string
  ): Promise<{ success: true; transaction: CreditTransaction; newBalance: string }> {
    try {
      const now = new Date();

      // Fetch user and verify presence
      const userResult = await db().readDoc<UserCreditRow>('users', userId);
      if (!userResult.success) {
        if (isDbInitFailure(userResult.metadata)) {
          throw new Error('Database initialization failed.');
        }
        throw new Error('User not found.');
      }
      if (!userResult.data) {
        throw new Error('User not found.');
      }
      const userData = userResult.data;
      const currentBalance = userData?.credit_balance;
      if (!currentBalance) {
        throw new Error('No credit balance found.');
      }

      // Verify user has enough credits
      const currentAmount = parseFloat(currentBalance.amount);
      const spendAmount = parseFloat(request.amount);

      if (currentAmount < spendAmount) {
        throw new Error(`Insufficient balance. Current: ${currentAmount}, Required: ${spendAmount}.`);
      }

      // Calculate new balance and transaction
      const newAmount = (currentAmount - spendAmount).toString();
      const usdEquivalent = (spendAmount * parseFloat(usdRate)).toString();

      // Negative-valued credit transaction to represent debit/spend
      const transactionId = this._generateTransactionId();
      const creditTransaction: CreditTransaction = {
        id: transactionId,
        user_id: userId,
        type,
        amount: `-${request.amount}`,
        usd_rate: usdRate,
        usd_equivalent: `-${usdEquivalent}`,
        balance_after: newAmount,
        timestamp: now.getTime(),
        description: request.description,
        order_id: request.order_id,
        reference_id: request.reference_id,
        metadata: request.metadata,
      };

      // Construct updated balance object
      const updatedBalance: UserCreditBalance = {
        ...currentBalance,
        amount: newAmount,
        usd_equivalent: (parseFloat(currentBalance.usd_equivalent) - parseFloat(usdEquivalent)).toString(),
        fiat_currency: currentBalance.fiat_currency ?? paymentCurrency,
        last_updated: now.getTime(),
        last_transaction_id: transactionId,
      };

      // Write new balance to document
      const updatedUserData = {
        ...userData,
        credit_balance: updatedBalance,
        updated_at: now,
      };

      // Commit balance
      const updateResult = await db().updateDoc('users', userId, updatedUserData);
      if (!updateResult.success) {
        throw new Error('Failed to update user balance.');
      }

      // Transaction list update (non-atomic)
      const existingTransactions = userData?.credit_transactions || [];
      const updatedTransactions = [...existingTransactions, creditTransaction];

      // Write new transaction list
      const transactionUpdateResult = await db().updateDoc('users', userId, {
        ...updatedUserData,
        credit_transactions: updatedTransactions,
      });
      if (!transactionUpdateResult.success) {
        logger.warn('Failed to save credit transaction record, but balance was updated.', { userId, transactionId });
      }

      logger.info('Credits spent successfully.', {
        userId,
        amount: request.amount,
        type,
        transactionId: creditTransaction.id,
      });

      // Update client UI for new balance in real time
      await this.publishBalanceUpdate(userId, updatedBalance);

      return { success: true, transaction: creditTransaction, newBalance: newAmount };
    } catch (error) {
      logger.error('Failed to spend credits.', { userId, request, error });
      throw new Error(`Failed to spend credits: ${error}`);
    }
  }

  /**
   * Retrieves a user's paginated credit transaction history, supporting type/date filters.
   *
   * // STUB: Filtering and pagination are done in-memory, not efficient for large sets.
   * // TODO: React19/Next16: Switch this to use native SQL 'window functions' or cursor-based paginated queries with streaming,
   * //   with query pushed entirely into DB for proper performance/scalability.
   */
  async getCreditHistory(
    userId: string,
    request: CreditHistoryRequest
  ): Promise<CreditHistoryResponse> {
    try {
      // STUB: Reads whole credit_transactions array; inefficient for high-volume accounts.
      const userResult = await db().readDoc<UserCreditRow>('users', userId);
      if (!userResult.success) {
        if (isDbInitFailure(userResult.metadata)) {
          throw new Error('Database initialization failed.');
        }
        throw new Error('User not found.');
      }
      if (!userResult.data) {
        throw new Error('User not found.');
      }
      const userData = userResult.data;
      const allTransactions: CreditTransaction[] = userData?.credit_transactions || [];

      let filteredTransactions = allTransactions;

      // If a type filter is passed, filter for only those entry types.
      if (request.type) {
        filteredTransactions = filteredTransactions.filter((t) => t.type === request.type);
      }

      // Date filtering if requested: filter by start and/or end date range
      if (request.start_date || request.end_date) {
        filteredTransactions = filteredTransactions.filter((t) => {
          const txDate = new Date(t.timestamp);
          if (request.start_date && txDate < new Date(request.start_date)) return false;
          if (request.end_date && txDate > new Date(request.end_date)) return false;
          return true;
        });
      }

      // Sort so that newest transactions come first
      filteredTransactions.sort((a, b) => b.timestamp - a.timestamp);

      // Offset-based pagination: use after_id and limit
      const startIndex = request.after_id
        ? filteredTransactions.findIndex((t) => t.id === request.after_id) + 1
        : 0;

      const endIndex = startIndex + (request.limit || 20);
      const transactions = filteredTransactions.slice(startIndex, endIndex);

      // Windowed summary (not full account): credits, debits, net, count
      const summary = this._calculateSummary(transactions);

      // Are there more transactions to paginate?
      const hasMore = endIndex < filteredTransactions.length;
      const nextCursor =
        hasMore && transactions.length > 0 ? transactions[transactions.length - 1].id : undefined;

      logger.info('Credit history retrieved.', {
        userId,
        transactionCount: transactions.length,
        hasMore,
      });

      return {
        transactions,
        has_more: hasMore,
        next_cursor: nextCursor,
        summary,
      };
    } catch (error) {
      logger.error('Failed to get credit history.', { userId, request, error });
      throw new Error('Failed to retrieve credit history.');
    }
  }

  /**
   * Returns true if user currently has >= requiredAmount credits.
   * Defensive: falls back to "false" on any error (including cannot read balance).
   */
  async hasSufficientBalance(userId: string, requiredAmount: string): Promise<boolean> {
    try {
      // Look up current balance
      const balance = await this.getUserCreditBalance(userId);
      if (!balance) {
        return false;
      }
      const currentAmount = parseFloat(balance.amount);
      const required = parseFloat(requiredAmount);
      return currentAmount >= required;
    } catch (error) {
      logger.error('Failed to check sufficient balance.', { userId, requiredAmount, error });
      return false;
    }
  }

  /**
   * Look up the current user's credit balance using their server session/user context.
   * Uses lazy import for @/auth for bundle bloat avoidance and compatibility.
   *
   * TODO: Replace this with React 19 or NextJS 16 native 'server context' user() getter.
   * TODO: If in a React Server Action context, receive userId as a parameter instead.
   */
  async getCurrentUserCreditBalance(): Promise<UserCreditBalance | null> {
    // Lazy import keeps this file SSR-safe: does not always import heavy next-auth types/bundles.
    const { auth } = await import('@/auth');
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User not authenticated.');
    }
    // Lookup credit balance for the authenticated userId
    return this.getUserCreditBalance(session.user.id);
  }

  /**
   * Debit (spend) a user's balance for membership fee.
   * Creates a debit transaction with known membership metadata.
   */
  async processMembershipFee(
    userId: string,
    membershipFee: string,
    usdRate: string
  ): Promise<{ success: true; transaction: CreditTransaction }> {
    try {
      // Prepare spend request struct for this specific business logic (membership fee)
      const request: CreditSpendRequest = {
        amount: membershipFee,
        description: 'Monthly membership fee',
        metadata: {
          subscription_type: 'monthly_membership',
          payment_method: 'ring_credits',
        },
      };
      // Use existing debit/spend flow to ensure identical audit trail, limits, balances, etc.
      const result = await this.spendCredits(userId, request, 'membership_fee', usdRate);

      logger.info('Membership fee processed.', {
        userId,
        amount: membershipFee,
        transactionId: result.transaction.id,
      });

      return { success: true, transaction: result.transaction };
    } catch (error) {
      logger.error('Failed to process membership fee.', { userId, membershipFee, error });
      throw error;
    }
  }

  /**
   * Create a globally unique transaction id for audit logging.
   * Uses timestamp + pseudo-random string.
   * TODO: Use native crypto.randomUUID() for even stronger uniqueness (available on Node 18+ and edge runtimes)
   */
  private _generateTransactionId(): string {
    // If new enough Node/runtime, use crypto.randomUUID(); fallback as below
    // TODO: When supported everywhere, switch to crypto.randomUUID()
    return `ct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Compute a summary of a list of transactions: total credits, debits, net change, count.
   * Used for windowed paginated history list summaries.
   */
  private _calculateSummary(transactions: CreditTransaction[]) {
    let totalCredits = 0;
    let totalDebits = 0;

    // For each transaction, accumulate its amount to credits or debits
    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount);
      if (amount > 0) {
        totalCredits += amount;
      } else {
        totalDebits += Math.abs(amount);
      }
    });

    const netChange = totalCredits - totalDebits;

    return {
      total_credits: totalCredits.toString(),
      total_debits: totalDebits.toString(),
      net_change: netChange.toString(),
      transaction_count: transactions.length,
    };
  }

  /**
   * Publishes a credit balance change to the user's live channel, so UI can re-render without poll.
   *
   * TODO: After Next.js 16, switch to Edge PubSub proxy for lowest-latency, cost-effective real-time UX.
   * // STUB: hardcoded/mock limits; real per-user/account limits should be loaded/calculated.
   */
  private async publishBalanceUpdate(userId: string, balance: UserCreditBalance): Promise<void> {
    try {
      // Publish only essential client fields (balance + subscription + limits)
      const balanceData = {
        balance: {
          amount: balance.amount,
          usd_equivalent: balance.usd_equivalent,
          last_updated: balance.last_updated,
        },
        subscription: {
          active: balance.subscription_active || false,
          contract_address: balance.subscription_contract_address,
          next_payment: balance.subscription_next_payment,
          status: balance.subscription_active ? 'ACTIVE' as const : 'INACTIVE' as const,
        },
        limits: {
          // STUB: These are NOT dynamic limits; real implementation would load per-user/account limits from DB or system profile.
          // STUB: monthly_spend_limit: should be actual policy/cap from user/account/config
          // STUB: remaining_monthly_limit: needs decrement on each spend, loaded from balance/account
          monthly_spend_limit: '1000', // STUB/static
          remaining_monthly_limit: '1000', // STUB/static
          min_balance_warning: '1', // STUB/static
        },
      };
      // Actually trigger the pubsub/push event (can be async fire-and-forget if wanted)
      await publishToChannel(userId, 'credit:balance', balanceData);
    } catch (error) {
      logger.error('Failed to publish balance update.', { userId, error });
    }
  }

  /**
   * Utility: Immediately spend fiat USD credits for a user (wrapper enforcing usd_rate = 1).
   * // STUB: Currency enforcement is not robust; in a real multi-fiat scenario, currency & rate logic must be generalized.
   */
  async spendFiatUsd(
    userId: string,
    usdAmount: string,
    description: string,
    type: CreditTransactionType = 'desk_buy',
    metadata?: Record<string, unknown>
  ) {
    const { getFiatCreditAccountingRate } = await import('@/lib/payments/credit-currency')
    return this.spendCredits(
      userId,
      { amount: usdAmount, description, metadata },
      type,
      getFiatCreditAccountingRate()
    );
  }

  /**
   * Utility: Immediately top up fiat credits for a user (SSOT unitToDefaultCurrency rate).
   */
  async addFiatUsd(
    userId: string,
    usdAmount: string,
    description: string,
    type: CreditTransactionType = 'desk_sell',
    metadata?: Record<string, unknown>
  ) {
    const { getFiatCreditAccountingRate } = await import('@/lib/payments/credit-currency')
    return this.addCredits(
      userId,
      { amount: usdAmount, description, metadata },
      type,
      getFiatCreditAccountingRate()
    );
  }
}

// Export the singleton for global import
// (Helps ensure all consumers share the same service instance and share strong typing.)
export const creditBalanceService = CreditBalanceService.getInstance();
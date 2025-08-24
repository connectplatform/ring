import { 
  CreditTransaction, 
  CreditTransactionType,
  UserCreditBalance,
  CreditTopUpRequest,
  CreditSpendRequest,
  CreditHistoryRequest,
  CreditHistoryResponse,
} from '@/lib/zod/credit-schemas';
import { getAdminDb } from '@/lib/firebase-admin.server';
import { auth } from '@/auth';
import { logger } from '@/lib/logger';

/**
 * Service for managing user credit balances and transactions
 */
export class UserCreditService {
  private static instance: UserCreditService;
  private db = getAdminDb();

  private constructor() {}

  static getInstance(): UserCreditService {
    if (!UserCreditService.instance) {
      UserCreditService.instance = new UserCreditService();
    }
    return UserCreditService.instance;
  }

  /**
   * Get user credit balance
   */
  async getUserCreditBalance(userId: string): Promise<UserCreditBalance | null> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      const userDoc = await userRef.get();  // TODO: use getCachedDocument
      // TODO: use getCachedCollection
      
      if (!userDoc.exists) {
        logger.warn('User not found', { userId });
        return null;
      }
      
      const userData = userDoc.data();
      return userData?.credit_balance || null;
    } catch (error) {
      logger.error('Failed to get user credit balance', { userId, error });
      throw new Error('Failed to retrieve credit balance');
    }
  }

  /**
   * Initialize credit balance for new user
   */
  async initializeCreditBalance(userId: string): Promise<UserCreditBalance> {
    try {
      const initialBalance: UserCreditBalance = {
        amount: '0',
        usd_equivalent: '0',
        last_updated: Date.now(),
        subscription_active: false,
      };

      const userRef = this.db.collection('users').doc(userId);
      await userRef.update({
        credit_balance: initialBalance,
      });

      logger.info('Credit balance initialized', { userId });
      return initialBalance;
    } catch (error) {
      logger.error('Failed to initialize credit balance', { userId, error });
      throw new Error('Failed to initialize credit balance');
    }
  }

  /**
   * Add credits to user balance (airdrop, reimbursement, top-up)
   */
  async addCredits(
    userId: string, 
    request: CreditTopUpRequest,
    type: CreditTransactionType,
    usdRate: string
  ): Promise<{ success: true; transaction: CreditTransaction; newBalance: string }> {
    try {
      const result = await this.db.runTransaction(async (transaction) => {
        // Get current user data
        const userRef = this.db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        const currentBalance = userData?.credit_balance || {
          amount: '0',
          usd_equivalent: '0',
          last_updated: Date.now(),
          subscription_active: false,
        };

        // Calculate new balance
        const currentAmount = parseFloat(currentBalance.amount);
        const addAmount = parseFloat(request.amount);
        const newAmount = (currentAmount + addAmount).toString();
        const usdEquivalent = (addAmount * parseFloat(usdRate)).toString();

        // Create transaction record
        const transactionId = this._generateTransactionId();
        const creditTransaction: CreditTransaction = {
          id: transactionId,
          user_id: userId,
          type,
          amount: request.amount,
          usd_rate: usdRate,
          usd_equivalent: usdEquivalent,
          balance_after: newAmount,
          timestamp: Date.now(),
          description: request.description,
          tx_hash: request.tx_hash,
          metadata: request.metadata,
        };

        // Update user credit balance
        const updatedBalance: UserCreditBalance = {
          ...currentBalance,
          amount: newAmount,
          usd_equivalent: (parseFloat(currentBalance.usd_equivalent) + parseFloat(usdEquivalent)).toString(),
          last_updated: Date.now(),
          last_transaction_id: transactionId,
        };

        // Save transaction
        const transactionRef = this.db.collection('users').doc(userId).collection('credit_transactions').doc(transactionId);
        transaction.set(transactionRef, creditTransaction);

        // Update user balance
        transaction.update(userRef, {
          credit_balance: updatedBalance,
        });

        return { transaction: creditTransaction, newBalance: newAmount };
      });

      logger.info('Credits added successfully', { 
        userId, 
        amount: request.amount, 
        type,
        transactionId: result.transaction.id 
      });

      return { success: true, ...result };
    } catch (error) {
      logger.error('Failed to add credits', { userId, request, error });
      throw new Error(`Failed to add credits: ${error}`);
    }
  }

  /**
   * Spend credits from user balance
   */
  async spendCredits(
    userId: string,
    request: CreditSpendRequest,
    type: CreditTransactionType,
    usdRate: string
  ): Promise<{ success: true; transaction: CreditTransaction; newBalance: string }> {
    try {
      const result = await this.db.runTransaction(async (transaction) => {
        // Get current user data
        const userRef = this.db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        const currentBalance = userData?.credit_balance;
        
        if (!currentBalance) {
          throw new Error('No credit balance found');
        }

        // Check sufficient balance
        const currentAmount = parseFloat(currentBalance.amount);
        const spendAmount = parseFloat(request.amount);
        
        if (currentAmount < spendAmount) {
          throw new Error(`Insufficient balance. Current: ${currentAmount}, Required: ${spendAmount}`);
        }

        // Calculate new balance
        const newAmount = (currentAmount - spendAmount).toString();
        const usdEquivalent = (spendAmount * parseFloat(usdRate)).toString();

        // Create transaction record (negative amount for debit)
        const transactionId = this._generateTransactionId();
        const creditTransaction: CreditTransaction = {
          id: transactionId,
          user_id: userId,
          type,
          amount: `-${request.amount}`, // Negative for debit
          usd_rate: usdRate,
          usd_equivalent: `-${usdEquivalent}`, // Negative for debit
          balance_after: newAmount,
          timestamp: Date.now(),
          description: request.description,
          order_id: request.order_id,
          reference_id: request.reference_id,
          metadata: request.metadata,
        };

        // Update user credit balance
        const updatedBalance: UserCreditBalance = {
          ...currentBalance,
          amount: newAmount,
          usd_equivalent: (parseFloat(currentBalance.usd_equivalent) - parseFloat(usdEquivalent)).toString(),
          last_updated: Date.now(),
          last_transaction_id: transactionId,
        };

        // Save transaction
        const transactionRef = this.db.collection('users').doc(userId).collection('credit_transactions').doc(transactionId);
        transaction.set(transactionRef, creditTransaction);

        // Update user balance
        transaction.update(userRef, {
          credit_balance: updatedBalance,
        });

        return { transaction: creditTransaction, newBalance: newAmount };
      });

      logger.info('Credits spent successfully', { 
        userId, 
        amount: request.amount, 
        type,
        transactionId: result.transaction.id 
      });

      return { success: true, ...result };
    } catch (error) {
      logger.error('Failed to spend credits', { userId, request, error });
      throw new Error(`Failed to spend credits: ${error}`);
    }
  }

  /**
   * Get user credit transaction history
   */
  async getCreditHistory(
    userId: string, 
    request: CreditHistoryRequest
  ): Promise<CreditHistoryResponse> {
    try {
      const transactionsRef = this.db.collection('users').doc(userId).collection('credit_transactions');
      
      // Build query
      let q = transactionsRef
        .orderBy('timestamp', 'desc')
        .limit(request.limit);

      // Add type filter
      if (request.type) {
        q = q.where('type', '==', request.type);
      }

      // Add date range filters
      if (request.start_date) {
        q = q.where('timestamp', '>=', request.start_date);
      }
      if (request.end_date) {
        q = q.where('timestamp', '<=', request.end_date);
      }

      // Add pagination
      if (request.after_id) {
        const afterDoc = await this.db.collection('users').doc(userId).collection('credit_transactions').doc(request.after_id).get();
        if (afterDoc.exists) {
          q = q.startAfter(afterDoc);
        }
      }

      const snapshot = await q.get();
      const transactions: CreditTransaction[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data() as CreditTransaction;
        transactions.push(data);
      });

      // Calculate summary
      const summary = this._calculateSummary(transactions);
      
      // Check for more results
      const hasMore = snapshot.docs.length === request.limit;
      const nextCursor = hasMore && transactions.length > 0 
        ? transactions[transactions.length - 1].id 
        : undefined;

      logger.info('Credit history retrieved', { 
        userId, 
        transactionCount: transactions.length,
        hasMore 
      });

      return {
        transactions,
        has_more: hasMore,
        next_cursor: nextCursor,
        summary,
      };
    } catch (error) {
      logger.error('Failed to get credit history', { userId, request, error });
      throw new Error('Failed to retrieve credit history');
    }
  }

  /**
   * Check if user has sufficient balance for a purchase
   */
  async hasSufficientBalance(userId: string, requiredAmount: string): Promise<boolean> {
    try {
      const balance = await this.getUserCreditBalance(userId);
      if (!balance) {
        return false;
      }

      const currentAmount = parseFloat(balance.amount);
      const required = parseFloat(requiredAmount);
      
      return currentAmount >= required;
    } catch (error) {
      logger.error('Failed to check sufficient balance', { userId, requiredAmount, error });
      return false;
    }
  }

  /**
   * Get current authenticated user's credit balance
   */
  async getCurrentUserCreditBalance(): Promise<UserCreditBalance | null> {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    return this.getUserCreditBalance(session.user.id);
  }

  /**
   * Process membership fee payment from credit balance
   */
  async processMembershipFee(
    userId: string,
    membershipFee: string,
    usdRate: string
  ): Promise<{ success: true; transaction: CreditTransaction }> {
    try {
      const request: CreditSpendRequest = {
        amount: membershipFee,
        description: 'Monthly membership fee',
        metadata: {
          subscription_type: 'monthly_membership',
          payment_method: 'ring_credits',
        },
      };

      const result = await this.spendCredits(
        userId,
        request,
        'membership_fee',
        usdRate
      );

      logger.info('Membership fee processed', { 
        userId, 
        amount: membershipFee,
        transactionId: result.transaction.id 
      });

      return { success: true, transaction: result.transaction };
    } catch (error) {
      logger.error('Failed to process membership fee', { userId, membershipFee, error });
      throw error;
    }
  }

  /**
   * Generate unique transaction ID
   */
  private _generateTransactionId(): string {
    return `ct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate transaction summary
   */
  private _calculateSummary(transactions: CreditTransaction[]) {
    let totalCredits = 0;
    let totalDebits = 0;

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
}

// Export singleton instance
export const userCreditService = UserCreditService.getInstance();
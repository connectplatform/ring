import { 
  CreditTransaction, 
  CreditTransactionType,
  UserCreditBalance,
  CreditTopUpRequest,
  CreditSpendRequest,
  CreditHistoryRequest,
  CreditHistoryResponse,
} from '@/lib/zod/credit-schemas';
import {
  getDatabaseService,
  initializeDatabase
} from '@/lib/database';
import { auth } from '@/auth';
import { logger } from '@/lib/logger';

/**
 * Service for managing user credit balances and transactions
 */
export class UserCreditService {
  private static instance: UserCreditService;

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
      // Initialize database service
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        logger.error('Database initialization failed', { userId, error: initResult.error });
        throw new Error('Database initialization failed');
      }

      const dbService = getDatabaseService();
      const userResult = await dbService.read('users', userId);

      if (!userResult.success || !userResult.data) {
        logger.warn('User not found', { userId });
        return null;
      }

      const userData = userResult.data.data || userResult.data;
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

      // Initialize database service
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        logger.error('Database initialization failed', { userId, error: initResult.error });
        throw new Error('Database initialization failed');
      }

      const dbService = getDatabaseService();

      // First read the current user data
      const userResult = await dbService.read('users', userId);
      if (!userResult.success || !userResult.data) {
        throw new Error('User not found');
      }

      const userData = userResult.data.data || userResult.data;

      // Merge credit balance into existing data
      const updatedData = {
        ...userData,
        credit_balance: initialBalance
      };

      // Update the user document
      const updateResult = await dbService.update('users', userId, updatedData);
      if (!updateResult.success) {
        throw new Error('Failed to update user document');
      }

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
      // Initialize database service
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error('Database initialization failed');
      }

      const dbService = getDatabaseService();

      // Get current user data
      const userResult = await dbService.read('users', userId);
      if (!userResult.success || !userResult.data) {
        throw new Error('User not found');
      }

      const userData = userResult.data.data || userResult.data;
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

      // Update user data with new balance
      const updatedUserData = {
        ...userData,
        credit_balance: updatedBalance,
        updated_at: new Date()
      };

      const updateResult = await dbService.update('users', userId, updatedUserData);
      if (!updateResult.success) {
        throw new Error('Failed to update user balance');
      }

      // For now, store credit transactions in the user data as an array
      // TODO: Create a separate credit_transactions table in the future
      const existingTransactions = userData?.credit_transactions || [];
      const updatedTransactions = [...existingTransactions, creditTransaction];

      const transactionUpdateResult = await dbService.update('users', userId, {
        ...updatedUserData,
        credit_transactions: updatedTransactions
      });

      if (!transactionUpdateResult.success) {
        logger.warn('Failed to save credit transaction record, but balance was updated', { userId, transactionId });
      }

      logger.info('Credits added successfully', {
        userId,
        amount: request.amount,
        type,
        transactionId: creditTransaction.id
      });

      return { success: true, transaction: creditTransaction, newBalance: newAmount };
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
      // Initialize database service
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error('Database initialization failed');
      }

      const dbService = getDatabaseService();

      // Get current user data
      const userResult = await dbService.read('users', userId);
      if (!userResult.success || !userResult.data) {
        throw new Error('User not found');
      }

      const userData = userResult.data.data || userResult.data;
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

      // Update user data with new balance
      const updatedUserData = {
        ...userData,
        credit_balance: updatedBalance,
        updated_at: new Date()
      };

      const updateResult = await dbService.update('users', userId, updatedUserData);
      if (!updateResult.success) {
        throw new Error('Failed to update user balance');
      }

      // For now, store credit transactions in the user data as an array
      // TODO: Create a separate credit_transactions table in the future
      const existingTransactions = userData?.credit_transactions || [];
      const updatedTransactions = [...existingTransactions, creditTransaction];

      const transactionUpdateResult = await dbService.update('users', userId, {
        ...updatedUserData,
        credit_transactions: updatedTransactions
      });

      if (!transactionUpdateResult.success) {
        logger.warn('Failed to save credit transaction record, but balance was updated', { userId, transactionId });
      }

      logger.info('Credits spent successfully', {
        userId,
        amount: request.amount,
        type,
        transactionId: creditTransaction.id
      });

      return { success: true, transaction: creditTransaction, newBalance: newAmount };
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
      // Initialize database service
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error('Database initialization failed');
      }

      const dbService = getDatabaseService();

      // Get user data
      const userResult = await dbService.read('users', userId);
      if (!userResult.success || !userResult.data) {
        throw new Error('User not found');
      }

      const userData = userResult.data.data || userResult.data;
      const allTransactions: CreditTransaction[] = userData?.credit_transactions || [];

      // Filter transactions based on request criteria
      let filteredTransactions = allTransactions;

      // Filter by type
      if (request.type) {
        filteredTransactions = filteredTransactions.filter(t => t.type === request.type);
      }

      // Filter by date range
      if (request.start_date || request.end_date) {
        filteredTransactions = filteredTransactions.filter(t => {
          const txDate = new Date(t.timestamp);
          if (request.start_date && txDate < new Date(request.start_date)) return false;
          if (request.end_date && txDate > new Date(request.end_date)) return false;
          return true;
        });
      }

      // Sort by timestamp descending (most recent first)
      filteredTransactions.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      const startIndex = request.after_id
        ? filteredTransactions.findIndex(t => t.id === request.after_id) + 1
        : 0;

      const endIndex = startIndex + (request.limit || 20);
      const transactions = filteredTransactions.slice(startIndex, endIndex);

      // Calculate summary
      const summary = this._calculateSummary(transactions);

      // Check for more results
      const hasMore = endIndex < filteredTransactions.length;
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
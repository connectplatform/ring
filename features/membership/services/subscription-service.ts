import { SubscriptionStatus } from '@/lib/zod/credit-schemas';
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service';
import { nativeTokenPriceOracleService } from '@/features/wallet/services/native-token-price-oracle';
import { getNativeChainConfig } from '@/lib/ring-config-chain';
import { db } from '@/lib/database';
import { auth } from '@/auth';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// TODO: If migrating to React 19/Next.js 16, consider leveraging server actions 
// for all mutative handlers (creation, cancellation, renewal), and caching selectors
// for read operations like getSubscriptionStatus.

// Interface for the result of creating a subscription (success payload shape)
interface SubscriptionCreationResult {
  success: true;
  subscription: SubscriptionStatus;
  transaction_hash?: string;
  contract_address: string;
}

// Interface for payment operation result details
interface PaymentResult {
  success: boolean;
  transaction_hash?: string;
  amount_paid?: string;
  next_payment_due?: number;
  error?: string;
}

// SubscriptionRow extends SubscriptionStatus typing with db id
type SubscriptionRow = SubscriptionStatus & { id: string };

/**
 * Singleton service for managing membership subscriptions.
 */
export class SubscriptionService {
  private static instance: SubscriptionService;

  // Private constructor prevents class instantiation outside .getInstance()
  private constructor() {}

  // Retrieve or instantiate the singleton instance
  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Create a new membership subscription for a user.
   * Throws if already active.
   */
  async createSubscription(userId: string): Promise<SubscriptionCreationResult> {
    try {
      // Check for active subscription
      const existingSubscription = await this.getSubscriptionStatus(userId);
      if (existingSubscription && existingSubscription.status === 'ACTIVE') {
        throw new Error('User already has an active subscription');
      }

      const membershipFee = '1.0'; // TODO: Parameterize fee for flexibility 

      // Check if user has enough credit tokens
      const hasSufficientBalance = await creditBalanceService.hasSufficientBalance(
        userId,
        membershipFee
      );

      if (!hasSufficientBalance) {
        throw new Error('Insufficient token balance for subscription');
      }

      // Retrieve the current USD price for the chain's native token
      const priceData = await nativeTokenPriceOracleService.getNativeTokenUsdPrice(
        Number(getNativeChainConfig().solana?.chainId)
      );

      // Process payment using membership fee and current price
      // TODO: Replace with native server actions for atomicity if/when possible in Next.js 16
      const paymentResult = await creditBalanceService.processMembershipFee(
        userId,
        membershipFee,
        priceData.price
      );

      // Construct subscription DB row
      const subscriptionId = `sub_${Date.now()}_${userId.slice(-8)}`;
      const now = Date.now();
      // Set next payment due in 30 days
      const nextPaymentDue = now + (30 * 24 * 60 * 60 * 1000);

      const subscription: SubscriptionStatus = {
        user_id: userId,
        status: 'ACTIVE',
        start_time: now,
        next_payment_due: nextPaymentDue,
        failed_attempts: 0,
        auto_renew: true,
        total_paid: membershipFee,
        payments_count: 1,
      };

      // Execute DB transaction: create subscription + update user meta
      await db().transaction(async (txn) => {
        await txn.create(
          'ring_subscriptions',
          {
            ...subscription,
            created_at: now,
            updated_at: now,
          },
          { id: subscriptionId }
        );

        await txn.update('users', userId, {
          'credit_balance.subscription_active': true,
          'credit_balance.subscription_next_payment': nextPaymentDue,
          'membership.tier': 'MEMBER',
          'membership.upgraded_at': now,
          'membership.payment_method': 'ring_credits',
          'membership.auto_renew': true,
        });
      });

      // Invalidate and update user profile cache/page
      revalidatePath(`/[locale]/profile/${userId}`);

      logger.info('Subscription created successfully', {
        userId,
        subscriptionId,
        initialPayment: paymentResult.transaction.id, // STUB: confirm paymentResult.transaction instance shape
        nextPaymentDue,
      });

      return {
        success: true,
        subscription,
        contract_address: process.env.RING_MEMBERSHIP_CONTRACT_ADDRESS || '', // Fallback to empty string
      };

    } catch (error) {
      logger.error('Failed to create subscription', { userId, error });
      throw new Error(`Failed to create subscription: ${error}`);
    }
  }

  /**
   * Cancel user's subscription (change status & revoke user benefits).
   */
  async cancelSubscription(userId: string): Promise<{ success: true }> {
    try {
      // Check for existing active subscription
      const subscription = await this.getSubscriptionStatus(userId);
      if (!subscription || subscription.status !== 'ACTIVE') {
        throw new Error('No active subscription found');
      }

      const now = Date.now();

      // Find active subscription in DB
      const queryResult = await db().queryDocs<SubscriptionRow & Record<string, unknown>>({
        collection: 'ring_subscriptions',
        filters: [
          { field: 'user_id', operator: '==', value: userId },
          { field: 'status', operator: '==', value: 'ACTIVE' }
        ]
      });

      if (!queryResult.success || !queryResult.data?.length) {
        throw new Error('Active subscription not found in database');
      }

      const activeSubscriptionId = queryResult.data[0].id;

      // Update subscription and user account in same transaction for integrity
      await db().transaction(async (txn) => {
        await txn.update('ring_subscriptions', activeSubscriptionId, {
          status: 'CANCELLED',
          cancelled_at: now,
          updated_at: now,
        });

        await txn.update('users', userId, {
          'credit_balance.subscription_active': false,
          'credit_balance.subscription_next_payment': null,
          'membership.auto_renew': false,
        });
      });

      revalidatePath(`/[locale]/profile/${userId}`);

      logger.info('Subscription cancelled', { userId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to cancel subscription', { userId, error });
      throw new Error(`Failed to cancel subscription: ${error}`);
    }
  }

  /**
   * Process manual subscription renewal/payment now.
   * Fails if not due.
   */
  async renewSubscription(userId: string): Promise<PaymentResult> {
    try {
      // Get latest subscription
      const subscription = await this.getSubscriptionStatus(userId);
      if (!subscription) {
        throw new Error('No subscription found');
      }

      // Only allow renewal if subscription is due/exceeded
      if (subscription.status === 'ACTIVE' && subscription.next_payment_due! > Date.now()) {
        throw new Error('Subscription is not due for renewal');
      }

      const membershipFee = '1.0'; // TODO: Parameterize fee for flexibility

      // Check for sufficient wallet credit
      const hasSufficientBalance = await creditBalanceService.hasSufficientBalance(userId, membershipFee);

      if (!hasSufficientBalance) {
        return {
          success: false,
          error: `Insufficient {native_token} balance for renewal`, // TODO: Replace placeholder with symbol/label
        };
      }

      // Find live price again before payment
      const priceData = await nativeTokenPriceOracleService.getNativeTokenUsdPrice(
        Number(getNativeChainConfig().solana?.chainId)
      );

      // Process the payment
      // TODO: Wrap payment + subscription update in a unified action/mutex if possible in Next 16
      const paymentResult = await creditBalanceService.processMembershipFee(
        userId,
        membershipFee,
        priceData.price
      );

      const now = Date.now();
      const nextPaymentDue = now + (30 * 24 * 60 * 60 * 1000);

      // Find the subscription doc to patch
      const queryResult = await db().queryDocs<SubscriptionRow & Record<string, unknown>>({
        collection: 'ring_subscriptions',
        filters: [{ field: 'user_id', operator: '==', value: userId }]
      });

      if (!queryResult.success || !queryResult.data?.length) {
        throw new Error('Subscription not found');
      }

      const subscriptionDoc = queryResult.data[0];
      const currentData = subscriptionDoc as SubscriptionStatus;

      // Patch the existing record
      await db().transaction(async (txn) => {
        await txn.update('ring_subscriptions', subscriptionDoc.id, {
          status: 'ACTIVE',
          next_payment_due: nextPaymentDue,
          failed_attempts: 0,
          total_paid: (parseFloat(currentData.total_paid) + parseFloat(membershipFee)).toString(),
          payments_count: currentData.payments_count + 1,
          updated_at: now,
        });

        await txn.update('users', userId, {
          'credit_balance.subscription_active': true,
          'credit_balance.subscription_next_payment': nextPaymentDue,
        });
      });

      revalidatePath(`/[locale]/profile/${userId}`);

      logger.info('Subscription renewed', {
        userId,
        paymentTransactionId: paymentResult.transaction.id, // STUB: verify this property exists on result
        nextPaymentDue,
      });

      return {
        success: true,
        amount_paid: membershipFee,
        next_payment_due: nextPaymentDue,
      };

    } catch (error) {
      logger.error('Failed to renew subscription', { userId, error });
      return {
        success: false,
        error: `Failed to renew subscription: ${error}`,
      };
    }
  }

  /**
   * Get latest subscription status for a user.
   * Reads from DB, applies status updates if overdue.
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
    try {
      // Query subscriptions for user, return latest by start_time
      const queryResult = await db().queryDocs<SubscriptionRow & Record<string, unknown>>({
        collection: 'ring_subscriptions',
        filters: [{ field: 'user_id', operator: '==', value: userId }],
        orderBy: [{ field: 'start_time', direction: 'desc' }],
        pagination: { limit: 1 }
      });

      if (!queryResult.success) {
        throw queryResult.error || new Error('Failed to query subscriptions');
      }

      if (!queryResult.data?.length) {
        return null;
      }

      const latestSubscription = queryResult.data[0] as SubscriptionRow;

      // If active subscription is overdue by 7 days, auto-mark expired
      if (
        latestSubscription.status === 'ACTIVE' &&
        latestSubscription.next_payment_due! < Date.now() - (7 * 24 * 60 * 60 * 1000)
      ) {
        await this.markSubscriptionExpired(userId, latestSubscription.id);
        latestSubscription.status = 'EXPIRED';
      }

      return latestSubscription;

    } catch (error) {
      logger.error('Failed to get subscription status', { userId, error });
      return null;
    }
  }

  /**
   * Get current session user's subscription status.
   * Throws if not logged in.
   */
  async getCurrentUserSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    const session = await auth();
    // TODO: If using new Next.js Server Actions, get authenticated user id via server context not explicit function
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.getSubscriptionStatus(session.user.id);
  }

  /**
   * Check if the user has an ACTIVE membership, including grace period.
   */
  async hasActiveMembership(userId: string): Promise<boolean> {
    const subscription = await this.getSubscriptionStatus(userId);
    if (!subscription) return false;

    if (subscription.status !== 'ACTIVE') return false;

    // 7-day grace period after payment due for renewal before expiry
    const gracePeriod = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return (subscription.next_payment_due! + gracePeriod) > now;
  }

  /**
   * Mark a subscription as expired in DB and downgrade user.
   * Only used internally.
   */
  private async markSubscriptionExpired(userId: string, subscriptionId: string): Promise<void> {
    try {
      // Update status in subscriptions collection
      const subResult = await db().updateDoc('ring_subscriptions', subscriptionId, {
        status: 'EXPIRED',
        expired_at: Date.now(),
        updated_at: Date.now(),
      });

      if (!subResult.success) {
        throw subResult.error || new Error('Failed to update subscription');
      }

      // Downgrade user metadata
      const userResult = await db().updateDoc('users', userId, {
        'credit_balance.subscription_active': false,
        'membership.tier': 'SUBSCRIBER',
      });

      if (!userResult.success) {
        throw userResult.error || new Error('Failed to update user profile');
      }

      revalidatePath(`/[locale]/profile/${userId}`);

      logger.info('Subscription marked as expired', { userId, subscriptionId });
    } catch (error) {
      logger.error('Failed to mark subscription as expired', { userId, subscriptionId, error });
    }
  }

  /**
   * Admin: Return live stats on all subscriptions.
   */
  async getSubscriptionStats(): Promise<{
    total_active: number;
    total_expired: number;
    total_cancelled: number;
    due_for_payment: number;
    total_revenue: string;
  }> {
    try {
      // Fetch all subscriptions
      const allSubsResult = await db().queryDocs<SubscriptionRow & Record<string, unknown>>({
        collection: 'ring_subscriptions',
      });
      if (!allSubsResult.success || !allSubsResult.data) {
        throw allSubsResult.error || new Error('Failed to fetch subscriptions');
      }

      // Count all subscriptions that are ACTIVE and overdue (due for payment)
      const dueResult = await db().queryDocs<SubscriptionRow & Record<string, unknown>>({
        collection: 'ring_subscriptions',
        filters: [
          { field: 'status', operator: '==', value: 'ACTIVE' },
          { field: 'next_payment_due', operator: '<', value: Date.now() }
        ]
      });
      if (!dueResult.success || !dueResult.data) {
        throw dueResult.error || new Error('Failed to fetch due subscriptions');
      }

      let totalActive = 0;
      let totalExpired = 0;
      let totalCancelled = 0;
      let totalRevenue = 0;

      // Aggregate results over all subscriptions for admin stats
      allSubsResult.data.forEach((doc) => {
        const data = doc as SubscriptionStatus;

        switch (data.status) {
          case 'ACTIVE':
            totalActive++;
            break;
          case 'EXPIRED':
            totalExpired++;
            break;
          case 'CANCELLED':
            totalCancelled++;
            break;
        }

        totalRevenue += parseFloat(data.total_paid);
      });

      return {
        total_active: totalActive,
        total_expired: totalExpired,
        total_cancelled: totalCancelled,
        due_for_payment: dueResult.data.length,
        total_revenue: totalRevenue.toFixed(6),
      };

    } catch (error) {
      logger.error('Failed to get subscription stats', { error });
      throw new Error('Failed to retrieve subscription statistics');
    }
  }
}

// Singleton instance export for consuming modules
export const subscriptionService = SubscriptionService.getInstance();

import { SubscriptionStatusSchema, SubscriptionStatus } from '@/lib/zod/credit-schemas';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { priceOracleService } from '@/services/blockchain/price-oracle-service';
import { getAdminDb } from '@/lib/firebase-admin.server';
import { auth } from '@/auth';
import { logger } from '@/lib/logger';

/**
 * Subscription creation result
 */
interface SubscriptionCreationResult {
  success: true;
  subscription: SubscriptionStatus;
  transaction_hash?: string;
  contract_address: string;
}

/**
 * Payment processing result
 */
interface PaymentResult {
  success: boolean;
  transaction_hash?: string;
  amount_paid?: string;
  next_payment_due?: number;
  error?: string;
}

/**
 * Service for managing RING token membership subscriptions
 */
export class SubscriptionService {
  private static instance: SubscriptionService;
  private db = getAdminDb();

  private constructor() {}

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Create a new membership subscription
   */
  async createSubscription(userId: string): Promise<SubscriptionCreationResult> {
    try {
      // Check if user already has an active subscription
      const existingSubscription = await this.getSubscriptionStatus(userId);
      if (existingSubscription && existingSubscription.status === 'ACTIVE') {
        throw new Error('User already has an active subscription');
      }

      // Check if user has sufficient RING balance
      const membershipFee = '1.0';
      const hasSufficientBalance = await userCreditService.hasSufficientBalance(
        userId, 
        membershipFee
      );

      if (!hasSufficientBalance) {
        throw new Error('Insufficient RING balance for subscription');
      }

      // Get current RING/USD rate for transaction recording
      const priceData = await priceOracleService.getRingUsdPrice();

      // Process initial payment from credit balance
      const paymentResult = await userCreditService.processMembershipFee(
        userId,
        membershipFee,
        priceData.price
      );

      // Create subscription record in database
      const subscriptionId = `sub_${Date.now()}_${userId.slice(-8)}`;
      const now = Date.now();
      const nextPaymentDue = now + (30 * 24 * 60 * 60 * 1000); // 30 days from now

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

      // Save to database
      await this.db.runTransaction(async (transaction) => {
        const subscriptionRef = this.db.collection('ring_subscriptions').doc(subscriptionId);
        transaction.set(subscriptionRef, {
          ...subscription,
          created_at: now,
          updated_at: now,
        });

        // Update user profile with subscription info
        const userRef = this.db.collection('users').doc(userId);
        transaction.update(userRef, {
          'credit_balance.subscription_active': true,
          'credit_balance.subscription_next_payment': nextPaymentDue,
          'membership.tier': 'MEMBER',
          'membership.upgraded_at': now,
          'membership.payment_method': 'ring_credits',
          'membership.auto_renew': true,
        });
      });

      logger.info('Subscription created successfully', {
        userId,
        subscriptionId,
        initialPayment: paymentResult.transaction.id,
        nextPaymentDue,
      });

      return {
        success: true,
        subscription,
        contract_address: process.env.RING_MEMBERSHIP_CONTRACT_ADDRESS || '',
      };

    } catch (error) {
      logger.error('Failed to create subscription', { userId, error });
      throw new Error(`Failed to create subscription: ${error}`);
    }
  }

  /**
   * Cancel user's subscription
   */
  async cancelSubscription(userId: string): Promise<{ success: true }> {
    try {
      const subscription = await this.getSubscriptionStatus(userId);
      if (!subscription || subscription.status !== 'ACTIVE') {
        throw new Error('No active subscription found');
      }

      const now = Date.now();

      // Update subscription status in database
      await this.db.runTransaction(async (transaction) => {
        const subscriptionsRef = this.db.collection('ring_subscriptions');
        const querySnapshot = await subscriptionsRef.where('user_id', '==', userId).where('status', '==', 'ACTIVE').get();

        if (querySnapshot.empty) {
          throw new Error('Active subscription not found in database');
        }

        querySnapshot.forEach((subscriptionDoc) => {
          transaction.update(subscriptionDoc.ref, {
            status: 'CANCELLED',
            cancelled_at: now,
            updated_at: now,
          });
        });

        // Update user profile
        const userRef = this.db.collection('users').doc(userId);
        transaction.update(userRef, {
          'credit_balance.subscription_active': false,
          'credit_balance.subscription_next_payment': null,
          'membership.auto_renew': false,
        });
      });

      logger.info('Subscription cancelled', { userId });

      return { success: true };

    } catch (error) {
      logger.error('Failed to cancel subscription', { userId, error });
      throw new Error(`Failed to cancel subscription: ${error}`);
    }
  }

  /**
   * Process manual subscription renewal
   */
  async renewSubscription(userId: string): Promise<PaymentResult> {
    try {
      const subscription = await this.getSubscriptionStatus(userId);
      if (!subscription) {
        throw new Error('No subscription found');
      }

      if (subscription.status === 'ACTIVE' && subscription.next_payment_due! > Date.now()) {
        throw new Error('Subscription is not due for renewal');
      }

      // Check balance and process payment
      const membershipFee = '1.0';
      const hasSufficientBalance = await userCreditService.hasSufficientBalance(userId, membershipFee);

      if (!hasSufficientBalance) {
        return {
          success: false,
          error: 'Insufficient RING balance for renewal',
        };
      }

      // Get current rate and process payment
      const priceData = await priceOracleService.getRingUsdPrice();
      const paymentResult = await userCreditService.processMembershipFee(
        userId,
        membershipFee,
        priceData.price
      );

      const now = Date.now();
      const nextPaymentDue = now + (30 * 24 * 60 * 60 * 1000);

      // Update subscription in database
      await this.db.runTransaction(async (transaction) => {
        const subscriptionsRef = this.db.collection('ring_subscriptions');
        const querySnapshot = await subscriptionsRef.where('user_id', '==', userId).get();

        if (!querySnapshot.empty) {
          const subscriptionDoc = querySnapshot.docs[0];
          const currentData = subscriptionDoc.data() as SubscriptionStatus;
          
          transaction.update(subscriptionDoc.ref, {
            status: 'ACTIVE',
            next_payment_due: nextPaymentDue,
            failed_attempts: 0,
            total_paid: (parseFloat(currentData.total_paid) + parseFloat(membershipFee)).toString(),
            payments_count: currentData.payments_count + 1,
            updated_at: now,
          });
        }

        // Update user profile
        const userRef = this.db.collection('users').doc(userId);
        transaction.update(userRef, {
          'credit_balance.subscription_active': true,
          'credit_balance.subscription_next_payment': nextPaymentDue,
        });
      });

      logger.info('Subscription renewed', {
        userId,
        paymentTransactionId: paymentResult.transaction.id,
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
   * Get subscription status for user
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
    try {
      const subscriptionsRef = this.db.collection('ring_subscriptions');
      const querySnapshot = await subscriptionsRef.where('user_id', '==', userId).get();

      if (querySnapshot.empty) {
        return null;
      }

      // Get the most recent subscription
      const subscriptions = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as SubscriptionStatus & { id: string }))
        .sort((a, b) => b.start_time! - a.start_time!);

      const latestSubscription = subscriptions[0];

      // Check if subscription has expired
      if (latestSubscription.status === 'ACTIVE' && 
          latestSubscription.next_payment_due! < Date.now() - (7 * 24 * 60 * 60 * 1000)) { // 7 day grace period
        // Mark as expired if payment is more than 7 days overdue
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
   * Get current user's subscription status
   */
  async getCurrentUserSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    return this.getSubscriptionStatus(session.user.id);
  }

  /**
   * Check if user has active membership
   */
  async hasActiveMembership(userId: string): Promise<boolean> {
    const subscription = await this.getSubscriptionStatus(userId);
    if (!subscription) return false;

    // Check if subscription is active and within grace period
    if (subscription.status !== 'ACTIVE') return false;

    const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    
    return subscription.next_payment_due! + gracePeriod > now;
  }

  /**
   * Mark subscription as expired
   */
  private async markSubscriptionExpired(userId: string, subscriptionId: string): Promise<void> {
    try {
      const subscriptionRef = this.db.collection('ring_subscriptions').doc(subscriptionId);
      await subscriptionRef.update({
        status: 'EXPIRED',
        expired_at: Date.now(),
        updated_at: Date.now(),
      });

      // Update user profile
      const userRef = this.db.collection('users').doc(userId);
      await userRef.update({
        'credit_balance.subscription_active': false,
        'membership.tier': 'SUBSCRIBER', // Downgrade to subscriber
      });

      logger.info('Subscription marked as expired', { userId, subscriptionId });

    } catch (error) {
      logger.error('Failed to mark subscription as expired', { userId, subscriptionId, error });
    }
  }

  /**
   * Get subscription statistics (admin)
   */
  async getSubscriptionStats(): Promise<{
    total_active: number;
    total_expired: number;
    total_cancelled: number;
    due_for_payment: number;
    total_revenue: string;
  }> {
    try {
      const subscriptionsRef = this.db.collection('ring_subscriptions');
      
      // Get all subscriptions
      const allSubscriptions = await subscriptionsRef.get();
      
      let totalActive = 0;
      let totalExpired = 0;
      let totalCancelled = 0;
      let dueForPayment = 0;
      let totalRevenue = 0;
      const now = Date.now();

      allSubscriptions.forEach(doc => {
        const data = doc.data() as SubscriptionStatus;
        
        switch (data.status) {
          case 'ACTIVE':
            totalActive++;
            if (data.next_payment_due! <= now) {
              dueForPayment++;
            }
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
        due_for_payment: dueForPayment,
        total_revenue: totalRevenue.toFixed(6),
      };

    } catch (error) {
      logger.error('Failed to get subscription stats', { error });
      throw new Error('Failed to retrieve subscription statistics');
    }
  }
}

// Export singleton instance
export const subscriptionService = SubscriptionService.getInstance();
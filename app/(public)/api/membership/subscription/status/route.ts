import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { subscriptionService } from '@/services/membership/subscription-service';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { UserRole } from '@/features/auth/types';
import { logger } from '@/lib/logger';

/**
 * GET /api/membership/subscription/status
 * Get current user's subscription status and membership information
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get subscription status
    const subscription = await subscriptionService.getSubscriptionStatus(userId);
    
    // Get credit balance
    const creditBalance = await userCreditService.getUserCreditBalance(userId);

    // Check active membership
    const hasActiveMembership = await subscriptionService.hasActiveMembership(userId);

    // Calculate days until next payment
    let daysUntilPayment: number | null = null;
    let paymentOverdue = false;
    
    if (subscription && subscription.next_payment_due) {
      const now = Date.now();
      const timeDiff = subscription.next_payment_due - now;
      daysUntilPayment = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
      paymentOverdue = timeDiff < 0;
    }

    // Determine membership tier benefits
    const membershipBenefits = {
      [UserRole.VISITOR]: ['Basic profile access', 'Limited messaging'],
      [UserRole.SUBSCRIBER]: ['Enhanced profile', 'Standard messaging', 'Basic opportunities'],
      [UserRole.MEMBER]: [
        'Full profile access',
        'Unlimited messaging',
        'All opportunities access',
        'Create entities',
        'Priority support',
      ],
      [UserRole.CONFIDENTIAL]: [
        'All Member benefits',
        'Confidential opportunities',
        'Advanced analytics',
        'White-label access',
      ],
      [UserRole.ADMIN]: ['All platform features', 'Admin dashboard', 'User management'],
    };

    const currentTier = session.user.role || UserRole.VISITOR;
    const canUpgrade = !hasActiveMembership && [UserRole.VISITOR, UserRole.SUBSCRIBER].includes(currentTier);

    const response = {
      user: {
        id: userId,
        current_tier: currentTier,
        has_active_membership: hasActiveMembership,
        can_upgrade: canUpgrade,
      },
      subscription: subscription ? {
        status: subscription.status,
        start_time: subscription.start_time,
        next_payment_due: subscription.next_payment_due,
        failed_attempts: subscription.failed_attempts,
        auto_renew: subscription.auto_renew,
        total_paid: subscription.total_paid,
        payments_count: subscription.payments_count,
        days_until_payment: daysUntilPayment,
        payment_overdue: paymentOverdue,
      } : null,
      balance: {
        ring_amount: creditBalance?.amount || '0',
        usd_equivalent: creditBalance?.usd_equivalent || '0',
        sufficient_for_renewal: creditBalance ? parseFloat(creditBalance.amount) >= 1.0 : false,
      },
      membership: {
        current_benefits: membershipBenefits[currentTier] || [],
        upgrade_benefits: hasActiveMembership ? [] : membershipBenefits[UserRole.MEMBER],
        monthly_cost: {
          ring_amount: '1.0',
          usd_equivalent: '~$1.00', // Approximate
        },
      },
      actions: {
        can_create: !subscription && canUpgrade,
        can_renew: subscription?.status === 'EXPIRED' || paymentOverdue,
        can_cancel: subscription?.status === 'ACTIVE',
        can_modify: subscription?.status === 'ACTIVE',
      },
      warnings: [] as any[],
      notifications: [] as any[],
    };

    // Add warnings and notifications
    if (subscription) {
      if (paymentOverdue) {
        response.warnings.push({
          type: 'payment_overdue',
          message: `Your membership payment is ${Math.abs(daysUntilPayment!)} days overdue`,
          action: 'Renew subscription to maintain access',
        });
      } else if (daysUntilPayment !== null && daysUntilPayment <= 3) {
        response.notifications.push({
          type: 'payment_reminder',
          message: `Your next membership payment is due in ${daysUntilPayment} days`,
          action: 'Ensure sufficient RING balance for automatic renewal',
        });
      }
    }


    logger.info('Subscription status retrieved', { 
      userId, 
      subscriptionStatus: subscription?.status || 'none',
      hasActiveMembership,
      currentTier,
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get subscription status', { error });
    
    return NextResponse.json(
      { error: 'Failed to retrieve subscription status' },
      { status: 500 }
    );
  }
}

  /**
 * TODO: PUT /api/membership/subscription/status
 * Update subscription settings (auto-renew, etc.)
 */
// TODO: Implement subscription settings update
    // This would update the database record and possibly smart contract state
 
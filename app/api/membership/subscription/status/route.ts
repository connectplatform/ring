import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor';
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service';
import { UserRolesArray } from '@/features/auth/user-role';
import { logger } from '@/lib/logger';

/**
 * GET /api/membership/subscription/status
 * Returns the current user's subscription status and related membership info.
 * 
 * Source of truth is subscription_ledger (queried via SubscriptionConductor).
 * 
 * Comments throughout enhance future maintainability and clarify business logic.
 *
 * // TODO: Once Next.js 16 Route Handlers stabilize, convert to Route Handler Object and use route segment configs for improved SSR/prerender/streaming control (see https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
 * // TODO: When using the edge runtime, replace `Date.now()` with new standard: `globalThis.performance.now()` for consistency inside edge/SSR.
 */
export async function GET(request: NextRequest) {
  // Ensure a DB connection is available (Next.js Route Handler SSR/ISR disables auto-prerender for dynamic data).
  await connection();

  try {
    // Authenticate user (auth util abstracts session/cookie/token handling)
    const session = await auth();

    // Deny access if not authenticated. Returns 401 Unauthorized.
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Safely extract user ID
    const userId = session.user.id;

    // Fetch subscription information (from subscription_ledger primary datasource)
    // STUB: If SubscriptionConductor.getSubscription is a stub, implement: fetch sub row by userId, with status, timing, payment, etc.
    const subscription = await SubscriptionConductor.getSubscription(userId);

    // Retrieve user's credit balance (currency: RING), could be separate payment system
    // STUB: If creditBalanceService.getUserCreditBalance is stub, implement: fetch user credits from wallet/balance table
    const creditBalance = await creditBalanceService.getUserCreditBalance(userId);

    // Membership state; true if subscription exists and is active or in grace period.
    const hasActiveMembership = subscription
      ? (subscription.status === 'active' || subscription.status === 'grace_period')
      : false;

    // Holds countdown (days) to next payment/renewal. Null if not applicable.
    let daysUntilPayment: number | null = null;
    // True if the next payment is in the past.
    let paymentOverdue = false;

    // If user has a subscription, calculate days until next payment and possible overdue detection.
    if (subscription && subscription.next_payment_due) {
      // TODO: Use new temporal APIs or next standards for time math where available.
      const now = Date.now();
      const timeDiff = subscription.next_payment_due - now;
      // Round up so even a fraction of day is notified.
      daysUntilPayment = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
      paymentOverdue = timeDiff < 0;
    }

    // Set of membership tier benefits (roles in UserRolesArray). Kept static here for consistency.
    // Consider moving to config/constants if benefits are reused/imported elsewhere.
    const membershipBenefits: Record<string, string[]> = {
      [UserRolesArray.visitor]: [
        'Basic profile access',
        'Limited messaging'
      ],
      [UserRolesArray.subscriber]: [
        'Enhanced profile',
        'Standard messaging',
        'Basic opportunities'
      ],
      [UserRolesArray.member]: [
        'Full profile access',
        'Unlimited messaging',
        'All opportunities access',
        'Create entities',
        'Priority support',
      ],
      [UserRolesArray.confidential]: [
        'All Member benefits',
        'Confidential opportunities',
        'Advanced analytics',
        'White-label access',
      ],
      [UserRolesArray.admin]: [
        'All platform features',
        'Admin dashboard',
        'User management',
      ],
    };

    // Try to get current membership tier, default to 'visitor' if not set
    const currentTier = session.user.role || UserRolesArray.visitor;

    // User can upgrade if they do not have an active membership and are visitor or subscriber.
    const canUpgrade = !hasActiveMembership && [UserRolesArray.visitor, UserRolesArray.subscriber].includes(currentTier);

    // Construct API response object (contains user, sub, balance, membership, actions, and comms)
    const response: any = {
      user: {
        id: userId,
        current_tier: currentTier,
        has_active_membership: hasActiveMembership,
        can_upgrade: canUpgrade,
      },
      // If subscription is fetched, fill detailed fields. Otherwise, null.
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        provider: subscription.provider,
        gateway: subscription.gateway,
        method: subscription.method,
        start_time: subscription.start_time,
        next_payment_due: subscription.next_payment_due,
        failed_attempts: subscription.failed_attempts,
        auto_renew: subscription.auto_renew,
        total_paid: subscription.total_paid,
        payments_count: subscription.payments_count,
        days_until_payment: daysUntilPayment,
        payment_overdue: paymentOverdue,
      } : null,
      // Wallet and eligibility
      balance: {
        ring_amount: creditBalance?.amount || '0',
        main_currency_equivalent: creditBalance?.main_currency_equivalent || '0',
        sufficient_for_renewal: creditBalance ? parseFloat(creditBalance.amount) >= 1.0 : false,
      },
      membership: {
        current_benefits: membershipBenefits[currentTier] || [],
        // If no membership, show member benefits as upgrade incentive; else empty array.
        upgrade_benefits: hasActiveMembership ? [] : membershipBenefits[UserRolesArray.member],
        monthly_cost: {
          ring_amount: '1.0',
          main_currency_equivalent: '~$1.00', // Approximate; consider fetching live fx for precision in future iter.
        },
      },
      // Determine what actions are shown/enabled to the user.
      actions: {
        can_create: !subscription && canUpgrade,
        can_renew: (subscription?.status === 'expired') || paymentOverdue,
        can_cancel: subscription?.status === 'active' || subscription?.status === 'pending',
        can_modify: subscription?.status === 'active',
      },
      warnings: [] as any[],       // runtime popups: account at risk, etc.
      notifications: [] as any[],  // info-only: renewal upcoming, etc.
    };

    // Dynamic communication logic (warnings/notifications inserted as applicable)
    if (subscription) {
      if (paymentOverdue) {
        // Warn membership payment is overdue
        response.warnings.push({
          type: 'payment_overdue',
          message: `Your membership payment is ${Math.abs(daysUntilPayment!)} days overdue`,
          action: 'Renew subscription to maintain access',
        });
      } else if (daysUntilPayment !== null && daysUntilPayment <= 3) {
        // If renewal is coming soon (<= 3 days), issue a proactive reminder
        response.notifications.push({
          type: 'payment_reminder',
          message: `Your next membership payment is due in ${daysUntilPayment} days`,
          action: 'Ensure sufficient RING balance for automatic renewal',
        });
      }
    }

    // Audit log: record retrieval with metadata (user/sub/tier); could be extended for metrics.
    logger.info('Subscription status retrieved', {
      userId,
      subscriptionStatus: subscription?.status || 'none',
      hasActiveMembership,
      currentTier,
    });

    // Native Next.js, returns JSON response body.
    return NextResponse.json(response);

  } catch (error) {
    // Top-level: catch all unexpected/unhandled errors, log and return 500.
    logger.error('Failed to get subscription status', { error });

    return NextResponse.json(
      { error: 'Failed to retrieve subscription status' },
      { status: 500 }
    );
  }
}

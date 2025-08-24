import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { subscriptionService } from '@/services/membership/subscription-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/membership/subscription/cancel
 * Cancel user's active RING token membership subscription
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body for cancellation details
    const requestBody = await request.json().catch(() => ({}));
    const { 
      reason = 'User requested cancellation',
      immediate = false, // If true, cancel immediately; if false, cancel at end of current period
      feedback = '',
    } = requestBody;

    // Validate subscription exists and is active
    const subscription = await subscriptionService.getSubscriptionStatus(userId);
    if (!subscription) {
      return NextResponse.json(
        { 
          error: 'No subscription found',
          message: 'You do not have an active membership subscription to cancel',
        },
        { status: 404 }
      );
    }

    if (subscription.status !== 'ACTIVE') {
      return NextResponse.json(
        { 
          error: 'Cannot cancel inactive subscription',
          message: `Your subscription is already ${subscription.status.toLowerCase()}`,
          current_status: subscription.status,
        },
        { status: 400 }
      );
    }

    // Cancel the subscription
    const result = await subscriptionService.cancelSubscription(userId);

    // Log cancellation details for analytics
    logger.info('Membership subscription cancelled', { 
      userId, 
      reason,
      immediate,
      totalPaid: subscription.total_paid,
      paymentsCount: subscription.payments_count,
      subscriptionDuration: subscription.start_time 
        ? Date.now() - subscription.start_time 
        : 0,
      feedback: feedback ? 'provided' : 'not provided',
    });

    // Determine access expiration
    let accessExpiresAt: number;
    let accessMessage: string;

    if (immediate) {
      accessExpiresAt = Date.now();
      accessMessage = 'Your Member access has been removed immediately';
    } else {
      // Allow access until next payment would have been due
      accessExpiresAt = subscription.next_payment_due || Date.now();
      const daysRemaining = Math.max(0, Math.ceil((accessExpiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
      accessMessage = `You'll retain Member access for ${daysRemaining} more days until ${new Date(accessExpiresAt).toLocaleDateString()}`;
    }

    const response = {
      success: true,
      message: 'Subscription cancelled successfully',
      cancellation: {
        cancelled_at: Date.now(),
        reason: reason,
        immediate: immediate,
        access_expires_at: accessExpiresAt,
        access_message: accessMessage,
      },
      subscription_summary: {
        total_paid: subscription.total_paid,
        payments_made: subscription.payments_count,
        subscription_duration_days: subscription.start_time 
          ? Math.floor((Date.now() - subscription.start_time) / (24 * 60 * 60 * 1000))
          : 0,
      },
      what_happens_next: [
        immediate 
          ? 'Your Member access has been removed immediately'
          : accessMessage,
        'Your RING token balance remains unchanged',
        'You can resubscribe anytime to regain Member access',
        'Your entities and opportunities remain accessible',
        'Message history is preserved',
      ],
      alternative_options: [
        {
          title: 'Pause Subscription',
          description: 'Temporarily pause payments while keeping your account (not yet available)',
          available: false,
        },
        {
          title: 'Downgrade to Subscriber',
          description: 'Switch to free Subscriber tier with limited features',
          available: true,
          action_url: '/profile/membership/downgrade',
        },
        {
          title: 'Contact Support',
          description: 'Speak with our team about your concerns',
          available: true,
          action_url: '/support/contact',
        },
      ],
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to cancel membership subscription', { error });
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('No active subscription found')) {
        return NextResponse.json(
          { error: 'No active subscription to cancel' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to cancel membership subscription' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/membership/subscription/cancel
 * Get cancellation information and preview
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

    // Get current subscription
    const subscription = await subscriptionService.getSubscriptionStatus(userId);
    if (!subscription || subscription.status !== 'ACTIVE') {
      return NextResponse.json(
        { 
          error: 'No active subscription',
          message: 'You do not have an active subscription to cancel',
        },
        { status: 404 }
      );
    }

    // Calculate what user will lose
    const memberBenefits = [
      'Access to confidential opportunities',
      'Priority support',
      'Advanced entity creation features',
      'Premium messaging capabilities',
      'Analytics dashboard',
      'API access (if applicable)',
    ];

    const subscriberFeatures = [
      'Basic opportunities access',
      'Standard messaging',
      'Limited entity creation',
      'Community support',
    ];

    // Calculate potential savings/costs
    const daysRemaining = subscription.next_payment_due 
      ? Math.max(0, Math.ceil((subscription.next_payment_due - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

    const response = {
      current_subscription: {
        status: subscription.status,
        next_payment_due: subscription.next_payment_due,
        days_remaining: daysRemaining,
        monthly_cost: '1.0 RING (~$1.00)',
        total_paid: subscription.total_paid,
        payments_made: subscription.payments_count,
      },
      cancellation_impact: {
        will_lose: memberBenefits,
        will_keep: subscriberFeatures,
        downgrade_to: 'Subscriber',
        access_until: subscription.next_payment_due,
      },
      cancellation_options: [
        {
          type: 'end_of_period',
          title: 'Cancel at end of current period',
          description: `Keep Member access until ${new Date(subscription.next_payment_due || Date.now()).toLocaleDateString()}`,
          recommended: true,
        },
        {
          type: 'immediate',
          title: 'Cancel immediately',
          description: 'Remove Member access right now',
          recommended: false,
          warning: 'You will lose access to Member features immediately',
        },
      ],
      alternatives: [
        {
          title: 'Contact Support First',
          description: 'Discuss your concerns with our team - we may be able to help',
          action: 'Contact Support',
          recommended: true,
        },
        {
          title: 'Pause Payments',
          description: 'Temporarily stop payments while keeping your account (coming soon)',
          action: 'Not Available Yet',
          available: false,
        },
      ],
      feedback_questions: [
        'What is the main reason for cancelling?',
        'How would you rate your experience with RING Platform?',
        'What could we improve to better serve you?',
        'Would you consider rejoining in the future?',
      ],
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get cancellation preview', { error });
    
    return NextResponse.json(
      { error: 'Failed to retrieve cancellation information' },
      { status: 500 }
    );
  }
}

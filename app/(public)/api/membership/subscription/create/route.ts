import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { subscriptionService } from '@/services/membership/subscription-service';
import { UserRole } from '@/features/auth/types';
import { logger } from '@/lib/logger';

/**
 * POST /api/membership/subscription/create
 * Create a new RING token membership subscription
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check if user is at least a SUBSCRIBER
    if (!session.user.role || session.user.role === UserRole.VISITOR) {
      return NextResponse.json(
        { 
          error: 'Insufficient access level',
          message: 'You must be at least a Subscriber to create a membership subscription',
          current_role: session.user.role,
          required_roles: [UserRole.SUBSCRIBER, UserRole.MEMBER, UserRole.CONFIDENTIAL, UserRole.ADMIN],
        },
        { status: 403 }
      );
    }

    // Parse request body for any additional options
    const requestBody = await request.json().catch(() => ({}));
    const { auto_renew = true, start_immediately = true } = requestBody;

    // Check if user already has an active subscription
    const existingSubscription = await subscriptionService.getSubscriptionStatus(userId);
    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      return NextResponse.json(
        { 
          error: 'Subscription already exists',
          message: 'You already have an active RING token subscription',
          subscription: existingSubscription,
        },
        { status: 409 }
      );
    }

    // Validate that smart contracts are deployed
    if (!process.env.RING_TOKEN_CONTRACT_ADDRESS || !process.env.RING_MEMBERSHIP_CONTRACT_ADDRESS) {
      return NextResponse.json(
        { 
          error: 'Service unavailable',
          message: 'RING token contracts are not yet deployed. Please try again later.',
        },
        { status: 503 }
      );
    }

    // Create the subscription
    const result = await subscriptionService.createSubscription(userId);

    logger.info('Membership subscription created', { 
      userId, 
      subscriptionStatus: result.subscription.status,
      contractAddress: result.contract_address,
      autoRenew: auto_renew,
    });

    return NextResponse.json({
      success: true,
      message: 'Membership subscription created successfully',
      subscription: {
        status: result.subscription.status,
        start_time: result.subscription.start_time,
        next_payment_due: result.subscription.next_payment_due,
        auto_renew: result.subscription.auto_renew,
        total_paid: result.subscription.total_paid,
        payments_count: result.subscription.payments_count,
      },
      contract_address: result.contract_address,
      benefits: [
        'Access to confidential opportunities',
        'Priority support',
        'Advanced entity creation',
        'Premium messaging features',
        'Analytics dashboard',
      ],
      next_steps: [
        'Your first monthly payment has been processed',
        'You now have access to Member-level features',
        `Next payment due: ${new Date(result.subscription.next_payment_due!).toLocaleDateString()}`,
        'You can cancel anytime from your profile settings',
      ],
    });

  } catch (error) {
    logger.error('Failed to create membership subscription', { error });
    
 
    return NextResponse.json(
      { error: 'Failed to create membership subscription' },
      { status: 500 }
    );
  }
}
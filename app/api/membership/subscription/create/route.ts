import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor';
import { UserRolesArray } from '@/features/auth/user-role';
import { logger } from '@/lib/logger';
import { getMemberFiatTier } from '@/lib/membership/pricing';
import { getCardPaymentProcessor } from '@/lib/payments/subscription/subscription-config';

// TODO: If running on React 19 and Next.js 16+ ensure that you are using server actions and route handlers that natively leverage streaming and enhanced error boundaries for improved UX and observability. (Not implemented here as this API route relies on traditional handlers, but see: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)
// TODO: Consider adding "typed responses" using TypeScript utility types for stricter shape enforcement on API response objects.

/**
 * Subscription create request schema.
 *
 * Accepts provider parameter to support all 6 subscription providers:
 * - credit_balance: Fiat USD credit balance (default)
 * - native_token: On-chain RING token
 * - stripe: Stripe card payments
 * - wayforpay: WayForPay card payments
 * - nft_gate: NFT ownership gate
 * - paypal: PayPal payments (stub)
 */
const SubscriptionCreateSchema = z.object({
  provider: z.enum([
    'credit_balance',
    'native_token',
    'stripe',
    'wayforpay',
    'nft_gate',
    'paypal', // STUB: actual PayPal logic not implemented yet
  ]).optional(),
  auto_renew: z.boolean().default(true),
});

/**
 * POST /api/membership/subscription/create
 * Handles creation of a membership subscription for the current user.
 */
export async function POST(request: NextRequest) {
  // Opt out of prerendering for this route in Next 16+ (for SSR/db access)
  await connection();

  try {
    // Authenticate user session via custom auth util
    const session = await auth();

    // If user is unauthenticated, return 401 Unauthorized
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract userId and fallback-safe email
    const userId = session.user.id;
    const userEmail = session.user.email || '';

    // Parse JSON body from incoming request, ensure robust fallback on JSON parse error
    const requestBody = await request.json().catch(() => ({})); // safe catch for non-JSON requests / body parse issues
    let validatedRequest;
    try {
      validatedRequest = SubscriptionCreateSchema.parse(requestBody); // Validate using zod schema
    } catch (validationError) {
      // Bad request/validation error (400)
      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 }
      );
    }

    // Destructure validated, typed inputs (auto_renew always boolean)
    const { provider: requestedProvider, auto_renew } = validatedRequest;

    // Fallback to credit_balance if no provider specified
    const provider = requestedProvider || 'credit_balance';

    // Enforce the user has at least a 'subscriber'-level role
    if (!session.user.role || session.user.role === UserRolesArray.visitor) {
      return NextResponse.json(
        {
          error: 'Insufficient access level',
          message: 'You must be at least a Subscriber to create a membership subscription',
          current_role: session.user.role,
          required_roles: [UserRolesArray.subscriber, UserRolesArray.member, UserRolesArray.confidential, UserRolesArray.admin],
        },
        { status: 403 }
      );
    }

    // Check if user already has an active subscription
    // NOTE: This prevents multiple active subscriptions per account
    const existingSubscription = await SubscriptionConductor.getSubscription(userId);
    if (existingSubscription && existingSubscription.status === 'active') {
      return NextResponse.json(
        {
          error: 'Subscription already exists',
          message: 'You already have an active subscription',
          subscription: existingSubscription,
        },
        { status: 409 }
      );
    }

    // Obtain the member pricing tier from config (single source of truth)
    const memberTier = getMemberFiatTier();
    if (!memberTier) {
      // Service unavailable if config missing
      return NextResponse.json(
        { error: 'Service unavailable', message: 'Member tier not configured' },
        { status: 503 }
      );
    }

    //--------------------- Provider/Gateway assignment logic ---------------------

    // Properties to be configured below
    let gateway: string;
    let method: 'credit_balance' | 'card' | 'crypto' | 'paypal' | 'nft';
    let gatewayFeePercent: number;
    let gatewayFeeFixed: number;
    let currency: string;

    // Map provider request to gateway and method configuration
    switch (provider) {
      case 'credit_balance':
        gateway = 'Credit Balance';
        method = 'credit_balance';
        gatewayFeePercent = 0;
        gatewayFeeFixed = 0;
        currency = memberTier.currency;
        break;
      case 'native_token':
        gateway = 'Native Token';
        method = 'crypto';
        gatewayFeePercent = 0;
        gatewayFeeFixed = 0;
        currency = '{native_token}';
        break;
      case 'stripe':
        gateway = 'Stripe';
        method = 'card';
        gatewayFeePercent = 2.9;
        gatewayFeeFixed = 0.30;
        currency = 'USD';
        break;
      case 'wayforpay':
        gateway = 'WayForPay';
        method = 'card';
        gatewayFeePercent = 2.7;
        gatewayFeeFixed = 0;
        currency = 'USD';
        break;
      case 'nft_gate':
        gateway = 'NFT Gate';
        method = 'nft';
        gatewayFeePercent = 0;
        gatewayFeeFixed = 0;
        currency = 'NFT';
        break;
      case 'paypal':
        gateway = 'PayPal';
        method = 'crypto';
        gatewayFeePercent = 3.49;
        gatewayFeeFixed = 0.49;
        currency = 'USD';
        // STUB: The PayPal method and actual integration NOT implemented yet.
        // STUB: TODO: Implement PayPal provider in conductor and backend. Route to PayPal payment initialization, handle webhooks, validate confirmation, then finalize Subscription.
        break;
      default:
        gateway = 'Credit Balance';
        method = 'credit_balance';
        gatewayFeePercent = 0;
        gatewayFeeFixed = 0;
        currency = memberTier.currency;
    }

    //--------------------- Subscription Ledger and Payment Processing ---------------------

    // Call SubscriptionConductor to attempt a new subscription
    // TODO: If gatekeeping fails, consider using Next.js 16 'Middleware' for unified API error interception
    const result = await SubscriptionConductor.createSubscription({
      userId,
      userEmail,
      provider,
      gateway,
      method,
      amount: memberTier.amount,
      currency,
      gatewayFeePercent,
      gatewayFeeFixed,
      metadata: { auto_renew, target_role: UserRolesArray.member as UserRolesArray },
    });

    // If creation (insertion, API, or payment) failed:
    if (!result.success) {
      logger.warn('SubscriptionConductor.createSubscription failed', {
        userId,
        provider,
        error: result.error,
      });
      return NextResponse.json(
        { error: result.error || 'Failed to create subscription' },
        { status: 400 }
      );
    }

    // Log subscription creation success for audit/debug analytics
    logger.info('Membership subscription created', {
      userId,
      provider,
      subscriptionId: result.subscriptionId,
      autoRenew: auto_renew,
    });

    // Fetch the created subscription details for the frontend/app
    const subscription = result.subscriptionId
      ? await SubscriptionConductor.getSubscription(userId)
      : null; // If no ID, return null in response

    // Compose API response payload:
    return NextResponse.json({
      success: true,
      message: 'Membership subscription created successfully',
      provider,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        provider: subscription.provider,
        gateway: subscription.gateway,
        method: subscription.method,
        start_time: subscription.start_time,
        next_payment_due: subscription.next_payment_due,
        auto_renew: subscription.auto_renew,
        total_paid: subscription.total_paid,
        payments_count: subscription.payments_count,
      } : null,
      benefits: [
        'Access to confidential opportunities',
        'Priority support',
        'Advanced entity creation',
        'Premium messaging features',
        'Analytics dashboard',
      ],
      next_steps: [
        provider === 'credit_balance'
          ? 'Your first monthly payment has been processed'
          : provider === 'native_token'
          ? 'Your on-chain native token transfer has been recorded'
          : provider === 'stripe' || provider === 'wayforpay'
          ? 'Your card has been charged'
          : provider === 'paypal'
            // STUB: Paypal process messaging
            ? 'PayPal transaction stub: payment process pending (to be implemented)'
            : 'Your subscription has been created',
        'You now have access to Member-level features',
        subscription?.next_payment_due
          ? `Next payment due: ${new Date(subscription.next_payment_due).toLocaleDateString()}`
          : 'Next payment will be charged automatically',
        'You can cancel anytime from your profile settings',
      ],
    });

  } catch (error) {
    // Top-level error logger (unforeseen or thrown)
    logger.error('Failed to create membership subscription', { error });

    return NextResponse.json(
      { error: 'Failed to create membership subscription' },
      { status: 500 }
    );
  }
}

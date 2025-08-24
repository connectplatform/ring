import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { subscriptionService } from '@/services/membership/subscription-service';
import { userCreditService } from '@/features/wallet/services/user-credit-service';
import { priceOracleService } from '@/services/blockchain/price-oracle-service';
import { logger } from '@/lib/logger';
import { UserRole } from '@/features/auth/types';

/**
 * Payment request schema
 */
const RingPaymentRequestSchema = z.object({
  type: z.enum(['membership_upgrade', 'subscription_renewal', 'membership_fee']),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid positive number').optional(),
  auto_subscribe: z.boolean().default(false),
});

type RingPaymentRequest = z.infer<typeof RingPaymentRequestSchema>;

/**
 * POST /api/membership/payment/ring
 * Process RING token payment for membership fees
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
    const requestBody = await request.json();

    // Validate request body
    let validatedRequest: RingPaymentRequest;
    try {
      validatedRequest = RingPaymentRequestSchema.parse(requestBody);
    } catch (validationError) {
      logger.warn('Invalid RING payment request', { 
        userId, 
        requestBody, 
        validationError 
      });
      
      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 }
      );
    }

    const { type, amount, auto_subscribe } = validatedRequest;

    // Determine payment amount
    const membershipFee = amount || '1.0'; // Default 1 RING per month
    const paymentAmount = parseFloat(membershipFee);

    // Validate payment amount
    if (paymentAmount <= 0 || paymentAmount > 100) {
      return NextResponse.json(
        { error: 'Invalid payment amount. Must be between 0.01 and 100 RING' },
        { status: 400 }
      );
    }

    // Check user's credit balance
    const creditBalance = await userCreditService.getUserCreditBalance(userId);
    if (!creditBalance || parseFloat(creditBalance.amount) < paymentAmount) {
      return NextResponse.json(
        { 
          error: 'Insufficient RING balance',
          current_balance: creditBalance?.amount || '0',
          required_amount: membershipFee,
          shortfall: creditBalance 
            ? Math.max(0, paymentAmount - parseFloat(creditBalance.amount)).toString()
            : membershipFee,
          top_up_url: '/wallet/topup',
        },
        { status: 400 }
      );
    }

    // Get current RING/USD rate for transaction recording
    const priceData = await priceOracleService.getRingUsdPrice();

    let result;
    let responseMessage;

    switch (type) {
      case 'membership_upgrade':
        // Upgrade from SUBSCRIBER to MEMBER
        if (session.user.role !== UserRole.SUBSCRIBER) {
          return NextResponse.json(
            { 
              error: 'Invalid upgrade request',
              message: 'Only Subscribers can upgrade to Member using RING payments',
              current_role: session.user.role,
            },
            { status: 400 }
          );
        }

        // Process payment and upgrade
        result = await userCreditService.spendCredits(
          userId,
          {
            amount: membershipFee,
            description: 'Membership upgrade to Member',
            metadata: {
              type: 'membership_upgrade',
              from_tier: session.user.role,
              to_tier: 'MEMBER',
            },
          },
          'membership_fee',
          priceData.price
        );

        // TODO: Update user role to MEMBER
        // This would typically be done through a user management service
        
        if (auto_subscribe) {
          // Create automatic subscription
          await subscriptionService.createSubscription(userId);
          responseMessage = 'Upgraded to Member and created automatic subscription';
        } else {
          responseMessage = 'Upgraded to Member tier successfully';
        }

        break;

      case 'subscription_renewal':
        // Renew existing subscription
        const renewalResult = await subscriptionService.renewSubscription(userId);
        
        if (!renewalResult.success) {
          return NextResponse.json(
            { error: renewalResult.error },
            { status: 400 }
          );
        }

        result = {
          success: true,
          newBalance: (parseFloat(creditBalance.amount) - paymentAmount).toString(),
          transaction: {
            id: `renewal_${Date.now()}`,
            amount: membershipFee,
            usd_equivalent: (paymentAmount * parseFloat(priceData.price)).toString(),
          },
        };

        responseMessage = 'Subscription renewed successfully';
        break;

      case 'membership_fee':
        // One-time membership fee payment
        result = await userCreditService.processMembershipFee(
          userId,
          membershipFee,
          priceData.price
        );

        responseMessage = 'Membership fee paid successfully';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid payment type' },
          { status: 400 }
        );
    }

    // Get updated subscription status
    const updatedSubscription = await subscriptionService.getSubscriptionStatus(userId);

    const response = {
      success: true,
      message: responseMessage,
      payment: {
        type: type,
        amount_paid: membershipFee,
        currency: 'RING',
        usd_equivalent: (paymentAmount * parseFloat(priceData.price)).toFixed(6),
        exchange_rate: priceData.price,
        transaction_id: result.transaction.id,
        timestamp: Date.now(),
      },
      account: {
        new_balance: result.newBalance,
        subscription_status: updatedSubscription?.status || 'NONE',
        membership_tier: 'MEMBER', // Would get from updated user profile
        next_payment_due: updatedSubscription?.next_payment_due,
      },
      benefits_unlocked: type === 'membership_upgrade' ? [
        'Access to confidential opportunities',
        'Priority support',
        'Advanced entity creation',
        'Premium messaging features',
        'Analytics dashboard',
      ] : [],
    };

    logger.info('RING payment processed successfully', {
      userId,
      type,
      amount: membershipFee,
      transactionId: result.transaction.id,
      newBalance: result.newBalance,
      subscriptionStatus: updatedSubscription?.status,
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to process RING payment', { error });
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Insufficient balance')) {
        return NextResponse.json(
          { error: 'Insufficient RING balance for payment' },
          { status: 400 }
        );
      }
      
      if (error.message.includes('User not found')) {
        return NextResponse.json(
          { error: 'User account not found' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to process RING payment' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/membership/payment/ring
 * Get payment information and pricing
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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'membership_upgrade';

    // Get user's current balance
    const creditBalance = await userCreditService.getUserCreditBalance(userId);
    const currentBalance = parseFloat(creditBalance?.amount || '0');

    // Get current RING price
    const priceData = await priceOracleService.getRingUsdPrice();
    const membershipFee = 1.0;
    const usdCost = membershipFee * parseFloat(priceData.price);

    // Get subscription status
    const subscription = await subscriptionService.getSubscriptionStatus(userId);

    // Determine available payment options
    const paymentOptions = [];

    if (session.user.role === UserRole.SUBSCRIBER) {
      paymentOptions.push({
        type: 'membership_upgrade',
        title: 'Upgrade to Member',
        description: 'One-time upgrade with optional auto-renewal',
        cost: {
          ring_amount: '1.0',
          usd_equivalent: usdCost.toFixed(2),
        },
        available: currentBalance >= membershipFee,
        benefits: [
          'Immediate access to Member features',
          'Optional automatic monthly renewals',
          'Cancel anytime',
        ],
      });
    }

    if (subscription?.status === 'EXPIRED' || (subscription?.next_payment_due && subscription.next_payment_due < Date.now())) {
      paymentOptions.push({
        type: 'subscription_renewal',
        title: 'Renew Subscription',
        description: 'Renew your membership for another month',
        cost: {
          ring_amount: '1.0',
          usd_equivalent: usdCost.toFixed(2),
        },
        available: currentBalance >= membershipFee,
        benefits: [
          'Restore Member access',
          'Reset payment schedule',
          'Continue with current benefits',
        ],
      });
    }

    paymentOptions.push({
      type: 'membership_fee',
      title: 'One-time Payment',
      description: 'Pay membership fee without subscription',
      cost: {
        ring_amount: '1.0',
        usd_equivalent: usdCost.toFixed(2),
      },
      available: currentBalance >= membershipFee,
      benefits: [
        'No automatic renewals',
        'Pay as needed',
        'Full control over payments',
      ],
    });

    const response = {
      user: {
        current_balance: currentBalance.toString(),
        balance_sufficient: currentBalance >= membershipFee,
        current_tier: session.user.role,
        subscription_status: subscription?.status || 'NONE',
      },
      pricing: {
        membership_fee: {
          ring_amount: '1.0',
          usd_equivalent: usdCost.toFixed(6),
          exchange_rate: priceData.price,
          rate_updated: priceData.timestamp,
        },
        discounts: [], // Future: bulk payments, annual subscriptions
        fees: {
          processing_fee: '0',
          network_fee: '0',
          platform_fee: '0',
        },
      },
      payment_options: paymentOptions,
      requirements: {
        minimum_balance: '1.0',
        balance_shortfall: Math.max(0, membershipFee - currentBalance).toString(),
        top_up_needed: currentBalance < membershipFee,
      },
      next_steps: currentBalance >= membershipFee ? [
        'Select payment type',
        'Confirm payment details',
        'Complete payment',
        'Access Member features',
      ] : [
        'Top up RING balance',
        'Return to complete payment',
      ],
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get RING payment information', { error });
    
    return NextResponse.json(
      { error: 'Failed to retrieve payment information' },
      { status: 500 }
    );
  }
}

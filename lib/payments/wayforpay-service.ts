/**
 * WayForPay Payment Service Integration
 * 
 * This service handles payment processing for membership upgrades using WayForPay API.
 * It provides secure payment initiation, webhook handling, and automatic role upgrades.
 */

import { UserRole } from '@/features/auth/types';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// WayForPay API Configuration
const WAYFORPAY_API_URL = 'https://api.wayforpay.com/api';
const WAYFORPAY_MERCHANT_ACCOUNT = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_SECRET_KEY;
const WAYFORPAY_DOMAIN = process.env.WAYFORPAY_DOMAIN;

// Membership pricing configuration (₴299 UAH for MEMBER upgrade)
export const MEMBERSHIP_PRICES = {
  [UserRole.SUBSCRIBER]: {
    amount: 0,
    currency: 'UAH',
    description: 'Ring Platform Subscriber (Free)',
    duration: 'lifetime'
  },
  [UserRole.MEMBER]: {
    amount: 299,
    currency: 'UAH',
    description: 'Ring Platform Member Upgrade',
    duration: '1 month'
  },
  [UserRole.CONFIDENTIAL]: {
    amount: 999,
    currency: 'UAH',
    description: 'Ring Platform Confidential Membership',
    duration: '1 month'
  }
} as const;

export interface PaymentRequest {
  userId: string;
  userEmail: string;
  targetRole: UserRole;
  returnUrl: string;
  callbackUrl: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
}

export interface WebhookPayload {
  merchantAccount: string;
  orderReference: string;
  merchantSignature: string;
  amount: number;
  currency: string;
  authCode: string;
  cardPan: string;
  transactionStatus: string;
  reasonCode: string;
  [key: string]: any;
}

/**
 * Validates WayForPay configuration
 */
function validateConfig(): void {
  if (!WAYFORPAY_MERCHANT_ACCOUNT) {
    throw new Error('WAYFORPAY_MERCHANT_ACCOUNT environment variable is required');
  }
  if (!WAYFORPAY_SECRET_KEY) {
    throw new Error('WAYFORPAY_SECRET_KEY environment variable is required');
  }
  if (!WAYFORPAY_DOMAIN) {
    throw new Error('WAYFORPAY_DOMAIN environment variable is required');
  }
}

/**
 * Generates WayForPay signature for request authentication
 */
function generateSignature(data: Record<string, any>): string {
  const signatureString = Object.values(data).join(';');
  return crypto
    .createHmac('md5', WAYFORPAY_SECRET_KEY!)
    .update(signatureString)
    .digest('hex');
}

/**
 * Verifies WayForPay webhook signature
 */
export function verifyWebhookSignature(payload: WebhookPayload): boolean {
  try {
    const { merchantSignature, ...data } = payload;
    const expectedSignature = generateSignature(data);
    return merchantSignature === expectedSignature;
  } catch (error) {
    logger.error('WayForPay: Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Initiates a payment request with WayForPay
 */
export async function initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    validateConfig();

    const membershipConfig = MEMBERSHIP_PRICES[request.targetRole];
    if (!membershipConfig) {
      return {
        success: false,
        error: `Invalid target role: ${request.targetRole}`
      };
    }

    // Generate unique order reference
    const orderId = `ring_${request.userId}_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    // Prepare payment data
    const paymentData = {
      merchantAccount: WAYFORPAY_MERCHANT_ACCOUNT,
      merchantDomainName: WAYFORPAY_DOMAIN,
      orderReference: orderId,
      orderDate: timestamp,
      amount: membershipConfig.amount,
      currency: membershipConfig.currency,
      productName: [membershipConfig.description],
      productCount: [1],
      productPrice: [membershipConfig.amount],
      clientFirstName: request.userEmail.split('@')[0],
      clientLastName: 'User',
      clientEmail: request.userEmail,
      clientPhone: '',
      language: 'EN',
      returnUrl: request.returnUrl,
      serviceUrl: request.callbackUrl
    };

    // Generate signature
    const signature = generateSignature(paymentData);
    const requestPayload = {
      ...paymentData,
      merchantSignature: signature
    };

    logger.info('WayForPay: Initiating payment request', {
      orderId,
      userId: request.userId,
      targetRole: request.targetRole,
      amount: membershipConfig.amount
    });

    // Make API request to WayForPay
    const response = await fetch(WAYFORPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      throw new Error(`WayForPay API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.reason === 'Ok') {
      logger.info('WayForPay: Payment initiated successfully', {
        orderId,
        paymentUrl: result.invoiceUrl
      });

      return {
        success: true,
        paymentUrl: result.invoiceUrl,
        orderId
      };
    } else {
      logger.error('WayForPay: Payment initiation failed', {
        orderId,
        reason: result.reason,
        reasonCode: result.reasonCode
      });

      return {
        success: false,
        error: result.reason || 'Payment initiation failed'
      };
    }

  } catch (error) {
    logger.error('WayForPay: Error initiating payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Processes a successful payment and upgrades user role
 */
export async function processSuccessfulPayment(payload: WebhookPayload): Promise<boolean> {
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(payload)) {
      logger.error('WayForPay: Invalid webhook signature');
      return false;
    }

    // Check transaction status
    if (payload.transactionStatus !== 'Approved') {
      logger.warn('WayForPay: Transaction not approved', {
        orderReference: payload.orderReference,
        status: payload.transactionStatus,
        reasonCode: payload.reasonCode
      });
      return false;
    }

    // Extract user ID and target role from order reference
    const orderParts = payload.orderReference.split('_');
    if (orderParts.length < 3 || orderParts[0] !== 'ring') {
      logger.error('WayForPay: Invalid order reference format', {
        orderReference: payload.orderReference
      });
      return false;
    }

    const userId = orderParts[1];
    
    // Determine target role based on payment amount
    let targetRole: UserRole | null = null;
    for (const [role, config] of Object.entries(MEMBERSHIP_PRICES)) {
      if (config.amount === payload.amount) {
        targetRole = role as UserRole;
        break;
      }
    }

    if (!targetRole) {
      logger.error('WayForPay: Could not determine target role from payment amount', {
        amount: payload.amount,
        orderReference: payload.orderReference
      });
      return false;
    }

    logger.info('WayForPay: Processing successful payment', {
      userId,
      targetRole,
      amount: payload.amount,
      orderReference: payload.orderReference
    });

    // Import and call the role upgrade service
    const { upgradeUserRole } = await import('@/features/auth/services/upgrade-user-role');
    const upgradeResult = await upgradeUserRole(userId, targetRole, {
      paymentReference: payload.orderReference,
      paymentAmount: payload.amount,
      paymentCurrency: payload.currency,
      authCode: payload.authCode,
      cardPan: payload.cardPan?.slice(-4) // Store only last 4 digits
    });

    if (upgradeResult.success) {
      logger.info('WayForPay: User role upgraded successfully', {
        userId,
        targetRole,
        orderReference: payload.orderReference
      });
      return true;
    } else {
      logger.error('WayForPay: Failed to upgrade user role', {
        userId,
        targetRole,
        error: upgradeResult.error
      });
      return false;
    }

  } catch (error) {
    logger.error('WayForPay: Error processing successful payment:', error);
    return false;
  }
}

/**
 * Gets payment status by order reference
 */
export async function getPaymentStatus(orderReference: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  try {
    validateConfig();

    const requestData = {
      merchantAccount: WAYFORPAY_MERCHANT_ACCOUNT,
      orderReference,
      apiVersion: 1
    };

    const signature = generateSignature(requestData);
    const requestPayload = {
      ...requestData,
      merchantSignature: signature
    };

    const response = await fetch(`${WAYFORPAY_API_URL}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      throw new Error(`WayForPay API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    return {
      success: true,
      status: result.transactionStatus
    };

  } catch (error) {
    logger.error('WayForPay: Error getting payment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

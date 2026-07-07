/**
 * WayForPay Payment Service Integration
 *
 * This service handles payment processing for membership upgrades using WayForPay API.
 * It provides secure payment initiation, webhook handling, and automatic role upgrades.
 */

import { UserRolesArray, assertKnownUserRole, UPGRADEABLE_ROLES } from '@/features/auth/user-role';
import { upgradeUserRole } from '@/features/auth/services/upgrade-user-role';
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type { MemberTierConfig } from '@/lib/ring-config-types'
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// WayForPay API endpoints and credentials (loaded from environment variables for security)
const WAYFORPAY_API_URL = 'https://api.wayforpay.com/api';
const WAYFORPAY_MERCHANT_ACCOUNT = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_SECRET_KEY;
const WAYFORPAY_DOMAIN = process.env.WAYFORPAY_DOMAIN;

// Membership role types
export type MembershipTierRole = 'member' | 'confidential';

/**
 * Returns purchasable tier configuration for a given user role.
 * Only allows roles that are upgradeable.
 *
 * @param role - Target user role (should be upgradeable)
 * @returns MembershipTierConfig or null if role is not upgradeable or misconfigured
 */
export function getMembershipTierConfig(
  role: UserRolesArray,
): MemberTierConfig | null {
  const knownRole = assertKnownUserRole(role); // Ensure role is recognized in our system
  // Only allow upgradeable roles
  if (!UPGRADEABLE_ROLES.includes(knownRole)) {
    return null;
  }
  // Access tiers config for membership from application configuration
  const tiers = getSystemConfigSnapshot().membership?.tiers;
  if (!tiers) return null;
  // Return config for the knownRole or null if not defined in tiers
  return tiers[knownRole] ?? null;
}

// Request data required to initiate a payment
export interface PaymentRequest {
  userId: string;
  userEmail: string;
  targetRole: UserRolesArray;
  returnUrl: string;
  callbackUrl: string;
}

/**
 * Given the paid amount, attempts to resolve which membership tier
 * the amount matches. Used in webhooks to infer the user's intended upgrade.
 *
 * @param amount - The payment amount received
 * @returns The matching UserRolesArray or null if no match found
 */
export function resolveMembershipRoleFromAmount(amount: number): UserRolesArray | null {
  const tiers = getSystemConfigSnapshot().membership?.tiers;
  if (!tiers) return null;
  // Compare paid amount with known tier amounts (could improve to allow float errors?)
  if (tiers.member.amount === amount) return UserRolesArray.member;
  if (tiers.subscriber.amount === amount) return UserRolesArray.subscriber;
  return null;
}

// PaymentResponse shape for caller convenience
export interface PaymentResponse {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
}

// WebhookPayload shape (includes any other passed keys from WayForPay)
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
  [key: string]: any; // allows extension for unexpected fields
}

/**
 * Validates that all required environment configuration is set for WayForPay integration.
 * Throws with a helpful error if any expected configuration is missing.
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
  // TODO: In Next.js 16, recommend use of "process.env" via safeEnv or .env validation schema for runtime typing
}

/**
 * Generates the HMAC signature string for WayForPay authentication.
 * Concatenates data values by ';', then creates an md5 HMAC using secret key.
 *
 * @param data - Record of payment/service data (must match WayForPay specification order)
 * @returns Hex signature string for insertion into API payload
 */
function generateSignature(data: Record<string, any>): string {
  // Note: The order of Object.values must be consistent per WayForPay docs.
  // TODO: Consider explicit ordering by fields where signature mismatch occurs.
  const signatureString = Object.values(data).join(';');
  return crypto
    .createHmac('md5', WAYFORPAY_SECRET_KEY!)
    .update(signatureString)
    .digest('hex');
  // TODO: For stronger security, verify if WayForPay supports sha256 hmac in future.
}

/**
 * Verifies that the webhook payload includes the valid merchant signature.
 * Defensive: catches errors and logs, never throws.
 *
 * @param payload - WebhookPayload received from WayForPay
 * @returns True if merchantSignature matches, false otherwise.
 */
export function verifyWebhookSignature(payload: WebhookPayload): boolean {
  try {
    const { merchantSignature, ...data } = payload; // Remove provided signature from verification input
    const expectedSignature = generateSignature(data);
    return merchantSignature === expectedSignature;
  } catch (error) {
    logger.error('WayForPay: Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Initiates a payment with WayForPay for membership upgrade.
 * - Prepares a signed payload, sends to payment API and returns payment url for user redirect.
 * - Implements error handling and logs key lifecycle events.
 *
 * @param request - Info about who, what, and where to upgrade
 * @returns PaymentResponse indicating success/failure and paymentUrl (if any)
 */
// TODO: If upgrading to Next.js 16+ "fetch" can use built-in "fetch" with improved Request/Response typing.
export async function initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    validateConfig(); // Ensure API is configured

    const membershipConfig = getMembershipTierConfig(request.targetRole);
    if (!membershipConfig) {
      // Defensive: check target role is allowed and misconfig not occurred
      return {
        success: false,
        error: `Invalid target role: ${request.targetRole}`
      };
    }

    // Create a (mostly) unique orderId for mapping payments to users
    // Format: membership_<userId>_<ts>. 'ring_*' legacy support for backwards compatibility.
    const orderId = `membership_${request.userId}_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    // Prepare payment API request data per WayForPay specification
    // See https://wiki.wayforpay.com/page/registration-api for allowed keys
    const paymentData = {
      merchantAccount: WAYFORPAY_MERCHANT_ACCOUNT,
      merchantDomainName: WAYFORPAY_DOMAIN,
      orderReference: orderId,
      orderDate: timestamp, // seconds since epoch
      amount: membershipConfig.amount,
      currency: membershipConfig.currency,
      productName: [membershipConfig.description],
      productCount: [1],
      productPrice: [membershipConfig.amount],
      clientFirstName: request.userEmail.split('@')[0], // Fallback: take part before @ in email
      clientLastName: 'User', // Not collected: could prompt for full name down the line
      clientEmail: request.userEmail,
      clientPhone: '', // Not yet captured from user
      language: 'EN', // Could derive from current user locale
      returnUrl: request.returnUrl, // Where user goes after payment
      serviceUrl: request.callbackUrl // Where WayForPay posts status updates
    };

    // Generate merchant signature for API authorization
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

    // Make fetch request to the WayForPay API
    // TODO: Switch to next-native "fetch" (already standard for API routes, browsers in Next16+)
    const response = await fetch(WAYFORPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      // Log unexpected status codes
      throw new Error(`WayForPay API error: ${response.status} ${response.statusText}`);
    }

    // Parse API response JSON (should contain 'reason' and 'invoiceUrl' on success)
    const result = await response.json();

    if (result.reason === 'Ok') {
      logger.info('WayForPay: Payment initiated successfully', {
        orderId,
        paymentUrl: result.invoiceUrl
      });
      // All good: return success + url to redirect user
      return {
        success: true,
        paymentUrl: result.invoiceUrl,
        orderId
      };
    } else {
      // API returned a non-success reason; log and forward error
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
    // Catch all errors: log diagnostic details for ops
    logger.error('WayForPay: Error initiating payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Handles a successful payment (from webhook),
 * verifies the notification, infers the intended upgrade, performs the role change,
 * and logs outcome.
 *
 * @param payload - WebhookPayload sent to our callbackUrl from WayForPay
 * @returns true if upgrade was completed, false if anything goes wrong.
 */
export async function processSuccessfulPayment(payload: WebhookPayload): Promise<boolean> {
  try {
    // Step 1: Check webhook signature is valid (prevents spoofing)
    if (!verifyWebhookSignature(payload)) {
      logger.error('WayForPay: Invalid webhook signature');
      return false;
    }

    // Step 2: Only process *approved* transactions, ignore anything else
    if (payload.transactionStatus !== 'Approved') {
      logger.warn('WayForPay: Transaction not approved', {
        orderReference: payload.orderReference,
        status: payload.transactionStatus,
        reasonCode: payload.reasonCode
      });
      return false;
    }

    // Step 3: Parse orderReference to extract userId (should be "membership_<userId>_<ts>" or legacy "ring_*")
    const orderParts = payload.orderReference.split('_');
    const prefix = orderParts[0];
    if (orderParts.length < 3 || (prefix !== 'membership' && prefix !== 'ring')) {
      logger.error('WayForPay: Invalid order reference format', {
        orderReference: payload.orderReference
      });
      return false;
    }
    const userId = orderParts[1];

    // Step 4: Infer the intended user role from paid amount
    let targetRole: UserRolesArray | null = resolveMembershipRoleFromAmount(payload.amount);

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

    // Step 5: Upgrade the user role in system (prevents double-upgrade, usually must be idempotent)
    // NOTE: Only stores last 4 of cardPan for security. Consider storing more in PCI-compliant store if needed.
    const upgradeResult = await upgradeUserRole(userId, targetRole, {
      paymentReference: payload.orderReference,
      paymentAmount: payload.amount,
      paymentCurrency: payload.currency,
      authCode: payload.authCode,
      cardPan: payload.cardPan?.slice(-4) // Store only last 4 digits, prevent PCI risks
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
 * Gets payment status by order reference using WayForPay status API.
 * Used to check transaction progress/outcome asynchronously.
 * Returns an object with success flag, current status, or error message.
 *
 * @param orderReference - Unique order reference created during payment
 * @returns An object with { success, status, error? }
 */
export async function getPaymentStatus(orderReference: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  try {
    validateConfig();

    // Build status API request with necessary details
    const requestData = {
      merchantAccount: WAYFORPAY_MERCHANT_ACCOUNT,
      orderReference,
      apiVersion: 1
    };

    // Attach merchant signature
    const signature = generateSignature(requestData);
    const requestPayload = {
      ...requestData,
      merchantSignature: signature
    };

    // Query WayForPay API for transaction status
    // TODO: In Next.js 16+ use native fetch with improved streaming & error utilities if needed
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

    // Parse result with expected 'transactionStatus'
    const result = await response.json();

    return {
      success: true,
      status: result.transactionStatus // Use value as returned directly from API
    };

  } catch (error) {
    logger.error('WayForPay: Error getting payment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

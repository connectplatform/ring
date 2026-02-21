/**
 * WayForPay Store Payment Service
 * 
 * This service handles payment processing for store orders using WayForPay API.
 * It provides secure payment initiation, webhook handling, and vendor settlement integration.
 */

import { logger } from '@/lib/logger';
import crypto from 'crypto';
import type { CartItem, CheckoutInfo } from '@/features/store/types';

// WayForPay API Configuration
const WAYFORPAY_API_URL = 'https://api.wayforpay.com/api';
const WAYFORPAY_CHECKOUT_URL = 'https://secure.wayforpay.com/pay';

// GreenFood.live WayForPay Merchant Configuration
// Priority: Store-specific > General > Default GreenFood credentials
const WAYFORPAY_MERCHANT_ACCOUNT = process.env.WAYFORPAY_STORE_MERCHANT_ACCOUNT 
  || process.env.WAYFORPAY_MERCHANT_ACCOUNT 
  || 'greenfood_live1';

const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_STORE_SECRET_KEY 
  || process.env.WAYFORPAY_SECRET_KEY 
  || '49292617352e675713f2bb7e4cf0197bcb903b7d';

const WAYFORPAY_DOMAIN = process.env.WAYFORPAY_STORE_DOMAIN 
  || process.env.WAYFORPAY_DOMAIN 
  || 'greenfood.live';

// GreenFood merchant password (for API operations requiring password)
const WAYFORPAY_MERCHANT_PASSWORD = process.env.WAYFORPAY_MERCHANT_PASSWORD 
  || '5d28f775b036834737b538320d519b5c';

// Store payment configuration
export const STORE_PAYMENT_CONFIG = {
  currency: 'UAH',
  defaultLanguage: 'UK',
  paymentLifetime: 86400, // 24 hours in seconds
  holdTimeout: 1728000, // 20 days in seconds
  availablePaymentSystems: [
    'card',
    'googlePay', 
    'applePay',
    'privat24',
    'payParts',
    'payPartsMono',
    'payPartsPrivat'
  ].join(';')
};

export interface StorePaymentRequest {
  orderId: string;
  userId: string;
  userEmail: string;
  items: CartItem[];
  totalAmount: number;
  currency?: 'UAH' | 'USD' | 'EUR';
  shippingInfo: CheckoutInfo;
  returnUrl: string;
  webhookUrl: string;
  locale?: 'UK' | 'EN' | 'RU';
}

export interface StorePaymentResponse {
  success: boolean;
  paymentUrl?: string;
  wayforpayOrderId?: string;
  error?: string;
}

export interface StoreWebhookPayload {
  merchantAccount: string;
  orderReference: string;
  merchantSignature: string;
  amount: number;
  currency: string;
  authCode: string;
  email: string;
  phone: string;
  createdDate: number;
  processingDate: number;
  cardPan: string;
  cardType: string;
  issuerBankCountry: string;
  issuerBankName: string;
  recToken?: string;
  transactionStatus: string;
  reason: string;
  reasonCode: number;
  fee: number;
  paymentSystem: string;
  acquirerBankName?: string;
  cardProduct?: string;
  clientName?: string;
  [key: string]: any;
}

export interface VendorSettlement {
  vendorId: string;
  vendorEntityId: string;
  productIds: string[];
  subtotal: number;
  commission: number;
  commissionRate: number;
  netAmount: number;
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
function generateSignature(signatureString: string): string {
  return crypto
    .createHmac('md5', WAYFORPAY_SECRET_KEY!)
    .update(signatureString, 'utf8')
    .digest('hex');
}

/**
 * Creates signature string for purchase request
 */
function createPurchaseSignatureString(data: {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number;
  amount: number;
  currency: string;
  productName: string[];
  productCount: number[];
  productPrice: number[];
}): string {
  const parts = [
    data.merchantAccount,
    data.merchantDomainName,
    data.orderReference,
    data.orderDate.toString(),
    data.amount.toString(),
    data.currency
  ];
  
  // Add product arrays
  parts.push(...data.productName);
  parts.push(...data.productCount.map(c => c.toString()));
  parts.push(...data.productPrice.map(p => p.toString()));
  
  return parts.join(';');
}

/**
 * Creates signature string for webhook verification
 */
function createWebhookSignatureString(payload: StoreWebhookPayload): string {
  const parts = [
    payload.merchantAccount,
    payload.orderReference,
    payload.amount.toString(),
    payload.currency,
    payload.authCode,
    payload.cardPan,
    payload.transactionStatus,
    payload.reasonCode.toString()
  ];
  
  return parts.join(';');
}

/**
 * Verifies WayForPay webhook signature
 */
export function verifyStoreWebhookSignature(payload: StoreWebhookPayload): boolean {
  try {
    const signatureString = createWebhookSignatureString(payload);
    const expectedSignature = generateSignature(signatureString);
    return payload.merchantSignature === expectedSignature;
  } catch (error) {
    logger.error('WayForPay Store: Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Calculates vendor settlements for an order
 */
export async function calculateVendorSettlements(
  items: CartItem[],
  vendorTiers: Record<string, string>
): Promise<VendorSettlement[]> {
  // Group items by vendor
  const vendorGroups = new Map<string, CartItem[]>();
  
  for (const item of items) {
    const vendorId = item.product.productOwner || 'platform';
    if (!vendorGroups.has(vendorId)) {
      vendorGroups.set(vendorId, []);
    }
    vendorGroups.get(vendorId)!.push(item);
  }
  
  // Calculate settlements for each vendor
  const settlements: VendorSettlement[] = [];
  
  for (const [vendorId, vendorItems] of vendorGroups) {
    const vendorTier = vendorTiers[vendorId] || 'NEW';
    const commissionRate = getCommissionRateForTier(vendorTier);
    
    const subtotal = vendorItems.reduce((sum, item) => {
      const price = parseFloat(item.product.price);
      return sum + (price * item.quantity);
    }, 0);
    
    const commission = subtotal * (commissionRate / 100);
    const netAmount = subtotal - commission;
    
    settlements.push({
      vendorId,
      vendorEntityId: vendorItems[0].product.ownerEntityId || '',
      productIds: vendorItems.map(item => item.product.id),
      subtotal,
      commission,
      commissionRate,
      netAmount
    });
  }
  
  return settlements;
}

/**
 * Gets commission rate based on vendor tier
 */
function getCommissionRateForTier(tier: string): number {
  const rates: Record<string, number> = {
    'NEW': 20,
    'BASIC': 18,
    'VERIFIED': 16,
    'TRUSTED': 14,
    'PREMIUM': 12
  };
  return rates[tier] || 20;
}

/**
 * Initiates a store payment request with WayForPay
 */
export async function initiateStorePayment(request: StorePaymentRequest): Promise<StorePaymentResponse> {
  try {
    validateConfig();

    // Generate unique order reference
    const orderReference = `store_${request.orderId}_${Date.now()}`;
    const orderDate = Math.floor(Date.now() / 1000);
    
    // Prepare product data for WayForPay
    const productNames: string[] = [];
    const productCounts: number[] = [];
    const productPrices: number[] = [];
    
    for (const item of request.items) {
      productNames.push(item.product.name);
      productCounts.push(item.quantity);
      productPrices.push(parseFloat(item.product.price));
    }
    
    // If no items, add a single "Order" item
    if (productNames.length === 0) {
      productNames.push('Store Order');
      productCounts.push(1);
      productPrices.push(request.totalAmount);
    }
    
    // Prepare payment data
    const paymentData = {
      merchantAccount: WAYFORPAY_MERCHANT_ACCOUNT!,
      merchantDomainName: WAYFORPAY_DOMAIN!,
      merchantTransactionType: 'AUTO',
      merchantTransactionSecureType: 'AUTO',
      orderReference,
      orderDate,
      amount: request.totalAmount,
      currency: request.currency || STORE_PAYMENT_CONFIG.currency,
      productName: productNames,
      productCount: productCounts,
      productPrice: productPrices,
      clientFirstName: request.shippingInfo.firstName || '',
      clientLastName: request.shippingInfo.lastName || '',
      clientEmail: request.userEmail || request.shippingInfo.email || '',
      clientPhone: '',
      clientAddress: request.shippingInfo.address || '',
      clientCity: request.shippingInfo.city || '',
      language: request.locale || STORE_PAYMENT_CONFIG.defaultLanguage,
      returnUrl: request.returnUrl,
      serviceUrl: request.webhookUrl,
      paymentSystems: STORE_PAYMENT_CONFIG.availablePaymentSystems,
      defaultPaymentSystem: 'card',
      orderLifetime: STORE_PAYMENT_CONFIG.paymentLifetime,
      holdTimeout: STORE_PAYMENT_CONFIG.holdTimeout,
      apiVersion: 2
    };
    
    // Generate signature
    const signatureString = createPurchaseSignatureString(paymentData);
    const signature = generateSignature(signatureString);
    
    logger.info('WayForPay Store: Initiating payment request', {
      orderReference,
      orderId: request.orderId,
      userId: request.userId,
      amount: request.totalAmount,
      currency: paymentData.currency,
      itemCount: request.items.length
    });
    
    // Create payment form data
    const formData = new URLSearchParams();
    
    // Add all payment data fields
    formData.append('merchantAccount', paymentData.merchantAccount);
    formData.append('merchantDomainName', paymentData.merchantDomainName);
    formData.append('merchantSignature', signature);
    formData.append('merchantTransactionType', paymentData.merchantTransactionType);
    formData.append('merchantTransactionSecureType', paymentData.merchantTransactionSecureType);
    formData.append('orderReference', paymentData.orderReference);
    formData.append('orderDate', paymentData.orderDate.toString());
    formData.append('amount', paymentData.amount.toString());
    formData.append('currency', paymentData.currency);
    formData.append('language', paymentData.language);
    formData.append('returnUrl', paymentData.returnUrl);
    formData.append('serviceUrl', paymentData.serviceUrl);
    formData.append('paymentSystems', paymentData.paymentSystems);
    formData.append('defaultPaymentSystem', paymentData.defaultPaymentSystem);
    formData.append('orderLifetime', paymentData.orderLifetime.toString());
    formData.append('holdTimeout', paymentData.holdTimeout.toString());
    formData.append('apiVersion', paymentData.apiVersion.toString());
    
    // Add client data
    if (paymentData.clientFirstName) formData.append('clientFirstName', paymentData.clientFirstName);
    if (paymentData.clientLastName) formData.append('clientLastName', paymentData.clientLastName);
    if (paymentData.clientEmail) formData.append('clientEmail', paymentData.clientEmail);
    if (paymentData.clientAddress) formData.append('clientAddress', paymentData.clientAddress);
    if (paymentData.clientCity) formData.append('clientCity', paymentData.clientCity);
    
    // Add product arrays
    paymentData.productName.forEach(name => formData.append('productName[]', name));
    paymentData.productCount.forEach(count => formData.append('productCount[]', count.toString()));
    paymentData.productPrice.forEach(price => formData.append('productPrice[]', price.toString()));
    
    // For mobile/API integration, we need to get the payment URL
    // WayForPay doesn't provide a direct API for this, so we'll return the checkout URL with form data
    const paymentUrl = `${WAYFORPAY_CHECKOUT_URL}?${formData.toString()}`;
    
    logger.info('WayForPay Store: Payment URL generated successfully', {
      orderReference,
      orderId: request.orderId
    });
    
    return {
      success: true,
      paymentUrl,
      wayforpayOrderId: orderReference
    };
    
  } catch (error) {
    logger.error('WayForPay Store: Error initiating payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Processes a successful store payment from webhook
 */
export async function processStorePaymentWebhook(payload: StoreWebhookPayload): Promise<{
  success: boolean;
  orderId?: string;
  settlements?: VendorSettlement[];
  error?: string;
}> {
  try {
    // Verify webhook signature
    if (!verifyStoreWebhookSignature(payload)) {
      logger.error('WayForPay Store: Invalid webhook signature');
      return { success: false, error: 'Invalid signature' };
    }
    
    // Extract order ID from reference
    const orderParts = payload.orderReference.split('_');
    if (orderParts.length < 3 || orderParts[0] !== 'store') {
      logger.error('WayForPay Store: Invalid order reference format', {
        orderReference: payload.orderReference
      });
      return { success: false, error: 'Invalid order reference' };
    }
    
    const orderId = orderParts[1];
    
    // Check transaction status
    if (payload.transactionStatus !== 'Approved') {
      logger.warn('WayForPay Store: Transaction not approved', {
        orderReference: payload.orderReference,
        status: payload.transactionStatus,
        reasonCode: payload.reasonCode,
        reason: payload.reason
      });
      return { 
        success: false, 
        orderId,
        error: `Transaction ${payload.transactionStatus}: ${payload.reason}` 
      };
    }
    
    logger.info('WayForPay Store: Processing successful payment', {
      orderId,
      amount: payload.amount,
      currency: payload.currency,
      orderReference: payload.orderReference,
      paymentSystem: payload.paymentSystem
    });
    
    return {
      success: true,
      orderId,
      settlements: [] // Will be calculated by the service layer with actual order data
    };
    
  } catch (error) {
    logger.error('WayForPay Store: Error processing payment webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Gets payment status from WayForPay
 */
export async function getStorePaymentStatus(orderReference: string): Promise<{
  success: boolean;
  status?: string;
  transactionStatus?: string;
  amount?: number;
  currency?: string;
  error?: string;
}> {
  try {
    validateConfig();
    
    const requestData = {
      merchantAccount: WAYFORPAY_MERCHANT_ACCOUNT!,
      orderReference,
      merchantSignature: ''
    };
    
    // Generate signature for status request
    const signatureString = `${requestData.merchantAccount};${requestData.orderReference}`;
    requestData.merchantSignature = generateSignature(signatureString);
    
    const response = await fetch(`${WAYFORPAY_API_URL}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      throw new Error(`WayForPay API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.reasonCode === 1100) {
      return {
        success: true,
        status: 'found',
        transactionStatus: result.transactionStatus,
        amount: result.amount,
        currency: result.currency
      };
    } else {
      return {
        success: false,
        error: result.reason || 'Transaction not found'
      };
    }
    
  } catch (error) {
    logger.error('WayForPay Store: Error getting payment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Initiates a refund for a store payment
 */
export async function refundStorePayment(
  orderReference: string,
  amount: number,
  currency: string,
  comment: string
): Promise<{
  success: boolean;
  refundId?: string;
  error?: string;
}> {
  try {
    validateConfig();
    
    const requestData = {
      merchantAccount: WAYFORPAY_MERCHANT_ACCOUNT!,
      orderReference,
      amount,
      currency,
      comment,
      merchantSignature: ''
    };
    
    // Generate signature for refund request
    const signatureString = `${requestData.merchantAccount};${requestData.orderReference};${requestData.amount};${requestData.currency}`;
    requestData.merchantSignature = generateSignature(signatureString);
    
    logger.info('WayForPay Store: Initiating refund', {
      orderReference,
      amount,
      currency,
      comment
    });
    
    const response = await fetch(`${WAYFORPAY_API_URL}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      throw new Error(`WayForPay API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.reasonCode === 1100) {
      logger.info('WayForPay Store: Refund initiated successfully', {
        orderReference,
        refundId: result.orderReference
      });
      
      return {
        success: true,
        refundId: result.orderReference
      };
    } else {
      logger.error('WayForPay Store: Refund failed', {
        orderReference,
        reason: result.reason,
        reasonCode: result.reasonCode
      });
      
      return {
        success: false,
        error: result.reason || 'Refund failed'
      };
    }
    
  } catch (error) {
    logger.error('WayForPay Store: Error processing refund:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

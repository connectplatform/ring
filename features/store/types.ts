import { 
  ProductListingType, 
  ProductStatus, 
  InventorySyncStrategy,
  FulfillmentStatus 
} from '@/constants/store'

// Inventory Sync Configuration
export interface InventorySync {
  enabled: boolean
  strategy: InventorySyncStrategy
  lastSyncTime?: string
  syncFrequency: number // in minutes
}

// Pricing Strategy Configuration
export interface PricingStrategy {
  basePrice: number
  dynamicPricing: boolean
  channelMarkup?: Record<string, number> // storeId -> markup percentage
  bulkDiscounts?: Array<{
    minQuantity: number
    discountPercent: number
  }>
  minimumAdvertisedPrice?: number
}

// Commission Structure
export interface CommissionStructure {
  platformCommission: number // percentage
  referralCommission?: number // percentage
  customSplits?: Array<{
    recipientId: string
    percentage: number
    description: string
  }>
}

// Fulfillment Options
export interface FulfillmentOptions {
  merchantFulfilled: boolean
  platformFulfilled: boolean
  dropshipEnabled: boolean
  fulfillmentSLA: number // in hours
}

// Product Compliance
export interface ProductCompliance {
  requiresAgeVerification: boolean
  restrictedRegions?: string[]
  certifications?: Array<{
    name: string
    issuer: string
    expiryDate?: string
  }>
  intellectualPropertyStatus?: 'owned' | 'licensed' | 'pending' | 'none'
}

export type TokenCurrency = 'RING' | 'DAAR' | 'DAARION'
export type FiatCurrency = 'UAH' | 'USD' | 'EUR'
export type StoreCurrency = TokenCurrency | FiatCurrency

export interface StoreProduct {
  id: string
  name: string
  description?: string
  price: string
  currency: StoreCurrency
  inStock: boolean
  category?: string
  tags?: string[]
  relatedProductIds?: string[]
  
  // Multi-vendor fields
  productListedAt?: string[] // Array of storeIDs where listed (default: ['1'])
  productOwner?: string // userID of product owner
  ownerEntityId?: string // Entity ID owning the product
  storeId?: string // Primary store for inventory context
  listingType?: ProductListingType
  inventorySync?: InventorySync
  pricingStrategy?: PricingStrategy
  commissionStructure?: CommissionStructure
  fulfillmentOptions?: FulfillmentOptions
  productCompliance?: ProductCompliance
  status?: ProductStatus
}

export interface CartItem {
  product: StoreProduct
  quantity: number
}

export interface CheckoutInfo {
  firstName: string
  lastName: string
  email?: string
  address?: string
  city?: string
  notes?: string
  phone?: string
  postalCode?: string
  country?: string
}

// Payment-related types
export type PaymentMethod = 'wayforpay' | 'stripe' | 'crypto' | 'credit'
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded'
export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'closed' | 'escalated'

export interface StorePayment {
  method: PaymentMethod
  status: PaymentStatus
  wayforpayOrderId?: string
  wayforpayTransactionId?: string
  stripeSessionId?: string
  cryptoTxHash?: string
  amount: number
  currency: string
  paidAt?: string
  failureReason?: string
  refundedAmount?: number
  cardLast4?: string
  cardType?: string
  paymentSystem?: string
}

export interface StoreOrder {
  id: string
  userId: string
  items: CartItem[]
  subtotal: number
  tax?: number
  shipping?: number
  total: number
  status: 'new' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled'
  payment?: StorePayment
  shippingInfo: CheckoutInfo
  vendorSettlements?: VendorSettlement[]
  createdAt: string
  updatedAt?: string
  completedAt?: string
  notes?: string
}

export interface VendorSettlement {
  vendorId: string
  vendorEntityId: string
  productIds: string[]
  subtotal: number
  commission: number
  commissionRate: number
  netAmount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  processedAt?: string
  payoutMethod?: string
  payoutReference?: string
}

export interface PaymentTransaction {
  id: string
  orderId: string
  userId: string
  vendorId?: string
  gatewayId: 'wayforpay' | 'stripe' | 'crypto'
  gatewayTransactionId: string
  amount: number
  currency: string
  status: PaymentStatus
  method: PaymentMethod
  cardLast4?: string
  cardType?: string
  refundedAmount?: number
  disputeStatus?: DisputeStatus
  metadata?: Record<string, any>
  createdAt: string
  updatedAt?: string
}

export interface Refund {
  id: string
  transactionId: string
  orderId: string
  amount: number
  reason: string
  status: RefundStatus
  processedBy?: string
  processedAt?: string
  gatewayRefundId?: string
  vendorApproval?: boolean
  createdAt: string
}

export interface Dispute {
  id: string
  transactionId: string
  orderId: string
  buyerId: string
  vendorId: string
  reason: string
  status: DisputeStatus
  evidence?: Array<{
    type: string
    description: string
    url?: string
    submittedBy: string
    submittedAt: string
  }>
  resolution?: {
    decision: 'buyer_favor' | 'vendor_favor' | 'split' | 'cancelled'
    amount?: number
    notes: string
    resolvedBy: string
    resolvedAt: string
  }
  mediatorId?: string
  createdAt: string
  resolvedAt?: string
}

export interface StoreAdapter {
  listProducts(): Promise<StoreProduct[]>
  checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }>
}

// Extended order-related types (P0)
export interface PaymentInfo {
  method: 'stripe' | 'crypto' | 'cod'
  status: 'pending' | 'paid' | 'failed'
  txHash?: string
  stripeSessionId?: string
}

export interface ShippingLocation {
  id?: string
  name?: string
  address?: string
  settlementName?: string
  regionName?: string
}

export interface ShippingInfo {
  provider?: 'nova-post' | 'manual' | 'pickup'
  location?: ShippingLocation | null
}

export interface OrderItem {
  productId: string
  name: string
  price: string
  currency: StoreCurrency
  quantity: number
  // Multi-vendor fields
  vendorId?: string
  storeId?: string
  commissionAmount?: number
}

export interface OrderTotalsByCurrency {
  DAAR?: number
  DAARION?: number
  RING?: number
}

// Vendor Order Split
export interface VendorOrder {
  vendorId: string
  storeId: string
  items: OrderItem[]
  subtotal: number
  commission: number
  vendorPayout: number
  fulfillmentStatus: FulfillmentStatus
  trackingInfo?: {
    carrier?: string
    trackingNumber?: string
    estimatedDelivery?: string
  }
  metadata?: {
    referralCode?: string
    [key: string]: any
  }
}

// Settlement Status
export interface SettlementStatus {
  platformFeePaid: boolean
  vendorPayoutsPending: string[] // vendor IDs
  vendorPayoutsComplete: string[] // vendor IDs
  disputeStatus?: 'none' | 'open' | 'resolved' | 'escalated'
}

// Cross-Border Information
export interface CrossBorderInfo {
  originCountry: string
  destinationCountry: string
  customsValue: number
  dutiesPaid: boolean
  customsDocuments?: string[]
}

export interface Order {
  id: string
  userId?: string
  items: OrderItem[]
  totals: OrderTotalsByCurrency
  checkoutInfo: CheckoutInfo
  shipping?: ShippingInfo
  payment?: PaymentInfo
  status: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled'
  createdAt: string
  updatedAt?: string
  
  // Multi-vendor fields
  vendorOrders?: VendorOrder[]
  settlementStatus?: SettlementStatus
  crossBorderInfo?: CrossBorderInfo
}

export type AdminOrdersSearchParams = {
  status?: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled';
  page?: string;
  limit?: string;
  sort?: string;
  sortOrder?: string;
  search?: string;
  startAfter?: string;
  endBefore?: string;
  orderBy?: string;
  orderByDirection?: string;
  orderByField?: string;
};

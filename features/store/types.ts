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

// Product Variant Types
export interface VariantOption {
  value: string
  label: string
  available: boolean
  stock?: number
  priceModifier?: number
  colorHex?: string
}

export interface ProductVariant {
  name: string
  options: VariantOption[]
}

export type VendorTier = 'NEW' | 'BASIC' | 'VERIFIED' | 'TRUSTED' | 'PREMIUM'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'


export interface StoreProduct {
  id: string
  name: string
  description?: string
  price: string
  currency: StoreCurrency
  inStock: boolean

  // P0 Critical Fields (Phase 2: Multi-vendor marketplace - 2025-11-04)
  sku?: string // Stock Keeping Unit (inventory tracking, barcode scanning)
  slug?: string // SEO-friendly URL
  longDescription?: string // Rich product content for detail pages
  reorderPoint?: number // Auto-reorder trigger level
  vendorTier?: VendorTier // Vendor trust tier
  commissionRate?: number // Platform commission % (12-20)
  approvalStatus?: ApprovalStatus // Main Store moderation status
  approvedBy?: string // Admin who approved
  approvedAt?: string // Approval timestamp
  rejectionReason?: string // Rejection reason if rejected

  // Extended product fields for detailed product pages
  images?: string[]
  vendorName?: string
  stock?: number
  allowPreorder?: boolean // Allow preorders when out of stock (stock=0)
  featured?: boolean
  rating?: number
  reviewCount?: number
  billingPeriod?: 'one-time' | 'monthly' | 'yearly'
  specifications?: Record<string, any>
  digitalProduct?: boolean
  instantDelivery?: boolean
  shipping?: {
    method?: string
    weight?: string
    dimensions?: string
    origin?: string
    included?: boolean
  }

  // Product Variants (Phase 1: Product page wiring)
  variants?: ProductVariant[]

  relatedProductIds?: string[]

  // AI-powered features (vector search for similar products)
  embedding?: number[] // 128D vector embedding for semantic similarity
  category?: string // Product category for better matching
  tags?: string[] // Tags for enhanced search and recommendations

  // ERP Extension: Vendor and quality data
  vendorProfile?: any // ExtendedVendorProfile - vendor information
  qualityBadges?: string[] // Quality certification badges
  trustScore?: number // Vendor trust score (0-100)
  sustainabilityRating?: number // Environmental impact rating
  aiRecommended?: boolean // AI recommendation flag
  complianceStatus?: {
    fsma?: boolean
    organic?: boolean
    fairTrade?: boolean
  }

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
  selectedVariants?: Record<string, string> // Phase 2: variant name -> value
  finalPrice?: number // Price including variant modifiers
  isPreorder?: boolean // Flag for preorder items (stock=0 at time of cart add)
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
  createProduct(product: Partial<StoreProduct> & { vendorId: string }): Promise<StoreProduct>
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

export interface StoreProduct {
  id: string
  name: string
  description?: string
  price: string
  currency: 'DAAR' | 'DAARION'
  inStock: boolean
  category?: string
  tags?: string[]
  relatedProductIds?: string[]
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
  currency: 'DAAR' | 'DAARION'
  quantity: number
}

export interface OrderTotalsByCurrency {
  DAAR?: number
  DAARION?: number
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

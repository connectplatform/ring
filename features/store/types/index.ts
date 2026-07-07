/** 
 * This is the central location for all store types.
 * */

import type { SupportedCurrencies } from '@/lib/ring-config-types'; 
export type StoreCurrency = Record<SupportedCurrencies, { symbol: string, name: SupportedCurrencies }>; // Type for store currency
// TODO: add zod to store currency types 
// TODO: add EnabledStoreCurrencies and/or MerchantAcceptedCurrencies per selected CardProcessor config (stripe and wayforpay)

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: StoreCurrency;
}
/**
 * STORE ADAPTER INTERFACE AND IMPLEMENTATION
 * Store-specific operations for products and checkout
 */

// Import StoreProduct from main types
import type { CartItem, CheckoutInfo } from '@/features/store/types'

export interface OrderItem {
  productId: string
  name: string
  price: string
  currency: StoreCurrency
  quantity: number
}

export interface OrderTotalsByCurrency {
  [currency: string]: number
}

export interface Order {
  id: string
  items: OrderItem[]
  totals: OrderTotalsByCurrency
  checkoutInfo: CheckoutInfo
  status: string
  createdAt: string
}
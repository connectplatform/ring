/**
 * UAH Pricing Service
 * 
 * Handles Ukrainian Hryvnia (UAH) currency operations including
 * conversion, formatting, and pricing calculations for the Ukrainian market.
 */

import { logger } from '@/lib/logger'
import type { StoreProduct } from '@/features/store/types'

// Currency conversion rates (will be fetched from API in production)
const DEFAULT_RATES = {
  USD_TO_UAH: 37.50,
  EUR_TO_UAH: 40.50,
  RING_TO_UAH: 10.00, // Placeholder rate for RING token
  DAAR_TO_UAH: 5.00,  // Placeholder rate for DAAR token
  DAARION_TO_UAH: 2.50 // Placeholder rate for DAARION token
}

export interface ConversionRate {
  from: string
  to: string
  rate: number
  timestamp: string
}

export interface PriceFormatOptions {
  showCurrency?: boolean
  decimals?: number
  thousandsSeparator?: string
  decimalSeparator?: string
}

/**
 * UAH Pricing Service
 */
export const UAHPricingService = {
  /**
   * Converts an amount from one currency to UAH
   */
  async convertToUAH(amount: number, fromCurrency: string): Promise<number> {
    try {
      // If already in UAH, return as is
      if (fromCurrency === 'UAH') {
        return amount
      }
      
      // Get conversion rate
      const rate = await this.getConversionRate(fromCurrency, 'UAH')
      
      // Convert and round to 2 decimal places
      const converted = amount * rate
      return Math.round(converted * 100) / 100
      
    } catch (error) {
      logger.error('UAHPricing: Error converting to UAH', {
        amount,
        fromCurrency,
        error
      })
      throw error
    }
  },

  /**
   * Converts an amount from UAH to another currency
   */
  async convertFromUAH(amount: number, toCurrency: string): Promise<number> {
    try {
      // If target is UAH, return as is
      if (toCurrency === 'UAH') {
        return amount
      }
      
      // Get conversion rate
      const rate = await this.getConversionRate('UAH', toCurrency)
      
      // Convert and round to appropriate decimal places
      const converted = amount * rate
      const decimals = ['USD', 'EUR'].includes(toCurrency) ? 2 : 4
      return Math.round(converted * Math.pow(10, decimals)) / Math.pow(10, decimals)
      
    } catch (error) {
      logger.error('UAHPricing: Error converting from UAH', {
        amount,
        toCurrency,
        error
      })
      throw error
    }
  },

  /**
   * Gets conversion rate between two currencies
   */
  async getConversionRate(from: string, to: string): Promise<number> {
    try {
      // Check if we have a direct rate
      const directKey = `${from}_TO_${to}` as keyof typeof DEFAULT_RATES
      if (DEFAULT_RATES[directKey]) {
        return DEFAULT_RATES[directKey]
      }
      
      // Check if we have an inverse rate
      const inverseKey = `${to}_TO_${from}` as keyof typeof DEFAULT_RATES
      if (DEFAULT_RATES[inverseKey]) {
        return 1 / DEFAULT_RATES[inverseKey]
      }
      
      // If both currencies are not UAH, convert through UAH
      if (from !== 'UAH' && to !== 'UAH') {
        const fromToUah = await this.getConversionRate(from, 'UAH')
        const uahToTarget = await this.getConversionRate('UAH', to)
        return fromToUah * uahToTarget
      }
      
      // TODO: Implement real-time rate fetching from API
      // For now, return a default rate
      logger.warn('UAHPricing: No conversion rate found, using default', {
        from,
        to
      })
      return 1
      
    } catch (error) {
      logger.error('UAHPricing: Error getting conversion rate', {
        from,
        to,
        error
      })
      throw error
    }
  },

  /**
   * Formats a price in UAH with proper currency symbol
   */
  formatUAH(amount: number, options: PriceFormatOptions = {}) {
    const {
      showCurrency = true,
      decimals = 2,
      thousandsSeparator = ',',
      decimalSeparator = '.'
    } = options
    
    // Round to specified decimal places
    const rounded = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals)
    
    // Split into integer and decimal parts
    const parts = rounded.toFixed(decimals).split('.')
    
    // Add thousands separators
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator)
    
    // Join with decimal separator
    const formatted = parts.join(decimalSeparator)
    
    // Add currency symbol if requested
    return showCurrency ? `₴${formatted}` : formatted
  },

  /**
   * Converts product prices to UAH
   */
  async getUAHPricing(products: StoreProduct[]): Promise<StoreProduct[]> {
    try {
      const convertedProducts = await Promise.all(
        products.map(async (product) => {
          // Skip if already in UAH (extend allowed currencies at call-site)
          if ((product as any).currency === 'UAH') {
            return product as StoreProduct
          }
          
          // Convert price to UAH
          const priceInUAH = await this.convertToUAH(
            parseFloat(product.price),
            (product as any).currency || 'USD'
          )
          
          return {
            ...product,
            // Preserve original values for reference where type permits
            // StoreProduct in this codebase currently limits currency to RING/DAAR/DAARION,
            // callers using UAH should widen the type at call-site.
            price: String(priceInUAH)
          } as StoreProduct
        })
      )
      
      return convertedProducts
    } catch (error) {
      logger.error('UAHPricing: Error converting product prices', error)
      throw error
    }
  },

  /**
   * Calculates VAT (PDV) for Ukrainian market
   */
  calculateVAT(amount: number, rate: number = 20) {
    // Ukrainian VAT is typically 20%
    const vatMultiplier = rate / 100
    const vat = amount * vatMultiplier
    const gross = amount + vat
    
    return {
      net: Math.round(amount * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      gross: Math.round(gross * 100) / 100
    }
  },

  /**
   * Applies bulk discount based on quantity (Ukrainian market preferences)
   */
  applyBulkDiscount(unitPrice: number, quantity: number) {
    const originalTotal = unitPrice * quantity
    let discountPercent = 0
    
    // Ukrainian market typical bulk discounts
    if (quantity >= 100) {
      discountPercent = 15
    } else if (quantity >= 50) {
      discountPercent = 10
    } else if (quantity >= 20) {
      discountPercent = 7
    } else if (quantity >= 10) {
      discountPercent = 5
    } else if (quantity >= 5) {
      discountPercent = 3
    }
    
    const discount = originalTotal * (discountPercent / 100)
    const finalTotal = originalTotal - discount
    
    return {
      originalTotal: Math.round(originalTotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
      discountPercent
    }
  },

  /**
   * Validates Ukrainian payment amount limits
   */
  validatePaymentAmount(amount: number, currency: string = 'UAH') {
    // Convert to UAH if needed (simple approximation for validation)
    const amountInUAH = currency === 'UAH' ? amount : amount * DEFAULT_RATES.USD_TO_UAH
    
    // Ukrainian payment regulations
    const MIN_PAYMENT = 1 // 1 UAH minimum
    const MAX_PAYMENT_CARD = 150000 // 150,000 UAH for card payments
    const MAX_PAYMENT_CASH = 50000 // 50,000 UAH for cash (regulatory limit)
    
    if (amountInUAH < MIN_PAYMENT) {
      return {
        valid: false,
        reason: `Minimum payment amount is ${this.formatUAH(MIN_PAYMENT)}`
      }
    }
    
    if (amountInUAH > MAX_PAYMENT_CARD) {
      return {
        valid: false,
        reason: `Maximum payment amount is ${this.formatUAH(MAX_PAYMENT_CARD)}`
      }
    }
    
    return { valid: true }
  },

  /**
   * Gets localized price display for Ukrainian market
   */
  getLocalizedPriceDisplay(
    amount: number, 
    currency: string = 'UAH',
    locale: 'uk' | 'en' = 'uk'
  ): string {
    if (currency === 'UAH') {
      if (locale === 'uk') {
        // Ukrainian format: 1 234,56 ₴
        return this.formatUAH(amount, {
          showCurrency: true,
          decimals: 2,
          thousandsSeparator: ' ',
          decimalSeparator: ','
        }) + ' грн'
      } else {
        // English format: ₴1,234.56
        return this.formatUAH(amount)
      }
    } else {
      // For non-UAH currencies, use standard format
      const symbols: Record<string, string> = {
        USD: '$',
        EUR: '€',
        RING: 'RING',
        DAAR: 'DAAR',
        DAARION: 'DAARION'
      }
      
      const symbol = symbols[currency] || currency
      return `${symbol}${amount.toFixed(2)}`
    }
  },

  /**
   * Calculates delivery cost for Ukrainian regions
   */
  calculateDeliveryUAH(
    region: string,
    weight: number, // in kg
    deliveryType: 'nova_poshta' | 'ukrposhta' | 'courier' = 'nova_poshta'
  ): number {
    // Base rates in UAH
    const baseRates = {
      nova_poshta: { base: 50, perKg: 5, express: 30 },
      ukrposhta: { base: 30, perKg: 3, express: 0 },
      courier: { base: 100, perKg: 10, express: 50 }
    } as const
    
    const rate = baseRates[deliveryType]
    let cost = rate.base + (weight * rate.perKg)
    
    // Add regional surcharge
    const remoteSurcharge: Record<string, number> = {
      'Zakarpattia': 20,
      'Chernivtsi': 15,
      'Ivano-Frankivsk': 15,
      'Crimea': 0, // Not available
      'Donetsk': 30, // Limited service
      'Luhansk': 30  // Limited service
    }
    
    if (remoteSurcharge[region]) {
      cost += remoteSurcharge[region]
    }
    
    return Math.round(cost * 100) / 100
  }
}

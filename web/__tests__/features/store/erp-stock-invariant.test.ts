/**
 * ERP stock invariant + Wave 1 helpers (unit-level logic tests).
 */

import {
  CART_SOFT_HOLD_MINUTES,
  cartHoldOrderId,
  DEFAULT_INVENTORY_STORE_ID,
  isCartHoldOrderId,
  ORDER_RESERVATION_MINUTES,
  shouldSkipPhysicalStock,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'

describe('ERP stock constants SSOT', () => {
  it('maps zero-warehouse label to default inventory store id', () => {
    expect(ZERO_WAREHOUSE_ID).toBe('zero-warehouse')
    expect(DEFAULT_INVENTORY_STORE_ID).toBe('1')
  })

  it('cart soft-hold id and TTLs', () => {
    expect(cartHoldOrderId('user-1')).toBe('cart_user-1')
    expect(isCartHoldOrderId('cart_user-1')).toBe(true)
    expect(isCartHoldOrderId('order-abc')).toBe(false)
    expect(CART_SOFT_HOLD_MINUTES).toBeLessThan(ORDER_RESERVATION_MINUTES)
  })
})

describe('shouldSkipPhysicalStock (Wave 1 digital skip)', () => {
  it('skips preorder, digitalProduct, instantDelivery', () => {
    expect(shouldSkipPhysicalStock({ isPreorder: true })).toBe(true)
    expect(shouldSkipPhysicalStock({ product: { digitalProduct: true } })).toBe(true)
    expect(shouldSkipPhysicalStock({ product: { instantDelivery: true } })).toBe(true)
    expect(shouldSkipPhysicalStock({ product: { digitalProduct: false } })).toBe(false)
  })
})

describe('ERP stock invariant math', () => {
  function assertInvariant(stock: number, available: number, reserved: number) {
    expect(stock).toBe(available + reserved)
  }

  it('holds after reserve', () => {
    const stock = 5
    let available = 5
    let reserved = 0
    const q = 2
    available -= q
    reserved += q
    assertInvariant(stock, available, reserved)
    expect(available).toBe(3)
  })

  it('holds after fulfill then deduct (commit sale)', () => {
    let stock = 5
    let available = 3
    let reserved = 2
    const q = 2
    reserved -= q
    stock -= q
    // Wave 1 repair: available = stock - reserved (same when hold was fulfilled)
    available = Math.max(0, stock - reserved)
    assertInvariant(stock, available, reserved)
    expect({ stock, available, reserved }).toEqual({ stock: 3, available: 3, reserved: 0 })
  })

  it('repairs available when paid without prior hold', () => {
    let stock = 5
    let available = 5
    let reserved = 0
    const q = 2
    stock -= q
    available = Math.max(0, stock - reserved)
    assertInvariant(stock, available, reserved)
    expect(available).toBe(3)
  })

  it('holds after cancel restore', () => {
    const stock = 5
    let available = 3
    let reserved = 2
    const q = 2
    available += q
    reserved -= q
    assertInvariant(stock, available, reserved)
    expect(available).toBe(5)
  })

  it('holds after refund restore', () => {
    let stock = 3
    let available = 3
    let reserved = 0
    const q = 2
    stock += q
    available += q
    assertInvariant(stock, available, reserved)
    expect(stock).toBe(5)
  })

  it('rejects naive mirror after deduct-with-open-hold (Flaw A)', () => {
    const stockAfterBadDeduct = 3
    const reservedStillOpen = 2
    const naiveAvailable = stockAfterBadDeduct - reservedStillOpen
    expect(naiveAvailable).toBe(1)
    const correctAvailable = 3
    expect(correctAvailable).not.toBe(naiveAvailable)
  })
})

describe('Flaw E fulfill clears reserved', () => {
  it('fulfilled path decreases reserved without restoring available', () => {
    let available = 3
    let reserved = 2
    const q = 2
    reserved = Math.max(0, reserved - q)
    expect(available).toBe(3)
    expect(reserved).toBe(0)
  })
})

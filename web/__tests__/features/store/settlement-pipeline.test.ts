import { calculateCommission } from '@/features/store/services/settlement'
import type { VendorOrder } from '@/features/store/types'
import type { VendorProfile } from '@/features/store/types/vendor'

describe('settlement pipeline commission wiring', () => {
  const vendor: VendorProfile = {
    id: 'vendor_entity1',
    entityId: 'entity1',
    userId: 'user1',
    storeTier: 'starter',
  } as VendorProfile

  it('applies referral commission when referralCode is in vendor order metadata', () => {
    const vendorOrder: VendorOrder = {
      vendorId: 'entity1',
      storeId: 'entity1',
      items: [
        {
          productId: 'p1',
          name: 'Test',
          price: '100',
          currency: 'UAH',
          quantity: 1,
        },
      ],
      subtotal: 100,
      commission: 0,
      vendorPayout: 0,
      fulfillmentStatus: 'pending' as const,
      metadata: { referralCode: 'ABC123' },
    }

    const breakdown = calculateCommission(vendorOrder, vendor)
    expect(breakdown.referralCommission).toBeGreaterThan(0)
    expect(breakdown.referralEffectivePercent).toBeDefined()
  })

  it('skips referral commission without referral metadata', () => {
    const vendorOrder: VendorOrder = {
      vendorId: 'entity1',
      storeId: 'entity1',
      items: [
        {
          productId: 'p1',
          name: 'Test',
          price: '100',
          currency: 'UAH',
          quantity: 1,
        },
      ],
      subtotal: 100,
      commission: 0,
      vendorPayout: 0,
      fulfillmentStatus: 'pending' as const,
    }

    const breakdown = calculateCommission(vendorOrder, vendor)
    expect(breakdown.referralCommission).toBe(0)
  })
})

import { StorePaymentsService } from '../../../services/store/payments-service'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Firestore mock capturing updates
const updates: any[] = []
jest.mock('@/lib/firebase-admin.server', () => {
  return {
    getAdminDb: async () => ({
      collection: (_name: string) => ({
        doc: (id: string) => ({
          set: async (data: any) => { updates.push({ id, data }) }
        })
      })
    })
  }
})

beforeEach(() => { updates.length = 0 })

describe('StorePaymentsService updates', () => {
  it('marks order paid via Stripe', async () => {
    await StorePaymentsService.markOrderPaidStripe('ord_1', 'sess_123')
    expect(updates[0].id).toBe('ord_1')
    expect(updates[0].data.payment.method).toBe('stripe')
    expect(updates[0].data.payment.status).toBe('paid')
    expect(updates[0].data.status).toBe('paid')
  })

  it('marks order failed via Stripe', async () => {
    await StorePaymentsService.markOrderFailedStripe('ord_2', 'sess_456')
    expect(updates[0].id).toBe('ord_2')
    expect(updates[0].data.payment.status).toBe('failed')
  })

  it('records crypto payment as paid', async () => {
    await StorePaymentsService.recordCryptoPayment('ord_3', '0xabc')
    expect(updates[0].id).toBe('ord_3')
    expect(updates[0].data.payment.method).toBe('crypto')
    expect(updates[0].data.status).toBe('paid')
  })
})



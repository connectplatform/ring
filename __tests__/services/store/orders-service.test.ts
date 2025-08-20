import { StoreOrdersService } from '../../../services/store/orders-service'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Minimal Firestore admin mock
jest.mock('@/lib/firebase-admin.server', () => {
  const docs: any[] = Array.from({ length: 55 }).map((_, i) => ({
    id: `ord_${i + 1}`,
    data: () => ({ userId: 'u1', createdAt: `2025-01-0${(i % 9) + 1}T00:00:00Z` })
  }))

  const collection = (name: string) => ({
    where: (_f: string, _op: any, _val: any) => ({
      orderBy: (_f2: string, _dir: any) => ({
        limit: (n: number) => ({
          get: async () => ({ docs: docs.slice(0, n) }),
          startAfter: (_doc: any) => ({ get: async () => ({ docs: docs.slice(20, 20 + n) }) })
        })
      })
    }),
    doc: (id: string) => ({ get: async () => ({ exists: true, id, data: () => ({ userId: 'u1' }) }) })
  })

  return {
    getAdminDb: async () => ({ collection, batch: () => ({ commit: async () => {} }) })
  }
})

describe('StoreOrdersService pagination', () => {
  it('returns first page with lastVisible', async () => {
    const { items, lastVisible } = await StoreOrdersService.listOrdersForUser('u1', { limit: 20 })
    expect(items).toHaveLength(20)
    expect(lastVisible).toBe('ord_20')
  })

  it('returns next page after cursor', async () => {
    const page1 = await StoreOrdersService.listOrdersForUser('u1', { limit: 20 })
    const page2 = await StoreOrdersService.listOrdersForUser('u1', { limit: 20, startAfter: page1.lastVisible! })
    expect(page2.items[0].id).toBe('ord_21')
  })
})



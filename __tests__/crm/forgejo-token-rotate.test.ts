/**
 * Forgejo monthly token rotate classification.
 */
import { runForgejoTokenRotate } from '@/features/crm/lab/forgejo-token-rotate-service'

jest.mock('@/features/crm/lab/forgejo-admin-client', () => ({
  isForgejoAdminConfigured: jest.fn(() => true),
}))

jest.mock('@/features/crm/lab/deployment-service', () => ({
  ProjectDeploymentService: {
    listSourceAuthRefs: jest.fn(),
    getByOrderId: jest.fn(),
  },
}))

jest.mock('@/features/crm/orders/project-order-service', () => ({
  ProjectOrderService: {
    getById: jest.fn(),
  },
}))

jest.mock('@/features/crm/lab/order-source-auth-service', () => ({
  rotateOrderSourceToken: jest.fn(async () => 'new-token'),
}))

const admin = jest.requireMock('@/features/crm/lab/forgejo-admin-client') as {
  isForgejoAdminConfigured: jest.Mock
}

const dep = jest.requireMock('@/features/crm/lab/deployment-service') as {
  ProjectDeploymentService: {
    listSourceAuthRefs: jest.Mock
    getByOrderId: jest.Mock
  }
}

const orders = jest.requireMock('@/features/crm/orders/project-order-service') as {
  ProjectOrderService: { getById: jest.Mock }
}

const authSvc = jest.requireMock('@/features/crm/lab/order-source-auth-service') as {
  rotateOrderSourceToken: jest.Mock
}

describe('runForgejoTokenRotate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    admin.isForgejoAdminConfigured.mockReturnValue(true)
  })

  it('rotates aged active tokens and skips young/revoked/inactive', async () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    const young = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

    dep.ProjectDeploymentService.listSourceAuthRefs.mockResolvedValue([
      { orderId: 'ord-old', robotUsername: 'order-src-a', revokedAt: null, mintedAt: old },
      { orderId: 'ord-young', robotUsername: 'order-src-b', revokedAt: null, mintedAt: young },
      { orderId: 'ord-rev', robotUsername: 'order-src-c', revokedAt: old, mintedAt: old },
      { orderId: 'ord-dead', robotUsername: 'order-src-d', revokedAt: null, mintedAt: old },
    ])

    dep.ProjectDeploymentService.getByOrderId.mockImplementation(async (id: string) => {
      const map: Record<string, unknown> = {
        'ord-old': {
          sourceAuth: {
            tokenEncrypted: 'v2:x',
            mintedAt: old,
            robotUsername: 'order-src-a',
          },
        },
        'ord-young': {
          sourceAuth: {
            tokenEncrypted: 'v2:x',
            mintedAt: young,
            robotUsername: 'order-src-b',
          },
        },
        'ord-rev': {
          sourceAuth: {
            tokenEncrypted: 'v2:revoked-still-present',
            revokedAt: old,
            mintedAt: old,
            robotUsername: 'order-src-c',
          },
        },
        'ord-dead': {
          sourceAuth: {
            tokenEncrypted: 'v2:x',
            mintedAt: old,
            robotUsername: 'order-src-d',
          },
        },
      }
      return map[id]
    })

    orders.ProjectOrderService.getById.mockImplementation(async (id: string) => {
      if (id === 'ord-dead') return { workStatus: 'canceled', paymentStatus: 'refunded' }
      return { workStatus: 'in_progress', paymentStatus: 'paid' }
    })

    const result = await runForgejoTokenRotate({ maxAgeDays: 30, limit: 10 })
    expect(result.rotated).toBe(1)
    expect(result.orderIds).toEqual(['ord-old'])
    expect(result.skippedYoung).toBe(1)
    expect(result.skippedRevoked).toBe(1)
    expect(result.skippedInactive).toBe(1)
    expect(authSvc.rotateOrderSourceToken).toHaveBeenCalledWith('ord-old')
  })

  it('fails closed when admin unset', async () => {
    admin.isForgejoAdminConfigured.mockReturnValue(false)
    const result = await runForgejoTokenRotate()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/ADMIN/)
  })
})

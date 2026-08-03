/**
 * Forgejo robot GC classification (dry-run).
 */
import { runForgejoRobotGc } from '@/features/crm/lab/forgejo-robot-gc-service'

jest.mock('@/features/crm/lab/forgejo-admin-client', () => ({
  isForgejoAdminConfigured: jest.fn(() => true),
  listUsers: jest.fn(),
  deleteUser: jest.fn(async () => undefined),
}))

jest.mock('@/features/crm/lab/deployment-service', () => ({
  ProjectDeploymentService: {
    listSourceAuthRefs: jest.fn(),
    patch: jest.fn(async () => ({})),
  },
}))

jest.mock('@/features/crm/orders/project-order-service', () => ({
  ProjectOrderService: {
    getById: jest.fn(),
  },
}))

const admin = jest.requireMock('@/features/crm/lab/forgejo-admin-client') as {
  isForgejoAdminConfigured: jest.Mock
  listUsers: jest.Mock
  deleteUser: jest.Mock
}

const dep = jest.requireMock('@/features/crm/lab/deployment-service') as {
  ProjectDeploymentService: { listSourceAuthRefs: jest.Mock; patch: jest.Mock }
}

const orders = jest.requireMock('@/features/crm/orders/project-order-service') as {
  ProjectOrderService: { getById: jest.Mock }
}

describe('runForgejoRobotGc', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    admin.isForgejoAdminConfigured.mockReturnValue(true)
  })

  it('dry-run: would_delete unreferenced old robot; skip young; skip active', async () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const young = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    admin.listUsers.mockResolvedValue([
      { id: 1, login: 'order-src-orphan', email: 'a@x', created: old },
      { id: 2, login: 'order-src-young', email: 'b@x', created: young },
      { id: 3, login: 'order-src-active', email: 'c@x', created: old },
      { id: 4, login: 'order-lab-write', email: 'd@x', created: old },
    ])
    dep.ProjectDeploymentService.listSourceAuthRefs.mockResolvedValue([
      {
        orderId: 'ord-live',
        robotUsername: 'order-src-active',
        revokedAt: null,
        mintedAt: old,
      },
    ])
    orders.ProjectOrderService.getById.mockResolvedValue({
      workStatus: 'in_progress',
      paymentStatus: 'paid',
    })

    const result = await runForgejoRobotGc({ dryRun: true })
    expect(result.success).toBe(true)
    expect(result.dryRun).toBe(true)
    expect(result.candidates).toBe(3) // order-src-* only
    const byLogin = Object.fromEntries(result.robots.map((r) => [r.login, r.action]))
    expect(byLogin['order-src-orphan']).toBe('would_delete')
    expect(byLogin['order-src-young']).toBe('skip_young')
    expect(byLogin['order-src-active']).toBe('skip_active')
    expect(admin.deleteUser).not.toHaveBeenCalled()
  })

  it('deletes revoked+canceled robot and clears sourceAuth', async () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    admin.listUsers.mockResolvedValue([
      { id: 1, login: 'order-src-dead', email: 'a@x', created: old },
    ])
    dep.ProjectDeploymentService.listSourceAuthRefs.mockResolvedValue([
      {
        orderId: 'ord-dead',
        robotUsername: 'order-src-dead',
        revokedAt: old,
        mintedAt: old,
      },
    ])
    orders.ProjectOrderService.getById.mockResolvedValue({
      workStatus: 'canceled',
      paymentStatus: 'refunded',
    })

    const result = await runForgejoRobotGc({ dryRun: false })
    expect(result.deleted).toBe(1)
    expect(admin.deleteUser).toHaveBeenCalledWith('order-src-dead')
    expect(dep.ProjectDeploymentService.patch).toHaveBeenCalledWith('ord-dead', {
      sourceAuth: null,
    })
  })
})

/**
 * Order Source Auth — per-order Forgejo PAT mint + cache + leak guard + mint lock.
 */
import { encryptLabSecret, decryptLabSecret } from '@/features/crm/lab/lab-secret-crypto'
import {
  robotUsernameForSlug,
  getOrderSourceToken,
  revokeOrderSourceToken,
  rotateOrderSourceToken,
  __clearOrderSourceTokenCacheForTests,
  invalidateOrderSourceTokenCache,
} from '@/features/crm/lab/order-source-auth-service'
import { ProjectDeploymentService, type SourceAuth } from '@/features/crm/lab/deployment-service'

jest.mock('@/lib/redis/set-nx', () => ({
  setNxPx: jest.fn(async () => ({ claimed: true, backend: 'memory' as const })),
  releaseNx: jest.fn(async () => undefined),
  hasNxKey: jest.fn(async () => ({ hit: false, backend: 'memory' as const })),
}))

jest.mock('@/features/crm/lab/forgejo-admin-client', () => ({
  isForgejoAdminConfigured: jest.fn(() => true),
  ensureRobotUser: jest.fn(async (username: string) => ({ username, created: true })),
  addRepoCollaborator: jest.fn(async () => undefined),
  mintUserToken: jest.fn(async () => ({
    id: 42,
    sha1: 'a'.repeat(40),
    tokenLastEight: 'aaaaaaaa',
    name: 'order-source-ord-1',
    scopes: ['write:repository'],
  })),
  deleteUserToken: jest.fn(async () => undefined),
  ForgejoAdminError: class ForgejoAdminError extends Error {
    status: number
    body?: string
    constructor(message: string, status: number, body?: string) {
      super(message)
      this.name = 'ForgejoAdminError'
      this.status = status
      this.body = body
    }
  },
}))

jest.mock('@/features/crm/lab/deployment-service', () => {
  const actual = jest.requireActual('@/features/crm/lab/deployment-service') as object
  return {
    ...actual,
    ProjectDeploymentService: {
      getByOrderId: jest.fn(),
      patch: jest.fn(),
      toMasked: (actual as { ProjectDeploymentService: { toMasked: unknown } })
        .ProjectDeploymentService,
    },
  }
})

const admin = jest.requireMock('@/features/crm/lab/forgejo-admin-client') as {
  isForgejoAdminConfigured: jest.Mock
  ensureRobotUser: jest.Mock
  addRepoCollaborator: jest.Mock
  mintUserToken: jest.Mock
  deleteUserToken: jest.Mock
}

const setNx = jest.requireMock('@/lib/redis/set-nx') as {
  setNxPx: jest.Mock
  releaseNx: jest.Mock
}

const depSvc = ProjectDeploymentService as unknown as {
  getByOrderId: jest.Mock
  patch: jest.Mock
}

describe('robotUsernameForSlug', () => {
  it('prefixes and sanitizes', () => {
    expect(robotUsernameForSlug('Acme_Corp!')).toBe('order-src-acme-corp')
  })

  it('caps at 40 chars', () => {
    const long = 'x'.repeat(80)
    expect(robotUsernameForSlug(long).length).toBeLessThanOrEqual(40)
    expect(robotUsernameForSlug(long).startsWith('order-src-')).toBe(true)
  })
})

describe('getOrderSourceToken', () => {
  const orderId = 'ord-test-1'
  const gitUrl = 'https://forge.ringdom.org/ringdom-clones/acme.git'

  beforeEach(() => {
    process.env.ORDER_LAB_ENCRYPTION_KEY =
      process.env.ORDER_LAB_ENCRYPTION_KEY || 'test-order-lab-key-32bytes-minimum!!'
    process.env.RING_FORGEJO_API_TOKEN = 'env-fallback-token-xxxxxxxxxxxxxxxxxxxx'
    __clearOrderSourceTokenCacheForTests()
    jest.clearAllMocks()
    admin.isForgejoAdminConfigured.mockReturnValue(true)
    setNx.setNxPx.mockResolvedValue({ claimed: true, backend: 'memory' })
  })

  it('mints and persists encrypted sourceAuth (v2 envelope) with repo restriction', async () => {
    depSvc.getByOrderId.mockResolvedValue({
      id: 'dep-1',
      orderId,
      gitUrl,
      sourceAuth: null,
    })
    depSvc.patch.mockImplementation(async (_id: string, patch: { sourceAuth?: SourceAuth }) => ({
      id: 'dep-1',
      orderId,
      gitUrl,
      ...patch,
    }))

    const result = await getOrderSourceToken(orderId)
    expect(result.source).toBe('per-order')
    expect(result.token).toBe('a'.repeat(40))
    expect(admin.mintUserToken).toHaveBeenCalledWith(
      'order-src-acme',
      expect.stringMatching(/^os-/),
      ['write:repository'],
      { repositories: [{ owner: 'ringdom-clones', name: 'acme' }] },
    )
    expect(setNx.setNxPx).toHaveBeenCalled()
    expect(setNx.releaseNx).toHaveBeenCalled()
    const patched = depSvc.patch.mock.calls[0][1] as { sourceAuth: SourceAuth }
    expect(patched.sourceAuth.tokenEncrypted.startsWith('v2:')).toBe(true)
    expect(decryptLabSecret(patched.sourceAuth.tokenEncrypted)).toBe('a'.repeat(40))
  })

  it('when mint lock not claimed, awaits peer sourceAuth', async () => {
    setNx.setNxPx.mockResolvedValueOnce({ claimed: false, backend: 'memory' })
    const enc = encryptLabSecret('p'.repeat(40))
    depSvc.getByOrderId
      .mockResolvedValueOnce({ id: 'dep-1', orderId, gitUrl, sourceAuth: null }) // unused in peer path first
      .mockResolvedValue({
        id: 'dep-1',
        orderId,
        gitUrl,
        sourceAuth: {
          robotUsername: 'order-src-acme',
          tokenId: 9,
          tokenLastEight: 'pppppppp',
          tokenEncrypted: enc,
          scope: 'write:repository',
          mintedAt: new Date().toISOString(),
        },
      })

    const result = await getOrderSourceToken(orderId)
    expect(result.token).toBe('p'.repeat(40))
    expect(admin.mintUserToken).not.toHaveBeenCalled()
  })

  it('tolerates robot already exists (ensureRobotUser created:false)', async () => {
    admin.ensureRobotUser.mockResolvedValueOnce({ username: 'order-src-acme', created: false })
    depSvc.getByOrderId.mockResolvedValue({ id: 'dep-1', orderId, gitUrl, sourceAuth: null })
    depSvc.patch.mockResolvedValue({ id: 'dep-1', orderId, gitUrl })
    const result = await getOrderSourceToken(orderId)
    expect(result.source).toBe('per-order')
  })

  it('returns cached token without re-decrypt', async () => {
    const token = 'b'.repeat(40)
    const encrypted = encryptLabSecret(token)
    depSvc.getByOrderId.mockResolvedValue({
      id: 'dep-1',
      orderId,
      gitUrl,
      sourceAuth: {
        robotUsername: 'order-src-acme',
        tokenId: 7,
        tokenLastEight: 'bbbbbbbb',
        tokenEncrypted: encrypted,
        scope: 'write:repository',
        mintedAt: new Date().toISOString(),
      },
    })

    const first = await getOrderSourceToken(orderId)
    expect(first.token).toBe(token)
    depSvc.getByOrderId.mockClear()
    const second = await getOrderSourceToken(orderId)
    expect(second.token).toBe(token)
    expect(depSvc.getByOrderId).not.toHaveBeenCalled()
  })

  it('falls back to env token when admin unset', async () => {
    admin.isForgejoAdminConfigured.mockReturnValue(false)
    depSvc.getByOrderId.mockResolvedValue({ id: 'dep-1', orderId, gitUrl, sourceAuth: null })
    const result = await getOrderSourceToken(orderId)
    expect(result.source).toBe('env-fallback')
    expect(result.token).toBe(process.env.RING_FORGEJO_API_TOKEN)
    expect(admin.mintUserToken).not.toHaveBeenCalled()
  })

  it('remint deletes prior token id and uses a unique token name', async () => {
    depSvc.getByOrderId.mockResolvedValue({
      id: 'dep-1',
      orderId,
      gitUrl,
      sourceAuth: {
        robotUsername: 'order-src-acme',
        tokenId: 11,
        tokenLastEight: 'oldtoken',
        tokenEncrypted: encryptLabSecret('e'.repeat(40)),
        scope: 'write:repository',
        mintedAt: '2026-07-01T00:00:00.000Z',
      },
    })
    depSvc.patch.mockResolvedValue({})

    const result = await getOrderSourceToken(orderId, { forceRemint: true })
    expect(result.source).toBe('per-order')
    expect(admin.deleteUserToken).toHaveBeenCalledWith('order-src-acme', 11)
    const mintArgs = admin.mintUserToken.mock.calls[0]
    expect(mintArgs[1]).toMatch(/^os-/)
    const patched = depSvc.patch.mock.calls[0][1] as { sourceAuth: SourceAuth }
    expect(patched.sourceAuth.rotatedAt).toBeTruthy()
  })
})

describe('toMasked leak guard', () => {
  it('strips sourceAuth from masked deployment', () => {
    const { ProjectDeploymentService: real } = jest.requireActual(
      '@/features/crm/lab/deployment-service',
    ) as typeof import('@/features/crm/lab/deployment-service')

    const encrypted = encryptLabSecret('secret-token')
    const dep = {
      id: 'dep-1',
      orderId: 'ord-1',
      edge: 'us' as const,
      envConfig: {},
      projectUrl: null,
      projectName: null,
      imageTag: null,
      gitUrl: 'https://forge.ringdom.org/ringdom-clones/acme.git',
      sourceAuth: {
        robotUsername: 'order-src-acme',
        tokenId: 1,
        tokenLastEight: 'deadbeef',
        tokenEncrypted: encrypted,
        scope: 'write:repository' as const,
        mintedAt: '2026-08-01T00:00:00.000Z',
      },
      namespace: 'ns',
      deploymentName: 'ns',
      secretName: 'ns-secrets',
      configMapName: 'ns-config',
      lastDeployAt: null,
      lastDeployStatus: 'idle' as const,
      lastError: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }

    const masked = real.toMasked(dep)
    expect(masked.deployment).not.toHaveProperty('sourceAuth')
    expect(JSON.stringify(masked)).not.toContain(encrypted)
  })
})

describe('rotation/revoke', () => {
  beforeEach(() => {
    process.env.ORDER_LAB_ENCRYPTION_KEY =
      process.env.ORDER_LAB_ENCRYPTION_KEY || 'test-order-lab-key-32bytes-minimum!!'
    process.env.RING_FORGEJO_API_TOKEN = 'env-fallback-token-xxxxxxxxxxxxxxxxxxxx'
    __clearOrderSourceTokenCacheForTests()
    jest.clearAllMocks()
    admin.isForgejoAdminConfigured.mockReturnValue(true)
    setNx.setNxPx.mockResolvedValue({ claimed: true, backend: 'memory' })
  })

  it('revokeOrderSourceToken clears cache and marks revokedAt', async () => {
    depSvc.getByOrderId.mockResolvedValue({
      id: 'dep-1',
      orderId: 'ord-rev',
      gitUrl: 'https://forge.ringdom.org/ringdom-clones/acme.git',
      sourceAuth: {
        robotUsername: 'order-src-acme',
        tokenId: 9,
        tokenLastEight: 'cafebabe',
        tokenEncrypted: encryptLabSecret('c'.repeat(40)),
        scope: 'write:repository',
        mintedAt: new Date().toISOString(),
      },
    })
    depSvc.patch.mockResolvedValue({})
    await revokeOrderSourceToken('ord-rev')
    expect(admin.deleteUserToken).toHaveBeenCalledWith('order-src-acme', 9)
    const patch = depSvc.patch.mock.calls[0][1] as { sourceAuth: SourceAuth }
    expect(patch.sourceAuth.revokedAt).toBeTruthy()
    expect(patch.sourceAuth.tokenEncrypted).toBe('')
  })

  it('rotateOrderSourceToken remints', async () => {
    depSvc.getByOrderId.mockResolvedValue({
      id: 'dep-1',
      orderId: 'ord-rot',
      gitUrl: 'https://forge.ringdom.org/ringdom-clones/acme.git',
      sourceAuth: {
        robotUsername: 'order-src-acme',
        tokenId: 3,
        tokenLastEight: '11111111',
        tokenEncrypted: encryptLabSecret('d'.repeat(40)),
        scope: 'write:repository',
        mintedAt: new Date().toISOString(),
      },
    })
    depSvc.patch.mockResolvedValue({})
    const token = await rotateOrderSourceToken('ord-rot')
    expect(token).toBe('a'.repeat(40))
    expect(admin.deleteUserToken).toHaveBeenCalled()
    expect(admin.mintUserToken).toHaveBeenCalled()
  })

  it('invalidateOrderSourceTokenCache is exported for 401 recovery', () => {
    expect(typeof invalidateOrderSourceTokenCache).toBe('function')
  })
})

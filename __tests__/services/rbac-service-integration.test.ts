// @ts-nocheck
/**
 * RBAC service integration tests — mocked auth() + db(), no live database.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

jest.mock('server-only', () => ({}))

const mockAuth = jest.fn()
const mockFindDocById = jest.fn()
const mockUpdateDoc = jest.fn()

jest.mock('@/auth', () => ({
  auth: () => mockAuth(),
}))

jest.mock('@/lib/database', () => ({
  db: () => ({
    findDocById: (...args: unknown[]) => mockFindDocById(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  }),
}))

jest.mock('@/features/entities/lib/entity-mutation-sync', () => ({
  syncEntityDiscovery: jest.fn(),
}))

jest.mock('@/features/opportunities/lib/opportunity-mutation-sync', () => ({
  syncOpportunityDiscovery: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

describe('entity RBAC service integration', () => {
  beforeEach(() => {
    jest.resetModules()
    mockAuth.mockReset()
    mockFindDocById.mockReset()
    mockUpdateDoc.mockReset()
  })

  it('getEntityById blocks subscriber on member visibility entity', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'subscriber-1', role: 'subscriber' },
    })
    mockFindDocById.mockResolvedValue({
      success: true,
      data: {
        id: 'entity-1',
        visibility: 'member',
        isConfidential: false,
        addedBy: 'owner-1',
      },
    })

    const { getEntityById, EntityAccessDeniedError } = await import(
      '@/features/entities/services/get-entity-by-id'
    )

    await expect(getEntityById('entity-1')).rejects.toBeInstanceOf(EntityAccessDeniedError)
  })

  it('updateEntity rejects member visibility escalation to confidential', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'owner-1', role: 'member' },
    })
    mockFindDocById.mockResolvedValue({
      success: true,
      data: { id: 'entity-1', addedBy: 'owner-1', visibility: 'member' },
    })

    const { updateEntity } = await import('@/features/entities/services/update-entity')

    await expect(
      updateEntity('entity-1', { visibility: 'confidential', isConfidential: true }),
    ).rejects.toThrow(/cannot set this visibility/)
    expect(mockUpdateDoc).not.toHaveBeenCalled()
  })
})

describe('opportunity RBAC service integration', () => {
  beforeEach(() => {
    jest.resetModules()
    mockAuth.mockReset()
    mockFindDocById.mockReset()
    mockUpdateDoc.mockReset()
  })

  it('updateOpportunity rejects member confidential escalation', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'owner-1', role: 'member' },
    })
    mockFindDocById.mockResolvedValue({
      success: true,
      data: {
        id: 'opp-1',
        createdBy: 'owner-1',
        isConfidential: false,
        visibility: 'member',
      },
    })

    const { updateOpportunity } = await import(
      '@/features/opportunities/services/update-opportunity'
    )

    await expect(
      updateOpportunity('opp-1', { isConfidential: true, visibility: 'confidential' }),
    ).rejects.toThrow(/cannot set this visibility/)
    expect(mockUpdateDoc).not.toHaveBeenCalled()
  })
})

import { jest } from '@jest/globals'
import { UserRole } from '@/features/auth/user-role'

const mockRead = jest.fn()
const mockUpdate = jest.fn()
const mockCreate = jest.fn()
const mockInitializeDatabase = jest.fn()
const mockGetDatabaseService = jest.fn()

jest.mock('@/lib/database', () => ({
  initializeDatabase: (...args) => mockInitializeDatabase(...args),
  getDatabaseService: () => mockGetDatabaseService(),
}))

jest.mock('crypto', () => ({
  default: {
    randomBytes: () => Buffer.alloc(32, 0xab),
  },
}))

describe('generateNonce', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInitializeDatabase.mockResolvedValue({ success: true })
    mockGetDatabaseService.mockReturnValue({
      read: mockRead,
      update: mockUpdate,
      create: mockCreate,
    })
  })

  it('creates a new wallet user when none exists', async () => {
    mockRead.mockResolvedValue({ success: true, data: null })
    mockCreate.mockResolvedValue({ success: true })

    const { generateNonce } = await import('@/features/wallet/services/generate-nonce')
    const address = '0x742d35Cc6634C0532925a3b8D8Cf45f6bB6E6C3e'

    const result = await generateNonce(address)

    expect(result.nonce).toHaveLength(64)
    expect(result.expires).toBeGreaterThan(Date.now())
    expect(mockCreate).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        role: UserRole.SUBSCRIBER,
        nonce: result.nonce,
        walletAddress: expect.any(String),
      }),
      { id: address.toLowerCase() },
    )
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('updates an existing wallet user', async () => {
    mockRead.mockResolvedValue({
      success: true,
      data: { data: { email: 'wallet@example.com', role: UserRole.SUBSCRIBER } },
    })
    mockUpdate.mockResolvedValue({ success: true })

    const { generateNonce } = await import('@/features/wallet/services/generate-nonce')
    const address = '0x742d35Cc6634C0532925a3b8D8Cf45f6bB6E6C3e'

    await generateNonce(address)

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

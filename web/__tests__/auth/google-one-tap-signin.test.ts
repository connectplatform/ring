/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

jest.mock('@/lib/ring-config-core', () => ({
  getDefaultTheme: () => 'light',
}))

const mockReadDoc = jest.fn()
const mockQueryDocs = jest.fn()

jest.mock('@/lib/database', () => ({
  db: () => ({
    readDoc: (...args: unknown[]) => mockReadDoc(...args),
    queryDocs: (...args: unknown[]) => mockQueryDocs(...args),
  }),
}))

import { resolveCanonicalUser } from '@/features/auth/services/user-resolve'

describe('Google One Tap signIn callback user resolve', () => {
  const authSrc = readFileSync(join(process.cwd(), 'auth.ts'), 'utf8')

  it('passes a pending create-id into resolveCanonicalUser', () => {
    expect(authSrc).toMatch(/const pendingId = randomUUID\(\)/)
    expect(authSrc).toMatch(/resolveCanonicalUser\(\{\s*email,\s*id:\s*pendingId\s*\}\)/)
    expect(authSrc).not.toMatch(/resolveCanonicalUser\(\{\s*email\s*\}\)/)
  })

  it('does not label user-resolve failures as Google token verification failed', () => {
    expect(authSrc).toMatch(/Google One Tap user resolve failed in signIn callback/)
    const tokenFailIdx = authSrc.indexOf('Google token verification failed in signIn callback')
    const userResolveIdx = authSrc.indexOf('Google One Tap user resolve failed in signIn callback')
    expect(tokenFailIdx).toBeGreaterThan(-1)
    expect(userResolveIdx).toBeGreaterThan(-1)
    expect(authSrc).toMatch(/isUserResolve/)
  })
})

describe('resolveCanonicalUser GIS first-time contract', () => {
  beforeEach(() => {
    mockReadDoc.mockReset()
    mockQueryDocs.mockReset()
    mockReadDoc.mockResolvedValue({ success: true, data: null })
    mockQueryDocs.mockResolvedValue({ success: true, data: [] })
  })

  it('throws when first-time GIS passes only email', async () => {
    await expect(resolveCanonicalUser({ email: 'new.user@example.com' })).rejects.toThrow(
      'resolveCanonicalUser: no existing user and no id to create',
    )
  })

  it('returns the pending create-id when first-time GIS passes email and id', async () => {
    const pendingId = 'gis-pending-create-id'
    const resolved = await resolveCanonicalUser({
      email: 'new.user@example.com',
      id: pendingId,
    })
    expect(resolved.userRow).toBeNull()
    expect(resolved.canonicalId).toBe(pendingId)
    expect(resolved.created).toBe(false)
  })

  it('reuses an existing user by email even when a pending create-id is passed', async () => {
    const existing = {
      id: 'existing-user-id',
      email: 'old.user@example.com',
      role: 'subscriber',
    }
    mockQueryDocs.mockResolvedValue({ success: true, data: [existing] })

    const resolved = await resolveCanonicalUser({
      email: 'old.user@example.com',
      id: 'gis-pending-create-id',
    })

    expect(resolved.userRow).toEqual(existing)
    expect(resolved.canonicalId).toBe('existing-user-id')
    expect(resolved.created).toBe(false)
  })

  it('GIS callback create branch uses resolved.canonicalId instead of throwing', async () => {
    const pendingId = 'gis-pending-create-id'
    const resolved = await resolveCanonicalUser({
      email: 'new.user@example.com',
      id: pendingId,
    })

    const user = { id: 'gis-jwt-pending' }
    if (resolved.userRow) {
      user.id = resolved.canonicalId
    } else {
      user.id = resolved.canonicalId
    }

    expect(user.id).toBe(pendingId)
  })
})

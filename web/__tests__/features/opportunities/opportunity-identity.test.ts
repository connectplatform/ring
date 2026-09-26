import { describe, expect, it } from '@jest/globals'
import { UserRolesArray } from '@/features/auth/user-role'
import {
  canSetAnonymousPoster,
  maskAnonymousOpportunity,
  shouldMaskAnonymousPoster,
} from '@/features/opportunities/lib/opportunity-identity'
import type { SerializedOpportunity } from '@/features/opportunities/types'

function baseRow(overrides: Partial<SerializedOpportunity> = {}): SerializedOpportunity {
  return {
    id: 'opp-1',
    type: 'offer',
    title: 'Test',
    isConfidential: false,
    anonymousPoster: true,
    briefDescription: 'Brief',
    createdBy: 'owner-1',
    organizationId: 'entity-1',
    dateCreated: new Date().toISOString(),
    dateUpdated: new Date().toISOString(),
    expirationDate: new Date().toISOString(),
    status: 'active',
    category: 'tech',
    tags: [],
    location: 'CK',
    requiredSkills: [],
    requiredDocuments: [],
    attachments: [],
    visibility: 'member',
    contactInfo: { linkedEntity: 'entity-1', contactAccount: 'owner-1' },
    applicantCount: 0,
    creator: { id: 'owner-1', name: 'Owner' },
    ...overrides,
  }
}

describe('opportunity-identity', () => {
  it('allows anonymousPoster only for confidential role on member|subscriber', () => {
    expect(canSetAnonymousPoster(UserRolesArray.confidential, 'member')).toBe(true)
    expect(canSetAnonymousPoster(UserRolesArray.confidential, 'subscriber')).toBe(true)
    expect(canSetAnonymousPoster(UserRolesArray.confidential, 'public')).toBe(false)
    expect(canSetAnonymousPoster(UserRolesArray.admin, 'member')).toBe(false)
    expect(canSetAnonymousPoster(UserRolesArray.member, 'member')).toBe(false)
  })

  it('does not mask owner or admin', () => {
    const row = baseRow()
    expect(shouldMaskAnonymousPoster(row, { viewerUserId: 'owner-1' })).toBe(false)
    expect(
      shouldMaskAnonymousPoster(row, {
        viewerUserId: 'admin-1',
        viewerRole: UserRolesArray.admin,
      }),
    ).toBe(false)
  })

  it('strips identity for other members', () => {
    const masked = maskAnonymousOpportunity(baseRow(), {
      viewerUserId: 'member-2',
      viewerRole: UserRolesArray.member,
    })
    expect(masked.createdBy).toBe('')
    expect(masked.organizationId).toBe('')
    expect(masked.creator).toBeUndefined()
    expect(masked.contactInfo.contactAccount).toBe('')
    expect(masked.anonymousPoster).toBe(true)
    expect(masked.isConfidential).toBe(false)
  })
})

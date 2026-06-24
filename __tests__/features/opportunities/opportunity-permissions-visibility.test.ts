// @ts-nocheck
import { describe, expect, it } from '@jest/globals'
import { UserRole } from '@/features/auth/user-role'
import {
  assertOpportunityVisibilityPatch,
  canCreateOpportunityConfidential,
  canDeleteOpportunity,
  canEditOpportunity,
  canSetOpportunityVisibility,
} from '@/features/opportunities/lib/opportunity-permissions'

describe('opportunity-permissions visibility', () => {
  it('confidential role can create confidential opportunities', () => {
    expect(canCreateOpportunityConfidential(UserRole.confidential)).toBe(true)
  })

  it('member cannot mark opportunity confidential', () => {
    expect(canSetOpportunityVisibility(UserRole.member, undefined, { isConfidential: true })).toBe(false)
  })

  it('superadmin can set confidential visibility', () => {
    expect(canSetOpportunityVisibility(UserRole.superadmin, 'confidential')).toBe(true)
  })

  it('superadmin can edit another users opportunity', () => {
    expect(canEditOpportunity(UserRole.superadmin, 'owner-1', 'admin-1')).toBe(true)
  })

  it('admin can edit another users opportunity', () => {
    expect(canEditOpportunity(UserRole.admin, 'owner-1', 'admin-1')).toBe(true)
  })

  it('owner can edit own opportunity', () => {
    expect(canEditOpportunity(UserRole.member, 'owner-1', 'owner-1')).toBe(true)
  })

  it('confidential role can edit non-owned opportunity', () => {
    expect(canEditOpportunity(UserRole.confidential, 'owner-1', 'conf-1')).toBe(true)
  })

  it('member cannot edit another users opportunity', () => {
    expect(canEditOpportunity(UserRole.member, 'owner-1', 'other-1')).toBe(false)
  })

  it('canDeleteOpportunity mirrors edit gate', () => {
    expect(canDeleteOpportunity(UserRole.superadmin, 'owner-1', 'admin-1')).toBe(true)
    expect(canDeleteOpportunity(UserRole.subscriber, 'owner-1', 'sub-1')).toBe(false)
  })

  it('assertOpportunityVisibilityPatch rejects subscriber escalation', () => {
    expect(() =>
      assertOpportunityVisibilityPatch(UserRole.subscriber, { isConfidential: true }),
    ).toThrow(/cannot set this visibility/)
  })
})

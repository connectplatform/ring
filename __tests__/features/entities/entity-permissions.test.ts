// @ts-nocheck
import { describe, expect, it } from '@jest/globals'
import { UserRole } from '@/features/auth/user-role'
import {
  assertEntityVisibilityPatch,
  canCreateEntity,
  canSetEntityVisibility,
} from '@/features/entities/lib/entity-permissions'

describe('entity-permissions', () => {
  it('member can create non-confidential entity', () => {
    expect(canCreateEntity(UserRole.member)).toBe(true)
  })

  it('subscriber cannot create entity', () => {
    expect(canCreateEntity(UserRole.subscriber)).toBe(false)
  })

  it('confidential role can create confidential entity', () => {
    expect(canCreateEntity(UserRole.confidential, { isConfidential: true })).toBe(true)
  })

  it('member cannot create confidential entity', () => {
    expect(canCreateEntity(UserRole.member, { isConfidential: true })).toBe(false)
  })

  it('member can set member visibility but not confidential', () => {
    expect(canSetEntityVisibility(UserRole.member, 'member')).toBe(true)
    expect(canSetEntityVisibility(UserRole.member, 'confidential')).toBe(false)
    expect(canSetEntityVisibility(UserRole.member, undefined, { isConfidential: true })).toBe(false)
  })

  it('admin can set confidential visibility', () => {
    expect(canSetEntityVisibility(UserRole.admin, 'confidential', { isConfidential: true })).toBe(true)
  })

  it('assertEntityVisibilityPatch rejects member escalation', () => {
    expect(() =>
      assertEntityVisibilityPatch(UserRole.member, { visibility: 'confidential' }),
    ).toThrow(/cannot set this visibility/)
  })
})

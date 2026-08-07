// @ts-nocheck
import { describe, expect, it } from '@jest/globals'
import { UserRolesArray } from '@/features/auth/user-role'
import {
  assertEntityVisibilityPatch,
  canCreateEntity,
  canSetEntityVisibility,
} from '@/features/entities/lib/entity-permissions'

describe('entity-permissions', () => {
  it('member can create non-confidential entity', () => {
    expect(canCreateEntity(UserRolesArray.member)).toBe(true)
  })

  it('subscriber cannot create entity', () => {
    expect(canCreateEntity(UserRolesArray.subscriber)).toBe(false)
  })

  it('confidential role can create confidential entity', () => {
    expect(canCreateEntity(UserRolesArray.confidential, { isConfidential: true })).toBe(true)
  })

  it('member cannot create confidential entity', () => {
    expect(canCreateEntity(UserRolesArray.member, { isConfidential: true })).toBe(false)
  })

  it('member can set member visibility but not confidential', () => {
    expect(canSetEntityVisibility(UserRolesArray.member, 'member')).toBe(true)
    expect(canSetEntityVisibility(UserRolesArray.member, 'confidential')).toBe(false)
    expect(canSetEntityVisibility(UserRolesArray.member, undefined, { isConfidential: true })).toBe(false)
  })

  it('admin can set confidential visibility', () => {
    expect(canSetEntityVisibility(UserRolesArray.admin, 'confidential', { isConfidential: true })).toBe(true)
  })

  it('assertEntityVisibilityPatch rejects member escalation', () => {
    expect(() =>
      assertEntityVisibilityPatch(UserRolesArray.member, { visibility: 'confidential' }),
    ).toThrow(/cannot set this visibility/)
  })
})

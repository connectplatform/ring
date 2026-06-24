// @ts-nocheck
import { describe, expect, it } from '@jest/globals'
import { UserRole } from '@/features/auth/user-role'
import {
  assertNewsVisibilityPatch,
  canCreateNewsArticle,
  canSetNewsVisibility,
} from '@/features/news/lib/news-permissions'

describe('news-permissions', () => {
  it('member can create news', () => {
    expect(canCreateNewsArticle(UserRole.member)).toBe(true)
  })

  it('subscriber cannot create news', () => {
    expect(canCreateNewsArticle(UserRole.subscriber)).toBe(false)
  })

  it('member can set member visibility but not confidential', () => {
    expect(canSetNewsVisibility(UserRole.member, 'member')).toBe(true)
    expect(canSetNewsVisibility(UserRole.member, 'confidential')).toBe(false)
  })

  it('admin can set site-wide visibility', () => {
    expect(canSetNewsVisibility(UserRole.admin, 'site-wide')).toBe(true)
  })

  it('assertNewsVisibilityPatch rejects member confidential escalation', () => {
    expect(() =>
      assertNewsVisibilityPatch(UserRole.member, { visibility: 'confidential' }),
    ).toThrow(/cannot set this news visibility/)
  })
})

// @ts-nocheck
import { describe, expect, it } from '@jest/globals'
import { UserRole } from '@/features/auth/user-role'
import {
  buildOpportunityVisibilityFilters,
  canViewOpportunity,
  getAllowedVisibilityValues,
} from '@/features/opportunities/lib/opportunity-visibility-filter'

describe('opportunity-visibility-filter', () => {
  it('subscriber sees public and subscriber visibility only', () => {
    expect(getAllowedVisibilityValues(UserRole.subscriber)).toEqual([
      'public',
      'subscriber',
    ])
  })

  it('admin has unrestricted visibility list', () => {
    expect(getAllowedVisibilityValues(UserRole.admin)).toBeNull()
  })

  it('subscriber cannot view member-only opportunity by id', () => {
    expect(
      canViewOpportunity(
        { visibility: 'member', isConfidential: false },
        { userRole: UserRole.subscriber },
      ),
    ).toBe(false)
  })

  it('member can view member visibility opportunity', () => {
    expect(
      canViewOpportunity(
        { visibility: 'member', isConfidential: false },
        { userRole: UserRole.member },
      ),
    ).toBe(true)
  })

  it('non-confidential role cannot view confidential opportunity', () => {
    expect(
      canViewOpportunity(
        { visibility: 'public', isConfidential: true },
        { userRole: UserRole.member },
      ),
    ).toBe(false)
  })

  it('buildOpportunityVisibilityFilters excludes confidential rows for subscribers', () => {
    const filters = buildOpportunityVisibilityFilters(UserRole.subscriber)
    expect(filters).toEqual(
      expect.arrayContaining([
        { field: 'visibility', operator: 'in', value: ['public', 'subscriber'] },
        { field: 'isConfidential', operator: '==', value: false },
      ]),
    )
  })
})

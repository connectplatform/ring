// @ts-nocheck
import { describe, expect, it } from '@jest/globals'
import { UserRole } from '@/features/auth/user-role'
import {
  buildEntityVisibilityFilters,
  canViewEntity,
  getAllowedEntityVisibilityValues,
  isEntityVisibleInDiscovery,
} from '@/features/entities/lib/entity-visibility-filter'

describe('entity-visibility-filter', () => {
  it('subscriber sees public and subscriber visibility only', () => {
    expect(getAllowedEntityVisibilityValues(UserRole.subscriber)).toEqual([
      'public',
      'subscriber',
    ])
  })

  it('admin has unrestricted visibility list', () => {
    expect(getAllowedEntityVisibilityValues(UserRole.admin)).toBeNull()
  })

  it('subscriber cannot view member-only entity by id', () => {
    expect(
      canViewEntity(
        { visibility: 'member', isConfidential: false },
        { userRole: UserRole.subscriber },
      ),
    ).toBe(false)
  })

  it('member can view member visibility entity', () => {
    expect(
      canViewEntity(
        { visibility: 'member', isConfidential: false },
        { userRole: UserRole.member },
      ),
    ).toBe(true)
  })

  it('non-confidential role cannot view confidential entity', () => {
    expect(
      canViewEntity(
        { visibility: 'public', isConfidential: true },
        { userRole: UserRole.member },
      ),
    ).toBe(false)
  })

  it('buildEntityVisibilityFilters excludes confidential rows for subscribers', () => {
    const filters = buildEntityVisibilityFilters(UserRole.subscriber)
    expect(filters).toEqual(
      expect.arrayContaining([
        { field: 'visibility', operator: 'in', value: ['public', 'subscriber'] },
        { field: 'isConfidential', operator: '==', value: false },
      ]),
    )
  })

  it('globally blocked entity hidden from subscriber in discovery', () => {
    expect(
      isEntityVisibleInDiscovery(
        {
          id: 'e1',
          visibility: 'public',
          isConfidential: false,
          moderationStatus: 'blocked',
        } as any,
        { userRole: UserRole.subscriber },
      ),
    ).toBe(false)
  })

  it('admin sees globally blocked entity in discovery', () => {
    expect(
      isEntityVisibleInDiscovery(
        {
          id: 'e1',
          visibility: 'public',
          isConfidential: false,
          moderationStatus: 'blocked',
        } as any,
        { userRole: UserRole.admin },
      ),
    ).toBe(true)
  })
})

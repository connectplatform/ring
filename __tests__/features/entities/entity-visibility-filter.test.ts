// @ts-nocheck
import { describe, expect, it } from '@jest/globals'
import { UserRolesArray } from '@/features/auth/user-role'
import {
  buildEntityVisibilityFilters,
  canViewEntity,
  getAllowedEntityVisibilityValues,
  isEntityVisibleInDiscovery,
} from '@/features/entities/lib/entity-visibility-filter'

describe('entity-visibility-filter', () => {
  it('subscriber sees public and subscriber visibility only', () => {
    expect(getAllowedEntityVisibilityValues(UserRolesArray.subscriber)).toEqual([
      'public',
      'subscriber',
    ])
  })

  it('admin has unrestricted visibility list', () => {
    expect(getAllowedEntityVisibilityValues(UserRolesArray.admin)).toBeNull()
  })

  it('subscriber cannot view member-only entity by id', () => {
    expect(
      canViewEntity(
        { visibility: 'member', isConfidential: false },
        { userRole: UserRolesArray.subscriber },
      ),
    ).toBe(false)
  })

  it('member can view member visibility entity', () => {
    expect(
      canViewEntity(
        { visibility: 'member', isConfidential: false },
        { userRole: UserRolesArray.member },
      ),
    ).toBe(true)
  })

  it('non-confidential role cannot view confidential entity', () => {
    expect(
      canViewEntity(
        { visibility: 'public', isConfidential: true },
        { userRole: UserRolesArray.member },
      ),
    ).toBe(false)
  })

  it('buildEntityVisibilityFilters excludes confidential rows for subscribers', () => {
    const filters = buildEntityVisibilityFilters(UserRolesArray.subscriber)
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
        { userRole: UserRolesArray.subscriber },
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
